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

function checkRun(destination, ...args) {
  return spawnSync(process.execPath, [script, '--action', 'check', '--root', destination, ...args], {encoding: 'utf8'});
}

test('check reports the standard gate and exits non-zero without an initialized standard', () => {
  const {destination} = fixture();
  const result = checkRun(destination, '--checks', 'standard');
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /\[FAIL\] 标准门禁/);
  assert.match(result.stdout, /缺少 vendor\/rmdl\/scripts\/rmdl\.mjs/);
  assert.deepEqual(fs.readdirSync(destination), []);
});

test('project checks run only scripts that exist and propagate failures', () => {
  const {destination} = fixture();
  fs.mkdirSync(path.join(destination, 'vendor/rmdl/scripts'), {recursive: true});
  fs.copyFileSync(path.join(repo, 'scripts/rmdl.mjs'), path.join(destination, 'vendor/rmdl/scripts/rmdl.mjs'));
  fs.writeFileSync(path.join(destination, 'package.json'), JSON.stringify({
    scripts: {
      typecheck: 'node -e "process.exit(0)"',
      test: 'node -e "process.exit(1)"',
    },
  }));
  const result = checkRun(destination, '--checks', 'project');
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /\[PASS\] \. npm run typecheck/);
  assert.match(result.stdout, /\[FAIL\] \. npm run test/);
  assert.match(result.stdout, /\[NOT RUN\] \. npm run lint/);
  assert.match(result.stdout, /\[NOT RUN\] \. npm run build/);
  assert.match(result.stdout, /汇总：PASS 1 \/ FAIL 2 \/ NOT RUN 4/);
  assert.equal(fs.existsSync(path.join(destination, 'dist')), false);
});

test('a passing project check exits zero and does not modify the working tree', () => {
  const {source, destination} = fixture();
  assert.equal(run(source, destination).status, 0);
  fs.writeFileSync(path.join(destination, 'rmdl.project.json'), JSON.stringify({
    standardVersion: '0.3.0', projectName: 'Fixture',
    selection: {operation: 'new', productType: 'service', frontendMode: 'none', frontendFramework: 'none',
      backendLanguage: 'dotnet', orm: 'freesql', productionDatabase: 'sqlite', deployment: 'docker', migrationStrategy: 'not-applicable'},
    fixed: {webFramework: 'react', language: 'typescript-strict', runtime: 'node', packageManager: 'npm',
      uiLibrary: 'heroui-v3', cssEngine: 'tailwind-v4', iconSet: 'lucide', designSystem: 'rmdl-core',
      sharedUiPackage: '@remmai/rmdl-ui', uiVersion: '0.3.0', dotnetTarget: 'net11.0'},
    versioning: {source: 'VERSION', buildId: 'git-commit', frontendPlacement: 'none'},
    governance: {state: 'locked', approvedBy: 'Owner', approvalReference: 'PR-1', approvedAt: '2026-11-16T00:00:00Z'},
  }));
  fs.writeFileSync(path.join(destination, 'VERSION'), '1.0.0\n');
  fs.writeFileSync(path.join(destination, 'CHANGELOG.md'), '# Changelog\n\n## 1.0.0\n\n- First.\n');
  fs.writeFileSync(path.join(destination, 'global.json'), JSON.stringify({sdk: {version: '11.0.100', allowPrerelease: false, rollForward: 'disable'}}));
  fs.mkdirSync(path.join(destination, 'backend'));
  fs.writeFileSync(path.join(destination, 'backend/App.csproj'), '<Project><PropertyGroup><TargetFramework>net11.0</TargetFramework></PropertyGroup></Project>');
  const before = git(destination, 'status', '--porcelain');
  const result = checkRun(destination, '--checks', 'standard');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /\[PASS\] 标准门禁/);
  assert.equal(git(destination, 'status', '--porcelain'), before);
});

test('the menu exposes check and update-then-check without extra commands', () => {
  const {source, destination} = fixture();
  const result = spawnSync(process.execPath, [script, '--root', destination, '--repository', source], {
    encoding: 'utf8', input: '3\n\n1\n0\n', env: {...process.env, GIT_ALLOW_PROTOCOL:'file'},
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /3\. 检查项目/);
  assert.match(result.stdout, /4\. 更新并检查/);
  assert.match(result.stdout, /\[FAIL\] 标准门禁/);
});

function globalRun(globalDir, ...args) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8', env: {...process.env, GIT_ALLOW_PROTOCOL:'file', RMDL_GLOBAL_DIR: globalDir},
  });
}

