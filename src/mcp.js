// MCP client bridge: use ANY MCP server's tools as WinAgent tools. Zero deps.
// Config: MCP_SERVERS env (or --mcp var) as JSON:
//   {"sqlite":{"command":"uvx","args":["mcp-server-sqlite","--db-path","C:/data/a.db"]}}
// Each server tool becomes mcp_<server>_<tool>. Unreachable servers are skipped
// with a warning — the agent still boots.
import { spawn } from 'node:child_process';

let nextId = 1;

function connectMcp(def) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const waiters = new Map();
    let settled = false;
    const fail = (e) => { if (!settled) { settled = true; reject(e); } };
    function start(cmd, retried, shell) {
      let child;
      try {
        child = spawn(cmd, def.args || [], {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          shell: !!shell,
          env: { ...process.env, ...(def.env || {}) },
        });
      } catch (e) { fail(e); return null; }
      child.stdout.on('data', (d) => {
        buf += String(d);
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          let m;
          try { m = JSON.parse(line); } catch { continue; }
          if (m.id !== undefined && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); }
        }
      });
      child.stderr.on('data', () => {});
      child.on('error', (e) => {
        // Windows: bare `npx`/`node` often resolve only as .cmd (which needs a shell) — retry once.
        if (!settled && !retried && process.platform === 'win32' && (e.code === 'ENOENT' || e.code === 'EINVAL') && !/\.(exe|cmd|bat)$/i.test(cmd)) {
          const c2 = start(cmd + '.cmd', true, true);
          if (c2) api.child = c2;
          return;
        }
        fail(e);
      });
      return child;
    }
    const api = { child: null, rpc: null };
    const timer = setTimeout(() => fail(new Error(`init timeout: ${def.command}`)), 20000);
    api.child = start(def.command, false);
    if (!api.child) return;
    function rpc(method, params) {
      return new Promise((res, rej) => {
        const id = nextId++;
        waiters.set(id, (m) => {
          if (m.error) rej(new Error(m.error.message || JSON.stringify(m.error)));
          else res(m.result);
        });
        try { api.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); }
        catch (e) { waiters.delete(id); rej(e); return; }
        setTimeout(() => { if (waiters.has(id)) { waiters.delete(id); rej(new Error(`rpc timeout: ${method}`)); } }, 25000);
      });
    }
    api.rpc = rpc;
    try { process.on('exit', () => { try { api.child.kill(); } catch {} }); } catch {}
    (async () => {
      await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'winagent', version: '1.7' } });
      api.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      clearTimeout(timer);
      settled = true;
      resolve(api);
    })().catch(fail);
  });
}

export async function discoverMcp(cfg) {
  let servers = (cfg && cfg.mcpServers) || process.env.MCP_SERVERS;
  if (!servers) return [];
  if (typeof servers === 'string') {
    try { servers = JSON.parse(servers); }
    catch { console.log('  [mcp] MCP_SERVERS is not valid JSON — skipped'); return []; }
  }
  const tools = [];
  for (const [srv, def] of Object.entries(servers)) {
    if (!def || !def.command) { console.log(`  [mcp] ${srv}: missing command — skipped`); continue; }
    try {
      const c = await connectMcp(def);
      const list = await c.rpc('tools/list', {});
      const found = (list && list.tools) || [];
      for (const t of found) {
        const props = (t.inputSchema && t.inputSchema.properties) || {};
        tools.push({
          name: (`mcp_${srv}_${t.name}`).slice(0, 60),
          description: (`[mcp:${srv}] ${(t.description || t.name || '').slice(0, 240)}`).trim(),
          args: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, (v && (v.description || v.type)) || 'value'])),
          run: async (a) => {
            try {
              const r = await c.rpc('tools/call', { name: t.name, arguments: a || {} });
              const parts = ((r && r.content) || []).map(b => (b && b.type === 'text' ? b.text : `[${(b && b.type) || 'data'}]`)).join('\n');
              return { ok: !(r && r.isError), result: parts.slice(0, 8000) };
            } catch (e) { return { ok: false, error: e.message }; }
          },
        });
      }
      console.log(`  [mcp] ${srv}: ${found.length} tools`);
    } catch (e) { console.log(`  [mcp] ${srv} unavailable: ${e.message}`); }
  }
  return tools;
}
