#!/usr/bin/env node
/** 同步提升 VERSION 与 package.json 的版本，避免两处漂移。 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const version = process.argv[2];
if (!version) {
  console.error('用法：node scripts/bump-version.mjs <MAJOR.MINOR.PATCH>');
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`版本号必须是 MAJOR.MINOR.PATCH（不带 v 前缀）：${version}`);
  process.exit(1);
}

const versionFile = path.join(root, 'VERSION');
const pkgFile = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
const previous = fs.readFileSync(versionFile, 'utf8').trim();

fs.writeFileSync(versionFile, `${version}\n`);
pkg.version = version;
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');

console.log(`版本：${previous} → ${version}`);
console.log('下一步：git commit -am "chore: release ' + version + '" && git tag v' + version + ' && git push origin main --tags');
