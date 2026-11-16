import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(repo, 'scripts/bootstrap.mjs');
const roots = [];
const tempBase = process.platform === 'win32' && fs.existsSync(path.join(os.tmpdir(), 'opencode'))
  ? path.join(os.tmpdir(), 'opencode') : os.tmpdir();

function git(root, ...args) {
  const result = spawnSync('git', ['-C', root, ...args], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function fixture() {
  const root = fs.mkdtempSync(path.join(tempBase, 'rmdl-bootstrap-'));
  roots.push(root);
  const source = path.join(root, 'standard source');
  const destination = path.join(root, 'new product 空目录');
  fs.mkdirSync(source);
  fs.mkdirSync(destination);
  for (const file of ['RMDL.md', 'policy/session-baseline.md', 'scripts/rmdl.mjs', 'scripts/bootstrap.mjs', 'rmdl.cmd',
    'templates/project/AGENTS.md', 'templates/project/CLAUDE.md', 'templates/project/opencode.json']) {
    fs.mkdirSync(path.dirname(path.join(source, file)), {recursive: true});
    fs.copyFileSync(path.join(repo, file), path.join(source, file));
  }
  git(source, 'init', '-b', 'main');
  git(source, 'add', '.');
  git(source, '-c', 'user.name=RMDL Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture');
  return {root, source, destination, commit: git(source, 'rev-parse', 'HEAD')};
}

function run(source, destination, ...args) {
  return spawnSync(process.execPath, [script, '--action', 'init', '--root', destination, '--repository', source, ...args], {
    encoding: 'utf8',
    // Local transport is enabled only for isolated test fixtures, never by the installer.
    env: {...process.env, GIT_ALLOW_PROTOCOL: 'file'},
  });
}

test('empty directory gains pinned submodule and working agent entrypoints', () => {
  const {source, destination, commit} = fixture();
  const result = run(source, destination);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(path.join(destination, 'vendor/rmdl'), 'rev-parse', 'HEAD'), commit);
  assert.match(git(destination, 'ls-files', '--stage', 'vendor/rmdl'), new RegExp(`^160000 ${commit} `));
  for (const file of ['AGENTS.md', 'opencode.json']) {
    assert.equal(fs.readFileSync(path.join(destination, file), 'utf8').trim(), fs.readFileSync(path.join(source, 'templates/project', file), 'utf8').replaceAll('\r\n', '\n').trim());
  }
  assert.equal(fs.existsSync(path.join(destination, 'CLAUDE.md')), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(destination, 'rmdl.bootstrap.json'))).state, 'awaiting-project-selection');
  assert.equal(fs.existsSync(path.join(destination, 'rmdl.project.json')), false);
  assert.equal(fs.existsSync(path.join(destination, 'VERSION')), false);
  assert.equal(spawnSync('git', ['-C', destination, 'rev-parse', '--verify', 'HEAD']).status, 128);
});

test('explicit non-default branch is pinned instead of remote HEAD', () => {
  const {source, destination} = fixture();
  git(source, 'checkout', '-b', 'standards/new');
  fs.writeFileSync(path.join(source, 'RMDL.md'), '# New standard\n');
  git(source, 'add', '.');
  git(source, '-c', 'user.name=RMDL Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'new standard');
  const commit = git(source, 'rev-parse', 'HEAD');
  git(source, 'checkout', 'main');
  const result = run(source, destination, '--ref', 'standards/new');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(path.join(destination, 'vendor/rmdl'), 'rev-parse', 'HEAD'), commit);
  assert.equal(JSON.parse(fs.readFileSync(path.join(destination, 'rmdl.bootstrap.json'))).commit, commit);
});

test('existing files and existing Git repositories are never overwritten', () => {
  const {source, destination} = fixture();
  fs.writeFileSync(path.join(destination, 'AGENTS.md'), 'my existing rules');
  const result = run(source, destination);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /不是空目录/);
  assert.deepEqual(fs.readdirSync(destination), ['AGENTS.md']);
  assert.equal(fs.readFileSync(path.join(destination, 'AGENTS.md'), 'utf8'), 'my existing rules');
  fs.unlinkSync(path.join(destination, 'AGENTS.md'));
  git(destination, 'init');
  assert.notEqual(run(source, destination).status, 0);
  assert.deepEqual(fs.readdirSync(destination), ['.git']);
});

