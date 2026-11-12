# AchLLM roadmap: current cloud capacity

This plan is for the current 4-vCPU, 8-GB RAM, 20-GB InstaBox machine. It is a CPU-only research host, not enough hardware to train a frontier LLM from scratch. The target is a small, auditable chat-and-code model that improves only when it passes measured checks.

## Operating boundary

- Train only on licensed, documented, lawful datasets. Keep source, licence, and provenance for every record.
- Preserve safeguards for harmful or illegal requests. The goal is configurable, useful behaviour—not an unrestricted model.
- Never train on private chats, passwords, files, browsing history, or copied third-party model outputs without explicit rights.
- Do not let AchLLM control system tools until it passes task-specific reliability and safety gates.

## Phase 1 — baseline and telemetry

Status: active. The trainer runs every five minutes while the server is available, resumes from its checkpoint, and publishes non-sensitive live status.

1. Keep the byte-level baseline bounded to 4 MB of training text and a 4 MB checkpoint.
2. Record serialized size, learned transition-weight entries, contexts, byte vocabulary, and lookup candidates.
3. Keep dashboard data live through `/achllm/status`, `/achllm/history`, and `/achllm/benchmarks`; GitHub Pages is only a fallback.

Exit gate: reproducible checkpoint and telemetry for 24 clean training cycles.

## Phase 2 — licensed chat and code data

1. Add small, reviewed public datasets with compatible licences, beginning with MIT-licensed chat/code traces.
2. Deduplicate and split by source before training: 80% train, 10% validation, 10% held out.
3. Keep total stored data under 12 GB and checkpoint/history storage under 2 GB on this machine.

Exit gate: every data row has provenance and no held-out content appears in training.

## Phase 3 — measurable quality

1. Add a held-out next-byte perplexity test for the baseline.
2. Add a small fixed chat helpfulness set and a code syntax/execution set that can run locally.
3. Publish only scored results with the exact harness version, data split hash, and model checkpoint hash.
4. Show `Not evaluated` for every unsupported comparison instead of estimating a score.

Exit gate: three consecutive checkpoints improve validation loss without regressing safety or code tests.

## Phase 4 — model architecture upgrade

The current count model has transition weights, not neural parameters; FLOPS/TOPS are not meaningful for it. A neural model requires a new, measured project.

1. Prototype a compact 20–50M parameter transformer only after Phase 3 data and evals exist.
2. Train short CPU smoke runs locally; use these only to validate the pipeline, not to claim model quality.
3. For real training, use a time-limited GPU grant, donated compute, or a funded GPU provider. The current CPU host should remain the controller, evaluator, dashboard, and inference gateway.

Exit gate: the new model beats the baseline on the same held-out tests and stays inside the server’s memory/storage budget.

## Phase 5 — useful agent integration

1. Keep planning/tool execution outside AchLLM while it remains unproven.
2. Introduce read-only tools first in a sandbox with audit logs and per-task limits.
3. Require explicit verification for file modifications, package changes, account actions, and system settings.

Exit gate: repeatable task success, no critical safety failures, and a human-reviewed release.

## Hosting reality

The current free host pauses after idle time and has a maximum run duration, so it cannot provide literal 24/7 training. The services restart safely when the host returns. A true 24/7 path requires an always-on host or scheduled external restart service; no GitHub-only solution can run an unrestricted model process continuously.
