#!/usr/bin/env python3
"""Restartable low-resource scheduler for the optional neural smoke trainer."""
from __future__ import annotations

import os
import subprocess
import sys
import time
import json
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INTERVAL_SECONDS = max(900, int(os.environ.get("ACHLLM_NEURAL_INTERVAL_SECONDS", "21600")))
STATE = ROOT / "models" / "achllm-neural" / "training-state.json"


def write_state(state: str, **extra: object) -> None:
    """Publish non-sensitive runtime state for the live dashboard."""
    STATE.parent.mkdir(parents=True, exist_ok=True)
    payload = {"state": state, "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **extra}
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=STATE.parent, delete=False) as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    os.replace(temporary, STATE)

while True:
    started = time.time()
    write_state("training", startedAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), intervalSeconds=INTERVAL_SECONDS)
    result = subprocess.run([sys.executable, str(ROOT / "neural" / "train.py")], cwd=ROOT, check=False)
    if result.returncode:
        print(f"AchLLM neural cycle exited {result.returncode}; retrying after interval", flush=True)
        write_state("error", exitCode=result.returncode, intervalSeconds=INTERVAL_SECONDS)
    else:
        # Record real direct-checkpoint samples for later review.  This cannot
        # promote a model or change the public chat route by itself.
        write_state("evaluating", intervalSeconds=INTERVAL_SECONDS)
        evaluation = subprocess.run([sys.executable, str(ROOT / "neural" / "eval_chat.py")], cwd=ROOT, check=False)
        if evaluation.returncode:
            print(f"AchLLM neural evaluation exited {evaluation.returncode}; training checkpoint remains available", flush=True)
            write_state("error", exitCode=evaluation.returncode, intervalSeconds=INTERVAL_SECONDS)
    sleep_for = max(1, INTERVAL_SECONDS - int(time.time() - started))
    write_state("idle", nextCycleAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + sleep_for)), intervalSeconds=INTERVAL_SECONDS)
    time.sleep(sleep_for)
