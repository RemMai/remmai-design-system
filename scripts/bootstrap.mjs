#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import readline from 'node:readline';

const defaultRepository = 'https://github.com/RemMai/remmai-design-system.git';
const entryFiles = ['AGENTS.md', 'opencode.json'];
const baselineFiles = ['RMDL.md', 'policy/session-baseline.md', 'scripts/rmdl.mjs'];

function options(args) {
  const result = {root: '.', repository: defaultRepository, agent: 'opencode'};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') { result.help = true; continue; }
    if (!['--root', '--repository', '--ref', '--proxy', '--agent', '--action', '--checks'].includes(arg)) throw new Error(`未知参数：${arg}`);
    const value = args[++i];
    if (!value || value.startsWith('-')) throw new Error(`${arg} 缺少有效参数`);
    result[arg.slice(2)] = value;
  }
  if (result.proxy && !/^https?:\/\//.test(result.proxy)) throw new Error('--proxy 使用 http:// 或 https:// URL');
  if (!['opencode', 'skip'].includes(result.agent)) throw new Error('--agent 只能为 opencode 或 skip');
  if (result.action && !['init', 'update', 'check'].includes(result.action)) throw new Error('--action 只能为 init、update 或 check');
  if (result.checks && !['standard', 'project'].includes(result.checks)) throw new Error('--checks 只能为 standard 或 project');
  return result;
}

/** Keep paths and revisions as arguments, never interpolate them into shell code. */
function git(root, args, proxy) {
  const config = proxy ? ['-c', `http.proxy=${proxy}`] : [];
  const result = spawnSync('git', [...config, '-C', root, ...args], {encoding: 'utf8', windowsHide: true});
  if (result.error) throw new Error(`无法启动 Git：${result.error.message}`);
  if (result.status !== 0) throw new Error(`Git ${args[0]} 失败：\n${result.stderr.trim() || result.stdout.trim()}`);
  return result.stdout.trim();
}

/** Follow the installer's named branch, but record the resolved commit in each product gitlink. */
function sourceRef(repository) {
  if (repository !== defaultRepository) return 'HEAD';
  const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  if (!fs.existsSync(path.join(source, 'RMDL.md')) || !fs.existsSync(path.join(source, '.git'))) return 'HEAD';
  const branch = git(source, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return branch === 'HEAD' ? git(source, ['rev-parse', '--verify', 'HEAD']) : branch;
}

function projectLauncher(root) {
  const launcher = process.env.RMDL_LAUNCHER_PATH;
  if (!launcher) return null;
  const file = path.resolve(launcher);
  if (path.dirname(file) !== root || path.basename(file).toLowerCase() !== 'rmdl.cmd') return null;
  const stat = fs.lstatSync(file, {throwIfNoEntry: false});
  if (!stat?.isFile() || stat.isSymbolicLink()) return null;
  return file;
}

function assertEmpty(root) {
  const stat = fs.lstatSync(root, {throwIfNoEntry: false});
  if (!stat) return;
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`目标必须是普通空目录：${root}`);
  const launcher = projectLauncher(root);
  if (fs.readdirSync(root).some(name => path.join(root, name) !== launcher)) throw new Error(`目标目录不是空目录（仅允许当前 rmdl.cmd 启动器），未覆盖任何文件：${root}`);
}

function resolveCommit(source, ref, proxy) {
  // HEAD means remote default, never the detached commit currently pinned by the product.
  const candidates = ref === 'HEAD' ? ['refs/remotes/origin/HEAD'] : ref.startsWith('refs/')
    ? [ref] : [`refs/remotes/origin/${ref}`, ref];
  for (const candidate of candidates) {
    try { return git(source, ['rev-parse', '--verify', '--end-of-options', `${candidate}^{commit}`], proxy); }
    catch { /* Try the explicit remote-tracking branch before reporting a missing revision. */ }
  }
  throw new Error(`标准版本不存在或不是 commit：${ref}。请提供已存在的 Tag、分支或完整 commit。`);
}

function templates(source, commit, agent) {
  for (const file of baselineFiles) git(source, ['cat-file', '-e', `${commit}:${file}`]);
  if (agent === 'skip') return {};
  const files = Object.fromEntries(entryFiles.map(file => [file, git(source, ['show', `${commit}:templates/project/${file}`]) + '\n']));
  const config = JSON.parse(files['opencode.json']);
  if (!config.instructions?.includes('vendor/rmdl/policy/session-baseline.md')) throw new Error('OpenCode 模板未绑定会话基线');
  return files;
}

