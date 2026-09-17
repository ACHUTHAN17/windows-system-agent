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

## Connectors (ChatGPT-parity recipes — copy, fill tokens, restart)
```json
MCP_SERVERS={
"notion": {"command":"npx","args":["-y","@notionhq/notion-mcp-server"],"env":{"NOTION_TOKEN":"ntn_..."}},
"github": {"command":"npx","args":["-y","@modelcontextprotocol/server-github"],"env":{"GITHUB_PERSONAL_ACCESS_TOKEN":"ghp_..."}},
"google": {"command":"npx","args":["-y","@chieflatif/google-mcp"],"env":{"MCP_CORE_TOOLS":"1","GOOGLE_CLIENT_ID":"....apps.googleusercontent.com","GOOGLE_CLIENT_SECRET":"..."}},
"drive": {"command":"npx","args":["-y","@piotr-agier/google-drive-mcp"]},
"playwright": {"command":"npx","args":["-y","@playwright/mcp"]},
"files": {"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","C:/Users/You/Documents"]}
}
```
- Notion: token from notion.so/my-integrations, then share pages with the integration.
- Google: one Google Cloud OAuth Desktop client; first run opens a browser login, then auto-refreshes. `MCP_CORE_TOOLS=1` = 24 essential tools.
- GitHub: classic PAT (`repo` scope) — same token shape as skills/github.md.
- Playwright: second browser brain (Microsoft's) for JS-heavy pages.
- Windows: prefer ABSOLUTE command paths if bare names fail (see skill text).
