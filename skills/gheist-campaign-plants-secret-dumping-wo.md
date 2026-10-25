# Skill: Gheist campaign plants secret-dumping workflows using stolen GitHub tokens

Auto-learned 2026-10-25 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions Gheist campaign plants secret-dumping workflows using stolen GitHub tokens.

## Steps
1. Then, the tool downloads the log through the GitHub API and deletes the run seconds later
2. How the attack works For each repository, the tool creates a branch named ci-sync- plus six random characters, then commits .github/workflows/sync-check.yml with the message ci: sync config
3. How the payload evolved Two variants of this attack have been observed in parallel

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Gheist: Attempted Scaled Abuse of Stolen GitHub Tokens Stumbles
  https://www.wiz.io/blog/gheist-attempted-scaled-abuse-of-stolen-github-tokens-stumbles
- Wiz Says a Campaign Called Gheist Used Stolen GitHub Tokens to Plant ...
  https://www.soctember.com/detection/wiz-gheist-stolen-github-tokens-sync-check-workflow-secret-dump
- Credential-Stealing GitHub Actions Workflows Planted in Tens of ...
  https://thehackernews.com/2026/10/credential-stealing-github-actions.html