/** Prepare the entire checkout next to the destination before exposing any files in it. */
function bootstrap(config) {
  const root = path.resolve(config.root);
  assertEmpty(root);
  const parent = path.dirname(root);
  if (!fs.existsSync(parent)) throw new Error(`父目录不存在，请先创建：${parent}`);
  git(parent, ['--version']);
  const ref = config.ref ?? sourceRef(config.repository);
  const repository = /^(?:https?:\/\/|ssh:\/\/|git@)/.test(config.repository)
    ? config.repository : path.resolve(config.repository);
  const stage = fs.mkdtempSync(path.join(parent, '.rmdl-setup-'));
  const created = [];
  const existed = fs.existsSync(root);
  const launcher = projectLauncher(root);
  try {
    console.log(`正在拉取 RMDL（${ref}）…`);
    git(stage, ['init', '-b', 'main']);
    git(stage, ['submodule', 'add', '--', repository, 'vendor/rmdl'], config.proxy);
    const source = path.join(stage, 'vendor/rmdl');
    const commit = resolveCommit(source, ref, config.proxy);
    git(source, ['checkout', '--no-overwrite-ignore', '--detach', commit]);
    const files = templates(source, commit, config.agent);
    for (const [file, contents] of Object.entries(files)) fs.writeFileSync(path.join(stage, file), contents, {flag: 'wx'});
    if (launcher) fs.copyFileSync(launcher, path.join(stage, path.basename(launcher)));
    fs.writeFileSync(path.join(stage, 'rmdl.bootstrap.json'), JSON.stringify({
      repository, requestedRef: ref, commit, agent: config.agent, state: 'awaiting-project-selection',
    }, null, 2) + '\n');
    fs.writeFileSync(path.join(stage, '.gitignore'), 'node_modules/\n**/bin/\n**/obj/\nbuild/\ndist/\n.env\n.env.*\n!.env.example\n');
    // Refresh the gitlink after selecting a non-default branch/tag.
    git(stage, ['add', '--', '.gitmodules', 'vendor/rmdl', ...Object.keys(files), 'rmdl.bootstrap.json', '.gitignore', ...(launcher ? [path.basename(launcher)] : [])]);
    assertEmpty(root);
    if (!existed) fs.mkdirSync(root);
    for (const name of fs.readdirSync(stage)) {
      const destination = path.join(root, name);
      if (destination === launcher) continue;
      if (fs.existsSync(destination)) throw new Error(`目标在安装过程中新增了文件，停止覆盖：${name}`);
      fs.renameSync(path.join(stage, name), destination);
      created.push(destination);
    }
    // Verify the submodule's relative Git paths still work after moving the checkout.
    if (git(path.join(root, 'vendor/rmdl'), ['rev-parse', 'HEAD']) !== commit) throw new Error('安装后的标准 commit 校验失败');
    const link = git(root, ['ls-files', '--stage', '--', 'vendor/rmdl']);
    if (!link.startsWith(`160000 ${commit} `)) throw new Error('标准 submodule gitlink 与实际 commit 不一致');
    console.log(`\nRMDL 接入完成：${root}\n标准 commit：${commit}`);
    console.log(`Agent 规则：${config.agent === 'opencode' ? 'OpenCode' : '跳过'}。文件已暂存，尚未创建提交或业务工程。`);
    if (config.agent === 'opencode') console.log('\n在此目录打开 OpenCode，输入：请按 RMDL 标准引导我完成新项目选型。');
    console.log('也可以手动运行：node vendor/rmdl/scripts/rmdl.mjs init new --root .');
  } catch (error) {
    for (const file of created.reverse()) fs.rmSync(file, {recursive: true, force: true});
    if (!existed && fs.existsSync(root) && !fs.readdirSync(root).length) fs.rmdirSync(root);
    throw error;
  } finally {
    fs.rmSync(stage, {recursive: true, force: true});
  }
}

function readOptional(file) {
  const stat = fs.lstatSync(file, {throwIfNoEntry: false});
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`拒绝覆盖非普通文件：${file}`);
  return fs.readFileSync(file);
}

