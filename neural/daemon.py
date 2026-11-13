#!/usr/bin/env python3
"""Restartable low-resource scheduler for the optional neural smoke trainer."""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INTERVAL_SECONDS = max(900, int(os.environ.get("ACHLLM_NEURAL_INTERVAL_SECONDS", "21600")))

while True:
    started = time.time()
    result = subprocess.run([sys.executable, str(ROOT / "neural" / "train.py")], cwd=ROOT, check=False)
    if result.returncode:
        print(f"AchLLM neural cycle exited {result.returncode}; retrying after interval", flush=True)
    else:
        # Record real direct-checkpoint samples for later review.  This cannot
        # promote a model or change the public chat route by itself.
        evaluation = subprocess.run([sys.executable, str(ROOT / "neural" / "eval_chat.py")], cwd=ROOT, check=False)
        if evaluation.returncode:
            print(f"AchLLM neural evaluation exited {evaluation.returncode}; training checkpoint remains available", flush=True)
    sleep_for = max(1, INTERVAL_SECONDS - int(time.time() - started))
    time.sleep(sleep_for)
