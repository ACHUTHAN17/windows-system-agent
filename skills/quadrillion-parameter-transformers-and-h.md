# Skill: Quadrillion-parameter transformers and how to train them

Auto-learned 2026-11-08 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions Quadrillion-parameter transformers and how to train them.

## Steps
1. To study this regime directly, we train transformers on fixed datasets, across a range of data sizes, model sizes, and epoch count, and fit how loss depends on each
2. To prevent overfitting on repeated tokens without choking capacity, optimal weight decay must scale steeply as a power law of both parameter count and epoch count ®

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Quadrillion-parameter transformers and how to train them - Q
  https://qlabs.sh/research/parameters
- Quadrillion-parameter transformers and how to train them
  https://lifeboat.com/blog/2026/11/quadrillion-parameter-transformers-and-how-to-train-them
- GitHub - huggingface/trl: Train transformer language models with ...
  https://github.com/huggingface/trl
