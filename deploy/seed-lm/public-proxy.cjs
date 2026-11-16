// Authenticated gateway for the public dashboard and loopback-only AchLLM
// endpoints. It intentionally has a small allow-list and never stores a raw
// password: create WINAGENT_PROXY_PASSWORD_HASH with configure-public-proxy.
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const MAX_BODY_BYTES = 65_536;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const MAX_RATE_KEYS = 10_000;
const MODEL_ROUTES = new Map([
  ['GET /v1/models', 8091],
  ['POST /v1/chat/completions', 8091],
  ['POST /v1/feedback', 8091],
  ['POST /v1/agent/validate', 8091],
]);
const TELEMETRY_FILES = new Map([
  ['/achllm/status', 'docs/achllm-status.json'],
  ['/achllm/history', 'docs/achllm-history.json'],
  ['/achllm/benchmarks', 'docs/achllm-benchmarks.json'],
]);

function scryptOptions(params) {
  const match = /^N=(\d+),r=(\d+),p=(\d+)$/.exec(params || '');
  if (!match) throw new Error('Invalid scrypt password-hash parameters');
  const [, nText, rText, pText] = match;
  const N = Number(nText); const r = Number(rText); const p = Number(pText);
  if (!Number.isInteger(N) || N < 16_384 || N > 1_048_576 || (N & (N - 1)) !== 0 || !Number.isInteger(r) || r < 1 || r > 16 || !Number.isInteger(p) || p < 1 || p > 16) {
    throw new Error('Unsafe scrypt password-hash parameters');
  }
  return { N, r, p, maxmem: Math.max(64 * 1024 * 1024, 128 * N * r + 1024 * 1024) };
}

function hashPassword(password, salt = crypto.randomBytes(16)) {
  if (typeof password !== 'string' || password.length < 14) throw new Error('Gateway password must contain at least 14 characters');
  const params = 'N=16384,r=8,p=1';
  const digest = crypto.scryptSync(password, salt, 64, scryptOptions(params));
  return `$scrypt$${params}$${salt.toString('base64')}$${digest.toString('base64')}`;
}

function verifyPassword(password, encoded) {
  const match = /^\$scrypt\$(N=\d+,r=\d+,p=\d+)\$([A-Za-z0-9+/]+={0,2})\$([A-Za-z0-9+/]+={0,2})$/.exec(encoded || '');
  if (!match || typeof password !== 'string') return false;
  const [, params, saltText, digestText] = match;
  try {
    const expected = Buffer.from(digestText, 'base64');
    if (expected.length !== 64) return false;
    const actual = crypto.scryptSync(password, Buffer.from(saltText, 'base64'), expected.length, scryptOptions(params));
    return crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}

function validPasswordHash(encoded) {
  const match = /^\$scrypt\$(N=\d+,r=\d+,p=\d+)\$([A-Za-z0-9+/]+={0,2})\$([A-Za-z0-9+/]+={0,2})$/.exec(encoded || '');
  if (!match) return false;
  try {
    const salt = Buffer.from(match[2], 'base64'); const digest = Buffer.from(match[3], 'base64');
    scryptOptions(match[1]);
    return salt.length >= 16 && digest.length === 64;
  } catch { return false; }
}

function timingSafeText(a, b) {
  return crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());
}

function authorized(header, user, passwordHash) {
  if (typeof header !== 'string' || !header.startsWith('Basic ')) return false;
  let decoded = '';
  try { decoded = Buffer.from(header.slice(6), 'base64').toString('utf8'); } catch { return false; }
  const separator = decoded.indexOf(':');
  if (separator < 1) return false;
  const candidateUser = decoded.slice(0, separator);
  const candidatePassword = decoded.slice(separator + 1);
  const userMatches = timingSafeText(candidateUser, user);
  const passwordMatches = verifyPassword(candidatePassword, passwordHash);
  return userMatches && passwordMatches;
}

function configFromEnvironment(env = process.env) {
  const user = env.WINAGENT_PROXY_USER;
  const passwordHash = env.WINAGENT_PROXY_PASSWORD_HASH;
  if (!user || !passwordHash) throw new Error('Missing WINAGENT_PROXY_USER or WINAGENT_PROXY_PASSWORD_HASH');
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(user)) throw new Error('Gateway username must contain only letters, numbers, dot, underscore, or hyphen');
  if (!validPasswordHash(passwordHash)) throw new Error('Invalid gateway password hash');
  return { user, passwordHash, allowedOrigin: env.WINAGENT_CORS_ORIGIN || 'https://achuthan17.github.io' };
}

