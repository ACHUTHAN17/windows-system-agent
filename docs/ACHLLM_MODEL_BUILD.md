# Building AchLLM into a useful chat model

AchLLM now has the required pieces for a small, auditable chat-model project:

1. **Chat-formatted training.** Every attributable record is converted to explicit system, user, assistant, and end turns before training.
2. **Reproducible neural checkpoint.** The CPU trainer starts from random weights, resumes only compatible checkpoints, writes atomically, and records architecture, parameter count, split sizes, loss, and source hashes.
3. **Private neural test server.** `neural/serve.py` exposes an OpenAI-compatible loopback endpoint with bounded input, bounded generation, checkpoint hot reload, and health checks.
4. **Reliable public chat.** The public `achllm` and `achllm-auto` modes use the reviewed foundation plus attributable retrieval until the neural checkpoint earns promotion.
5. **Evaluation instead of claims.** `neural/eval_chat.py` writes direct held-out prompt completions for review. It cannot promote the model or fabricate frontier comparisons.
6. **Data governance.** Only versioned, licensed, attributable sources and explicitly donated chats enter the corpus. Credentials, browser history, arbitrary web pages, and unconsented chats remain excluded.

## Next measurable milestones

- Grow the documented chat-and-code corpus to at least 3,000 source-separated records.
- Add a frozen held-out chat and code suite with pass/fail criteria, then require three non-regressing runs.
- Promote a neural checkpoint only after those measured gates pass.
- Add read-only agent tasks in a separate sandbox; model text must never become arbitrary system execution.

The current 4-vCPU server can validate this pipeline and serve the reliable chat layer. It cannot train a frontier-capability LLM from scratch. Larger neural training needs more licensed data and time-limited GPU or donated compute, while this host remains useful for orchestration, evaluation, deployment, and chat serving.
