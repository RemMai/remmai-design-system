import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repo, 'bin/rem.mjs');
const roots = [];
const tempBase = process.platform === 'win32' && fs.existsSync(path.join(os.tmpdir(), 'opencode'))
  ? path.join(os.tmpdir(), 'opencode') : os.tmpdir();

function project(name = 'product') {
  const dir = fs.mkdtempSync(path.join(tempBase, `rmdl-npm-${name}-`));
  roots.push(dir);
  return dir;
}

function run(root, ...args) {
  const result = spawnSync(process.execPath, [cli, ...args, root], {
    encoding: 'utf8',
    env: { ...process.env, RMDL_STANDARD_DIR: repo, RMDL_LAUNCHER_PATH: '' },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test.after(() => {
  for (const dir of roots) fs.rmSync(dir, { recursive: true, force: true });
});

test('init vendors the bundled standard and pins an npm lock record', () => {
  const root = project();
  const result = run(root, 'init', '--agent', 'skip');
  assert.equal(result.status, 0, result.output);

  for (const file of ['RMDL.md', 'policy/session-baseline.md', 'scripts/rmdl.mjs', 'templates/project/AGENTS.md']) {
    assert.ok(fs.existsSync(path.join(root, 'vendor/rmdl', file)), `missing vendor/rmdl/${file}`);
  }
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  assert.equal(fs.existsSync(path.join(root, 'opencode.json')), false);

  const record = JSON.parse(fs.readFileSync(path.join(root, 'rmdl.bootstrap.json'), 'utf8'));
  assert.equal(record.source, 'npm');
  assert.equal(record.package, 'rem-ai-design');
  assert.match(record.version, /^\d+\.\d+\.\d+$/);
  assert.equal(record.state, 'awaiting-project-selection');
  assert.ok(Object.keys(record.lock.standard).includes('RMDL.md'));
  assert.equal(fs.existsSync(path.join(root, '.gitignore')), true);
  // 只暂存，不自动提交：业务仓库的首次提交由人决定。
  assert.equal(spawnSync('git', ['-C', root, 'rev-parse', '--verify', 'HEAD']).status, 128);
});

test('init writes agent entrypoints when OpenCode is selected', () => {
  const root = project('agent');
  const result = run(root, 'init');
  assert.equal(result.status, 0, result.output);
  const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(agents, /vendor\/rmdl\/policy\/session-baseline\.md/);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'opencode.json'), 'utf8'));
  assert.ok(config.instructions.includes('vendor/rmdl/policy/session-baseline.md'));
});

test('init refuses a directory that already has content', () => {
  const root = project('dirty');
  fs.writeFileSync(path.join(root, 'notes.txt'), 'keep me');
  const result = run(root, 'init', '--agent', 'skip');
  assert.equal(result.status, 1);
  assert.match(result.output, /不是空目录/);
  assert.equal(fs.readFileSync(path.join(root, 'notes.txt'), 'utf8'), 'keep me');
  assert.equal(fs.existsSync(path.join(root, 'vendor')), false);
});

test('update is a no-op on the same version and reports it', () => {
  const root = project('same');
  assert.equal(run(root, 'init', '--agent', 'skip').status, 0);
  const before = fs.readFileSync(path.join(root, 'rmdl.bootstrap.json'), 'utf8');
  const result = run(root, 'update', '--agent', 'skip');
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /已是目标版本/);
  const after = JSON.parse(fs.readFileSync(path.join(root, 'rmdl.bootstrap.json'), 'utf8'));
  assert.equal(after.version, JSON.parse(before).version);
});

test('update refuses locally modified standard files unless forced', () => {
  const root = project('tampered');
  assert.equal(run(root, 'init', '--agent', 'skip').status, 0);
  const target = path.join(root, 'vendor/rmdl/RMDL.md');
  fs.appendFileSync(target, '\n本地私改\n');

  const refused = run(root, 'update', '--agent', 'skip');
  assert.equal(refused.status, 1);
  assert.match(refused.output, /本地修改/);
  assert.match(fs.readFileSync(target, 'utf8'), /本地私改/);

  const forced = run(root, 'update', '--agent', 'skip', '--force');
  assert.equal(forced.status, 0, forced.output);
  assert.doesNotMatch(fs.readFileSync(target, 'utf8'), /本地私改/);
});

test('version and enable/disable work without Git submodules', () => {
  const root = project('version');
  assert.equal(run(root, 'init', '--agent', 'skip').status, 0);

  // 版本号来自根 VERSION，测试不硬编码发布版本
  const expected = fs.readFileSync(path.join(repo, 'VERSION'), 'utf8').trim();
  const version = run(root, 'version');
  assert.equal(version.status, 0, version.output);
  assert.match(version.output, new RegExp(`cli\\s+${expected.replaceAll('.', '\\.')}`));
  assert.match(version.output, new RegExp(`project lock\\s+npm ${expected.replaceAll('.', '\\.')}`));

  assert.equal(run(root, 'enable').status, 0);
  const marker = JSON.parse(fs.readFileSync(path.join(root, '.rmdl'), 'utf8'));
  assert.equal(marker.source, 'npm');
  assert.equal(run(root, 'disable').status, 0);
  assert.equal(fs.existsSync(path.join(root, '.rmdl')), false);
});
