#!/usr/bin/env node
/**
 * npm 模式的标准安装与更新。
 *
 * 与 scripts/bootstrap.mjs（Git submodule 模式）并列：
 * - Git 模式靠 `git submodule add` 固定 commit；
 * - npm 模式靠包内 `standard/` 快照固定 version + commit，不需要 Git 凭据。
 *
 * 两种模式写出同一份 rmdl.bootstrap.json，source 字段区分来源。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const RECORD_FILE = 'rmdl.bootstrap.json';
const STANDARD_META = '.rmdl-standard.json';
const ENTRY_FILES = ['AGENTS.md', 'opencode.json'];

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'bin', 'obj', 'dist', 'build', 'artifacts',
  '.vs', '.idea', '.vscode', 'standard', 'vendor', 'tests',
]);

function normalize(file) {
  return file.replaceAll('\\', '/');
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** 递归列出文件（相对路径，正斜杠），跳过构建产物目录。 */
export function walkFiles(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walkFiles(full, base, out);
      continue;
    }
    if (entry.isFile()) out.push(normalize(path.relative(base, full)));
  }
  return out.sort();
}

/** 目录清单 → {相对路径: sha256}，用于检测本地篡改。 */
export function hashTree(dir) {
  const result = {};
  for (const file of walkFiles(dir)) result[file] = sha256File(path.join(dir, file));
  return result;
}

export function diffTrees(expected, actual) {
  const changed = [];
  const missing = [];
  const extra = [];
  for (const [file, hash] of Object.entries(expected)) {
    if (!(file in actual)) missing.push(file);
    else if (actual[file] !== hash) changed.push(file);
  }
  for (const file of Object.keys(actual)) if (!(file in expected)) extra.push(file);
  return { changed, missing, extra };
}

/** 包内快照或显式指定的标准目录。 */
export function resolveStandardDir(packageRoot) {
  const dir = process.env.RMDL_STANDARD_DIR
    ? path.resolve(process.env.RMDL_STANDARD_DIR)
    : path.join(packageRoot, 'standard');
  return fs.existsSync(path.join(dir, 'RMDL.md')) ? dir : null;
}

export function readStandardMeta(standardDir) {
  const file = path.join(standardDir, STANDARD_META);
  if (fs.existsSync(file)) {
    const meta = readJson(file);
    if (meta.version) return meta;
  }
  // 开发态（RMDL_STANDARD_DIR 指向仓库根）没有 .rmdl-standard.json，回退到版本文件与 Git HEAD。
  const versionFile = path.join(standardDir, 'VERSION');
  const version = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf8').trim() : null;
  let commit = null;
  const head = spawnSync('git', ['-C', standardDir, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true });
  if (head.status === 0) commit = head.stdout.trim();
  return { name: null, version, commit };
}

export function readRecord(root) {
  const file = path.join(root, RECORD_FILE);
  return fs.existsSync(file) ? readJson(file) : null;
}

function projectLauncher(root) {
  const launcher = process.env.RMDL_LAUNCHER_PATH;
  if (!launcher) return null;
  const file = path.resolve(launcher);
  if (path.dirname(file) !== root || path.basename(file).toLowerCase() !== 'rmdl.cmd') return null;
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  return stat?.isFile() && !stat.isSymbolicLink() ? file : null;
}

function assertInstallable(root) {
  const stat = fs.lstatSync(root, { throwIfNoEntry: false });
  if (!stat) return false;
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`目标路径不是普通目录：${root}`);
  const launcher = projectLauncher(root);
  const allowed = new Set([launcher, path.join(root, '.git')].filter(Boolean));
  const blocking = fs.readdirSync(root).map(name => path.join(root, name)).filter(entry => !allowed.has(entry));
  if (blocking.length) {
    throw new Error(`目标目录不是空目录，已存在：${blocking.map(entry => path.basename(entry)).join(', ')}\n请换一个空目录，或先手动清理。`);
  }
  return true;
}

function copyStandard(source, destination) {
  fs.cpSync(source, destination, {
    recursive: true,
    dereference: true,
    filter(src) {
      const parts = path.relative(source, src).split(path.sep).filter(Boolean);
      if (!parts.length) return true;
      return !parts.some(part => SKIP_DIRS.has(part));
    },
  });
}

