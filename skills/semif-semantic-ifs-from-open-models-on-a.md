# Skill: SemIf Semantic ifs from open models, on a 3090 at home. Independent; not affiliated with Jev or TypeSafe.

Auto-learned 2026-09-18 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions SemIf Semantic ifs from open models, on a 3090 at home. Independent; not affiliated with Jev or TypeSafe..

## Steps
1. How it works flowchart LR S[Unstructured state] --> M[4B model] C[Runtime criteria] --> M O[Typed options] --> M M -- native option logits --> P[Probabilities] Loading Runtime-defined: criteria and option descriptions arrive with the request
2. Set up WSL2 first → docs/WSL_SETUP.md (start-to-finish)
3. To skip prompts: # `export MODEL_DIR=/path/to/models` and pass the model name
4. Pick a config + boot it (interactive wizard: asks model → GPUs → projects VRAM budget) bash scripts/launch.sh # Or let the resolver pick for your model + hardware (.

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- GitHub - pincente/Semif: Semantic ifs from open models, on a 3090 at home.
  https://github.com/pincente/Semif
- GitHub - noonghunna/club-3090: Community recipes for serving LLMs on ...
  https://github.com/noonghunna/club-3090
- Build a Home AI Server in 2026: Self-Hosted LLM Guide
  https://www.digitalapplied.com/blog/home-ai-server-build-self-hosted-llm-2026-guide