test('global setup installs one standard, writes a gate and registers it once', () => {
  const {root, source, destination} = fixture();
  const globalDir = path.join(root, 'global config');
  const first = globalRun(globalDir, '--action', 'global', '--repository', source);
  assert.equal(first.status, 0, first.stderr);
  const standard = path.join(globalDir, 'rmdl');
  assert.ok(fs.existsSync(path.join(standard, 'policy/session-baseline.md')));
  const gate = fs.readFileSync(path.join(globalDir, 'rmdl-gate.md'), 'utf8');
  assert.match(gate, /rmdl\.project\.json/);
  assert.match(gate, /\.rmdl/);
  assert.match(gate, /vendor\/rmdl\//);
  assert.ok(gate.includes(standard.replaceAll('\\', '/')));
  const config = JSON.parse(fs.readFileSync(path.join(globalDir, 'opencode.json'), 'utf8'));
  assert.deepEqual(config.instructions, ['rmdl-gate.md']);
  assert.equal(config.$schema, 'https://opencode.ai/config.json');
  // The product directory stays untouched by a global install.
  assert.deepEqual(fs.readdirSync(destination), []);
});

test('repeating global setup is idempotent and preserves unrelated settings', () => {
  const {root, source} = fixture();
  const globalDir = path.join(root, 'global config');
  assert.equal(globalRun(globalDir, '--action', 'global', '--repository', source).status, 0);
  const configPath = path.join(globalDir, 'opencode.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.model = 'custom/model';
  config.instructions.push('custom.md');
  fs.writeFileSync(configPath, JSON.stringify(config));
  const second = globalRun(globalDir, '--action', 'global', '--repository', source);
  assert.equal(second.status, 0, second.stderr);
  const merged = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(merged.model, 'custom/model');
  assert.deepEqual(merged.instructions, ['rmdl-gate.md', 'custom.md']);
});

test('global setup leaves a JSONC config for manual merging', () => {
  const {root, source} = fixture();
  const globalDir = path.join(root, 'global config');
  fs.mkdirSync(globalDir, {recursive: true});
  const jsonc = '// my settings\n{"model":"custom/model"}\n';
  fs.writeFileSync(path.join(globalDir, 'opencode.jsonc'), jsonc);
  const result = globalRun(globalDir, '--action', 'global', '--repository', source);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /需要手动处理/);
  assert.equal(fs.readFileSync(path.join(globalDir, 'opencode.jsonc'), 'utf8'), jsonc);
  assert.equal(fs.existsSync(path.join(globalDir, 'opencode.json')), false);
});

test('enable writes a marker bound to the global standard and disable removes only it', () => {
  const {root, source, destination} = fixture();
  const globalDir = path.join(root, 'global config');
  assert.equal(globalRun(globalDir, '--action', 'global', '--repository', source).status, 0);
  fs.writeFileSync(path.join(destination, 'business.txt'), 'keep');
  const enabled = globalRun(globalDir, '--action', 'enable', '--root', destination);
  assert.equal(enabled.status, 0, enabled.stderr);
  const marker = JSON.parse(fs.readFileSync(path.join(destination, '.rmdl'), 'utf8'));
  assert.equal(marker.standard, path.join(globalDir, 'rmdl'));
  assert.match(marker.commit, /^[a-f0-9]{40}$/);
  const disabled = globalRun(globalDir, '--action', 'disable', '--root', destination);
  assert.equal(disabled.status, 0, disabled.stderr);
  assert.equal(fs.existsSync(path.join(destination, '.rmdl')), false);
  assert.equal(fs.readFileSync(path.join(destination, 'business.txt'), 'utf8'), 'keep');
});

test('enable refuses when the global standard is missing', () => {
  const {root, destination} = fixture();
  const result = globalRun(path.join(root, 'empty config'), '--action', 'enable', '--root', destination);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /全局标准未安装/);
  assert.deepEqual(fs.readdirSync(destination), []);
});

test('menu exposes the global standard and project toggle', () => {
  const {root, source, destination} = fixture();
  const globalDir = path.join(root, 'global config');
  const result = spawnSync(process.execPath, [script, '--root', destination, '--repository', source], {
    encoding: 'utf8', input: '6\n\n2\n0\n', env: {...process.env, GIT_ALLOW_PROTOCOL:'file', RMDL_GLOBAL_DIR: globalDir},
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /5\. 全局标准/);
  assert.match(result.stdout, /6\. 启用 \/ 停用本项目/);
  assert.match(result.stdout, /已停用 RMDL/);
});

test('interactive startup presents init/update and defaults to OpenCode', () => {
  const {source, destination} = fixture();
  const result = spawnSync(process.execPath, [script, '--root', destination, '--repository', source], {
    encoding: 'utf8', input: '1\n\n\n\n\n\n0\n', env: {...process.env, GIT_ALLOW_PROTOCOL:'file'},
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
    encoding:'utf8', input:'1\n\n2\n\n\n\n0\n', env:{...process.env, GIT_ALLOW_PROTOCOL:'file'},
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
