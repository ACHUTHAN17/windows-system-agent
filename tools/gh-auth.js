// gh-auth.js — scan local Edge profiles for a usable github.com session cookie.
// Read-only. Run: node gh-auth.js
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';

if (typeof DatabaseSync !== 'function') {
  console.log(JSON.stringify({ ok: false, error: 'node:sqlite unavailable' }));
  process.exit(0);
}

const ud = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data');
const out = [];
let dirs = [];
try { dirs = fs.readdirSync(ud); } catch (e) { console.log(JSON.stringify({ ok: false, error: 'no User Data dir' })); process.exit(0); }

for (const d of dirs) {
  const c = path.join(ud, d, 'Network', 'Cookies');
  if (!fs.existsSync(c)) continue;
  const tmp = path.join(os.tmpdir(), 'ckscan-' + d.replace(/[^A-Za-z0-9]/g, '') + '.db');
  try { fs.copyFileSync(c, tmp); }
  catch (e) { out.push({ profile: d, error: 'copy: ' + e.message }); continue; }
  try {
    const db = new DatabaseSync(tmp);
    const rows = db.prepare(
      "SELECT host_key, name, length(value) AS vlen, expires_utc FROM cookies WHERE host_key LIKE '%github%'"
    ).all();
    db.close();
    out.push({ profile: d, githubCookies: rows });
  } catch (e) { out.push({ profile: d, error: 'db: ' + e.message }); }
  try { fs.unlinkSync(tmp); } catch (e) {}
}

// expiry note: expires_utc = microseconds since 1601-01-01; now ~ 13402000000000000
console.log(JSON.stringify({ ok: true, profiles: out }));
