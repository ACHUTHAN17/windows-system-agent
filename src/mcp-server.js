#!/usr/bin/env node
// WinAgent as an MCP server: exposes every WinAgent tool (built-in, MCP-bridged,
// self-authored) to any MCP client over stdio — Claude Desktop, Claude Code, or anything
// else that speaks MCP. Mirrors the exact protocol src/mcp.js already uses as a CLIENT
// (protocolVersion 2024-11-05, newline-delimited JSON-RPC 2.0), so this is a straight
// role-reversal of code already proven to work in this codebase.
//
// Run directly:        node src/mcp-server.js
// Claude Desktop config (claude_desktop_config.json):
//   { "mcpServers": { "winagent": { "command": "node",
//       "args": ["C:/path/to/windows-system-agent/src/mcp-server.js"],
//       "env": { "MCP_AUTO_YES": "false" } } } }
//
// SAFETY: this process's stdin/stdout ARE the JSON-RPC channel — they can never be used
// for an interactive y/N prompt (that would corrupt the protocol and likely hang the
// client). So approval works differently here than in the CLI or desktop app:
//   - MCP_AUTO_YES=true  (opt-in, the owner's own deliberate choice): every tool call is
//     allowed immediately, no gate. Many MCP hosts (Claude Desktop included) show their
//     own per-call confirmation UI regardless — this only controls WinAgent's OWN gate.
//   - MCP_AUTO_YES unset/false (the default): destructive and app-controlling tools are
//     auto-denied with a clear explanation instead of ever blocking on stdin. Read-only
//     tools (file_list, sys_info, web_search, ...) always work either way.
// ALLOWED_ROOTS / BLOCKED_PATHS from .env or config.json apply exactly as they do
// everywhere else in WinAgent — this is the same cfg, not a separate trust boundary.
import readline from 'node:readline';
import { createEngine } from './index.js';
import { DESTRUCTIVE } from './safety.js';

const PROTOCOL_VERSION = '2024-11-05';

// Loose {argName: "description"} -> real JSON Schema. WinAgent's tool args were never
// strictly typed (the engine's own LLM loop parses them loosely too), so every property
// is typed as a permissive string; the description is what actually carries the meaning.
function toInputSchema(args) {
  const properties = {};
  for (const [k, v] of Object.entries(args || {})) properties[k] = { type: 'string', description: String(v) };
  return { type: 'object', properties, required: [] };
}

function toMcpTool(tool) {
  const destructive = DESTRUCTIVE.has(tool.name);
  return {
    name: tool.name,
    description: tool.description || '',
    inputSchema: toInputSchema(tool.args),
    annotations: { readOnlyHint: !destructive, destructiveHint: destructive, idempotentHint: !destructive },
  };
}

function textResult(text, isError) {
  return { content: [{ type: 'text', text: String(text).slice(0, 16000) }], isError: !!isError };
}

async function main() {
  const engine = await createEngine({ _: [] });
  const { cfg, tools, runTool } = engine;

  // Never, under any circumstance, let an approval prompt try to read stdin here —
  // stdin is the JSON-RPC channel. See the file header for what each mode means.
  cfg.autoYes = process.env.MCP_AUTO_YES === 'true';
  cfg.approvalHandler = async (label) => {
    const isApp = label.startsWith('APP ');
    return isApp ? null : false; // only ever reached when MCP_AUTO_YES is not 'true'
  };
  // Routine engine chatter (skill auto-pick, mcp/self-tool loading, model retries) would
  // otherwise print to stdout via console.log and corrupt the JSON-RPC stream — redirect
  // it to stderr instead, where a host's logs can still see it.
  console.log = (...a) => process.stderr.write(a.join(' ') + '\n');

  function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
  function reply(id, result) { if (id !== undefined) send({ jsonrpc: '2.0', id, result }); }
  function replyError(id, code, message) { if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code, message } }); }

  async function handle(msg) {
    const { id, method, params } = msg;
    try {
      if (method === 'initialize') {
        reply(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: 'winagent', version: cfg.version || '1.0.0' },
        });
      } else if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
        // notifications never get a response
      } else if (method === 'tools/list') {
        reply(id, { tools: tools.map(toMcpTool) });
      } else if (method === 'tools/call') {
        const name = params && params.name;
        const args = (params && params.arguments) || {};
        if (!name) { replyError(id, -32602, 'missing tool name'); return; }
        let result;
        try { result = await runTool(name, args); }
        catch (e) { reply(id, textResult(`error: ${e.message}`, true)); return; }
        if (!result) { reply(id, textResult(`error: unknown tool "${name}"`, true)); return; }
        reply(id, textResult(JSON.stringify(result), result.ok === false));
      } else if (method === 'ping') {
        reply(id, {});
      } else {
        replyError(id, -32601, `method not found: ${method}`);
      }
    } catch (e) {
      replyError(id, -32603, e.message);
    }
  }

  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on('line', (line) => {
    line = line.trim();
    if (!line) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return; } // malformed line: ignore, never crash the server
    handle(msg);
  });
  rl.on('close', () => process.exit(0));
  process.stderr.write(`[mcp-server] WinAgent MCP server ready — ${tools.length} tools, MCP_AUTO_YES=${cfg.autoYes}\n`);
}

main().catch((e) => { process.stderr.write(`[mcp-server] fatal: ${e.message}\n`); process.exit(1); });
