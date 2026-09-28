'use strict';
const fs = require('node:fs');
const path = require('node:path');

// The agent writes memory/, skills/, runs/, tools-imported/ next to its source, so it
// cannot live in the read-only install folder. On first launch (and on app updates) the
// bundled engine is copied to a writable per-user folder (%APPDATA%\WinAgent\agent).
//   - src/ and package.json are ALWAYS refreshed from the bundle on a version change
//   - skills/, docs/, memory/ are only ever ADDED to, never overwritten (user data + sync)
//   - .env, config.json, runs/, tools-imported/ are never touched
function ensureAgentDir({ bundleDir, agentDir, version }) {
  fs.mkdirSync(agentDir, { recursive: true });
  const marker = path.join(agentDir, '.bundle-version');
  let current = '';
  try { current = fs.readFileSync(marker, 'utf8').trim(); } catch { /* first run */ }
  const engineMissing = !fs.existsSync(path.join(agentDir, 'src', 'index.js'));
  const refreshEngine = current !== version || engineMissing;

  if (refreshEngine) {
    fs.rmSync(path.join(agentDir, 'src'), { recursive: true, force: true });
    fs.cpSync(path.join(bundleDir, 'src'), path.join(agentDir, 'src'), { recursive: true });
    fs.copyFileSync(path.join(bundleDir, 'package.json'), path.join(agentDir, 'package.json'));
  }
  for (const d of ['skills', 'docs', 'memory']) {
    const from = path.join(bundleDir, d);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(agentDir, d), { recursive: true, force: false, errorOnExist: false });
  }
  for (const d of ['runs', 'memory']) fs.mkdirSync(path.join(agentDir, d), { recursive: true });
  if (refreshEngine) fs.writeFileSync(marker, version, 'utf8');
  return { refreshed: refreshEngine, previous: current };
}

module.exports = { ensureAgentDir };