/** Update only managed entrypoints; custom OpenCode settings survive via an instructions merge. */
function planRules(root, source, previous, next, agent) {
  const files = templates(source, next, agent);
  if (agent === 'skip') return files;
  if (fs.existsSync(path.join(root, 'opencode.jsonc')) || fs.existsSync(path.join(root, '.opencode/opencode.json')) || fs.existsSync(path.join(root, '.opencode/opencode.jsonc'))) {
    throw new Error('发现其他 OpenCode 配置入口；请先人工合并，或选择跳过 Agent 规则以仅更新标准。');
  }
  for (const file of Object.keys(files)) {
    const existing = readOptional(path.join(root, file));
    if (!existing) continue;
    if (file === 'AGENTS.md') {
      const oldTemplate = git(source, ['show', `${previous}:templates/project/${file}`]);
      if (existing.toString('utf8').replaceAll('\r\n', '\n').trim() !== oldTemplate.replaceAll('\r\n', '\n').trim()) {
        throw new Error('AGENTS.md 有自定义修改；未覆盖。请先人工合并，或选择跳过 Agent 规则以仅更新标准。');
      }
    } else {
      const config = JSON.parse(existing.toString('utf8'));
      if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('opencode.json 必须为 JSON 对象');
      if (config.instructions !== undefined && (!Array.isArray(config.instructions) || config.instructions.some(v => typeof v !== 'string'))) throw new Error('opencode.json instructions 必须为字符串数组');
      const incoming = JSON.parse(files[file]);
      config.instructions = [...new Set([...(config.instructions ?? []), ...incoming.instructions])];
      config.$schema ??= incoming.$schema;
      files[file] = JSON.stringify(config, null, 2) + '\n';
    }
  }
  return files;
}

