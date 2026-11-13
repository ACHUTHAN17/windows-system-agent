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
import re
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "neural"))
from serve import complete, current_runtime, chat_prompt  # noqa: E402

REPORT = ROOT / "models" / "achllm-neural" / "chat-evaluation.json"
CASES = (
    {"id": "concept", "prompt": "What is an algorithm?", "kind": "chat"},
    {"id": "system", "prompt": "Explain what an operating system does.", "kind": "chat"},
    {"id": "code", "prompt": "Write a Python function that adds two numbers.", "kind": "code"},
    {"id": "uncertainty", "prompt": "What should you do when you are uncertain about an answer?", "kind": "chat"},
)


def atomic_json(value: object, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target.parent, delete=False) as handle:
        json.dump(value, handle, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    os.replace(temporary, target)


def output_health(text: str) -> dict[str, object]:
    """Catch obvious collapsed decoding without pretending to judge truth.

    A small from-scratch model often emits one character or word repeatedly.
    This mechanical test makes that failure visible.  It is deliberately not a
    semantic score: helpfulness, factuality, safety, and code correctness still
    need an independent held-out evaluation.
    """
    normalized = " ".join(str(text or "").split())
    words = re.findall(r"[A-Za-z0-9_]+", normalized.lower())
    unique_ratio = len(set(words)) / max(1, len(words))
    longest_run = max((len(run) for run in re.findall(r"(.)\1*", normalized)), default=0)
    repeated_word = max((words.count(word) for word in set(words)), default=0)
    reasons: list[str] = []
    if len(words) < 3:
        reasons.append("too-short")
    if unique_ratio < 0.25:
        reasons.append("low-lexical-diversity")
    if longest_run >= 12:
        reasons.append("repeated-character-run")
    if repeated_word > max(4, len(words) * 0.5):
        reasons.append("repeated-word-run")
    return {
        "nonEmpty": bool(normalized), "wordCount": len(words),
        "uniqueWordRatio": round(unique_ratio, 4), "longestCharacterRun": longest_run,
        "maxRepeatedWord": repeated_word, "mechanicallyHealthy": not reasons,
        "reasons": reasons,
    }


def main() -> None:
    _, config, _ = current_runtime()
    rows = []
    for case in CASES:
        completion = complete(chat_prompt([{"role": "user", "content": case["prompt"]}]), 128, 0.0)
        health = output_health(completion)
        rows.append({**case, "completion": completion, "health": health})
    readable = sum(row["health"]["nonEmpty"] for row in rows)
    mechanically_healthy = sum(row["health"]["mechanicallyHealthy"] for row in rows)
    report = {
        "format": "achllm-neural-chat-evaluation",
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "checkpointSha256": hashlib.sha256((ROOT / "models" / "achllm-neural" / "achllm-neural.pt").read_bytes()).hexdigest(),
        "context": config.context,
        "prompts": rows,
        "formatChecks": {"nonEmpty": readable, "total": len(rows)},
        "qualityGate": {
            "mechanicallyHealthy": mechanically_healthy,
            "total": len(rows),
            "passed": mechanically_healthy == len(rows),
            "scope": "Only detects collapsed/repetitive decoding. It does not measure factuality, safety, or code correctness.",
        },
        "promotionEligible": False,
        "note": "Outputs are direct checkpoint samples for review. This report cannot promote a model; independent held-out chat, code, safety, and tool-use evaluation is still required.",
    }
    atomic_json(report, REPORT)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
