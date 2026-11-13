#!/usr/bin/env python3
"""Loopback-only OpenAI-compatible endpoint for an AchLLM neural checkpoint."""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import torch

from train import ASSISTANT_MARKER, BOS, CHECKPOINT, Config, END_MARKER, TinyDecoder, USER_MARKER, ByteTokenizer, SYSTEM_PROMPT

PORT = int(os.environ.get("ACHLLM_NEURAL_PORT", "8092"))
MAX_BODY = 65_536


def load_model():
    checkpoint = torch.load(CHECKPOINT, map_location="cpu", weights_only=False)
    if checkpoint.get("format") != "achllm-neural":
        raise ValueError("not an AchLLM neural checkpoint")
    config = Config(**checkpoint["config"])
    model = TinyDecoder(config)
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    return model, config, ByteTokenizer()


MODEL = CONFIG = TOKENIZER = None
CHECKPOINT_MTIME = None
LOAD_ERROR = None


def current_runtime():
    """Atomically pick up a trainer-written checkpoint between requests."""
    global MODEL, CONFIG, TOKENIZER, CHECKPOINT_MTIME, LOAD_ERROR
    try:
        modified = CHECKPOINT.stat().st_mtime_ns
        if MODEL is None or modified != CHECKPOINT_MTIME:
            MODEL, CONFIG, TOKENIZER = load_model()
            CHECKPOINT_MTIME = modified
        LOAD_ERROR = None
    except Exception as error:
        LOAD_ERROR = str(error)
        raise RuntimeError(f"neural checkpoint unavailable: {LOAD_ERROR}") from error
    return MODEL, CONFIG, TOKENIZER


def chat_prompt(messages: object) -> str:
    """Build the exact role template used at training time, with bounded input."""
    if not isinstance(messages, list):
        raise ValueError("messages must be an array")
    turns: list[str] = [f"<|system|> {SYSTEM_PROMPT}"]
    for message in messages[-12:]:
        if not isinstance(message, dict):
            continue
        role = str(message.get("role", "user")).lower()
        content = str(message.get("content", "")).strip().replace("\x00", "")
        if not content:
            continue
        if role == "assistant":
            turns.append(f"{ASSISTANT_MARKER} {content[:6000]}")
        elif role == "user":
            turns.append(f"{USER_MARKER} {content[:6000]}")
    if len(turns) == 1:
        raise ValueError("messages are required")
    return "\n".join(turns) + f"\n{ASSISTANT_MARKER}"


@torch.no_grad()
def complete(prompt: str, max_tokens: int, temperature: float = 0.0) -> str:
    model, config, tokenizer = current_runtime()
    # Do not seed decoding with an end-of-document marker. The continuation
    # starts immediately after the user's final byte, not after EOS.
    prompt_tokens = tokenizer.encode(prompt)[:-1]
    tokens = prompt_tokens[-config.context:]
    for _ in range(min(max(1, max_tokens), 192)):
        input_ids = torch.tensor([tokens[-config.context:]], dtype=torch.long)
        logits = model(input_ids)[0, -1]
        # Greedy output is the default for reproducible evaluation.  Sampling
        # is intentionally bounded and only available to the private test API.
        if 0.05 <= temperature <= 1.2:
            probabilities = torch.softmax(logits / temperature, dim=-1)
            next_token = int(torch.multinomial(probabilities, 1).item())
        else:
            next_token = int(torch.argmax(logits).item())
        if next_token == EOS:
            break
        tokens.append(next_token)
        text = tokenizer.decode(tokens[len(prompt_tokens[-config.context:]):])
        if END_MARKER in text or USER_MARKER in text or ASSISTANT_MARKER in text:
            break
    generated = tokenizer.decode(tokens[len(prompt_tokens[-config.context:]):])
    for stop in (END_MARKER, USER_MARKER, ASSISTANT_MARKER):
        generated = generated.split(stop, 1)[0]
    return generated.strip()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        return

    def respond(self, status: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/v1/models":
            return self.respond(200, {"object": "list", "data": [{"id": "achllm-neural", "object": "model"}]})
        if self.path == "/healthz":
            try:
                current_runtime()
                return self.respond(200, {"ok": True, "model": "achllm-neural", "checkpoint": str(CHECKPOINT)})
            except Exception as error:
                return self.respond(503, {"ok": False, "error": str(error)})
        return self.respond(404, {"error": {"message": "not found"}})

    def do_POST(self):
        if self.path != "/v1/chat/completions":
            return self.respond(404, {"error": {"message": "not found"}})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                return self.respond(413, {"error": {"message": "request too large"}})
            body = json.loads(self.rfile.read(length))
            prompt = chat_prompt(body.get("messages"))
            content = complete(prompt, int(body.get("max_tokens", 96)), float(body.get("temperature", 0)))
            if not content:
                content = "I do not have a usable answer from this experimental checkpoint yet."
            return self.respond(200, {"id": "achllm-neural", "object": "chat.completion", "model": "achllm-neural", "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}]})
        except Exception as error:
            return self.respond(400, {"error": {"message": str(error)}})


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
