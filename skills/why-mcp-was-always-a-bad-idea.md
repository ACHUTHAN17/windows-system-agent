# Skill: Why MCP Was Always a Bad Idea

Auto-learned 2026-09-20 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions Why MCP Was Always a Bad Idea.

## Steps
1. First, we’ll start with non-AI related issues with security in the protocol
2. To decide whether a tool call is safe, you need to know the user prompt, the agent goal, the session history, what other tools were called before, and whether this call is part of a larger workflow or just a strange one-off
3. How do you force every client and every agent to use the gateway? Agents can run in local developer environments, CI pipelines, different services or microservices, IDEs and notebooks, and on machines you do not fully control

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Everything Wrong with MCP - by Shrivu Shankar
  https://blog.sshh.io/p/everything-wrong-with-mcp
- Why MCP Gateways are a Bad Idea (and What to Do Instead)
  https://www.capsulesecurity.io/blog-post/why-mcp-gateways-are-a-bad-idea-and-what-to-do-instead
