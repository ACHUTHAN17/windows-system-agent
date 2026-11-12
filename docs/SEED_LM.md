# AchLLM: clean-room language-model baseline

AchLLM is a brand-new, byte-level language model trained from local text only. It imports no old-model weights, API output, tokenizer, or cloud model. Training and inference use only Node.js standard libraries.

```bash
npm run train:seed-model
npm run train:seed-once
npm run serve:seed-model
curl http://127.0.0.1:8091/v1/models
```

## Chat + code training

The trainer uses only MIT-licensed UltraChat teacher/student dialogue examples. It alternates general conversational traces with a code-filtered subset of that same dataset. It no longer adds general Wikimedia or legacy mixed corpora to the live checkpoint. Source URL, teacher lineage, domain, and licence are recorded in `models/seed-data/manifest.jsonl`; the bounded 4 MB model is written to `models/achllm.live.model.json` and reloaded automatically.

```bash
npm run distill:achllm-once
npm run status:achllm
```

`npm run status:achllm` produces `docs/achllm-status.json` and a bounded `docs/achllm-history.json`, which power the GitHub Pages dashboard at `docs/achllm.html`. The dashboard reports a checkpoint-growth line, data-composition doughnut, evidence-readiness bars, and a ten-aspect evaluation map. Publication means the telemetry has been published; it is not a capability pass. The dashboard deliberately shows comparison values as **not evaluated** until reproducible held-out chat and code tests exist.

The dashboard polls the authenticated gateway's read-only telemetry route every two seconds. This refreshes the view without creating rapid Git commits or changing the training cadence. Model chat remains password-protected.

WinAgent-authored code, documentation, dashboard, and AchLLM model artefacts are proprietary and carry no licence to use, copy, or redistribute. The upstream UltraChat source remains MIT-licensed; that upstream licence cannot be made private or revoked by this repository.

To make the GitHub Pages copy update from a server, configure a write-capable, least-privilege GitHub deploy credential on that server and then set `ACHLLM_STATUS_PUSH=1` in the trainer service. The trainer publishes only `docs/achllm-status.json` once per hour by default. It never commits prompts, model files, API keys, or system data. The setting is intentionally off by default.

This is **offline distillation** from an openly published teacher dataset, not unauthorised scraping or replaying a proprietary service. It improves the public training corpus but does not turn the compact CPU model into a frontier LLM.

For a Linux cloud server where the repository lives at `~/winagent`:

```bash
mkdir -p ~/.config/systemd/user
cp deploy/seed-lm/*.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now winagent-seed-trainer.service winagent-seed-llm.service
systemctl --user status winagent-seed-trainer.service winagent-seed-llm.service
```

The implementation uses a backoff next-byte model with a compact serialized state. It is a real model trained from scratch, but it is intentionally a research baseline: the small corpus and CPU-only hardware cannot produce broad language understanding, reliable plans, or frontier-model quality. It is therefore **not connected to tool execution**. That safety boundary prevents an unproven model from controlling files, applications, or system settings.

To progress it responsibly, add licensed task traces to `models/winagent-seed.corpus.txt`, evaluate held-out completions, and only consider tool integration after it reaches a documented success threshold. A model able to compete with leading commercial models requires orders of magnitude more data, accelerator compute, and evaluation infrastructure than a free CPU server provides.
