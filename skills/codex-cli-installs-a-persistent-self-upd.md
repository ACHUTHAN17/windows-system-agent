# Skill: Codex CLI installs a persistent, self-updating background daemon by default

Auto-learned 2026-10-12 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions Codex CLI installs a persistent, self-updating background daemon by default.

## Steps
1. How do I disable the Codex CLI daemon_auto_start feature? Set daemon_auto_start = false in config.toml, or run codex features disable daemon_auto_start followed by codex app-server daemon stop
2. Enable by adding an mcp_servers section to your ~/.codex/config.toml

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Codex CLI installs a persistent, self-updating...
  https://daily.dev/posts/codex-cli-installs-a-persistent-self-updating-background-daemon-by-default-unpmj86e7
- CLI: make `daemon_auto_start` opt-in — a persistent, self-updating ...
  https://github.com/openai/codex/issues/48195
- Documentation | Codex CLI
  https://openaicli.com/docs
