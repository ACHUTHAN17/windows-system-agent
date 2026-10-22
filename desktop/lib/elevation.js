'use strict';
// Windows elevation is deliberately explicit. This requests the normal UAC
// consent dialog; it never bypasses it or impersonates another user.
const { execFileSync, spawn } = require('node:child_process');

function isAdminOutput(value) { return /^\s*true\s*$/i.test(String(value || '')); }

function status({ platform = process.platform, run = execFileSync } = {}) {
  if (platform !== 'win32') return { supported: false, elevated: false, detail: 'Administrator elevation is implemented for Windows only.' };
  try {
    const output = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '[bool]([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'], { encoding: 'utf8', windowsHide: true });
    const elevated = isAdminOutput(output);
    return { supported: true, elevated, detail: elevated ? 'WinAgent is running as Administrator.' : 'WinAgent is running as the signed-in standard user.' };
  } catch (error) { return { supported: true, elevated: false, detail: `Could not determine elevation: ${error.message}` }; }
}

function psQuote(value) { return `'${String(value).replace(/'/g, "''")}'`; }

function requestRelaunch({ platform = process.platform, executable = process.execPath, args = process.argv.slice(1), launch = spawn } = {}) {
  if (platform !== 'win32') return { ok: false, error: 'Administrator relaunch is only available on Windows.' };
  try {
    const command = `$exe=${psQuote(executable)}; $args=@(${args.map(psQuote).join(',')}); Start-Process -FilePath $exe -ArgumentList $args -Verb RunAs`;
    const child = launch('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref?.();
    return { ok: true };
  } catch (error) { return { ok: false, error: error.message }; }
}

module.exports = { status, requestRelaunch, isAdminOutput, psQuote };
