# AchLLM: clean-room language-model baseline

AchLLM is a brand-new, byte-level language model trained from local text only. It imports no old-model weights, API output, tokenizer, or cloud model. Training and inference use only Node.js standard libraries.

```bash
npm run train:seed-model
npm run train:seed-once
npm run serve:seed-model
curl http://127.0.0.1:8091/v1/models
```

## Continuous cloud training

The trainer fetches a maximum of five public English Wikipedia extracts every 15 minutes, records source URLs and licence metadata in `models/seed-data/manifest.jsonl`, retrains a bounded 4 MB corpus, and writes `models/achllm.live.model.json`. The serving process detects the new checkpoint automatically. Wikimedia text requires CC BY-SA/GFDL attribution; the provenance manifest is retained for that purpose.

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
