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
CYCLE_SECONDS = max(3, int(os.environ.get("ACHLLM_NEURAL_CYCLE_SECONDS", "3")))
MICRO_STEPS = max(1, int(os.environ.get("ACHLLM_NEURAL_MICRO_STEPS", "1")))
EVALUATE_EVERY = max(1, int(os.environ.get("ACHLLM_NEURAL_EVALUATE_EVERY", "20")))
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

cycle_number = 0
while True:
    started = time.time()
    cycle_number += 1
    # One small, serial CPU step per cycle.  The subprocess cannot overlap with
    # another cycle; this lets the server keep working without saturating it.
    write_state("training", startedAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), cycleNumber=cycle_number, cycleSeconds=CYCLE_SECONDS, microSteps=MICRO_STEPS)
    training_env = os.environ.copy()
    training_env["ACHLLM_NEURAL_STEPS"] = str(MICRO_STEPS)
    result = subprocess.run([sys.executable, str(ROOT / "neural" / "train.py")], cwd=ROOT, env=training_env, check=False)
    if result.returncode:
        print(f"AchLLM neural cycle exited {result.returncode}; retrying next micro-cycle", flush=True)
        write_state("error", exitCode=result.returncode, cycleNumber=cycle_number, cycleSeconds=CYCLE_SECONDS)
    elif cycle_number % EVALUATE_EVERY == 0:
        # Record real direct-checkpoint samples for later review.  This cannot
        # promote a model or change the public chat route by itself.
        write_state("evaluating", cycleNumber=cycle_number, cycleSeconds=CYCLE_SECONDS, evaluateEvery=EVALUATE_EVERY)
        evaluation = subprocess.run([sys.executable, str(ROOT / "neural" / "eval_chat.py")], cwd=ROOT, check=False)
        if evaluation.returncode:
            print(f"AchLLM neural evaluation exited {evaluation.returncode}; training checkpoint remains available", flush=True)
            write_state("error", exitCode=evaluation.returncode, cycleNumber=cycle_number, cycleSeconds=CYCLE_SECONDS)
    remaining = max(0, CYCLE_SECONDS - (time.time() - started))
    if remaining:
        # Do not call this idle: it is the rate limiter that protects CPU and
        # checkpoint storage between continuous micro-training steps.
        write_state("continuous", phase="rate-limited before next micro-training step", cycleNumber=cycle_number, nextCycleAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + remaining)), cycleSeconds=CYCLE_SECONDS, microSteps=MICRO_STEPS)
        time.sleep(remaining)
