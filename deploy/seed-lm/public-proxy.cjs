// Authenticated gateway for the public dashboard and the loopback-only AchLLM
// endpoint. Credentials are supplied only through the server environment.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const user = process.env.WINAGENT_PROXY_USER;
const password = process.env.WINAGENT_PROXY_PASSWORD;
const allowedOrigin = process.env.WINAGENT_CORS_ORIGIN || 'https://achuthan17.github.io';
if (!user || !password) throw new Error('Missing proxy credentials');

const expected = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
const limits = new Map();
const cors = (req) => req.headers.origin === allowedOrigin ? {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  Vary: 'Origin',
} : {};
const rateAllowed = (ip) => {
  const now = Date.now();
  const recent = (limits.get(ip) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 20) return false;
  recent.push(now); limits.set(ip, recent); return true;
};

const server = http.createServer((req, res) => {
  const extra = cors(req);
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (req.method === 'OPTIONS') return res.writeHead(req.headers.origin === allowedOrigin ? 204 : 403, extra).end();
  const liveFile = pathname === '/achllm/status' ? 'docs/achllm-status.json' : pathname === '/achllm/history' ? 'docs/achllm-history.json' : null;
  if (liveFile) {
    if (req.method !== 'GET' || req.headers.origin !== allowedOrigin) return res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Forbidden');
    try { return res.writeHead(200, { ...extra, 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }).end(fs.readFileSync(path.join(process.cwd(), liveFile))); }
    catch { return res.writeHead(503, { ...extra, 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }).end('{"error":"Telemetry unavailable"}'); }
  }
  if (req.headers.authorization !== expected) return res.writeHead(401, { ...extra, 'WWW-Authenticate': 'Basic realm="WinAgent"', 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' }).end('Authentication required');
  const isModel = pathname === '/v1/models' || pathname === '/v1/chat/completions';
  if (pathname.startsWith('/v1/') && !isModel) return res.writeHead(404, { ...extra, 'Content-Type': 'text/plain' }).end('Not found');
  if (isModel && !rateAllowed(req.socket.remoteAddress || 'unknown')) return res.writeHead(429, { ...extra, 'Content-Type': 'text/plain' }).end('Rate limit exceeded');
  if (isModel && Number(req.headers['content-length'] || 0) > 65_536) return res.writeHead(413, { ...extra, 'Content-Type': 'text/plain' }).end('Request too large');
  const port = isModel ? 8091 : 8080;
  const headers = { ...req.headers, host: `127.0.0.1:${port}` };
  delete headers.origin; delete headers.authorization;
  const upstream = http.request({ hostname: '127.0.0.1', port, path: req.url, method: req.method, headers }, (response) => {
    res.writeHead(response.statusCode || 502, { ...response.headers, ...extra, 'Cache-Control': 'no-store' });
    response.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502, { ...extra, 'Content-Type': 'text/plain' }); res.end('WinAgent is unavailable'); });
  req.pipe(upstream);
});
server.listen(8081, '0.0.0.0');
