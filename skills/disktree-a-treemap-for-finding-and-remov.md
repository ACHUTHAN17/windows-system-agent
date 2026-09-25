# Skill: disktree A treemap for finding and removing what fills your disk, for Omarchy. Rust + GPUI.

Auto-learned 2026-09-25 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions disktree A treemap for finding and removing what fills your disk, for Omarchy. Rust + GPUI..

## Steps
1. Install Download disktree-*-x86_64-linux.tar.gz ( aarch64-linux on ARM) from the latest release , unpack it, and run ./install.sh inside (or just copy disktree onto your PATH )
2. use disktree::index::{ScanProgress, scan}; let progress = ScanProgress::default(); let tree = scan(dir.clone(), & progress); // The root aggregates its whole subtree

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- GitHub - tobi/disktree: A treemap for finding and removing what fills ...
  https://github.com/tobi/disktree
- disktree/AGENTS.md at main · tobi/disktree · GitHub
  https://github.com/tobi/disktree/blob/main/AGENTS.md
- disktree - Rust - Docs.rs
  https://docs.rs/disktree/latest/disktree/
