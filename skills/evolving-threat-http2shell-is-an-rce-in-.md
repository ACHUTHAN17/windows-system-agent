# Skill: Evolving Threat: http2shell is an RCE in node, Python, and more

Auto-learned 2026-10-23 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions Evolving Threat: http2shell is an RCE in node, Python, and more.

## Steps
1. First, a bare Node.js HTTP server does not decode an incoming Brotli body just by receiving it, so exposure depends on what your code and middleware actually do with the data
2. First, check the Node version inside every container image and artifact you ship, because a bundled runtime is easy to miss in a package inventory

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Node2Shell: From Brotli Data to Remote Code Execution
  https://www.imperva.com/blog/node2shell-from-brotli-data-to-remote-code-execution/
- Node2Shell: Node.js Brotli RCE (CVE-2026-111497) Explained
  https://www.tigergate.dev/blog/node2shell-nodejs-brotli-rce-explained/
- Node2Shell: Node.js Brotli RCE Explained (CVE-2026-111497)
  https://cveplayground.com/blog/node2shell-brotli-rce-cve-2026-111497/
