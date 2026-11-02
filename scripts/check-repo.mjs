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
];
const problems = [];
for (const file of required) if (!fs.existsSync(path.join(root, file))) problems.push(`Missing file: ${file}`);
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
