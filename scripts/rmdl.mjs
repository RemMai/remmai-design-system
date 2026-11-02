#!/usr/bin/env node
/**
 * RMDL v0.3 no-dependency governance CLI.
 * Commands: init new|refactor ; approve ; check ; audit
 * Run with node or bun. AI must not automate owner approval.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';

const VERSION = '0.3.0';
const FIXED = Object.freeze({
  webFramework: 'react', language: 'typescript-strict', packageManager: 'bun',
  uiLibrary: 'heroui-v3', cssEngine: 'tailwind-v4', iconSet: 'lucide',
  designSystem: 'rmdl-core', sharedUiPackage: '@remmai/rmdl-ui', uiVersion: VERSION,
});
const allowed = Object.freeze({
  operation: ['new', 'refactor'],
  productType: ['admin', 'data', 'portal', 'game', 'content', 'service'],
  frontendFramework: ['vite', 'next', 'none'],
  backendLanguage: ['dotnet', 'java', 'python', 'node', 'none'],
  productionDatabase: ['postgresql', 'mariadb', 'sqlite', 'none'],
  deployment: ['docker', 'linux', 'windows', 'hybrid'],
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
  if (s.productType === 'service' ? s.frontendFramework !== 'none' : s.frontendFramework === 'none') {
    err(errors, '仅 service 类型可不启用 Web 前端；其他产品须选择 vite/next');
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
    if (['node_modules', '.git', '.next', 'dist', 'build', 'coverage', 'generated', '__snapshots__'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) traverse(full, callback, relRoot);
    else if (entry.isFile()) callback(full, path.relative(relRoot, full).replaceAll(path.sep, '/'));
  }
}
function checkWeb(root, config, errors) {
  if (config.selection.productType === 'service') return;
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
    if (!/^(?:workspace:\*|0[.]3[.]0|(?:git\+https:\/\/|https:\/\/)[^\s]+#[a-f0-9]{7,40})$/.test(sharedVersion)) {
      err(errors, `${sharedName} 必须使用同仓 workspace:*、精确 0.3.0 或锁定 Git SHA；禁止浮动范围`);
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
  if (!fs.existsSync(path.join(root, 'bun.lock')) && !fs.existsSync(path.join(web, 'bun.lock'))) {
    err(errors, '缺少 bun.lock，必须锁定 Bun 安装结果');
  }
  for (const p of [root, web]) {
    for (const lock of ['package-lock.json','yarn.lock','pnpm-lock.yaml']) {
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
function check(root, print=true) {
  const errors=[];
  const file=path.join(root,'rmdl.project.json');
  if (!fs.existsSync(file)) { err(errors, '缺少 rmdl.project.json；先 init/审批'); }
  else {
    let config;
    try { config=readJSON(file); } catch(e) { err(errors, `rmdl.project.json 解析失败：${e.message}`); }
    if (config) {
      errors.push(...validateSelection(config));
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
      'content — 博客/内容站','service — 纯后端服务（无 Web）',
    ]);
    const frontendFramework=productType==='service'?'none':await choose(rl,'Web 构建/渲染框架（组件外观不会改变）',[
      'vite — 交互型后台默认推荐','next — 公开内容/SEO/SSR 推荐',
    ]);
    const backendLanguage=await choose(rl,'后端语言（由所有者决定）',[
      'dotnet — C# / ASP.NET Core','java — Java','python — Python',
      'node — Node.js + TypeScript','none — 无后端',
    ]);
    const productionDatabase=backendLanguage==='none'?'none':await choose(rl,'生产数据库',[
      'postgresql — 默认推荐','mariadb — MariaDB','sqlite — 适合明确轻量单机产品',
    ]);
    const deployment=await choose(rl,'部署形式',[
      'docker — 容器化','linux — Linux 原生','windows — Windows 原生','hybrid — 混合',
    ]);
    const migrationStrategy=operation==='new'?'not-applicable':await choose(rl,'重构迁移策略',[
      'incremental — 渐进迁移，默认推荐','rewrite — 完整重写（需额外风险评估）',
    ]);
    const config={
      $schema:'./policy/rmdl-project.schema.json',standardVersion:VERSION,projectName,
      selection:{operation,productType,frontendFramework,backendLanguage,
        orm:ormDefaults[backendLanguage],productionDatabase,deployment,migrationStrategy},
      fixed:{...FIXED},
      governance:{state:'draft',approvedBy:null,approvalReference:null,approvedAt:null},
    };
    writeJSON(dest, config);
    process.stdout.write('\n选型草稿已生成：rmdl.project.json\n下一步：请所有者审查，再执行 node scripts/rmdl.mjs approve。草稿状态禁止直接开发/交付。\n');
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
function usage() {process.stdout.write('Usage: node scripts/rmdl.mjs init new|refactor | approve | check | audit [--root path]\n');}
async function main() {
  const [command, arg]=process.argv.slice(2);
  const root=getRoot(process.argv.slice(2));
  if (command==='init') await init(root,arg);
  else if (command==='approve') await approve(root);
  else if (command==='check') {if(check(root).length) process.exitCode=1;}
  else if (command==='audit') {
    const failures=check(root);
    process.stdout.write(`审计记录：${failures.length} 个静态策略问题。审计命令不会修改代码；视觉质量须人工审查。\n`);
  } else usage();
}
main().catch(e=>{process.stderr.write(`RMDL: ${e.message}\n`);process.exitCode=1;});
