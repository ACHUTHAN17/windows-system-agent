#!/usr/bin/env python3
"""Create a reviewable, held-out chat sample report for AchLLM-Neural.

This script deliberately does not manufacture a benchmark score.  It stores
the actual completions for a fixed prompt set and marks them for human review.
Only an independently measured evaluation may later promote neural output.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "neural"))
from serve import complete, current_runtime, chat_prompt  # noqa: E402

REPORT = ROOT / "models" / "achllm-neural" / "chat-evaluation.json"
PROMPTS = (
    "What is an algorithm?",
    "Explain what an operating system does.",
    "Write a Python function that adds two numbers.",
    "What should you do when you are uncertain about an answer?",
)


def atomic_json(value: object, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target.parent, delete=False) as handle:
        json.dump(value, handle, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    os.replace(temporary, target)


def main() -> None:
    _, config, _ = current_runtime()
    rows = []
    for prompt in PROMPTS:
        completion = complete(chat_prompt([{"role": "user", "content": prompt}]), 128, 0.0)
        rows.append({"prompt": prompt, "completion": completion, "nonEmpty": bool(completion.strip())})
    readable = sum(row["nonEmpty"] for row in rows)
    report = {
        "format": "achllm-neural-chat-evaluation",
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "checkpointSha256": hashlib.sha256((ROOT / "models" / "achllm-neural" / "achllm-neural.pt").read_bytes()).hexdigest(),
        "context": config.context,
        "prompts": rows,
        "formatChecks": {"nonEmpty": readable, "total": len(rows)},
        "promotionEligible": False,
        "note": "Outputs are direct checkpoint samples for review. Non-empty output is not semantic quality, safety, or tool-use evidence.",
    }
    atomic_json(report, REPORT)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
