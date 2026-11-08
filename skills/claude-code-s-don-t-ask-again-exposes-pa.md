# Skill: Claude Code's "Don't Ask Again" exposes passwords in 1,122 public GitHub files

Auto-learned 2026-11-08 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions Claude Code's "Don't Ask Again" exposes passwords in 1,122 public GitHub files.

## Steps
1. How the leak happens By default, Claude Code asks before running most shell commands
2. Run git rm --cached .claude/settings.local.json , then add the path (or the whole .claude/ folder) to the project’s .gitignore and to your organization’s repo templates

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Claude Code &#x27;Don&#x27;t Ask Again&#x27; Bug Exposes 1,122 GitHub Credential Files ...
  https://aviatrix.ai/threat-research-center/claude-code-dont-ask-again-settings-local-json-passwords-keys-1122-github-2026/
- Claude Code&#x27;s "Yes, and Don&#x27;t Ask Again" Option Can Leak Passwords and ...
  https://kylesinvestigation.com/2026/11/07/claude-codes-yes-and-dont-ask-again-option-can-leak-passwords-and-api-keys-to-github/