/** Fetch before modifying the working tree; restore prior bytes and checkout if application fails. */
function update(config) {
  const root = path.resolve(config.root);
  const source = path.join(root, 'vendor/rmdl');
  const recordPath = path.join(root, 'rmdl.bootstrap.json');
  const recordBytes = readOptional(recordPath);
  const record = recordBytes ? JSON.parse(recordBytes) : {};
  if (path.resolve(git(root, ['rev-parse', '--show-toplevel'])) !== root) throw new Error('请从业务仓库根目录更新标准');
  const link = git(root, ['ls-files', '--stage', '--', 'vendor/rmdl']);
  if (!/^160000 [a-f0-9]+ 0\t/.test(link)) throw new Error('vendor/rmdl 不是已登记的 Git submodule；请先初始化标准');
  if (!fs.existsSync(path.join(source, '.git'))) throw new Error('标准子模块尚未检出，请先运行 git submodule update --init --recursive');
  if (git(source, ['status', '--porcelain', '--untracked-files=all', '--ignore-submodules=none'])) throw new Error('vendor/rmdl 有本地修改；请先保存，未切换标准版本');
  const previous = git(source, ['rev-parse', 'HEAD']);
  const branch = git(source, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (record.commit && record.commit !== previous) throw new Error('实际标准 commit 与 rmdl.bootstrap.json 不一致，请先核对手动变更');
  const repository = git(source, ['remote', 'get-url', 'origin']);
  const ref = config.ref ?? record.requestedRef ?? sourceRef(config.repository);
  console.log(`正在获取标准更新（${ref}）…`);
  git(source, ['fetch', 'origin', '--tags'], config.proxy);
  if (ref === 'HEAD') git(source, ['remote', 'set-head', 'origin', '--auto'], config.proxy);
  const next = resolveCommit(source, ref, config.proxy);
  const files = planRules(root, source, previous, next, config.agent);
  files['rmdl.bootstrap.json'] = JSON.stringify({
    ...record, repository, requestedRef: ref, commit: next, previousCommit: previous, agent: config.agent,
    state: fs.existsSync(path.join(root, 'rmdl.project.json')) ? 'project-selection-preserved' : 'awaiting-project-selection',
  }, null, 2) + '\n';
  const backups = Object.fromEntries(Object.keys(files).map(file => [file, readOptional(path.join(root, file))]));
  let switched = false;
  try {
    git(source, ['checkout', '--no-overwrite-ignore', '--detach', next]);
    switched = true;
    for (const [file, contents] of Object.entries(files)) fs.writeFileSync(path.join(root, file), contents);
    if (git(source, ['rev-parse', 'HEAD']) !== next) throw new Error('更新后的 commit 校验失败');
  } catch (error) {
    for (const [file, contents] of Object.entries(backups)) {
      if (contents === null) fs.rmSync(path.join(root, file), {force: true});
      else fs.writeFileSync(path.join(root, file), contents);
    }
    if (switched) git(source, ['checkout', '--no-overwrite-ignore', ...(branch === 'HEAD' ? ['--detach', previous] : [branch])]);
    throw error;
  }
  console.log(`\n标准${previous === next ? '已是所选版本' : '已更新'}：${previous} → ${next}`);
  console.log(`Agent 规则：${config.agent === 'opencode' ? 'OpenCode（保留其他配置）' : '跳过（现有规则文件保留）'}。`);
  console.log('业务选型与产品版本保持原值；变更尚未暂存或提交。');
  console.log('请审查 git diff；可在菜单中选择「检查项目」或「更新并检查」验证，无需手敲命令。');
  console.log('新增标准要求可能需要迁移项目配置；静态检查与真实工程测试通过后再提交。');
}

/** Run a local tool with arguments; never build a shell string from project data. */
function runTool(executable, args, cwd) {
  // Windows npm is a .cmd shim; Node requires a shell for it. Arguments here are fixed script names.
  const result = spawnSync(executable, args, {cwd, encoding: 'utf8', windowsHide: true, shell: /\.cmd$/i.test(executable)});
  if (result.error) return {ok: false, output: result.error.message};
  return {ok: result.status === 0, output: `${result.stdout}${result.stderr}`.trim()};
}

function firstLines(text, count = 6) {
  return text.split(/\r?\n/).filter(Boolean).slice(0, count).join(' | ');
}

function standardCheck(root) {
  const script = path.join(root, 'vendor/rmdl/scripts/rmdl.mjs');
  if (!fs.existsSync(script)) return {name: '标准门禁', status: 'FAIL', detail: '缺少 vendor/rmdl/scripts/rmdl.mjs，请先初始化或更新标准'};
  const result = runTool(process.execPath, [script, 'check', '--root', root], root);
  return {name: '标准门禁', status: result.ok ? 'PASS' : 'FAIL', detail: result.ok ? '静态策略通过（不代表视觉与真实构建通过）' : firstLines(result.output)};
}

/** Discover real project commands instead of assuming a layout that may not exist. */
function findFiles(dir, predicate, maxDepth, depth = 0) {
  if (depth > maxDepth || !fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (['node_modules', '.git', 'bin', 'obj', 'dist', 'build', 'vendor', 'artifacts'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findFiles(full, predicate, maxDepth, depth + 1));
    else if (entry.isFile() && predicate(full)) found.push(full);
  }
  return found;
}

function projectChecks(root) {
  const results = [];
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const packages = [root, path.join(root, 'apps/web')].filter(dir => fs.existsSync(path.join(dir, 'package.json')));
  if (!packages.length) results.push({name: '前端工程检查', status: 'NOT RUN', detail: '未找到 package.json'});
  for (const dir of packages) {
    const label = path.relative(root, dir) || '.';
    let scripts = {};
    try { scripts = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).scripts ?? {}; }
    catch (error) { results.push({name: `${label} package.json`, status: 'FAIL', detail: error.message}); continue; }
    for (const script of ['typecheck', 'lint', 'test', 'build']) {
      const name = `${label} npm run ${script}`;
      if (!scripts[script]) { results.push({name, status: 'NOT RUN', detail: 'package.json 未定义该脚本'}); continue; }
      const result = runTool(npm, ['run', script, '--silent'], dir);
      results.push({name, status: result.ok ? 'PASS' : 'FAIL', detail: result.ok ? '' : firstLines(result.output)});
    }
  }
  const solutions = findFiles(root, file => /\.(slnx|sln)$/i.test(file), 3);
  if (!solutions.length) results.push({name: '.NET 构建', status: 'NOT RUN', detail: '未找到 .sln/.slnx'});
  else if (!runTool('dotnet', ['--version'], root).ok) results.push({name: '.NET 构建', status: 'NOT RUN', detail: '未找到 dotnet CLI'});
  else {
    const result = runTool('dotnet', ['build', path.relative(root, solutions[0]), '-c', 'Release', '--nologo'], root);
    results.push({name: '.NET 构建', status: result.ok ? 'PASS' : 'FAIL', detail: result.ok ? '' : firstLines(result.output)});
  }
  results.push({name: '视觉回归', status: 'NOT RUN', detail: '需项目 Playwright 配置与人工审查'});
  return results;
}

function runChecks(root, mode) {
  if (!fs.existsSync(root)) { console.error(`项目目录不存在：${root}`); return false; }
  console.log(`\n正在检查：${root}`);
  const results = [standardCheck(root)];
  if (mode === 'project') results.push(...projectChecks(root));
  console.log('\n检查结果：');
  for (const item of results) console.log(`  [${item.status}] ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
  const count = status => results.filter(item => item.status === status).length;
  console.log(`\n汇总：PASS ${count('PASS')} / FAIL ${count('FAIL')} / NOT RUN ${count('NOT RUN')}`);
  if (count('FAIL')) console.log('存在失败项；修复后重新检查，不要跳过或关闭门禁。');
  else if (count('NOT RUN')) console.log('NOT RUN 项未验证，不能当作通过。');
  return count('FAIL') === 0;
}

async function menu(config) {
  const rl = readline.createInterface({input: process.stdin, crlfDelay: Infinity});
  const lines = rl[Symbol.asyncIterator]();
  const ask = async text => {
    process.stdout.write(text);
    const answer = await lines.next();
    if (answer.done) throw new Error('输入已结束，操作取消');
    return answer.value.trim();
  };
  const chooseChecks = async (defaultMode) => {
    for (;;) {
      const choice = await ask(`检查范围：1. 仅标准门禁  2. 标准 + 工程检查（typecheck/lint/test/build/.NET）  0. 跳过 [${defaultMode === 'project' ? 2 : 1}]：`);
      if (!choice) return defaultMode;
      if (choice === '1') return 'standard';
      if (choice === '2') return 'project';
      if (choice === '0') return null;
      console.log('请输入 0、1 或 2。');
    }
  };
  try {
    for (;;) {
      console.log('\nRMDL 标准管理\n  1. 初始化标准\n  2. 更新标准\n  3. 检查项目\n  4. 更新并检查\n  0. 退出');
      const action = await ask('请选择：');
      if (action === '0') return;
      if (!['1', '2', '3', '4'].includes(action)) { console.log('请输入 1、2、3、4 或 0。'); continue; }
      if (action === '3') {
        const root = (await ask(`项目目录 [${path.resolve(config.root)}]：`)) || config.root;
        const mode = await chooseChecks('project');
        if (mode) runChecks(path.resolve(root), mode);
        continue;
      }
      const root = (await ask(`项目目录 [${path.resolve(config.root)}]：`)) || config.root;
      let agent;
      while (!agent) {
        const choice = await ask('Agent 规则：1. OpenCode（默认）  2. 跳过 [1]：');
        if (!choice || choice === '1') agent = 'opencode';
        else if (choice === '2') agent = 'skip';
        else console.log('请输入 1 或 2。');
      }
      let suggested = config.ref ?? sourceRef(config.repository);
      if (action !== '1' && !config.ref) {
        const record = readOptional(path.join(path.resolve(root), 'rmdl.bootstrap.json'));
        suggested = record ? JSON.parse(record).requestedRef ?? suggested : suggested;
      }
      const ref = (await ask(`标准版本（分支 / Tag / commit，HEAD=远端默认分支）[${suggested}]：`)) || suggested;
      const proxy = (await ask(`HTTP 代理（空白使用当前 Git 设置）[${config.proxy ?? ''}]：`)) || config.proxy;
      const selected = options(['--action', action === '1' ? 'init' : 'update', '--root', root, '--agent', agent,
        '--repository', config.repository, '--ref', ref, ...(proxy ? ['--proxy', proxy] : [])]);
      try {
        (selected.action === 'init' ? bootstrap : update)(selected);
        const mode = await chooseChecks(selected.action === 'update' || action === '4' ? 'project' : 'standard');
        if (mode) runChecks(path.resolve(root), mode);
      } catch (error) { console.error(`RMDL 操作失败：${error.message}`); }
    }
  } finally { rl.close(); }
}

try {
  const config = options(process.argv.slice(2));
  if (config.help) {
    console.log(`RMDL 标准管理（需要 Node.js 和 Git）
启动菜单：node bootstrap.mjs
直接执行：node bootstrap.mjs --action init|update|check [--checks standard|project] [--root path] [--agent opencode|skip] [--ref tag|branch|commit] [--proxy http://host:port] [--repository URL]
菜单提供：初始化标准 / 更新标准 / 检查项目 / 更新并检查。
检查会运行标准门禁，并按项目实际存在的 package.json 脚本与 .NET 解决方案执行工程检查；缺失项报告 NOT RUN。
Agent 规则默认 OpenCode，可选择跳过。初始化目标必须为空目录（允许当前单文件 rmdl.cmd 启动器）。
默认仓库：${defaultRepository}
从标准仓库运行时默认选择其分支（detached 时选择 commit）；单独下载脚本默认远端 HEAD。
更新默认保持原标准引用；固定 commit/Tag 不会自动追新，换版本时显式选择新引用。
仅接入/更新/检查规则，不自动选择技术栈、不审批、不提交或推送业务仓库。`);
  } else if (config.action === 'check') {
    if (!runChecks(path.resolve(config.root), config.checks ?? 'project')) process.exitCode = 1;
  } else if (config.action) (config.action === 'init' ? bootstrap : update)(config);
  else await menu(config);
} catch (error) {
  console.error(`RMDL 接入失败：${error.message}`);
  process.exitCode = 1;
}
