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
  fs.writeFileSync(path.join(root,'VERSION'),'1.1.3\n');
  fs.writeFileSync(path.join(root,'CHANGELOG.md'),'# Changelog\n\n## [1.1.3] - 2026-11-16\n\n- Fixture release.\n');
  fs.writeFileSync(path.join(root,'global.json'),JSON.stringify({sdk:{version:'11.0.100',allowPrerelease:false,rollForward:'disable'}}));
  fs.mkdirSync(path.join(root,'backend'),{recursive:true});
  fs.writeFileSync(path.join(root,'backend/App.csproj'),'<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net11.0</TargetFramework></PropertyGroup></Project>');
  const web=path.join(root,'apps/web');
  fs.mkdirSync(path.join(web,'src/app/users'), {recursive:true});
  fs.writeFileSync(path.join(root,'package-lock.json'),JSON.stringify({name:'rmdl-fixture',lockfileVersion:3,packages:{}}));
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
  fs.rmSync(path.join(root,'package-lock.json'));
  manifest.selection.productType='tool';
  manifest.selection.frontendMode='static-html';
  manifest.selection.frontendFramework='none';
  manifest.selection.backendLanguage='none';
  manifest.selection.orm='none';
  manifest.selection.productionDatabase='none';
  manifest.selection.deployment='oss-static';
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
  manifest.selection.deployment='oss-static';
  fs.writeFileSync(path.join(root,'rmdl.project.json'),JSON.stringify(manifest));
  fs.rmSync(web,{recursive:true,force:true});
  fs.mkdirSync(path.join(web,'assets'),{recursive:true});
  fs.writeFileSync(path.join(web,'index.html'),'<main>Tool</main>');
  fs.writeFileSync(path.join(web,'assets/rmdl-tokens.css'),'');
  assert.match(run(root).stderr,/必须加载 assets\/rmdl-tokens\.css/);
});
test('schema and example lock Node.js runtime and npm package manager',()=>{
  const schema=JSON.parse(fs.readFileSync(path.join(here,'../policy/rmdl-project.schema.json'),'utf8'));
  for (const [field,value] of Object.entries({runtime:'node',packageManager:'npm'})) {
    assert.equal(example.fixed[field],value);
    assert.equal(schema.properties.fixed.properties[field].const,value);
    assert.ok(schema.properties.fixed.required.includes(field));
  }
});
test('legacy Bun selection is blocked',()=>{
  const {root,manifest}=fixture();
  manifest.fixed.runtime='bun';
  manifest.fixed.packageManager='bun';
  fs.writeFileSync(path.join(root,'rmdl.project.json'),JSON.stringify(manifest));
  const r=run(root);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/fixed.runtime 必须为 node/);
  assert.match(r.stderr,/fixed.packageManager 必须为 npm/);
});
test('legacy manifest without an explicit Node.js runtime is blocked',()=>{
  const {root,manifest}=fixture();
  delete manifest.fixed.runtime;
  fs.writeFileSync(path.join(root,'rmdl.project.json'),JSON.stringify(manifest));
  const r=run(root);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/fixed.runtime 必须为 node/);
});
test('missing npm lockfile is blocked',()=>{
  const {root}=fixture();
  fs.rmSync(path.join(root,'package-lock.json'));
  const r=run(root);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/缺少 package-lock.json/);
});
test('standalone web npm lockfile passes without a root lockfile',()=>{
  const {root,web}=fixture();
  fs.renameSync(path.join(root,'package-lock.json'),path.join(web,'package-lock.json'));
  assert.equal(run(root).status,0);
});
test('duplicate npm workspace lockfiles are blocked',()=>{
  const {root,web}=fixture();
  fs.copyFileSync(path.join(root,'package-lock.json'),path.join(web,'package-lock.json'));
  const r=run(root);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/不得重复维护 package-lock.json/);
});
for (const lock of ['bun.lock','bun.lockb','yarn.lock','pnpm-lock.yaml','npm-shrinkwrap.json']) {
  for (const location of ['root','web']) {
    test(`non-standard lockfile ${lock} at ${location} is blocked`,()=>{
      const {root,web}=fixture();
      fs.writeFileSync(path.join(location==='root'?root:web,lock),'');
      const r=run(root);
      assert.notEqual(r.status,0);
      assert.match(r.stderr,/不得混用锁文件/);
      assert.ok(r.stderr.includes(lock));
    });
  }
}
test('npm-incompatible workspace protocol is blocked',()=>{
  const {root,web}=fixture();
  const file=path.join(web,'package.json');
  const pkg=JSON.parse(fs.readFileSync(file,'utf8'));
  pkg.dependencies['@remmai/rmdl-ui']='workspace:*';
  fs.writeFileSync(file,JSON.stringify(pkg));
  const r=run(root);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/npm 不支持的 workspace: 协议/);
});
test('backend-free web project must select static hosting',()=>{
  const {root,manifest}=fixture();
  manifest.selection.backendLanguage='none';
  manifest.selection.orm='none';
  manifest.selection.productionDatabase='none';
  manifest.selection.deployment='docker';
  fs.writeFileSync(path.join(root,'rmdl.project.json'),JSON.stringify(manifest));
  assert.match(run(root).stderr,/无后端 Web 项目必须选择静态托管目标/);
});
test('redundant AI promotional slop in UI is blocked',()=>{
  const {root,web}=fixture();
  fs.writeFileSync(path.join(web,'src/app/users/page.tsx'),
    "import {AppPage} from '@remmai/rmdl-ui'; export default function Page(){return <AppPage><h2>核心功能介绍</h2></AppPage>}");
  assert.match(run(root).stderr,/违规包含宣讲式/);
});
process.on('exit',()=>roots.forEach(root=>fs.rmSync(root,{recursive:true,force:true})));