function createRateLimiter() {
  const limits = new Map();
  return (ip) => {
    const now = Date.now();
    if (limits.size > MAX_RATE_KEYS) for (const [key, value] of limits) if (now - value.lastSeen > RATE_WINDOW_MS) limits.delete(key);
    const current = limits.get(ip);
    if (!current || now - current.windowStart >= RATE_WINDOW_MS) { limits.set(ip, { windowStart: now, count: 1, lastSeen: now }); return true; }
    current.lastSeen = now;
    if (current.count >= RATE_LIMIT) return false;
    current.count += 1; return true;
  };
}

function cors(req, allowedOrigin) {
  return req.headers.origin === allowedOrigin ? {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  } : {};
}

function responseHeaders(extra = {}) {
  return { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', ...extra };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = []; let finished = false;
    req.on('data', (chunk) => {
      if (finished) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        finished = true; req.resume(); const error = new Error('Request too large'); error.statusCode = 413; reject(error); return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!finished) { finished = true; resolve(Buffer.concat(chunks)); } });
    req.on('aborted', () => { if (!finished) { finished = true; reject(new Error('Request aborted')); } });
    req.on('error', (error) => { if (!finished) { finished = true; reject(error); } });
  });
}

function clientAddress(req) { return req.socket.remoteAddress || 'unknown'; }

function createPublicProxy(config, options = {}) {
  const { user, passwordHash, allowedOrigin } = config;
  const rateAllowed = options.rateAllowed || createRateLimiter();
  return http.createServer(async (req, res) => {
    const extra = cors(req, allowedOrigin);
    const url = new URL(req.url, 'http://127.0.0.1');
    const pathname = url.pathname;
    const telemetry = TELEMETRY_FILES.get(pathname);
    if (req.method === 'OPTIONS') return res.writeHead(req.headers.origin === allowedOrigin ? 204 : 403, responseHeaders(extra)).end();
    if (telemetry) {
      if (req.method !== 'GET' || req.headers.origin !== allowedOrigin) return res.writeHead(403, responseHeaders({ 'Content-Type': 'text/plain' })).end('Forbidden');
      try { return res.writeHead(200, responseHeaders({ ...extra, 'Content-Type': 'application/json' })).end(fs.readFileSync(path.join(process.cwd(), telemetry))); }
      catch { return res.writeHead(503, responseHeaders({ ...extra, 'Content-Type': 'application/json' })).end('{"error":"Telemetry unavailable"}'); }
    }
    const port = MODEL_ROUTES.get(`${req.method} ${pathname}`);
    if (!port) return res.writeHead(404, responseHeaders({ ...extra, 'Content-Type': 'text/plain' })).end('Not found');
    if (!authorized(req.headers.authorization, user, passwordHash)) return res.writeHead(401, responseHeaders({ ...extra, 'WWW-Authenticate': 'Basic realm="WinAgent"', 'Content-Type': 'text/plain' })).end('Authentication required');
    if (!rateAllowed(clientAddress(req))) return res.writeHead(429, responseHeaders({ ...extra, 'Content-Type': 'text/plain' })).end('Rate limit exceeded');
    if (Number(req.headers['content-length'] || 0) > MAX_BODY_BYTES) return res.writeHead(413, responseHeaders({ ...extra, 'Content-Type': 'text/plain' })).end('Request too large');
    let body = Buffer.alloc(0);
    try { if (req.method === 'POST') body = await readBody(req); }
    catch (error) { return res.writeHead(error.statusCode || 400, responseHeaders({ ...extra, 'Content-Type': 'text/plain' })).end(error.message === 'Request too large' ? error.message : 'Invalid request body'); }
    const headers = { 'content-length': String(body.length), 'content-type': req.headers['content-type'] || 'application/json', host: `127.0.0.1:${port}` };
    const upstream = http.request({ hostname: '127.0.0.1', port, path: `${pathname}${url.search}`, method: req.method, headers, timeout: 30_000 }, (response) => {
      res.writeHead(response.statusCode || 502, responseHeaders({ ...response.headers, ...extra })); response.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy(new Error('Upstream timeout')));
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502, responseHeaders({ ...extra, 'Content-Type': 'text/plain' })); res.end('WinAgent is unavailable'); });
    upstream.end(body);
  });
}

if (require.main === module) createPublicProxy(configFromEnvironment()).listen(8081, '0.0.0.0');

module.exports = { MAX_BODY_BYTES, MODEL_ROUTES, authorized, configFromEnvironment, createPublicProxy, hashPassword, validPasswordHash, verifyPassword };
