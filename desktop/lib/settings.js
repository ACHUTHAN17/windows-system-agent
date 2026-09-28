'use strict';
const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = {
  preset: 'free',
  provider: 'openai-compatible',
  apiUrl: '',
  model: '',
  allowedRoots: '',
  fullAuto: false,
  hotkey: 'Control+Alt+Space',
  startWithWindows: false,
  closeToTray: true,
  syncOnStart: true,
  syncMemory: true,
  syncEngine: false,
};

// Persists settings in the user's profile. The API key is encrypted with Electron's
// safeStorage (Windows DPAPI) when available and only ever handed to the agent as an
// environment variable of the child process - it is never written to a .env file.
class Settings {
  constructor(dir, safeStorage) {
    this.file = path.join(dir, 'settings.json');
    this.ss = safeStorage || null;
    this.data = { ...DEFAULTS };
    try { Object.assign(this.data, JSON.parse(fs.readFileSync(this.file, 'utf8'))); } catch { /* defaults */ }
  }
  _save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
  }
  publicView() {
    const { apiKeyEnc, apiKeyPlain, ...rest } = this.data;
    return { ...rest, hasKey: !!(apiKeyEnc || apiKeyPlain), keyEncrypted: !!apiKeyEnc };
  }
  // patch may contain apiKey ('' = leave unchanged, null = clear)
  update(patch) {
    const allowed = Object.keys(DEFAULTS);
    for (const k of allowed) if (k in patch) this.data[k] = patch[k];
    if ('apiKey' in patch) {
      if (patch.apiKey === null) { delete this.data.apiKeyEnc; delete this.data.apiKeyPlain; }
      else if (String(patch.apiKey).trim()) {
        const key = String(patch.apiKey).trim();
        if (this.ss && this.ss.isEncryptionAvailable()) {
          this.data.apiKeyEnc = this.ss.encryptString(key).toString('base64');
          delete this.data.apiKeyPlain;
        } else { this.data.apiKeyPlain = key; delete this.data.apiKeyEnc; }
      }
    }
    this._save();
    return this.publicView();
  }
  _key() {
    try {
      if (this.data.apiKeyEnc && this.ss) return this.ss.decryptString(Buffer.from(this.data.apiKeyEnc, 'base64'));
    } catch { /* unreadable (other Windows user) */ }
    return this.data.apiKeyPlain || '';
  }
  // Environment for the agent child. Empty values are omitted so the engine's own
  // defaults (and the free-model fallback chain) still apply.
  agentEnv() {
    const d = this.data;
    const env = {};
    if (d.preset !== 'free') {
      if (d.provider) env.MODEL_PROVIDER = d.provider;
      if (d.apiUrl) env.MODEL_API_URL = d.apiUrl;
      if (d.model) env.MODEL_NAME = d.model;
      const k = this._key();
      if (k) env.MODEL_API_KEY = k;
    }
    if (String(d.allowedRoots || '').trim()) env.ALLOWED_ROOTS = String(d.allowedRoots).trim();
    return env;
  }
}

module.exports = { Settings, DEFAULTS };
