// Central config loader: config.json > .env > defaults. No dependencies.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

function loadDotEnv(root) {
  const out = {};
  for (const name of ['.env', 'config.json']) {
    // .env parsing is manual to stay zero-dependency
    if (name !== '.env') continue;
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 0) continue;
      out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  }
  return out;
}

function loadJsonConfig(root) {
  for (const name of ['config.json', 'config.example.json']) {
    const p = path.join(root, name);
    if (name === 'config.json' && fs.existsSync(p)) {
      try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
    }
  }
  return {};
}

function loadScoutedModels(root) {
  // Self-improvement: models model-scout.js found and verified LIVE (see
  // docs/models.json, refreshed daily/30-min on GitHub Actions) become part
  // of the agent's own resilience chain automatically — no human needs to
  // edit .env. Sorted fastest-first. See USE_SCOUTED_MODELS to opt out.
  try {
    const p = path.join(root, 'docs', 'models.json');
    if (!fs.existsSync(p)) return [];
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (j.live || []).filter(m => m.kind === 'openai-post' || m.kind === 'openai-get')
      .slice().sort((a, b) => (a.latencyMs || 9e9) - (b.latencyMs || 9e9));
  } catch { return []; }
}

export function loadConfig(argv = {}) {
  const envFile = loadDotEnv(ROOT);
  const json = loadJsonConfig(ROOT);
  const env = (k, d) => argv[k] ?? json[k] ?? envFile[k] ?? process.env[k] ?? d;

  let extraHeaders = {};
  const rawHeaders = env('MODEL_EXTRA_HEADERS', '{}');
  try {
    extraHeaders = typeof rawHeaders === 'object' ? rawHeaders : JSON.parse(rawHeaders || '{}');
  } catch { extraHeaders = {}; }

  const list = (v) => {
    if (Array.isArray(v)) return v;
    if (!v) return [];
    return String(v).split(',').map(s => s.trim()).filter(Boolean);
  };

  const cfg = {
    root: ROOT,
    provider: env('MODEL_PROVIDER', json.provider ?? 'openai-compatible'),
    apiUrl: env('MODEL_API_URL', json.apiUrl ?? 'http://localhost:11434/v1'),
    apiKey: env('MODEL_API_KEY', json.apiKey ?? ''),
    model: env('MODEL_NAME', json.model ?? json.MODEL_NAME ?? 'llama3.1'),
    extraHeaders,
    maxSteps: Number(env('MAX_STEPS', json.maxSteps ?? 15)),
    temperature: Number(env('TEMPERATURE', json.temperature ?? 0.2)),
    timeoutMs: Number(env('TIMEOUT_MS', json.timeoutMs ?? 60000)),
    requireApproval: String(env('REQUIRE_APPROVAL', json.requireApproval ?? true)) !== 'false' && String(env('REQUIRE_APPROVAL', json.requireApproval ?? true)) !== '0',
    autoYes: String(env('AUTO_YES', argv.yes ? 'true' : (json.autoYes ?? false))) === 'true' || argv.yes === true,
    allowedRoots: list(env('ALLOWED_ROOTS', json.allowedRoots ?? [])),
    blockedPaths: list(env('BLOCKED_PATHS', json.blockedPaths ?? [])),
    allowedApps: list(env('ALLOWED_APPS', json.allowedApps ?? [])),
    requireAppApproval: env('REQUIRE_APP_APPROVAL', json.requireAppApproval),    auditLog: env('AUDIT_LOG', json.auditLog ?? './agent-audit.log'),
    skillSource: env('SKILL_SOURCE', json.skillSource ?? 'auto'),
    skillToken: env('SKILL_TOKEN', json.skillToken ?? ''),
    skillRepo: env('SKILL_REPO', json.skillRepo ?? 'ACHUTHAN17/windows-system-agent'),
    skillBranch: env('SKILL_BRANCH', json.skillBranch ?? 'main'),
    telegramToken: env('TELEGRAM_TOKEN', json.telegramToken ?? ''),
    telegramAllow: env('TELEGRAM_ALLOW_FROM', json.telegramAllow ?? ''),
    fallbackUrl: env('LLM_FALLBACK_URL', json.fallbackUrl ?? ''),
    fallbackModel: env('LLM_FALLBACK_MODEL', json.fallbackModel ?? 'openai'),
    fallbackKey: env('LLM_FALLBACK_KEY', json.fallbackKey ?? ''),
    useScoutedModels: String(env('USE_SCOUTED_MODELS', json.useScoutedModels ?? true)) !== 'false',
    scoutedModels: loadScoutedModels(ROOT),
    shellAllowlist: json.shellAllowlist ?? ['powershell.exe', 'cmd.exe', 'pwsh.exe', 'tasklist.exe', 'taskkill.exe'],
  };
  cfg.apiUrl = String(cfg.apiUrl).replace(/\/+$/, '');
  return cfg;
}

export function printActiveModel(cfg) {
  const kind = cfg.provider === 'anthropic' ? 'Anthropic-native'
    : cfg.apiUrl.includes('localhost') || cfg.apiUrl.includes('127.0.0.1') ? 'local LLM'
    : 'API / custom';
  return `${cfg.model} [${cfg.provider} · ${kind}] @ ${cfg.apiUrl}`;
}
