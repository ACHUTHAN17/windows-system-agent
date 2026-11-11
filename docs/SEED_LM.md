# WinAgent Seed: clean-room language-model baseline

Seed is a brand-new, byte-level language model trained from local text only. It imports no old-model weights, API output, tokenizer, or cloud model. Training and inference use only Node.js standard libraries.

```bash
npm run train:seed-model
npm run serve:seed-model
curl http://127.0.0.1:8091/v1/models
```

The implementation uses a backoff next-byte model with a compact serialized state. It is a real model trained from scratch, but it is intentionally a research baseline: the small corpus and CPU-only hardware cannot produce broad language understanding, reliable plans, or frontier-model quality. It is therefore **not connected to tool execution**. That safety boundary prevents an unproven model from controlling files, applications, or system settings.

To progress it responsibly, add licensed task traces to `models/winagent-seed.corpus.txt`, evaluate held-out completions, and only consider tool integration after it reaches a documented success threshold. A model able to compete with leading commercial models requires orders of magnitude more data, accelerator compute, and evaluation infrastructure than a free 4-vCPU server provides.
