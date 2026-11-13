# AchLLM-Neural: CPU-first training pipeline

AchLLM-Neural is an optional decoder-only byte transformer that starts from random weights. It is separate from the current n-gram baseline and never replaces it automatically. It uses distinct begin/end byte tokens and explicit system, user, and assistant turns so its training format matches chat inference. A neural checkpoint is eligible for testing only after it records validation and held-out loss from a document-level split.

## Data boundary

The trainer reads only the declared local foundation and chat/code corpus files. Those corpus files already carry source and licence records in `models/seed-data/manifest.jsonl`. It does not scrape arbitrary pages, ingest browser history, read credentials, or train on private chats without explicit donation consent.

## Local or server install

```bash
python3 -m venv ~/.local/share/achllm-neural
~/.local/share/achllm-neural/bin/pip install --upgrade pip
~/.local/share/achllm-neural/bin/pip install -r neural/requirements.txt
~/.local/share/achllm-neural/bin/python neural/train.py --steps 200
```

The default model is deliberately small (about hundreds of thousands of parameters) and CPU-safe. It validates the full path: training, held-out evaluation, atomic checkpoint write, and loopback-only inference. It is not expected to provide general chat quality.

To run restartable smoke training while the host is available:

```bash
mkdir -p ~/.config/systemd/user
cp deploy/seed-lm/winagent-neural-*.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now winagent-neural-trainer.service
```

After the first checkpoint succeeds, start its private test endpoint:

```bash
systemctl --user enable --now winagent-neural-llm.service
curl http://127.0.0.1:8092/v1/models
```

The endpoint binds only to `127.0.0.1`. It is intentionally not exposed publicly or connected to system-tool execution. The free host can pause or stop after its runtime limit, so the service resumes rather than providing a literal 24/7 guarantee.

Create a reviewable direct-checkpoint chat report after each meaningful training phase:

```bash
~/.local/share/achllm-neural/bin/python neural/eval_chat.py
```

This records the real completions in `models/achllm-neural/chat-evaluation.json`. It detects obvious collapsed output such as repeated characters or words, but does **not** invent a benchmark score or promote the checkpoint. Promotion requires independently measured held-out chat, code, safety, and tool-use evaluation, the data/loss gates below, and an explicit review decision.

## Chat reliability gate

The public AchLLM chat service uses a small reviewed technical foundation and attributable retrieval from the licensed local corpus while the neural model is immature. It will not surface neural generations until the checkpoint has at least 3,000 training documents, validation loss at or below 2.0, held-out loss at or below 2.2, and an independent chat evaluation that explicitly marks the checkpoint eligible. Until then, unknown questions receive an honest limitation instead of a fabricated answer.

For testing, the authenticated chat surfaces always expose three choices: **AchLLM Auto**, **AchLLM Reliable**, and **AchLLM Neural**. Auto evaluates the baseline, reliable evidence layer, and neural checkpoint for every chat, then promotes neural output only after the gate passes. Direct Neural is intentionally available for inspecting the live checkpoint and labels every response as experimental.