for (const failure of ['unreachable', 'invalid-ref', 'missing-template']) {
  test(`${failure} leaves the destination empty and removes staging data`, () => {
    const {root, source, destination} = fixture();
    if (failure === 'missing-template') {
      git(source, 'rm', 'templates/project/opencode.json');
      git(source, '-c', 'user.name=RMDL Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'incomplete fixture');
    }
    const result = run(failure === 'unreachable' ? path.join(root, 'missing-repo') : source,
      destination, ...(failure === 'invalid-ref' ? ['--ref', 'missing-branch'] : []));
    assert.notEqual(result.status, 0);
    assert.deepEqual(fs.readdirSync(destination), []);
    assert.equal(fs.readdirSync(root).some(name => name.startsWith('.rmdl-setup-')), false);
  });
}

test('a new destination can be created and repeat execution is rejected', () => {
  const {source, destination} = fixture();
  fs.rmdirSync(destination);
  const first = run(source, destination);
  assert.equal(first.status, 0, first.stderr);
  assert.notEqual(run(source, destination).status, 0);
  assert.ok(fs.existsSync(path.join(destination, 'opencode.json')));
});

test('unknown arguments fail without installing into the working directory', () => {
  const result = spawnSync(process.execPath, [script, '--destination', '.'], {encoding: 'utf8'});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /未知参数/);
});

test('skip installs the standard without any agent entrypoint', () => {
  const {source, destination} = fixture();
  const result = run(source, destination, '--agent', 'skip');
  assert.equal(result.status, 0, result.stderr);
  for (const file of ['AGENTS.md', 'CLAUDE.md', 'opencode.json']) assert.equal(fs.existsSync(path.join(destination, file)), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(destination, 'rmdl.bootstrap.json'))).agent, 'skip');
});

function advance(source) {
  fs.appendFileSync(path.join(source, 'templates/project/AGENTS.md'), '\nNew standard rule.\n');
  git(source, 'add', '.');
  git(source, '-c', 'user.name=RMDL Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'updated standard');
  return git(source, 'rev-parse', 'HEAD');
}

test('update fetches remote HEAD, preserves product selection and merges OpenCode settings', () => {
  const {source, destination, commit} = fixture();
  const initial = run(source, destination);
  assert.equal(initial.status, 0, initial.stderr);
  fs.writeFileSync(path.join(destination, 'rmdl.project.json'), '{"governance":{"state":"locked"}}');
  fs.writeFileSync(path.join(destination, 'VERSION'), '1.2.3');
  fs.writeFileSync(path.join(destination, 'opencode.json'), JSON.stringify({model:'custom/model', instructions:['custom.md']}));
  const next = advance(source);
  const updated = run(source, destination, '--action', 'update');
  assert.equal(updated.status, 0, updated.stderr);
  assert.equal(git(path.join(destination, 'vendor/rmdl'), 'rev-parse', 'HEAD'), next);
  assert.equal(fs.readFileSync(path.join(destination, 'rmdl.project.json'), 'utf8'), '{"governance":{"state":"locked"}}');
  assert.equal(fs.readFileSync(path.join(destination, 'VERSION'), 'utf8'), '1.2.3');
  const config = JSON.parse(fs.readFileSync(path.join(destination, 'opencode.json')));
  assert.equal(config.model, 'custom/model');
  assert.deepEqual(config.instructions, ['custom.md', 'vendor/rmdl/policy/session-baseline.md']);
  assert.match(fs.readFileSync(path.join(destination, 'AGENTS.md'), 'utf8'), /New standard rule/);
  const record = JSON.parse(fs.readFileSync(path.join(destination, 'rmdl.bootstrap.json')));
  assert.equal(record.previousCommit, commit);
  assert.equal(record.commit, next);
  // The update remains reviewable and does not change the previously staged baseline.
  assert.match(git(destination, 'ls-files', '--stage', 'vendor/rmdl'), new RegExp(`^160000 ${commit} `));
});

test('custom agent rules block automatic replacement; skip still allows a standard update', () => {
  const {source, destination, commit} = fixture();
  assert.equal(run(source, destination).status, 0);
  const custom = 'my custom rules\n';
  fs.writeFileSync(path.join(destination, 'AGENTS.md'), custom);
  const next = advance(source);
  const rejected = run(source, destination, '--action', 'update');
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /AGENTS.md 有自定义修改/);
  assert.equal(git(path.join(destination, 'vendor/rmdl'), 'rev-parse', 'HEAD'), commit);
  assert.equal(fs.readFileSync(path.join(destination, 'AGENTS.md'), 'utf8'), custom);
  const skipped = run(source, destination, '--action', 'update', '--agent', 'skip');
  assert.equal(skipped.status, 0, skipped.stderr);
  assert.equal(git(path.join(destination, 'vendor/rmdl'), 'rev-parse', 'HEAD'), next);
  assert.equal(fs.readFileSync(path.join(destination, 'AGENTS.md'), 'utf8'), custom);
});

