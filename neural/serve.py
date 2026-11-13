#!/usr/bin/env python3
"""Loopback-only OpenAI-compatible endpoint for an AchLLM neural checkpoint."""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import torch

from train import BOS, EOS, CHECKPOINT, Config, TinyDecoder, VOCAB_SIZE, ByteTokenizer

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


MODEL, CONFIG, TOKENIZER = load_model()


@torch.no_grad()
def complete(prompt: str, max_tokens: int) -> str:
    # Do not seed decoding with an end-of-document marker. The continuation
    # starts immediately after the user's final byte, not after EOS.
    prompt_tokens = TOKENIZER.encode(prompt)[:-1]
    tokens = prompt_tokens[-CONFIG.context:]
    for _ in range(min(max(1, max_tokens), 128)):
        input_ids = torch.tensor([tokens[-CONFIG.context:]], dtype=torch.long)
        logits = MODEL(input_ids)[0, -1]
        # Greedy decoding remains reproducible during evaluation.
        next_token = int(torch.argmax(logits).item())
        if next_token == EOS:
            break
        tokens.append(next_token)
    return TOKENIZER.decode(tokens[len(prompt_tokens[-CONFIG.context:]):])


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
        return self.respond(404, {"error": {"message": "not found"}})

    def do_POST(self):
        if self.path != "/v1/chat/completions":
            return self.respond(404, {"error": {"message": "not found"}})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                return self.respond(413, {"error": {"message": "request too large"}})
            body = json.loads(self.rfile.read(length))
            prompt = "\n".join(f"{item.get('role', 'user')}: {item.get('content', '')}" for item in body.get("messages", []))
            if not prompt.strip():
                return self.respond(400, {"error": {"message": "messages are required"}})
            content = complete(prompt, int(body.get("max_tokens", 96)))
            return self.respond(200, {"id": "achllm-neural", "object": "chat.completion", "model": "achllm-neural", "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}]})
        except Exception as error:
            return self.respond(400, {"error": {"message": str(error)}})


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
