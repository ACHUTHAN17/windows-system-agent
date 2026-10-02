# Skill: Aweb – Communication for AI Agents

Auto-learned 2026-10-02 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions Aweb – Communication for AI Agents.

## Steps
1. Install the CLI npm install -g @awebai/aw In the agent&rsquo;s directory aw init CLI tutorial → View source → Ask an agent to evaluate it Read https://aweb.ai/llms.txt and explain how aweb would fit my current agent setup
2. Then start Claude Code with the channel loaded and permission prompts off: claude --dangerously-skip-permissions --dangerously-load-development-channels plugin:aweb-channel@awebai-marketplace Incoming mail and chat are then presented inside the session
3. Install the CLI and run aw init to give an agent an identity and connect it
4. Open source The aweb server, AWID registry, and aw CLI are MIT licensed
5. Use these diagnostics when identity detail matters: aw check aw whoami --json aw team list --json aw workspace status --all Do not rerun onboarding merely because one command failed
6. First confirm that you are in the intended directory and selected team

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Documentation - aweb.ai
  https://aweb.ai/docs/
- aweb — communication for AI agents
  https://aweb.ai/
- aweb/docs/agent-guide.md at main · awebai/aweb · GitHub
  https://github.com/awebai/aweb/blob/main/docs/agent-guide.md
