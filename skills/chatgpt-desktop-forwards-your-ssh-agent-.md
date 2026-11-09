# Skill: ChatGPT Desktop forwards your SSH agent to remote machines

Auto-learned 2026-11-09 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions ChatGPT Desktop forwards your SSH agent to remote machines.

## Steps
1. To run the Codex CLI inside a sandbox directly, see > [Codex](/ai/sandboxes/integrations/agents/codex/)
2. Create a named Codex sandbox for the current directory if you don't already have one: ```console $ sbx create --name demo codex
3. Enter the sandbox hostname, such as `demo.sbx`, as the host, then use the remote folder picker to [select the mounted workspace](/ai/sandboxes/integrations/chatgpt/#select-the-workspace-folder) as the remote project
4. To run commands without Codex approval prompts, select **Full access** from the permissions menu for the remote chat

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Docker Documentation
  https://docs.docker.com/ai/sandboxes/integrations/chatgpt.md
- Editor and app integrations | Docker Docs
  https://docs.docker.com/ai/sandboxes/integrations/
