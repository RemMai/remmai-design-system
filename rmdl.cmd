@echo off
setlocal DisableDelayedExpansion
where node >nul 2>nul
if errorlevel 1 goto missing_node
node -e "const fs=require('node:fs');const text=fs.readFileSync(process.argv[1],'utf8');eval(text.slice(text.indexOf('\n// RMDL_NODE_START')+1));" "%~f0" %*
set "RMDL_EXIT=%errorlevel%"
if not "%~1"=="" exit /b %RMDL_EXIT%
pause
exit /b %RMDL_EXIT%
:missing_node
echo Node.js is required. Install Node.js LTS and reopen this launcher.
if not "%~1"=="" exit /b 1
pause
exit /b 1

// RMDL_NODE_START
{
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const {spawnSync} = require('node:child_process');
  const launcher = path.resolve(process.argv[1]);
  const directory = path.dirname(launcher);
  const args = process.argv.slice(2);
  const repository = process.env.RMDL_BOOTSTRAP_REPOSITORY || 'https://github.com/RemMai/remmai-design-system.git';
  // This feature branch carries the installer until it is merged into main.
  const ref = process.env.RMDL_BOOTSTRAP_REF || 'chore/dotnet11-product-version-standards';
  let temporary;

  function git(arguments_, proxy) {
    const result = spawnSync('git', [...(proxy ? ['-c', `http.proxy=${proxy}`] : []), ...arguments_], {encoding: 'utf8', windowsHide: true});
    if (result.error) throw new Error(`Cannot start Git: ${result.error.message}`);
    if (result.status !== 0) throw new Error(result.stderr.trim() || 'Git command failed');
    return result.stdout.trim();
  }

  function proxySetting() {
    const at = args.indexOf('--proxy');
    if (at >= 0) {
      if (!args[at + 1] || args[at + 1].startsWith('-')) throw new Error('--proxy requires a URL');
      return args[at + 1];
    }
    if (process.env.RMDL_PROXY) return process.env.RMDL_PROXY;
    if (process.platform !== 'win32') return undefined;
    if (Object.entries(process.env).some(([key, value]) => /^(?:https?|all)_proxy$/i.test(key) && value)) return undefined;
    const configured = spawnSync('git', ['config', '--get-urlmatch', 'http.proxy', repository], {encoding: 'utf8', windowsHide: true});
    if (configured.status === 0) return undefined;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' | Select-Object ProxyEnable,ProxyServer | ConvertTo-Json -Compress"],
    {encoding: 'utf8', windowsHide: true});
    if (result.status !== 0) return undefined;
    try {
      const settings = JSON.parse(result.stdout);
      if (settings.ProxyEnable !== 1 || !settings.ProxyServer) return undefined;
      const entries = settings.ProxyServer.split(';');
      const selected = entries.find(value => value.startsWith('https=')) || entries.find(value => value.startsWith('http='));
      const server = selected ? selected.slice(selected.indexOf('=') + 1) : entries.length === 1 && !entries[0].includes('=') ? entries[0] : '';
      return server ? (/^https?:\/\//.test(server) ? server : `http://${server}`) : undefined;
    } catch { return undefined; }
  }

  try {
    const proxy = proxySetting();
    if (proxy && !/^https?:\/\//.test(proxy)) throw new Error('Proxy must be an http:// or https:// URL');
    const localScript = path.join(directory, 'scripts/bootstrap.mjs');
    const installedScript = path.join(directory, 'vendor/rmdl/scripts/bootstrap.mjs');
    const globalDir = process.env.RMDL_GLOBAL_DIR
      ? path.resolve(process.env.RMDL_GLOBAL_DIR)
      : process.env.XDG_CONFIG_HOME ? path.join(process.env.XDG_CONFIG_HOME, 'opencode') : path.join(os.homedir(), '.config', 'opencode');
    const globalScript = path.join(globalDir, 'rmdl', 'scripts', 'bootstrap.mjs');
    // Project-pinned standard wins; the machine-wide copy avoids re-downloading in projects without a submodule.
    let script = [localScript, installedScript, globalScript]
      .find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    if (!script) {
      console.log('Loading RMDL tools from GitHub...');
      if (proxy) console.log('Using the configured HTTP proxy.');
      git(['--version']);
      const base = fs.existsSync(path.join(os.tmpdir(), 'opencode')) ? path.join(os.tmpdir(), 'opencode') : os.tmpdir();
      temporary = fs.mkdtempSync(path.join(base, 'rmdl-tools-'));
      const checkout = path.join(temporary, 'standard');
      git(['clone', '--depth', '1', '--single-branch', '--branch', ref, '--', repository, checkout], proxy);
      script = path.join(checkout, 'scripts/bootstrap.mjs');
      if (!fs.existsSync(script)) throw new Error(`The selected standard (${ref}) does not contain scripts/bootstrap.mjs`);
    }
    const childArgs = [...args];
    if (script !== localScript && !args.includes('--root')) childArgs.push('--root', directory);
    if (proxy && !args.includes('--proxy')) childArgs.push('--proxy', proxy);
    const result = spawnSync(process.execPath, [script, ...childArgs], {
      stdio: 'inherit', env: {...process.env, RMDL_LAUNCHER_PATH: launcher},
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } catch (error) {
    console.error(`RMDL launcher failed: ${error.message}`);
    console.error('Check Git access to the standard repository; use --proxy URL if required.');
    process.exitCode = 1;
  } finally {
    if (temporary) {
      try { fs.rmSync(temporary, {recursive: true, force: true}); }
      catch (error) { console.error(`Temporary tool cleanup failed: ${error.message}`); process.exitCode = 1; }
    }
  }
}
