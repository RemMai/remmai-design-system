import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceCli = path.join(repoRoot, 'scripts', 'rmdl.mjs');

function run(script, args, cwd, input) {
  return spawnSync(process.execPath, [script, ...args], {cwd, input, encoding: 'utf8', windowsHide: true});
}

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rmdl-cli-hint-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  return directory;
}

test('usage in the standard repo points at scripts/rmdl.mjs', () => {
  const result = run(sourceCli, [], repoRoot);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: node scripts\/rmdl\.mjs /);
  assert.doesNotMatch(result.stdout, /vendor\/rmdl/);
});

test('usage in an installed business repo points at vendor/rmdl/scripts/rmdl.mjs', t => {
  const root = temporaryDirectory(t);
  const installed = path.join(root, 'vendor', 'rmdl', 'scripts', 'rmdl.mjs');
  fs.mkdirSync(path.dirname(installed), {recursive: true});
  fs.copyFileSync(sourceCli, installed);
  const result = run(installed, [], root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: node vendor\/rmdl\/scripts\/rmdl\.mjs /);
  assert.doesNotMatch(result.stdout, /Usage: node scripts\/rmdl\.mjs/);
});

test('usage adds --root when the working directory is not the project root', t => {
  const elsewhere = temporaryDirectory(t);
  const result = run(sourceCli, ['--root', repoRoot], elsewhere);
  assert.equal(result.status, 0, result.stderr);
  const absoluteRoot = repoRoot.split(path.sep).join('/');
  assert.ok(result.stdout.includes(`--root "${absoluteRoot}"`), result.stdout);
});

test('init and approve hints derive the CLI path from the running script', () => {
  const source = fs.readFileSync(sourceCli, 'utf8');
  assert.doesNotMatch(source, /node scripts\/rmdl\.mjs/);
  assert.match(source, /cliInvocation\(root, 'approve'\)/);
  assert.match(source, /cliInvocation\(root, 'check'\)/);
});
