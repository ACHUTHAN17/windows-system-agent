# Skill: DeepInfer DeepInfer: High-performance, large-scale inference framework for DeepSeek models

Auto-learned 2026-10-20 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions DeepInfer DeepInfer: High-performance, large-scale inference framework for DeepSeek models.

## Steps
1. Set DEEPINFER_ENABLE_MTP_VARLEN=1 ; DEEPINFER_USE_NEXTN_DECODE controls the maximum draft length (default: 5)
2. Set DEEPINFER_YOCO_PREFILL_TRUNCATION_MODE=compact and DEEPINFER_YOCO_PREFILL_KEEP_TOKENS=140 for the default V4.1 settings; the retained suffix must cover the SWA window plus the maximum backtracking length
3. Enable with DEEPINFER_BATCH_INVARIANT=1 (NVIDIA only)
4. How does DeepInfer work? The engine stacks DeepSeek’s kernels: FlashMLA , DeepGEMM , DeepEP , TileKernels, DeepSelect and custom TileLang kernels
5. How fast is DeepInfer? DeepSeek publishes Pareto curves for DeepSeek-V4.1-Flash at 131,072 context
6. To achieve efficient inference and cost-effective training, DeepSeek-V3 adopts Multi-head Latent Attention (MLA) and DeepSeekMoE architectures, which were thoroughly validated in DeepSeek-V2

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- GitHub - deepseek-ai/DeepInfer: DeepInfer: High-performance, large ...
  https://github.com/deepseek-ai/DeepInfer
- DeepSeek Open-Sources DeepInfer, the Inference Framework Behind ...
  https://www.marktechpost.com/2026/10/20/deepseek-deepinfer-open-source-inference-framework/
- GitHub - iinfer/deepseek-ai_DeepSeek-V3 · GitHub
  https://github.com/iinfer/deepseek-ai_DeepSeek-V3
