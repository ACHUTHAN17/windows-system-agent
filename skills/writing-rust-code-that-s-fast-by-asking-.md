# Skill: Writing Rust code that's fast by asking agents to make the code faster

Auto-learned 2026-09-22 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions Writing Rust code that's fast by asking agents to make the code faster.

## Steps
1. First, in the initial prompt for creating a Rust crate for UMAP, I asked Opus 4.5 to create benchmarks with different input data sizes since optimizations for small datasets may not work for large datasets and vice versa
2. Install npx add-skill leonardomso/rust-skills That's it
3. How to use it After installing, just ask your agent: /rust-skills review this function /rust-skills is my error handling idiomatic? /rust-skills check for memory issues /rust-skills is this unsafe block sound? The agent loads the relevant rules and applies them to your code

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Writing Rust code that&#x27;s faster than state-of-the-art libraries by ...
  https://minimaxir.com/2026/09/agentic-iteration/
- GitHub - leonardomso/rust-skills: A collection of 265 rules across 26 ...
  https://github.com/leonardomso/rust-skills
