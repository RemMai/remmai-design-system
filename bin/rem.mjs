#!/usr/bin/env node
/**
 * rem / remdl — RMDL 标准命令行入口。
 *
 * 默认走 npm 模式（包内 standard/ 快照，无需 Git 凭据）；
 * 加 --git 或项目使用 submodule 时，转交 scripts/bootstrap.mjs 的 Git 流程。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  initFromStandard,
  updateFromStandard,
  resolveStandardDir,
  readStandardMeta,
  readRecord,
  setEnabled,
} from '../scripts/npm-mode.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

const VALUE_FLAGS = new Set(['--agent', '--ref', '--proxy', '--repository', '--standard', '--to']);
const BOOLEAN_FLAGS = new Set(['--git', '--force', '--project', '--help', '-h', '--version', '-v']);

function parse(argv) {
  const flags = new Map();
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (VALUE_FLAGS.has(arg)) {
      const value = argv[++i];
      if (!value || value.startsWith('-')) fail(`${arg} 缺少有效参数`);
      flags.set(arg, value);
      continue;
    }
    if (BOOLEAN_FLAGS.has(arg)) {
      flags.set(arg, true);
      continue;
    }
    if (arg.startsWith('-')) fail(`未知参数：${arg}`);
    positional.push(arg);
  }
  return { flags, positional };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function bootstrapScript(projectRoot) {
  const candidates = [
    projectRoot && path.join(projectRoot, 'vendor/rmdl/scripts/bootstrap.mjs'),
    path.join(packageRoot, 'standard/scripts/bootstrap.mjs'),
    path.join(packageRoot, 'scripts/bootstrap.mjs'),
  ].filter(Boolean);
  return candidates.find(file => fs.existsSync(file)) ?? null;
}

function runBootstrap(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit', cwd });
  process.exit(result.status ?? 1);
}

function agentOf(flags) {
  const agent = flags.get('--agent') ?? 'opencode';
  if (!['opencode', 'skip'].includes(agent)) fail('--agent 只能是 opencode 或 skip');
  return agent;
}

function resolveRoot(positional, flags) {
  const target = flags.get('--standard') ?? positional[0];
  return target ? path.resolve(target) : process.cwd();
}

const HELP = `RMDL 标准脚手架 · ${packageJson.name}@${packageJson.version}

  remdl init [项目目录]          把包内标准装进项目（vendor/rmdl + Agent 入口）
      --agent opencode|skip      是否写入 OpenCode / AGENTS 入口，默认 opencode
      --git                      改用 Git submodule 模式（需要 Git 权限）

  remdl update [项目目录]        更新到项目锁定版本，或 --to 指定版本
      --to <版本>                更新到指定 npm 版本
      --force                    放弃 vendor/rmdl 的本地修改
      --git                      走 Git submodule 更新流程

  remdl check [项目目录]         校验标准门禁
      --project                  追加真实工程检查（typecheck/lint/test/build/.NET）

  remdl enable|disable [项目目录]  启用 / 停用本项目绑定（写 .rmdl 标记）
  remdl version                  显示 CLI、包内标准与项目锁定版本
  remdl doctor                   环境与安装自检

说明：Windows cmd.exe 自带 REM 注释命令，会吞掉 rem 指令；请用 PowerShell 或 Git Bash，
或直接使用 remdl。`;

function commandVersion(root) {
  const bundled = resolveStandardDir(packageRoot);
  const bundledMeta = bundled ? readStandardMeta(bundled) : { version: null, commit: null };
  const record = readRecord(root);
  console.log(`cli              ${packageJson.version}`);
  console.log(`bundled standard ${bundledMeta.version ?? '未打包'}${bundledMeta.commit ? ` (${String(bundledMeta.commit).slice(0, 8)})` : ''}`);
  console.log(`project          ${root}`);
  if (!record) console.log('project lock     未初始化');
  else if (record.source === 'npm') console.log(`project lock     npm ${record.version ?? '-'} (${String(record.commit ?? '').slice(0, 8) || 'no commit'})`);
  else console.log(`project lock     git ${record.requestedRef ?? '-'} (${String(record.commit ?? '').slice(0, 8)})`);
}

function commandDoctor(root) {
  const bundled = resolveStandardDir(packageRoot);
  const record = readRecord(root);
  const git = spawnSync('git', ['--version'], { encoding: 'utf8', windowsHide: true });
  console.log(`node             ${process.versions.node}`);
  console.log(`git              ${git.status === 0 ? git.stdout.trim() : '缺失（npm 模式不需要）'}`);
  console.log(`bundled standard ${bundled ?? '缺失（当前只能走 --git 模式）'}`);
  if (record) {
    const vendor = path.join(root, 'vendor/rmdl');
    const vendorMeta = fs.existsSync(vendor) ? readStandardMeta(vendor) : { version: null };
    console.log(`project lock     ${record.source} ${record.version ?? record.requestedRef ?? '-'}`);
    console.log(`vendor standard  ${vendorMeta.version ?? '缺失'}`);
    if (record.version && vendorMeta.version && record.version !== vendorMeta.version) {
      console.log('警告             项目锁定版本与 vendor/rmdl 实际版本不一致');
    }
  } else {
    console.log('project lock     未初始化');
  }
  console.log('提示             cmd.exe 的 REM 是内置注释命令，请在 PowerShell / Git Bash 使用 rem');
}

const [rawCommand = 'help', ...rest] = process.argv.slice(2);
const command = rawCommand === '--version' || rawCommand === '-v' ? 'version'
  : rawCommand === '--help' || rawCommand === '-h' ? 'help'
  : rawCommand;
const { flags, positional } = parse(rest);

if (flags.has('--help') || flags.has('-h')) {
  console.log(HELP);
  process.exit(0);
}
if (flags.has('--version') || flags.has('-v') || command === 'version') {
  commandVersion(resolveRoot(positional, flags));
  process.exit(0);
}

const root = resolveRoot(positional, flags);
const agent = agentOf(flags);
const useGit = flags.has('--git');

async function main() {
  switch (command) {
  case 'help':
  case 'menu':
    console.log(HELP);
    break;

  case 'doctor':
    commandDoctor(root);
    break;

  case 'init': {
    const bundled = useGit ? null : resolveStandardDir(packageRoot);
    if (bundled) {
      const record = initFromStandard({
        root,
        standardDir: bundled,
        meta: readStandardMeta(bundled),
        packageName: packageJson.name,
        agent,
      });
      console.log(`\nRMDL 标准已安装：${root}`);
      console.log(`标准来源：npm ${record.version}`);
      console.log(`锁定记录：${path.join(root, 'rmdl.bootstrap.json')}`);
      if (agent === 'opencode') console.log('\n下一步：用 OpenCode 打开该目录，让它按 RMDL 标准审计并锁定本项目选型。');
      console.log('手动初始化项目选型：node vendor/rmdl/scripts/rmdl.mjs init new --root .');
      console.log('校验安装：remdl check .');
      break;
    }
    const script = bootstrapScript(null);
    if (!script) fail('未找到 bootstrap.mjs，且包内没有 standard/ 快照；请重新安装 rem-ai-design');
    console.log('未发现包内标准快照，转用 Git submodule 模式。');
    runBootstrap(script, ['--action', 'init', '--root', root, '--agent', agent,
      ...(flags.has('--ref') ? ['--ref', flags.get('--ref')] : []),
      ...(flags.has('--proxy') ? ['--proxy', flags.get('--proxy')] : []),
      ...(flags.has('--repository') ? ['--repository', flags.get('--repository')] : []),
    ], process.cwd());
    break;
  }

  case 'update': {
    const record = readRecord(root);
    if (record && record.source !== 'npm') {
      const script = bootstrapScript(root);
      console.log('该项目使用 Git submodule 模式，转交 Git 更新流程。');
      runBootstrap(script, ['--action', 'update', '--root', root, '--agent', agent,
        ...(flags.has('--ref') ? ['--ref', flags.get('--ref')] : []),
        ...(flags.has('--proxy') ? ['--proxy', flags.get('--proxy')] : []),
      ], process.cwd());
      break;
    }
    if (useGit) {
      const script = bootstrapScript(root);
      runBootstrap(script, ['--action', 'update', '--root', root, '--agent', agent], process.cwd());
      break;
    }
    const standardDir = resolveStandardDir(packageRoot);
    if (!standardDir) fail('包内没有 standard/ 快照，无法执行 npm 更新');
    const result = await updateFromStandard({
      root,
      standardDir,
      meta: readStandardMeta(standardDir),
      packageName: packageJson.name,
      toVersion: flags.get('--to'),
      force: flags.has('--force'),
      agent,
    });
    const from = result.previous.version ?? '未记录';
    const to = result.next.version ?? '未记录';
    console.log(`\n标准${from === to ? '已是目标版本' : '已更新'}：${from} → ${to}`);
    console.log(`项目：${root}`);
    console.log('请查看 git diff，确认后提交业务仓库。');
    break;
  }

  case 'check': {
    const script = bootstrapScript(root);
    if (!script) fail('未找到 bootstrap.mjs，无法执行检查');
    const args = ['--action', 'check', '--root', root, '--checks', flags.has('--project') ? 'project' : 'standard'];
    runBootstrap(script, args, process.cwd());
    break;
  }

  case 'enable':
  case 'disable': {
    const result = setEnabled(root, command === 'enable');
    console.log(result.enabled
      ? `已启用 RMDL 绑定：${root}\n标记：${result.marker}`
      : `已停用 RMDL 绑定：${root}\n标记已删除，标准与入口文件未改动。`);
    break;
  }

  default:
    fail(`未知命令：${command}\n可用：init | update | check | enable | disable | version | doctor | help`);
  }
}

main().catch(error => {
  console.error(`RMDL 执行失败：${error.message}`);
  process.exit(1);
});