test('dirty submodule and missing update revisions keep the pinned checkout intact', () => {
  const {source, destination, commit} = fixture();
  assert.equal(run(source, destination).status, 0);
  advance(source);
  const dirty = path.join(destination, 'vendor/rmdl/local.txt');
  fs.writeFileSync(dirty, 'local work');
  const rejected = run(source, destination, '--action', 'update');
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /vendor\/rmdl 有本地修改/);
  assert.equal(fs.readFileSync(dirty, 'utf8'), 'local work');
  fs.unlinkSync(dirty);
  const missing = run(source, destination, '--action', 'update', '--ref', 'no-such-ref');
  assert.notEqual(missing.status, 0);
  assert.equal(git(path.join(destination, 'vendor/rmdl'), 'rev-parse', 'HEAD'), commit);
});

test('OpenCode can be installed during update after initial skip', () => {
  const {source, destination} = fixture();
  assert.equal(run(source, destination, '--agent', 'skip').status, 0);
  const result = run(source, destination, '--action', 'update');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(destination, 'opencode.json')));
  assert.ok(fs.existsSync(path.join(destination, 'AGENTS.md')));
  assert.equal(fs.existsSync(path.join(destination, 'CLAUDE.md')), false);
});

test('an explicit commit remains pinned after newer remote commits appear', () => {
  const {source, destination, commit} = fixture();
  assert.equal(run(source, destination, '--ref', commit).status, 0);
  advance(source);
  const result = run(source, destination, '--action', 'update');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(path.join(destination, 'vendor/rmdl'), 'rev-parse', 'HEAD'), commit);
});

test('alternate OpenCode config refuses automatic rewrite before checkout', () => {
  const {source, destination, commit} = fixture();
  assert.equal(run(source, destination).status, 0);
  const config = '// my JSONC settings\n{}';
  fs.writeFileSync(path.join(destination, 'opencode.jsonc'), config);
  advance(source);
  const result = run(source, destination, '--action', 'update');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /其他 OpenCode 配置入口/);
  assert.equal(git(path.join(destination, 'vendor/rmdl'), 'rev-parse', 'HEAD'), commit);
  assert.equal(fs.readFileSync(path.join(destination, 'opencode.jsonc'), 'utf8'), config);
});

