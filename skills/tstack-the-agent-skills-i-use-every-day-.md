# Skill: tstack The agent skills I use every day. Works with Claude Code and Codex.

Auto-learned 2026-10-26 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions tstack The agent skills I use every day. Works with Claude Code and Codex..

## Steps
1. Install the ones they need too: full-send uses sol-loop , file-pr , and babysit-pr
2. Install git clone https://github.com/t3dotgg/tstack cp -R tstack/skills/ * ~ /.claude/skills/ # Claude Code cp -R tstack/skills/ * ~ /.codex/skills/ # Codex Requirements An authenticated GitHub CLI ( gh )
3. Install a skill by placing it in the tool&rsquo;s skills directory ( .claude/skills/ for Claude Code, .agents/skills/ for Codex, ~/.openclaw/skills/ for OpenClaw) and treat every skill like code you run
4. Download, customize, and drop them straight into your project
5. How Skills Work: Progressive Disclosure Skills don't dump their entire contents into the AI's context window from the start

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- GitHub - t3dotgg/tstack: The agent skills I use every day. Works with ...
  https://github.com/t3dotgg/tstack
- GitHub - TukuCorp/tstack: My agent setup: skills, agents, hooks and ...
  https://github.com/TukuCorp/tstack
- AI Agent Skills Guide 2026: SKILL.md, Claude Code, Codex & Security
  https://www.thepromptindex.com/how-to-use-ai-agent-skills-the-complete-guide.html
