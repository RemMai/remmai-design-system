#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'README.md', 'RMDL.md', 'AGENTS.md', 'CLAUDE.md',
  'docs/06-跨Agent统一接入.md', 'docs/07-组件注册晋升.md',
  'docs/08-私有包发布与升级.md', 'docs/09-GitHub私有仓库初始化.md',
  'docs/10-业务项目接入.md', 'docs/11-视觉与工程验收.md',
  'registry/components.json', 'scripts/rmdl.mjs',
  'templates/project/AGENTS.md', 'templates/project/CLAUDE.md',
  'policy/session-baseline.md', 'opencode.json', 'templates/project/opencode.json',
  'docs/16-产品版本与构建标识.md',
  'scripts/bootstrap.mjs', 'rmdl.cmd', 'tests/rmdl-bootstrap.test.mjs',
  'package.json', 'VERSION', 'bin/rem.mjs', 'scripts/npm-mode.mjs',
  'scripts/prepack.mjs', 'tests/rmdl-npm.test.mjs',
];
const problems = [];
for (const file of required) if (!fs.existsSync(path.join(root, file))) problems.push(`Missing file: ${file}`);
let pkg;
try { pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')); }
catch (e) { problems.push(`package.json: ${e.message}`); }
if (pkg) {
  const version = fs.existsSync(path.join(root, 'VERSION')) ? fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim() : '';
  if (pkg.name !== 'rem-ai-design') problems.push(`package.json name must stay rem-ai-design (got ${pkg.name})`);
  if (pkg.version !== version) problems.push(`package.json version ${pkg.version} != VERSION ${version}`);
  if (!pkg.bin?.remdl || !pkg.bin?.rem) problems.push('package.json: bin must expose both remdl and rem');
  if (!Array.isArray(pkg.files) || !pkg.files.includes('standard/')) problems.push('package.json: files must ship the standard/ snapshot');
}
for (const [file, baseline] of [['opencode.json', 'policy/session-baseline.md'], ['templates/project/opencode.json', 'vendor/rmdl/policy/session-baseline.md']]) {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    if (!config.instructions?.includes(baseline)) problems.push(`${file}: missing baseline instructions`);
  } catch (e) { problems.push(`${file}: ${e.message}`); }
}
let registry;
try { registry = JSON.parse(fs.readFileSync(path.join(root, 'registry/components.json'), 'utf8')); }
catch (e) { problems.push(`Registry invalid JSON: ${e.message}`); }
if (registry) {
  const statuses = new Set(['proposed', 'candidate', 'approved', 'deprecated', 'retired']);
  const ids = new Set();
  if (!Array.isArray(registry.components)) problems.push('registry.components must be an array');
  for (const c of Array.isArray(registry.components) ? registry.components : []) {
    if (!c.id || typeof c.id !== 'string' || ids.has(c.id)) problems.push(`component id missing/duplicate: ${c.id}`);
    ids.add(c.id);
    if (!statuses.has(c.status)) problems.push(`${c.id}: invalid status ${c.status}`);
    if (c.status === 'approved') {
      if (!(typeof c.package === 'string' && typeof c.export === 'string' && typeof c.version === 'string' && typeof c.ownerApproval === 'string' && c.ownerApproval.startsWith('https://'))) {
        problems.push(`${c.id}: approved requires package/export/version/ownerApproval URL`);
      }
    }
    if (c.status === 'proposed' && c.version !== null) problems.push(`${c.id}: proposed must not claim released version`);
  }
}
if (problems.length) {
  console.error('RMDL repository checks FAILED:');
  for (const item of problems) console.error(' - ' + item);
  process.exitCode = 1;
} else console.log('RMDL repository checks PASS: required files and registry invariants verified. This is not a UI build/visual test.');
