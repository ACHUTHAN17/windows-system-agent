# Skill: mcp — plug the whole MCP ecosystem in as tools

Any MCP server (SQLite, Postgres, GitHub, Playwright, filesystem…) becomes
`mcp_<server>_<tool>` with zero code. Unreachable servers warn-and-skip.

## Configure (`.env`, one line of JSON)
```
MCP_SERVERS={"sqlite":{"command":"uvx","args":["mcp-server-sqlite","--db-path","C:/data/a.db"]},"gh":{"command":"npx","args":["-y","@modelcontextprotocol/server-github"],"env":{"GITHUB_PERSONAL_ACCESS_TOKEN":"..."}}}
```
Windows needs `uvx`/`npx` on PATH (or absolute command paths). Restart after edit.

## Use
- Tools list shows `mcp_sqlite_query` etc. on boot (`[mcp] sqlite: N tools`).
- Call like any tool; results are capped at 8000 chars.
- Failing server? Agent still boots; check the `[mcp]` boot line.

## Rules
- Treat MCP tools as third-party: approve first use, prefer read-only queries.
- Secrets go in the server `env` block (never in chat); `.env` is gitignored.
- Prefer built-in tools when both exist (fewer moving parts, better errors).