/** 模板内容与 agent 选择一致：skip 时不写任何 Agent 入口。 */
function entryContents(standardDir, agent) {
  if (agent === 'skip') return {};
  const files = {};
  for (const file of ENTRY_FILES) {
    const source = path.join(standardDir, 'templates/project', file);
    if (!fs.existsSync(source)) throw new Error(`标准快照缺少模板：templates/project/${file}`);
    files[file] = fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n').replace(/\n?$/, '\n');
  }
  const config = JSON.parse(files['opencode.json']);
  if (!config.instructions?.includes('vendor/rmdl/policy/session-baseline.md')) {
    throw new Error('OpenCode 模板未绑定 vendor/rmdl/policy/session-baseline.md');
  }
  return files;
}

function gitAvailable() {
  const result = spawnSync('git', ['--version'], { encoding: 'utf8', windowsHide: true });
  return result.status === 0;
}

function git(root, args) {
  return spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true });
}

/**
 * 把标准快照装进项目：vendor/rmdl + Agent 入口 + 锁定记录。
 * 全部内容先在临时目录就绪，再原子搬入目标目录。
 */
export function initFromStandard({ root, standardDir, meta, packageName, agent = 'opencode' }) {
  if (!standardDir) throw new Error('未找到包内标准快照，无法离线安装');
  const target = path.resolve(root);
  const parent = path.dirname(target);
  if (!fs.existsSync(parent)) throw new Error(`上级目录不存在：${parent}`);
  const existed = assertInstallable(target);
  const stage = fs.mkdtempSync(path.join(parent, '.rmdl-setup-'));
  const created = [];
  try {
    const vendor = path.join(stage, 'vendor/rmdl');
    fs.mkdirSync(path.dirname(vendor), { recursive: true });
    copyStandard(standardDir, vendor);

    const entries = entryContents(standardDir, agent);
    for (const [file, contents] of Object.entries(entries)) fs.writeFileSync(path.join(stage, file), contents);

    const record = {
      source: 'npm',
      package: packageName,
      version: meta.version,
      commit: meta.commit ?? null,
      requestedRef: meta.version ? `v${meta.version}` : null,
      agent,
      state: 'awaiting-project-selection',
      lock: { standard: hashTree(vendor), entries: entries },
    };
    writeJson(path.join(stage, RECORD_FILE), record);
    fs.writeFileSync(path.join(stage, '.gitignore'), 'node_modules/\n**/bin/\n**/obj/\nbuild/\ndist/\n.env\n.env.*\n!.env.example\n');

    if (gitAvailable()) {
      git(stage, ['init', '-b', 'main']);
      git(stage, ['add', '-A']);
    }

    if (!existed) fs.mkdirSync(target, { recursive: true });
    for (const name of fs.readdirSync(stage)) {
      const destination = path.join(target, name);
      if (fs.existsSync(destination)) throw new Error(`安装期间出现了同名文件，停止覆盖：${name}`);
      fs.renameSync(path.join(stage, name), destination);
      created.push(destination);
    }
    return record;
  } catch (error) {
    for (const file of created.reverse()) fs.rmSync(file, { recursive: true, force: true });
    if (!existed && fs.existsSync(target) && !fs.readdirSync(target).length) fs.rmdirSync(target);
    throw error;
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

function registryUrl() {
  return (process.env.npm_config_registry || process.env.NPM_CONFIG_REGISTRY || 'https://registry.npmjs.org/').replace(/\/+$/, '');
}

/** 从 npm 注册表取指定版本的 tarball，避免依赖本机 npm 可执行文件。 */
async function fetchStandard(packageName, version) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rmdl-pack-'));
  const cleanup = () => fs.rmSync(tmp, { recursive: true, force: true });
  const metadataUrl = `${registryUrl()}/${encodeURIComponent(packageName)}`;
  let tarball;
  try {
    const response = await fetch(metadataUrl, { headers: { accept: 'application/vnd.npm.install-v1+json' } });
    if (!response.ok) throw new Error(`注册表返回 ${response.status}`);
    const metadata = await response.json();
    tarball = metadata?.versions?.[version]?.dist?.tarball;
    if (!tarball) throw new Error(`该版本不存在或未发布 tarball`);
  } catch (error) {
    cleanup();
    throw new Error(`无法从 ${metadataUrl} 读取 ${packageName}@${version}：${error.message}\n可改用本机已有版本，或设置 RMDL_STANDARD_DIR 指向本地标准。`);
  }
  const archive = path.join(tmp, `${packageName}-${version}.tgz`);
  try {
    const response = await fetch(tarball);
    if (!response.ok) throw new Error(`下载 tarball 返回 ${response.status}`);
    fs.writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    cleanup();
    throw new Error(`下载 ${tarball} 失败：${error.message}`);
  }
  const extract = path.join(tmp, 'unpacked');
  fs.mkdirSync(extract);
  const untar = spawnSync('tar', ['-xzf', archive, '-C', extract], { encoding: 'utf8', windowsHide: true });
  if (untar.status !== 0) {
    cleanup();
    throw new Error(`解压 tarball 失败：${(untar.stderr || '').trim() || 'tar 不可用'}`);
  }
  const standardDir = path.join(extract, 'package', 'standard');
  if (!fs.existsSync(path.join(standardDir, 'RMDL.md'))) {
    cleanup();
    throw new Error(`${packageName}@${version} 的 tarball 内没有 standard/ 快照，请确认该版本由发布流水线生成`);
  }
  return { dir: standardDir, cleanup };
}

async function resolveTargetStandard({ standardDir, meta, packageName, toVersion }) {
  const envDir = process.env.RMDL_STANDARD_DIR ? path.resolve(process.env.RMDL_STANDARD_DIR) : null;
  if (envDir && fs.existsSync(path.join(envDir, 'RMDL.md'))) {
    return { standardDir: envDir, meta: readStandardMeta(envDir), cleanup: null };
  }
  if (!toVersion || toVersion === meta.version) {
    return { standardDir, meta, cleanup: null };
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(toVersion)) {
    throw new Error(`--to 需要完整版本号（如 0.4.1），收到：${toVersion}`);
  }
  const fetched = await fetchStandard(packageName, toVersion);
  return { standardDir: fetched.dir, meta: readStandardMeta(fetched.dir), cleanup: fetched.cleanup };
}

function assertUnmodified(root, record) {
  const vendor = path.join(root, 'vendor/rmdl');
  if (!fs.existsSync(vendor)) throw new Error('vendor/rmdl 不存在，无法更新；请重新执行 init');
  if (!record.lock?.standard) return { unmanaged: true };
  const diff = diffTrees(record.lock.standard, hashTree(vendor));
  const ignored = file => /^(node_modules|dist|build|bin|obj)\//.test(file);
  const extra = diff.extra.filter(file => !ignored(file));
  return { ...diff, extra };
}

function mergeEntries({ root, standardDir, newStandardDir, agent }) {
  if (agent === 'skip') return {};
  const files = entryContents(newStandardDir, agent);
  const previousTemplate = fs.readFileSync(path.join(standardDir, 'templates/project/AGENTS.md'), 'utf8')
    .replace(/\r\n/g, '\n').trim();
  const currentAgents = path.join(root, 'AGENTS.md');
  if (fs.existsSync(currentAgents)) {
    const existing = fs.readFileSync(currentAgents, 'utf8').replace(/\r\n/g, '\n').trim();
    if (existing !== previousTemplate) {
      throw new Error('AGENTS.md 已被本地修改，未覆盖。请先人工合并，或把该文件还原后重试。');
    }
  }
  const currentConfig = path.join(root, 'opencode.json');
  if (fs.existsSync(currentConfig)) {
    let config;
    try { config = JSON.parse(fs.readFileSync(currentConfig, 'utf8')); }
    catch { throw new Error('opencode.json 不是有效 JSON，无法安全合并 Agent 入口'); }
    if (config.instructions !== undefined && (!Array.isArray(config.instructions) || config.instructions.some(v => typeof v !== 'string'))) {
      throw new Error('opencode.json instructions 必须是字符串数组，未自动改写');
    }
    const incoming = JSON.parse(files['opencode.json']);
    config.$schema ??= incoming.$schema;
    config.instructions = [...new Set([...(config.instructions ?? []), ...incoming.instructions])];
    files['opencode.json'] = JSON.stringify(config, null, 2) + '\n';
  }
  return files;
}

/**
 * 用另一份标准快照替换 vendor/rmdl，并刷新入口与锁定记录。
 * 失败时回滚到替换前的状态。
 */
export async function updateFromStandard({ root, standardDir, meta, packageName, toVersion, force = false, agent = 'opencode' }) {
  const target = path.resolve(root);
  const record = readRecord(target);
  if (!record) throw new Error(`未找到 ${RECORD_FILE}，当前目录不是 RMDL 项目（先执行 init）`);
  if (record.source !== 'npm') throw new Error('该项目使用 Git submodule 模式，请用 --git 走 Git 更新流程');
  if (!fs.existsSync(path.join(standardDir, 'RMDL.md'))) throw new Error('缺少可用标准快照');

  const diff = assertUnmodified(target, record);
  const drift = [...diff.changed, ...diff.missing, ...(diff.extra ?? [])].sort();
  if (drift.length && !force) {
    throw new Error(`vendor/rmdl 存在本地修改，已拒绝覆盖：\n  ${drift.slice(0, 12).join('\n  ')}${drift.length > 12 ? `\n  ...共 ${drift.length} 项` : ''}\n确认放弃这些改动后重试：--force`);
  }

  const targetStandard = await resolveTargetStandard({ standardDir, meta, packageName, toVersion });
  try {
    const previousMeta = readStandardMeta(path.join(target, 'vendor/rmdl'));
    const entries = mergeEntries({ root: target, standardDir: path.join(target, 'vendor/rmdl'), newStandardDir: targetStandard.standardDir, agent });
    const vendor = path.join(target, 'vendor/rmdl');
    const stage = fs.mkdtempSync(path.join(path.dirname(target), '.rmdl-next-'));
    const nextVendor = path.join(stage, 'vendor/rmdl');
    fs.mkdirSync(path.dirname(nextVendor), { recursive: true });
    copyStandard(targetStandard.standardDir, nextVendor);

    const backup = {};
    for (const file of Object.keys(entries)) {
      const existing = path.join(target, file);
      backup[file] = fs.existsSync(existing) ? fs.readFileSync(existing) : null;
    }
    const retired = path.join(stage, 'previous');
    fs.renameSync(vendor, retired);
    try {
      fs.renameSync(nextVendor, vendor);
      for (const [file, contents] of Object.entries(entries)) fs.writeFileSync(path.join(target, file), contents);
    } catch (error) {
      fs.rmSync(vendor, { recursive: true, force: true });
      fs.renameSync(retired, vendor);
      for (const [file, contents] of Object.entries(backup)) {
        if (contents === null) fs.rmSync(path.join(target, file), { force: true });
        else fs.writeFileSync(path.join(target, file), contents);
      }
      throw error;
    } finally {
      fs.rmSync(stage, { recursive: true, force: true });
    }

    const nextRecord = {
      ...record,
      package: packageName,
      version: targetStandard.meta.version,
      commit: targetStandard.meta.commit ?? null,
      requestedRef: targetStandard.meta.version ? `v${targetStandard.meta.version}` : null,
      previousVersion: previousMeta.version ?? record.version,
      previousCommit: previousMeta.commit ?? record.commit,
      agent,
      state: fs.existsSync(path.join(target, 'rmdl.project.json')) ? 'project-selection-preserved' : 'awaiting-project-selection',
      lock: { standard: hashTree(vendor), entries },
    };
    writeJson(path.join(target, RECORD_FILE), nextRecord);
    return { previous: previousMeta, next: targetStandard.meta };
  } finally {
    targetStandard.cleanup?.();
  }
}

/** enable / disable：npm 模式用锁记录写标记，不需要 Git。 */
export function setEnabled(root, enabled) {
  const target = path.resolve(root);
  const marker = path.join(target, '.rmdl');
  if (!enabled) {
    fs.rmSync(marker, { force: true });
    return { enabled: false, marker };
  }
  const record = readRecord(target);
  if (!record) throw new Error(`未找到 ${RECORD_FILE}，当前目录不是 RMDL 项目`);
  writeJson(marker, {
    source: record.source,
    package: record.package,
    version: record.version,
    commit: record.commit,
    enabledAt: new Date().toISOString(),
  });
  return { enabled: true, marker };
}