test('schema and example declare product version binding and .NET 11',()=>{
  const schema=JSON.parse(fs.readFileSync(path.join(here,'../policy/rmdl-project.schema.json'),'utf8'));
  assert.equal(example.fixed.dotnetTarget,'net11.0');
  assert.equal(schema.properties.fixed.properties.dotnetTarget.const,'net11.0');
  assert.ok(schema.properties.fixed.required.includes('dotnetTarget'));
  assert.ok(schema.required.includes('versioning'));
  assert.equal(example.versioning.source,'VERSION');
  assert.equal(example.versioning.buildId,'git-commit');
});
test('missing version binding is blocked',()=>{
  const {root,manifest}=fixture();
  delete manifest.versioning;
  fs.writeFileSync(path.join(root,'rmdl.project.json'),JSON.stringify(manifest));
  assert.match(run(root).stderr,/versioning 必须绑定/);
});
for (const version of ['v1.1.3','1.1','01.1.3','1.1.3+abc','11.0.100-preview']) {
  test(`invalid product version ${version} is rejected`,()=>{
    const {root}=fixture();
    fs.writeFileSync(path.join(root,'VERSION'),version);
    assert.match(run(root).stderr,/MAJOR.MINOR.PATCH/);
  });
}
test('missing current changelog entry is blocked',()=>{
  const {root}=fixture();
  fs.writeFileSync(path.join(root,'CHANGELOG.md'),'# Changelog\n## 1.1.30\n');
  assert.match(run(root).stderr,/缺少当前版本 1.1.3/);
});
test('missing VERSION is blocked',()=>{
  const {root}=fixture();
  fs.rmSync(path.join(root,'VERSION'));
  assert.match(run(root).stderr,/产品版本读取失败/);
});
test('web version placement cannot be disabled, services require none',()=>{
  const {root,manifest}=fixture();
  manifest.versioning.frontendPlacement='none';
  fs.writeFileSync(path.join(root,'rmdl.project.json'),JSON.stringify(manifest));
  assert.match(run(root).stderr,/frontendPlacement/);
  Object.assign(manifest.selection,{productType:'service',frontendMode:'none',frontendFramework:'none'});
  fs.writeFileSync(path.join(root,'rmdl.project.json'),JSON.stringify(manifest));
  assert.equal(run(root).status,0);
  manifest.versioning.frontendPlacement='menu';
  fs.writeFileSync(path.join(root,'rmdl.project.json'),JSON.stringify(manifest));
  assert.match(run(root).stderr,/frontendPlacement/);
});
test('old .NET target and SDK are blocked',()=>{
  const {root}=fixture();
  fs.writeFileSync(path.join(root,'backend/App.csproj'),'<Project><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>');
  fs.writeFileSync(path.join(root,'global.json'),JSON.stringify({sdk:{version:'10.0.100'}}));
  const r=run(root);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/正式 11.x SDK/);
  assert.match(r.stderr,/目标框架必须显式声明 net11.0/);
});
test('central .NET 11 target and platform target are supported',()=>{
  const {root}=fixture();
  fs.writeFileSync(path.join(root,'backend/App.csproj'),'<Project Sdk="Microsoft.NET.Sdk.Web"/>');
  fs.writeFileSync(path.join(root,'Directory.Build.props'),'<Project><PropertyGroup><TargetFramework>net11.0</TargetFramework></PropertyGroup></Project>');
  assert.equal(run(root).status,0);
  fs.writeFileSync(path.join(root,'backend/App.csproj'),'<Project><PropertyGroup><TargetFramework>net11.0-windows</TargetFramework></PropertyGroup></Project>');
  assert.equal(run(root).status,0);
});
test('preview SDK and floating SDK policy are rejected',()=>{
  const {root}=fixture();
  for (const sdk of [
    {version:'11.0.100-preview.1',allowPrerelease:false,rollForward:'disable'},
    {version:'11.0.100',allowPrerelease:true,rollForward:'disable'},
    {version:'11.0.100',allowPrerelease:false,rollForward:'latestMajor'},
  ]) {
    fs.writeFileSync(path.join(root,'global.json'),JSON.stringify({sdk}));
    assert.match(run(root).stderr,/正式 11.x SDK/);
  }
});
test('version metadata uses actual Git HEAD and rejects dirty release builds',()=>{
  const {root}=fixture();
  function git(...args) {
    const result=spawnSync('git',['-C',root,...args],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    return result.stdout.trim();
  }
  git('init');
  git('add','.');
  git('-c','user.name=RMDL Test','-c','user.email=rmdl-test@example.invalid','-c','commit.gpgsign=false','commit','-m','fixture');
  const commit=git('rev-parse','HEAD');
  const versionRun=(...flags)=>spawnSync(process.execPath,[cli,'version','--root',root,...flags],{encoding:'utf8'});
  const clean=versionRun('--release');
  assert.equal(clean.status,0,clean.stderr);
  assert.deepEqual(JSON.parse(clean.stdout),{version:'1.1.3',gitCommit:commit,informationalVersion:`1.1.3+${commit}`,dirty:false});
  fs.writeFileSync(path.join(root,'untracked.txt'),'changed');
  const dirty=JSON.parse(versionRun().stdout);
  assert.equal(dirty.dirty,true);
  assert.equal(dirty.gitCommit,commit);
  assert.equal(dirty.informationalVersion,`1.1.3+${commit}.dirty`);
  const rejected=versionRun('--release');
  assert.notEqual(rejected.status,0);
  assert.equal(rejected.stdout,'');
  assert.match(rejected.stderr,/发布构建拒绝脏工作区/);
});
test('version generation fails without a Git HEAD',()=>{
  const {root}=fixture();
  const init=spawnSync('git',['-C',root,'init'],{encoding:'utf8'});
  assert.equal(init.status,0,init.stderr);
  const r=spawnSync(process.execPath,[cli,'version','--root',root],{encoding:'utf8'});
  assert.notEqual(r.status,0);
  assert.equal(r.stdout,'');
});