test('ignored local files are not overwritten by a standard update', () => {
  const {source, destination} = fixture();
  fs.writeFileSync(path.join(source, '.gitignore'), 'local-only.txt\n');
  git(source, 'add', '.gitignore');
  git(source, '-c', 'user.name=RMDL Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'ignored path');
  const previous = git(source, 'rev-parse', 'HEAD');
  assert.equal(run(source, destination).status, 0);
  const local = path.join(destination, 'vendor/rmdl/local-only.txt');
  fs.writeFileSync(local, 'my ignored file');
  const recordBefore = fs.readFileSync(path.join(destination, 'rmdl.bootstrap.json'), 'utf8');
  fs.writeFileSync(path.join(source, 'local-only.txt'), 'new standard file');
  git(source, 'add', '-f', 'local-only.txt');
  git(source, '-c', 'user.name=RMDL Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'new tracked file');
  const result = run(source, destination, '--action', 'update');
  assert.notEqual(result.status, 0);
  assert.equal(git(path.join(destination, 'vendor/rmdl'), 'rev-parse', 'HEAD'), previous);
  assert.equal(fs.readFileSync(local, 'utf8'), 'my ignored file');
  assert.equal(fs.readFileSync(path.join(destination, 'rmdl.bootstrap.json'), 'utf8'), recordBefore);
});

test('invalid agent values never initialize a directory', () => {
  const {source, destination} = fixture();
  const result = run(source, destination, '--agent', 'claude');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /只能为 opencode 或 skip/);
  assert.deepEqual(fs.readdirSync(destination), []);
});

test('interactive startup presents init/update and defaults to OpenCode', () => {
  const {source, destination} = fixture();
  const result = spawnSync(process.execPath, [script, '--root', destination, '--repository', source], {
    encoding: 'utf8', input: '1\n\n\n\n\n0\n', env: {...process.env, GIT_ALLOW_PROTOCOL:'file'},
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1\. 初始化标准/);
  assert.match(result.stdout, /2\. 更新标准/);
  assert.ok(fs.existsSync(path.join(destination, 'opencode.json')));
});

test('interactive startup supports skip and cancellation without filesystem writes', () => {
  const {source, destination} = fixture();
  const cancelled = spawnSync(process.execPath, [script, '--root', destination, '--repository', source], {encoding:'utf8', input:'0\n'});
  assert.equal(cancelled.status, 0, cancelled.stderr);
  assert.deepEqual(fs.readdirSync(destination), []);
  const skipped = spawnSync(process.execPath, [script, '--root', destination, '--repository', source], {
    encoding:'utf8', input:'1\n\n2\n\n\n0\n', env:{...process.env, GIT_ALLOW_PROTOCOL:'file'},
  });
  assert.equal(skipped.status, 0, skipped.stderr);
  assert.equal(fs.existsSync(path.join(destination, 'AGENTS.md')), false);
  assert.ok(fs.existsSync(path.join(destination, 'vendor/rmdl')));
});

function launcherRun(source, destination, args = [], input) {
  const launcher = path.join(destination, 'rmdl.cmd');
  const env = {...process.env, GIT_ALLOW_PROTOCOL:'file', RMDL_BOOTSTRAP_REPOSITORY:source, RMDL_BOOTSTRAP_REF:'main'};
  // Exercise the actual batch wrapper on Windows, and its embedded loader on other CI platforms.
  if (process.platform === 'win32') {
    const command = `""${launcher}" ${args.map(arg => `"${arg}"`).join(' ')}"`;
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {cwd:destination, env, encoding:'utf8', input, windowsVerbatimArguments:true});
  }
  const loader = "const fs=require('node:fs');const text=fs.readFileSync(process.argv[1],'utf8');eval(text.slice(text.indexOf('\\n// RMDL_NODE_START')+1));";
  return spawnSync(process.execPath, ['-e', loader, launcher, ...args], {cwd:destination, env, encoding:'utf8', input});
}

test('a copied standalone launcher downloads tools and initializes its own folder', () => {
  const {source, destination} = fixture();
  const launcher = path.join(destination, 'rmdl.cmd');
  fs.copyFileSync(path.join(repo, 'rmdl.cmd'), launcher);
  const before = fs.readFileSync(launcher, 'utf8');
  const result = launcherRun(source, destination, ['--action','init','--repository',source,'--agent','opencode']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Loading RMDL tools/);
  assert.ok(fs.existsSync(path.join(destination, 'vendor/rmdl/scripts/bootstrap.mjs')));
  assert.ok(fs.existsSync(path.join(destination, 'opencode.json')));
  assert.equal(fs.readFileSync(launcher, 'utf8'), before);
  assert.equal(git(destination, 'ls-files', 'rmdl.cmd'), 'rmdl.cmd');
});

test('a copied launcher uses an installed submodule without downloading tools', () => {
  const {source, destination} = fixture();
  assert.equal(run(source, destination).status, 0);
  fs.copyFileSync(path.join(repo, 'rmdl.cmd'), path.join(destination, 'rmdl.cmd'));
  const result = launcherRun(path.join(destination, 'missing-remote'), destination, ['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Loading RMDL tools/);
  assert.match(result.stdout, /初始化目标/);
});

test('a copied launcher opens the menu in an existing project with an old submodule', () => {
  const {source, destination} = fixture();
  assert.equal(run(source, destination).status, 0);
  fs.unlinkSync(path.join(destination, 'vendor/rmdl/scripts/bootstrap.mjs'));
  fs.copyFileSync(path.join(repo, 'rmdl.cmd'), path.join(destination, 'rmdl.cmd'));
  const result = launcherRun(source, destination, ['--root', destination], '0\n');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Loading RMDL tools/);
  assert.match(result.stdout, /2\. 更新标准/);
  assert.equal(fs.existsSync(path.join(destination, 'vendor/rmdl/scripts/bootstrap.mjs')), false);
});

test('standalone launcher download failure preserves launcher and existing files', () => {
  const {root, destination} = fixture();
  fs.copyFileSync(path.join(repo, 'rmdl.cmd'), path.join(destination, 'rmdl.cmd'));
  fs.writeFileSync(path.join(destination, 'business.txt'), 'keep me');
  const result = launcherRun(path.join(root, 'no-remote'), destination, ['--help']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RMDL launcher failed/);
  assert.deepEqual(fs.readdirSync(destination).sort(), ['business.txt', 'rmdl.cmd']);
  assert.equal(fs.readFileSync(path.join(destination, 'business.txt'), 'utf8'), 'keep me');
});

test('allowing the active launcher does not allow other files during initialization', () => {
  const {source, destination} = fixture();
  fs.copyFileSync(path.join(repo, 'rmdl.cmd'), path.join(destination, 'rmdl.cmd'));
  fs.writeFileSync(path.join(destination, 'business.txt'), 'keep me');
  const result = launcherRun(source, destination, ['--action','init','--repository',source]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /不是空目录/);
  assert.deepEqual(fs.readdirSync(destination).sort(), ['business.txt', 'rmdl.cmd']);
});

process.on('exit', () => roots.forEach(root => fs.rmSync(root, {recursive: true, force: true})));
