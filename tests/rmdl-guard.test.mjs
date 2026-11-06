import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '../scripts/rmdl.mjs');
const example = JSON.parse(fs.readFileSync(path.join(here,'../rmdl.project.example.json'), 'utf8'));
const roots = [];
function fixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rmdl-'));
  roots.push(root);
  const manifest=structuredClone(example);
  manifest.governance={state:'locked',approvedBy:'Owner',approvalReference:'PR-1',approvedAt:'2026-11-02T00:00:00Z'};
  fs.writeFileSync(path.join(root,'rmdl.project.json'),JSON.stringify(manifest));
  const web=path.join(root,'apps/web');
  fs.mkdirSync(path.join(web,'src/app/users'), {recursive:true});
  fs.writeFileSync(path.join(root,'bun.lock'),'');
  fs.writeFileSync(path.join(web,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true}}));
  fs.writeFileSync(path.join(web,'src/globals.css'),'@import \"tailwindcss\";\n@import \"@heroui/styles\";\n@import \"@remmai/rmdl-tokens/colors.css\";');
  fs.writeFileSync(path.join(web,'package.json'),JSON.stringify({
    dependencies:{react:'^19.0.0','@heroui/react':'^3.0.0','@heroui/styles':'^3.0.0',
      tailwindcss:'^4.0.0','lucide-react':'^0.400.0','@remmai/rmdl-ui':'0.3.0','@remmai/rmdl-tokens':'0.3.0'},
    devDependencies:{typescript:'^5.0.0',vite:'^7.0.0'},
  }));
  fs.writeFileSync(path.join(web,'src/app/users/page.tsx'),
    "import {AppPage} from '@remmai/rmdl-ui'; export default function Page(){return <AppPage>Users</AppPage>}");
  return {root,web,manifest};
}
function run(root) {return spawnSync(process.execPath,[cli,'check','--root',root],{encoding:'utf8'});}
test('compliant locked project passes static guard',()=>{
  const {root}=fixture();
  assert.equal(run(root).status,0);
});
test('draft selection cannot pass',()=>{
  const {root,manifest}=fixture();
  manifest.governance.state='draft';
  fs.writeFileSync(path.join(root,'rmdl.project.json'),JSON.stringify(manifest));
  const r=run(root);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/未锁定/);
});
test('second UI library is blocked',()=>{
  const {root,web}=fixture();
  const f=path.join(web,'package.json');
  const pkg=JSON.parse(fs.readFileSync(f,'utf8'));
  pkg.dependencies.antd='^6.0.0';
  fs.writeFileSync(f,JSON.stringify(pkg));
  assert.match(run(root).stderr,/禁止引入第二套 UI/);
});
test('CSS raw color in business page is blocked',()=>{
  const {root,web}=fixture();
  fs.writeFileSync(path.join(web,'src/app/users/custom.css'),'.card {background:#abcdef;}');
  assert.match(run(root).stderr,/硬编码颜色/);
});
test('removed RMDL core dependency is blocked',()=>{
  const {root,web}=fixture();
  const f=path.join(web,'package.json');
  const pkg=JSON.parse(fs.readFileSync(f,'utf8'));
  delete pkg.dependencies['@remmai/rmdl-ui'];
  fs.writeFileSync(f,JSON.stringify(pkg));
  assert.match(run(root).stderr,/共享 UI|rmdl-ui/);
});
test('front-end fixed stack cannot be changed by an agent',()=>{
  const {root,manifest}=fixture();
  manifest.fixed.webFramework='vue';
  fs.writeFileSync(path.join(root,'rmdl.project.json'),JSON.stringify(manifest));
  assert.match(run(root).stderr,/fixed.webFramework/);
});

test('page cannot bypass shared AppPage by merely importing UI package',()=>{
  const {root,web}=fixture();
  fs.writeFileSync(path.join(web,'src/app/users/page.tsx'),
    "import {AppPage} from '@remmai/rmdl-ui'; export default function Page(){return <div>Users</div>}");
  assert.match(run(root).stderr,/页面必须使用统一/);
});
test('HeroUI styles imported before Tailwind are blocked',()=>{
  const {root,web}=fixture();
  fs.writeFileSync(path.join(web,'src/globals.css'),
    '@import \"@heroui/styles\";\n@import \"tailwindcss\";\n@import \"@remmai/rmdl-tokens/colors.css\";');
  assert.match(run(root).stderr,/必须在 TailwindCSS 之后/);
});
test('static-html tool validates token stylesheet without requiring a JS toolchain',()=>{
  const {root,web,manifest}=fixture();
  manifest.selection.productType='tool';
  manifest.selection.frontendMode='static-html';
  manifest.selection.frontendFramework='none';
  manifest.selection.backendLanguage='none';
  manifest.selection.orm='none';
  manifest.selection.productionDatabase='none';
  fs.writeFileSync(path.join(root,'rmdl.project.json'),JSON.stringify(manifest));
  fs.rmSync(web,{recursive:true,force:true});
  fs.mkdirSync(path.join(web,'assets'),{recursive:true});
  fs.writeFileSync(path.join(web,'index.html'),'<link rel="stylesheet" href="assets/rmdl-tokens.css"><main>Tool</main>');
  fs.writeFileSync(path.join(web,'assets/rmdl-tokens.css'),':root { --rmdl-bg-canvas: white; }');
  assert.equal(run(root).status,0);
});
test('static-html requires the RMDL token stylesheet reference',()=>{
  const {root,web,manifest}=fixture();
  manifest.selection.productType='tool';
  manifest.selection.frontendMode='static-html';
  manifest.selection.frontendFramework='none';
  manifest.selection.backendLanguage='none';
  manifest.selection.orm='none';
  manifest.selection.productionDatabase='none';
  fs.writeFileSync(path.join(root,'rmdl.project.json'),JSON.stringify(manifest));
  fs.rmSync(web,{recursive:true,force:true});
  fs.mkdirSync(path.join(web,'assets'),{recursive:true});
  fs.writeFileSync(path.join(web,'index.html'),'<main>Tool</main>');
  fs.writeFileSync(path.join(web,'assets/rmdl-tokens.css'),'');
  assert.match(run(root).stderr,/必须加载 assets\/rmdl-tokens\.css/);
});
test('redundant AI promotional slop in UI is blocked',()=>{
  const {root,web}=fixture();
  fs.writeFileSync(path.join(web,'src/app/users/page.tsx'),
    "import {AppPage} from '@remmai/rmdl-ui'; export default function Page(){return <AppPage><h2>核心功能介绍</h2></AppPage>}");
  assert.match(run(root).stderr,/违规包含宣讲式/);
});
process.on('exit',()=>roots.forEach(root=>fs.rmSync(root,{recursive:true,force:true})));
