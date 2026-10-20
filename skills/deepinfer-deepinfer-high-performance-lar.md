# Skill: DeepInfer DeepInfer: High-performance, large-scale inference framework for DeepSeek models

Auto-learned 2026-10-20 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions DeepInfer DeepInfer: High-performance, large-scale inference framework for DeepSeek models.

## Steps
1. Set DEEPINFER_ENABLE_MTP_VARLEN=1 ; DEEPINFER_USE_NEXTN_DECODE controls the maximum draft length (default: 5)
2. Set DEEPINFER_YOCO_PREFILL_TRUNCATION_MODE=compact and DEEPINFER_YOCO_PREFILL_KEEP_TOKENS=140 for the default V4.1 settings; the retained suffix must cover the SWA window plus the maximum backtracking length
3. Enable with DEEPINFER_BATCH_INVARIANT=1 (NVIDIA only)
4. First, DeepInfer is the inference framework DeepSeek runs in production, released under Apache-2.0 on 20 October 2026; it is the stack behind DeepSeek-V4.1-Flash at scale
5. How a request runs Knowing the stages makes the environment variables legible
6. To achieve efficient inference and cost-effective training, DeepSeek-V3 adopts Multi-head Latent Attention (MLA) and DeepSeekMoE architectures, which were thoroughly validated in DeepSeek-V2

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- GitHub - deepseek-ai/DeepInfer: DeepInfer: High-performance, large ...
  https://github.com/deepseek-ai/DeepInfer
- DeepInfer: DeepSeek open-sourced the inference framework behind V4.1 ...
  https://cldnavi.com/en/blog/deepinfer-inference-framework-2026/
- GitHub - iinfer/deepseek-ai_DeepSeek-V3 · GitHub
  https://github.com/iinfer/deepseek-ai_DeepSeek-V3
