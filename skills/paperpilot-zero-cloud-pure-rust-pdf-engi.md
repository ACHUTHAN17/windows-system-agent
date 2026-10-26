# Skill: PaperPilot – Zero-Cloud, Pure-Rust PDF Engine with WASM and MCP

Auto-learned 2026-10-26 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions PaperPilot – Zero-Cloud, Pure-Rust PDF Engine with WASM and MCP.

## Steps
1. Use it with Claude / Cursor (MCP) Download paperpilot-mcp from Releases , then add it to claude_desktop_config.json : { "mcpServers" : { "paperpilot" : { "command" : " /path/to/paperpilot-mcp " } } } Restart Claude and try: "Merge these two PDFs and compress the re
2. Download and run Download PaperPilot.exe and double-click it
3. Copy the URL it shows you Once it&#x27;s ready, you&#x27;ll see something like: ====================================================================== PaperPilot is ready
4. Paste this URL into Claude&#x27;s connector settings: https://some-random-words.trycloudflare.com/mcp?token=AbCdEf123..
5. Then use it the same way as any Claude Code MCP tool, e.g.: /mcp__paperpilot__write_paper_prompt research_folder="C:\path\to\your\research" project_dir="C:\path\to\output" You do not need Steps 1-3 above for this path -- no tunnel gets created, and there&#x27;s no URL to paste anywhere.

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- GitHub - KrushnaVardhanReddy/PaperPilot: Your local AI copilot for ...
  https://github.com/KrushnaVardhanReddy/PaperPilot
- paper-pilot/docs/CLIENTS.md at main · aytzey/paper-pilot
  https://github.com/aytzey/paper-pilot/blob/main/docs/CLIENTS.md
- PaperPilot - sjgod1427.github.io
  https://sjgod1427.github.io/PaperPilot/docs/setup/
