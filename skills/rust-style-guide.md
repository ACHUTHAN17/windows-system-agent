# Skill: Rust Style Guide

Auto-learned 2026-10-22 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions Rust Style Guide.

## Steps
1. Note that avoiding trailing whitespace in string literals requires care to preserve the value of the literal
2. To compare two numeric chunks, compare them by numeric value, ignoring leading zeroes
3. To compare two chunks if both are not numeric, compare them by Unicode character lexicographically, with two exceptions: _ (underscore) sorts immediately after (space) but before any other character
4. to target something non-standard)

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Introduction - The Rust Style Guide
  https://doc.rust-lang.org/beta/style-guide/index.html
- Rust Documentation
  https://doc.rust-lang.org/
- 2436-style-guide - The Rust RFC Book
  https://rust-lang.github.io/rfcs/2436-style-guide.html
