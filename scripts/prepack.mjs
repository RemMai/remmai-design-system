#!/usr/bin/env node
/**
 * 发布前把标准本体快照进 standard/，让 `npm i -g` 的 CLI 能离线装标准。
 *
 * 只在 prepack 阶段运行；生成物不进入 Git，避免双份规范源。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const target = path.join(root, 'standard');

const payload = [
  'RMDL.md', 'AGENTS.md', 'CLAUDE.md', 'README.md',
  'rmdl.project.example.json', 'VERSION', 'rmdl.cmd',
  'scripts', 'docs', 'policy', 'templates', 'registry', 'packages',
];

const EXCLUDED = new Set(['.git', 'node_modules', 'bin', 'obj', 'dist', 'build', 'artifacts', '.vs', '.idea', '.vscode', 'standard']);

function readVersion() {
  const file = path.join(root, 'VERSION');
  if (!fs.existsSync(file)) throw new Error('缺少根 VERSION 文件');
  const version = fs.readFileSync(file, 'utf8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`VERSION 不是 MAJOR.MINOR.PATCH：${version}`);
  return version;
}

function resolveCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.trim();
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

const version = readVersion();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.version !== version) {
  throw new Error(`package.json ${pkg.version} 与 VERSION ${version} 不一致，先同步版本`);
}
if (pkg.name !== 'rem-ai-design') {
  throw new Error(`包名必须为 rem-ai-design，当前为 ${pkg.name}`);
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

for (const entry of payload) {
  const from = path.join(root, entry);
  if (!fs.existsSync(from)) throw new Error(`标准快照缺少必需内容：${entry}`);
  fs.cpSync(from, path.join(target, entry), {
    recursive: true,
    dereference: true,
    filter(src) {
      const parts = path.relative(root, src).split(path.sep).filter(Boolean);
      return !parts.some(part => EXCLUDED.has(part));
    },
  });
}

const meta = {
  name: pkg.name,
  version,
  commit: resolveCommit(),
  builtAt: new Date().toISOString(),
  platform: `${process.platform}-${process.arch}`,
};
fs.writeFileSync(path.join(target, '.rmdl-standard.json'), JSON.stringify(meta, null, 2) + '\n');

// 快照只是数据，不参与模块解析；显式标记为私有，避免被当成第二个可发布包。
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({
  name: 'rem-ai-design-standard',
  version,
  private: true,
  type: 'module',
}, null, 2) + '\n');

const files = [];
(function count(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count(full);
    else files.push(full);
  }
})(target);

const bytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
console.log(`standard 快照已生成：${files.length} 个文件，${(bytes / 1024).toFixed(1)} KB`);
console.log(`版本：${version}   commit：${(meta.commit ?? 'unknown').slice(0, 8)}`);
console.log(`位置：${target}`);
