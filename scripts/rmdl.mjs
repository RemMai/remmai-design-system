#!/usr/bin/env node
/**
 * RMDL v0.3 no-dependency governance CLI.
 * Commands: init new|refactor ; approve ; check ; audit ; version [--release]
 * Run with Node.js. Dependencies are managed with npm. AI must not automate owner approval.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import {execFileSync} from 'node:child_process';

const VERSION = '0.3.0';
const FIXED = Object.freeze({
  webFramework: 'react', language: 'typescript-strict', runtime: 'node', packageManager: 'npm',
  uiLibrary: 'heroui-v3', cssEngine: 'tailwind-v4', iconSet: 'lucide',
  designSystem: 'rmdl-core', sharedUiPackage: '@remmai/rmdl-ui', uiVersion: VERSION,
  dotnetTarget: 'net11.0',
});
const allowed = Object.freeze({
  operation: ['new', 'refactor'],
  productType: ['admin', 'data', 'portal', 'game', 'content', 'tool', 'service'],
  frontendMode: ['engineered', 'static-html', 'none'],
  frontendFramework: ['vite', 'next', 'none'],
  backendLanguage: ['dotnet', 'java', 'python', 'node', 'none'],
  productionDatabase: ['postgresql', 'mariadb', 'sqlite', 'none'],
  deployment: ['docker', 'linux', 'windows', 'hybrid', 'caddy-static', 'nginx-static', 'cloudflare-pages', 'oss-static', 'not-applicable'],
  migrationStrategy: ['not-applicable', 'incremental', 'rewrite'],
});
const ormDefaults = Object.freeze({dotnet:'freesql', java:'hibernate', python:'sqlalchemy', node:'drizzle', none:'none'});
const forbidden = [
  '@mui/material', '@mui/system', 'antd', '@chakra-ui/react', '@mantine/core',
  'bootstrap', 'react-bootstrap', 'primereact', 'semantic-ui-react',
  '@angular/core', 'vue', 'svelte', '@nextui-org/react', '@heroui/theme',
];

function getRoot(args) {
  const at = args.indexOf('--root');
  if (at >= 0 && !args[at + 1]) throw new Error('--root 缺少路径');
  return path.resolve(at >= 0 ? args[at + 1] : '.');
}
function readJSON(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); }
function err(result, text) { result.push(text); }
function validateSelection(config) {
  const errors = [];
  if (config.standardVersion !== VERSION) err(errors, `standardVersion 必须是 ${VERSION}`);
  if (!config.projectName || typeof config.projectName !== 'string') err(errors, '缺少 projectName');
  const s = config.selection ?? {};
  for (const [field, values] of Object.entries(allowed)) {
    if (!values.includes(s[field])) err(errors, `selection.${field} 不合法: ${String(s[field])}`);
  }
  for (const [key, value] of Object.entries(FIXED)) {
    if (config.fixed?.[key] !== value) err(errors, `fixed.${key} 必须为 ${value}`);
  }
  const v = config.versioning;
  if (v?.source !== 'VERSION' || v?.buildId !== 'git-commit') err(errors, 'versioning 必须绑定 source=VERSION 与 buildId=git-commit');
  const placements = s.frontendMode === 'none' ? ['none'] : ['footer', 'menu', 'header', 'changelog-page'];
  if (!placements.includes(v?.frontendPlacement)) err(errors, 'versioning.frontendPlacement 必须按 footer > menu > header > changelog-page 选择；无前端为 none');
  if (s.productType === 'service') {
    if (s.frontendMode !== 'none' || s.frontendFramework !== 'none') err(errors, 'service 类型必须 frontendMode=none 且 frontendFramework=none');
  } else if (s.frontendMode === 'none') {
    err(errors, '非 service 类型必须选择前端实现模式');
  } else if (s.frontendMode === 'static-html') {
    if (s.productType !== 'tool') err(errors, 'static-html 模式仅适用于 tool 类型轻量网页');
    if (s.frontendFramework !== 'none') err(errors, 'static-html 模式必须 frontendFramework=none');
    if (s.backendLanguage !== 'none' || s.productionDatabase !== 'none') err(errors, 'static-html 模式必须选择无后端和无生产数据库');
  } else if (s.frontendFramework === 'none') {
    err(errors, 'engineered 模式必须选择 vite 或 next');
  }
  if (s.operation === 'new' ? s.migrationStrategy !== 'not-applicable' : s.migrationStrategy === 'not-applicable') {
    err(errors, '新建项目 migrationStrategy=not-applicable；重构必须选 incremental/rewrite');
  }
  if (s.orm !== ormDefaults[s.backendLanguage]) {
    if (!(s.backendLanguage === 'dotnet' && s.orm === 'efcore')) {
      err(errors, `backendLanguage=${s.backendLanguage} 默认 ORM 必须是 ${ormDefaults[s.backendLanguage]}`);
    } else {
      // 例外不能由机器自行批准，需经受保护的审批记录。
      const ref = String(config.governance?.approvalReference || '');
      if (!ref.startsWith('ADR-')) err(errors, 'EF Core 例外需要先有 ADR 编号并在 approvalReference 以 ADR- 开头记录');
    }
  }
  if (s.backendLanguage === 'none' && s.productionDatabase !== 'none') err(errors, '无后端项目应将生产数据库选为 none');
  if (s.backendLanguage !== 'none' && s.productionDatabase === 'none') err(errors, '有后端项目必须明确选择生产数据库');
  const backendDeployments = ['docker', 'linux', 'windows', 'hybrid'];
  const staticDeployments = ['caddy-static', 'nginx-static', 'cloudflare-pages', 'oss-static'];
  if (s.backendLanguage === 'none' && s.frontendMode === 'none' && s.deployment !== 'not-applicable') {
    err(errors, '无前端、无后端项目应将 deployment 设为 not-applicable');
  } else if (s.backendLanguage === 'none' && s.frontendMode !== 'none' && !staticDeployments.includes(s.deployment)) {
    err(errors, '无后端 Web 项目必须选择静态托管目标：Caddy、Nginx、Cloudflare Pages 或 OSS');
  } else if (s.backendLanguage !== 'none' && !backendDeployments.includes(s.deployment)) {
    err(errors, '有后端项目必须选择 Docker、Linux、Windows 或混合部署');
  }
  if (config.governance?.state !== 'locked') err(errors, '项目未锁定：必须先完成用户审批（draft 不可交付）');
  if (!String(config.governance?.approvedBy || '').trim()) err(errors, '缺少治理审批者 approvedBy');
  if (!String(config.governance?.approvalReference || '').trim()) err(errors, '缺少可追溯审批记录 approvalReference');
  if (!String(config.governance?.approvedAt || '').trim()) err(errors, '缺少 approvedAt');
  return errors;
}
function majorVersion(value, major) {
  const s = String(value ?? '').trim();
  return new RegExp(`^(?:[~^]|>=)?${major}(?:[.]|$)`).test(s);
}
function traverse(dir, callback, relRoot) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (['node_modules', '.git', '.next', 'dist', 'build', 'bin', 'obj', 'vendor', 'coverage', 'generated', '__snapshots__'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) traverse(full, callback, relRoot);
    else if (entry.isFile()) callback(full, path.relative(relRoot, full).replaceAll(path.sep, '/'));
  }
}
function checkStaticWeb(root, errors) {
  const web = path.join(root, 'apps/web');
  const htmlPath = path.join(web, 'index.html');
  if (!fs.existsSync(htmlPath)) { err(errors, 'static-html 缺少 apps/web/index.html'); return; }
  const html = fs.readFileSync(htmlPath, 'utf8');
  if (!/href=["'](?:\.\/)?assets\/rmdl-tokens\.css["']/.test(html)) {
    err(errors, 'static-html index.html 必须加载 assets/rmdl-tokens.css');
  }
  const tokenCss = path.join(web, 'assets/rmdl-tokens.css');
  if (!fs.existsSync(tokenCss)) err(errors, 'static-html 缺少 apps/web/assets/rmdl-tokens.css（应来自锁定版本的 RMDL Tokens）');
  traverse(web, (file, rel) => {
    if (!/\.css$/.test(file) || rel === 'assets/rmdl-tokens.css') return;
    const css = fs.readFileSync(file, 'utf8');
    if (/#(?:[\da-f]{3,8})\b|\b(?:rgb|rgba|hsl|hsla|oklch)\s*\(/i.test(css)) {
      err(errors, `${rel} static-html CSS 不得硬编码颜色，应使用 --rmdl-* Token`);
    }
  }, web);
}
function checkWeb(root, config, errors) {
  if (config.selection.productType === 'service') return;
  if (config.selection.frontendMode === 'static-html') return checkStaticWeb(root, errors);
  const web = path.join(root, 'apps/web');
  const pkgPath = path.join(web, 'package.json');
  if (!fs.existsSync(pkgPath)) { err(errors, '缺少 apps/web/package.json（未完成前端初始化）'); return; }
  let pkg;
  try { pkg = readJSON(pkgPath); } catch (e) { err(errors, `无法读取 package.json: ${e.message}`); return; }
  const deps = {...pkg.dependencies, ...pkg.devDependencies};
  const needMajor = {'react':19, '@heroui/react':3, '@heroui/styles':3, 'tailwindcss':4};
  for (const [name, major] of Object.entries(needMajor)) {
    if (!majorVersion(deps[name], major)) err(errors, `apps/web 缺少 ${name} 主版本 ${major} 依赖（当前 ${String(deps[name])}）`);
  }
  if (!deps.typescript) err(errors, '缺少 TypeScript 依赖');
  if (!deps['lucide-react']) err(errors, '缺少 lucide-react 依赖');
  for (const sharedName of ['@remmai/rmdl-ui', '@remmai/rmdl-tokens']) {
    const sharedVersion = String(deps[sharedName] ?? '');
    if (!/^(?:0[.]3[.]0|(?:git\+https:\/\/|https:\/\/)[^\s]+#[a-f0-9]{7,40})$/.test(sharedVersion)) {
      err(errors, `${sharedName} 必须使用精确 0.3.0（含 npm workspace 本地包）或锁定 Git SHA；禁止浮动范围及 npm 不支持的 workspace: 协议`);
    }
  }
  const chosen = config.selection.frontendFramework;
  if (chosen === 'vite' && !deps.vite) err(errors, '选定 Vite 但未声明 vite 依赖');
  if (chosen === 'next' && !deps.next) err(errors, '选定 Next.js 但未声明 next 依赖');
  if (chosen === 'vite' && deps.next) err(errors, 'Vite 项目不得同时加入 Next.js 框架');
  if (chosen === 'next' && deps.vite) err(errors, 'Next.js 项目不得同时加入 Vite 作为另一个应用框架');
  for (const name of forbidden) if (deps[name]) err(errors, `禁止引入第二套 UI/前端框架: ${name}`);
  for (const name of Object.keys(deps)) if (name.startsWith('@mui/') || name.startsWith('@chakra-ui/')) err(errors, `禁止 UI 依赖: ${name}`);
  const tsconfigPath = path.join(web, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) err(errors, '缺少 apps/web/tsconfig.json');
  else {
    const source = fs.readFileSync(tsconfigPath, 'utf8');
    // 大多数 tsconfig 允许注释；此处检查 strict 显式开启，若改成复杂 JSONC 需使用工程 typecheck 做最终判断。
    if (!/"strict"\s*:\s*true\b/.test(source)) err(errors, 'TypeScript 必须显式 strict: true');
  }
  if (!fs.existsSync(path.join(root, 'package-lock.json')) && !fs.existsSync(path.join(web, 'package-lock.json'))) {
    err(errors, '缺少 package-lock.json，必须锁定 npm 安装结果');
  }
  if (fs.existsSync(path.join(root, 'package-lock.json')) && fs.existsSync(path.join(web, 'package-lock.json'))) {
    err(errors, '根工作区与 apps/web 不得重复维护 package-lock.json，请按 npm workspace 边界保留一份');
  }
  for (const p of [root, web]) {
    for (const lock of ['bun.lock','bun.lockb','yarn.lock','pnpm-lock.yaml','npm-shrinkwrap.json']) {
      if (fs.existsSync(path.join(p, lock))) err(errors, `同一工作区不得混用锁文件: ${path.relative(root,path.join(p,lock))}`);
    }
  }
  const src = path.join(web, 'src');
  let hasTailwind = false;
  let hasHero = false;
  let hasTokens = false;
  const scanFile = (file, rel) => {
    if (!/\.(?:css|scss|tsx|jsx|ts|js)$/.test(file) || /(?:\.test|\.spec)\.[tj]sx?$/.test(rel)) return;
    const code = fs.readFileSync(file,'utf8');
    // 常见违规模式阻断；更复杂的 CSS 色彩需配合 ESLint/Stylelint 与视觉审查。
    const lines = code.split(/\r?\n/);
    if (/\.css$/.test(file)) {
      hasTailwind ||= /@import\s+["']tailwindcss["']/.test(code);
      hasHero ||= /@import\s+["']@heroui\/styles["']/.test(code);
      hasTokens ||= /@import\s+["']@remmai\/rmdl-tokens\/colors\.css["']/.test(code);
      const heroImport = /@import\s+["']@heroui\/styles["']/.exec(code);
      const twImport = /@import\s+["']tailwindcss["']/.exec(code);
      if (heroImport && twImport && heroImport.index < twImport.index) {
        err(errors, `${rel} HeroUI styles 必须在 TailwindCSS 之后导入`);
      }
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\.(?:css|scss)$/.test(file) && /#[a-fA-F0-9]{3,8}(?![a-fA-F0-9])\b|\b(?:rgb|rgba|hsl|hsla|oklch)\s*\(/.test(line)) {
        err(errors, `${rel}:${i+1} CSS 硬编码颜色，应使用 --rmdl-* Token`);
      }
      if (/\b(?:bg|text|border|ring|from|to|via)-(?:red|blue|green|yellow|purple|pink|orange|indigo|teal|cyan|gray|slate|neutral|zinc|stone)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/.test(line)) {
        err(errors, `${rel}:${i+1} Tailwind 原生色板应改为 RMDL 语义 Token`);
      }
      if (/\b(?:bg|text|border|ring)-\[#[a-fA-F0-9]{3,8}\]/.test(line)) {
        err(errors, `${rel}:${i+1} Tailwind 任意硬编码颜色应改用 RMDL Token`);
      }
      if (/\b(?:color|backgroundColor|borderColor)\s*:\s*["'`]#[a-fA-F0-9]{3,8}\b/.test(line)) {
        err(errors, `${rel}:${i+1} JS 内联色值应改为 RMDL Token`);
      }
      if (/\.(?:tsx|jsx)$/.test(file)) {
        if (/(?:功能(?:介绍|说明|概述|特性|列表)|使用(?:说明|指南|指引)|模块(?:简介|说明)|核心功能|本页面支持|特性亮点)/.test(line) && !/^\s*(?:\/\/|\/\*|\*)/.test(line)) {
          err(errors, `${rel}:${i+1} 违规包含宣讲式/回显式功能说明文案（AI 冗余文案），后台只保留工作操作区`);
        }
      }
    }
    const isPage = /(^|\/)app\/(?:.*\/)?page\.tsx$/.test(rel) || /(^|\/)(?:pages|routes)\/.+\.tsx$/.test(rel);
    if (isPage && !code.includes('@remmai/rmdl-ui')) err(errors, `${rel} 页面必须直接导入统一 UI 核心包，防止独立造页`);
    if (isPage && !/<AppPage(?:\s|>)/.test(code)) err(errors, `${rel} 页面必须使用统一的 <AppPage> 页面容器`);
  };
  traverse(src, scanFile, root);
  traverse(path.join(root, 'packages/ui/src'), scanFile, root);
  if (!hasTailwind) err(errors, '没有在应用 CSS 中导入 Tailwind CSS v4');
  if (!hasHero) err(errors, '没有在应用 CSS 中导入 @heroui/styles');
  if (!hasTokens) err(errors, '没有在应用 CSS 中导入 @remmai/rmdl-tokens/colors.css');
}
/** Read the product version without confusing it with the standard/package version. */
function productVersion(root) {
  const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error('VERSION 必须为 MAJOR.MINOR.PATCH，例如 1.1.3（无 v 前缀/前导零）');
  return version;
}
function checkVersion(root, errors) {
  let version;
  try { version = productVersion(root); }
  catch (e) { err(errors, `产品版本读取失败：${e.message}`); }
  const file = path.join(root, 'CHANGELOG.md');
  if (!fs.existsSync(file)) err(errors, '缺少 CHANGELOG.md 产品更新记录');
  else if (version) {
    const escaped = version.replaceAll('.', '\\.');
    if (!new RegExp(`^##\\s+\\[?${escaped}\\]?(?:\\s|$)`, 'm').test(fs.readFileSync(file, 'utf8'))) {
      err(errors, `CHANGELOG.md 缺少当前版本 ${version} 的二级标题`);
    }
  }
}
/** Validate literal SDK/TFM declarations; compilation still verifies evaluated MSBuild settings. */
function checkDotnet(root, config, errors) {
  if (config.selection?.backendLanguage !== 'dotnet') return;
  try {
    const sdk = readJSON(path.join(root, 'global.json')).sdk;
    if (!/^11\.\d+\.\d+$/.test(sdk?.version ?? '') || sdk?.allowPrerelease !== false || sdk?.rollForward !== 'disable') {
      err(errors, 'global.json 必须锁定正式 11.x SDK，并设置 allowPrerelease=false、rollForward=disable');
    }
  } catch (e) { err(errors, `无法读取 .NET SDK 锁 global.json：${e.message}`); }
  let count = 0;
  traverse(root, (file, rel) => {
    if (!file.endsWith('.csproj')) return;
    count++;
    let text = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    if (!/<TargetFrameworks?>/.test(text)) {
      let dir = path.dirname(file);
      for (;;) {
        const props = path.join(dir, 'Directory.Build.props');
        if (fs.existsSync(props)) { text += fs.readFileSync(props, 'utf8').replace(/<!--[\s\S]*?-->/g, ''); break; }
        if (dir === root) break;
        dir = path.dirname(dir);
      }
    }
    const targets = [...text.matchAll(/<TargetFrameworks?>([^<]+)<\/TargetFrameworks?>/g)].flatMap(m => m[1].split(';').map(v => v.trim()));
    if (!targets.length || targets.some(v => !/^net11\.0(?:-[a-zA-Z0-9.]+)?$/.test(v))) err(errors, `${rel} 应用目标框架必须显式声明 net11.0（可在最近的 Directory.Build.props 中声明）`);
  }, root);
  if (!count) err(errors, '.NET 项目缺少 .csproj，尚未完成后端初始化');
}
/** Emit metadata once per build; never infer a revision from user-provided strings. */
function buildVersion(root, release) {
  const version = productVersion(root);
  const git = (...args) => execFileSync('git', ['-C', root, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  const gitCommit = git('rev-parse', '--verify', 'HEAD');
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(gitCommit)) throw new Error('无法获取完整 Git commit');
  const dirty = git('status', '--porcelain', '--untracked-files=normal').length > 0;
  if (release && dirty) throw new Error('发布构建拒绝脏工作区；提交产品版本及源码后再生成元数据');
  process.stdout.write(JSON.stringify({version, gitCommit, informationalVersion: `${version}+${gitCommit}${dirty ? '.dirty' : ''}`, dirty}, null, 2) + '\n');
}
function check(root, print=true) {
  const errors=[];
  const file=path.join(root,'rmdl.project.json');
  if (!fs.existsSync(file)) { err(errors, '缺少 rmdl.project.json；先 init/审批'); }
  else {
    let config;
    try { config=readJSON(file); } catch(e) { err(errors, `rmdl.project.json 解析失败：${e.message}`); }
    if (config) {
      errors.push(...validateSelection(config));
      checkVersion(root,errors);
      checkDotnet(root,config,errors);
      checkWeb(root,config,errors);
    }
  }
  if (print) {
    if (errors.length) {
      process.stderr.write(`\nRMDL CHECK FAILED (${errors.length}):\n${errors.map(e=>'  - '+e).join('\n')}\n`);
    } else process.stdout.write('RMDL CHECK PASSED（仅静态策略；仍需 typecheck/lint/test/视觉审核）\n');
  }
  return errors;
}
async function openQuestions() {
  return readline.createInterface({input: process.stdin, output:process.stdout});
}
async function choose(rl,label,choices) {
  process.stdout.write(`\n${label}\n${choices.map((s,i)=>`  ${i+1}. ${s}`).join('\n')}\n`);
  for (;;) {
    const v=(await rl.question('请选择数字（q=取消）：')).trim();
    if (v==='q') throw new Error('用户取消选型');
    const index=Number(v)-1;
    if (/^\d+$/.test(v) && index>=0 && index<choices.length) return choices[index].split(' — ')[0];
    process.stdout.write('无效选择，请重新选择。\n');
  }
}
async function init(root, operation) {
  if (!['new','refactor'].includes(operation)) throw new Error('用法：rmdl.mjs init new|refactor');
  const dest=path.join(root, 'rmdl.project.json');
  if (fs.existsSync(dest)) throw new Error('已有 rmdl.project.json，不覆盖锁定选型；变更请走审批/ADR');
  const rl=await openQuestions();
  try {
    const projectName=(await rl.question('项目名称（必填）：')).trim();
    if (!projectName) throw new Error('缺少项目名称');
    const productType=await choose(rl,'产品类型',[
      'admin — 管理后台','data — 数据平台','portal — 用户门户','game — 游戏管理/门户',
      'content — 博客/内容站','tool — 轻量网页/单页小工具','service — 纯后端服务（无 Web）',
    ]);
    const frontendMode=productType==='service'?'none':await choose(rl,'前端实现模式（两种模式均遵守 RMDL 视觉标准）',[
      'engineered — React 工程化，可构建为 OSS 静态产物','static-html — 原生 HTML/CSS/JS，目录直接上传 OSS（仅 Tool）',
    ]);
    const frontendFramework=frontendMode==='none'||frontendMode==='static-html'?'none':await choose(rl,'Web 构建/渲染框架',[
      'vite — 静态构建/交互型前端','next — 公开内容/SEO/SSR（静态 OSS 部署需确认导出兼容）',
    ]);
    const backendLanguage=frontendMode==='static-html'?'none':await choose(rl,'后端语言（由所有者决定）',[
      'dotnet — C# / ASP.NET Core','java — Java','python — Python',
      'node — Node.js + TypeScript','none — 无后端',
    ]);
    const productionDatabase=backendLanguage==='none'?'none':await choose(rl,'生产数据库',[
      'postgresql — 默认推荐','mariadb — MariaDB','sqlite — 适合明确轻量单机产品',
    ]);
    const deployment=backendLanguage==='none'
      ? frontendMode==='none'?'not-applicable':await choose(rl,'静态网页托管目标（不需要后端运行环境）',[
        'caddy-static — 自托管 Caddy','nginx-static — 自托管 Nginx',
        'cloudflare-pages — Cloudflare Pages','oss-static — OSS 静态网站托管',
      ])
      : await choose(rl,'后端应用部署形式',[
        'docker — 容器化','linux — Linux 原生','windows — Windows 原生','hybrid — 混合',
      ]);
    const migrationStrategy=operation==='new'?'not-applicable':await choose(rl,'重构迁移策略',[
      'incremental — 渐进迁移，默认推荐','rewrite — 完整重写（需额外风险评估）',
    ]);
    const config={
      $schema:'./policy/rmdl-project.schema.json',standardVersion:VERSION,projectName,
      selection:{operation,productType,frontendMode,frontendFramework,backendLanguage,
        orm:ormDefaults[backendLanguage],productionDatabase,deployment,migrationStrategy},
      fixed:{...FIXED},
      versioning:{source:'VERSION',buildId:'git-commit',frontendPlacement:frontendMode==='none'?'none':'changelog-page'},
      governance:{state:'draft',approvedBy:null,approvalReference:null,approvedAt:null},
    };
    writeJSON(dest, config);
    process.stdout.write('\n选型草稿已生成：rmdl.project.json\n版本位置暂填 changelog-page；按 footer > menu > header > changelog-page 复核布局后锁定。产品实现需 VERSION 与 CHANGELOG.md。\n下一步：请所有者审查，再执行 node scripts/rmdl.mjs approve。草稿状态禁止直接开发/交付。\n');
  } finally {rl.close();}
}
async function approve(root) {
  const dest=path.join(root,'rmdl.project.json');
  if (!fs.existsSync(dest)) throw new Error('找不到选型草稿，请先 init');
  const config=readJSON(dest);
  if (config.governance?.state === 'locked') throw new Error('配置已经锁定，不能重新自行批准');
  const invalid=validateSelection({...config,governance:{state:'locked',approvedBy:'[pending]',approvalReference:'[pending]',approvedAt:'[pending]'}}).filter(x=>!x.includes('EF Core'));
  if (invalid.length) throw new Error('选型非法：\n'+invalid.join('\n'));
  process.stdout.write('\n请项目所有者复核以下选型：\n'+JSON.stringify(config.selection,null,2)+'\n');
  const rl=await openQuestions();
  try {
    const name=(await rl.question('实际审核人（不能由 AI 代填）：')).trim();
    const ref=(await rl.question('可追溯审批记录（PR/工单/会议编号；EFCore 需 ADR- 前缀）：')).trim();
    const confirm=(await rl.question('明确同意以上全部选型，请输入 APPROVE RMDL：')).trim();
    if (!name || !ref || confirm !== 'APPROVE RMDL') throw new Error('未明确批准，保留草稿');
    config.governance={state:'locked',approvedBy:name,approvalReference:ref,approvedAt:new Date().toISOString()};
    const problems=validateSelection(config);
    if (problems.length) throw new Error('审批失败，草稿保持不变：\n' + problems.join('\n'));
    writeJSON(dest,config);
    process.stdout.write('选型已标记 locked。请继续使用受保护分支/指定审查者验证审批真实性；尚需脚手架与 CI 实施。\n');
  } finally {rl.close();}
}
function usage() {process.stdout.write('Usage: node scripts/rmdl.mjs init new|refactor | approve | check | audit | version [--release] [--root path]\n');}
async function main() {
  const [command, arg]=process.argv.slice(2);
  const root=getRoot(process.argv.slice(2));
  if (command==='init') await init(root,arg);
  else if (command==='approve') await approve(root);
  else if (command==='version') buildVersion(root,process.argv.includes('--release'));
  else if (command==='check') {if(check(root).length) process.exitCode=1;}
  else if (command==='audit') {
    const failures=check(root);
    process.stdout.write(`审计记录：${failures.length} 个静态策略问题。审计命令不会修改代码；视觉质量须人工审查。\n`);
  } else usage();
}
main().catch(e=>{process.stderr.write(`RMDL: ${e.message}\n`);process.exitCode=1;});
