#!/usr/bin/env python3
"""Train AchLLM-Neural from licensed, attributable local corpus files.

This is deliberately a CPU smoke-training pipeline, not a claim of frontier
capability. It starts from random weights and produces a reproducible,
versioned checkpoint only after a held-out validation pass is recorded.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import tempfile
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

try:
    import torch
    from torch import Tensor, nn
except ImportError as exc:  # Helpful error when the optional venv is absent.
    raise SystemExit("PyTorch is required. Create the documented virtualenv and install neural/requirements.txt.") from exc


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CORPORA = (
    ROOT / "models" / "achllm.foundation.txt",
    ROOT / "models" / "seed-data" / "chat-code-corpus.txt",
)
MODEL_DIR = ROOT / "models" / "achllm-neural"
CHECKPOINT = MODEL_DIR / "achllm-neural.pt"
METADATA = MODEL_DIR / "metadata.json"
FORMAT = "achllm-neural"
# Version 3 adds an explicit conversation template.  Version 2 checkpoints are
# intentionally not resumed because they were trained as unstructured text and
# therefore do not provide a sound base for a chat model.
VERSION = 3
PAD = 0
BOS = 1
EOS = 2
BYTE_OFFSET = 3
VOCAB_SIZE = 259  # padding, BOS, EOS, then raw UTF-8 bytes


@dataclass(frozen=True)
class Config:
    context: int = 128
    width: int = 128
    layers: int = 2
    heads: int = 4
    dropout: float = 0.05
    batch_size: int = 8
    learning_rate: float = 3e-4
    weight_decay: float = 0.01
    steps: int = 200
    seed: int = 1729


class ByteTokenizer:
    def encode(self, text: str) -> list[int]:
        return [BOS, *[byte + BYTE_OFFSET for byte in text.encode("utf-8", errors="replace")], EOS]

    def decode(self, ids: Iterable[int]) -> str:
        return bytes(token - BYTE_OFFSET for token in ids if token >= BYTE_OFFSET).decode("utf-8", errors="replace")


SYSTEM_PROMPT = "You are AchLLM, a helpful chat and code assistant. Answer accurately, briefly, and say when you are uncertain."
USER_MARKER = "<|user|>"
ASSISTANT_MARKER = "<|assistant|>"
END_MARKER = "<|end|>"


def as_chat_document(text: str) -> str:
    """Turn an attributable record into one consistent chat training example.

    Existing UltraChat rows already contain role labels.  Reference documents
    do not, so they become a factual-answer exercise.  The conversion is
    deterministic and keeps the source text intact; it never invents a
    teacher answer or consumes private conversations.
    """
    text = text.strip()
    lowered = text.lower()
    if "assistant:" in lowered or USER_MARKER in text or ASSISTANT_MARKER in text:
        turns: list[str] = []
        active_role = "user"
        buffer: list[str] = []
        for raw in text.splitlines():
            line = raw.strip()
            role, separator, value = line.partition(":")
            normalized = role.lower().strip()
            if separator and normalized in {"user", "assistant", "system"}:
                if buffer:
                    turns.append(f"{USER_MARKER if active_role == 'user' else ASSISTANT_MARKER} {' '.join(buffer).strip()}")
                active_role = "assistant" if normalized == "assistant" else "user"
                buffer = [value.strip()]
            elif line:
                buffer.append(line)
        if buffer:
            turns.append(f"{USER_MARKER if active_role == 'user' else ASSISTANT_MARKER} {' '.join(buffer).strip()}")
        if any(turn.startswith(ASSISTANT_MARKER) for turn in turns):
            return f"<|system|> {SYSTEM_PROMPT}\n" + "\n".join(turns) + f"\n{END_MARKER}"
    return f"<|system|> {SYSTEM_PROMPT}\n{USER_MARKER} Give a concise factual explanation.\n{ASSISTANT_MARKER} {text}\n{END_MARKER}"


class TinyDecoder(nn.Module):
    def __init__(self, config: Config):
        super().__init__()
        self.config = config
        self.token = nn.Embedding(VOCAB_SIZE, config.width)
        self.position = nn.Embedding(config.context, config.width)
        block = nn.TransformerEncoderLayer(
            d_model=config.width,
            nhead=config.heads,
            dim_feedforward=config.width * 4,
            dropout=config.dropout,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )
        self.blocks = nn.TransformerEncoder(block, num_layers=config.layers)
        self.norm = nn.LayerNorm(config.width)
        self.head = nn.Linear(config.width, VOCAB_SIZE, bias=False)

    def forward(self, tokens: Tensor) -> Tensor:
        _, length = tokens.shape
        if length > self.config.context:
            raise ValueError("sequence exceeds configured context")
        positions = torch.arange(length, device=tokens.device).unsqueeze(0)
        hidden = self.token(tokens) + self.position(positions)
        # True means blocked for PyTorch's transformer attention mask.
        blocked = torch.triu(torch.ones(length, length, device=tokens.device, dtype=torch.bool), diagonal=1)
        return self.head(self.norm(self.blocks(hidden, mask=blocked)))


def corpus_documents(files: Iterable[Path]) -> tuple[list[str], list[dict[str, str]]]:
    """Read only declared local corpus files and return deduplicated documents."""
    documents: list[str] = []
    provenance: list[dict[str, str]] = []
    seen: set[str] = set()
    for file in files:
        if not file.exists():
            continue
        source = file.read_text(encoding="utf-8", errors="replace")
        for chunk in source.split("\n\n"):
            text = chunk.strip()
            if len(text.encode("utf-8")) < 80:
                continue
            digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
            if digest in seen:
                continue
            seen.add(digest)
            documents.append(as_chat_document(text))
            provenance.append({"file": str(file.relative_to(ROOT)).replace("\\", "/"), "sha256": digest})
    if len(documents) < 3:
        raise ValueError("Need at least three attributable local documents before neural training")
    return documents, provenance


def deterministic_split(documents: list[str]) -> tuple[list[str], list[str], list[str]]:
    """Stable document-level 80/10/10 split prevents continuation leakage."""
    buckets = ([], [], [])
    for document in documents:
        value = int(hashlib.sha256(document.encode("utf-8")).hexdigest()[:8], 16) % 10
        buckets[0 if value < 8 else 1 if value == 8 else 2].append(document)
    # Small early corpora can miss a bucket. Move one complete record instead of
    # silently mixing source text across train and validation/held-out splits.
    for index in (1, 2):
        if not buckets[index] and len(buckets[0]) > 2:
            buckets[index].append(buckets[0].pop())
    if not buckets[0] or not buckets[1] or not buckets[2]:
        raise ValueError("Corpus split needs train, validation, and held-out documents")
    return buckets[0], buckets[1], buckets[2]


def encoded_documents(documents: Iterable[str], tokenizer: ByteTokenizer) -> list[Tensor]:
    return [torch.tensor(tokenizer.encode(document), dtype=torch.long) for document in documents]


def batch_from(documents: list[Tensor], config: Config, generator: random.Random) -> tuple[Tensor, Tensor]:
    rows: list[Tensor] = []
    span = config.context + 1
    for _ in range(config.batch_size):
        row = documents[generator.randrange(len(documents))]
        if row.numel() < span:
            repeats = (span + row.numel() - 1) // row.numel()
            row = row.repeat(repeats)
        start = generator.randrange(max(1, row.numel() - span + 1))
        rows.append(row[start:start + span])
    data = torch.stack(rows)
    return data[:, :-1], data[:, 1:]


@torch.no_grad()
def mean_loss(model: TinyDecoder, documents: list[Tensor], config: Config, seed: int, batches: int = 16) -> float:
    model.eval()
    generator = random.Random(seed)
    values: list[float] = []
    for _ in range(batches):
        inputs, targets = batch_from(documents, config, generator)
        logits = model(inputs)
        values.append(float(nn.functional.cross_entropy(logits.reshape(-1, VOCAB_SIZE), targets.reshape(-1)).item()))
    model.train()
    return sum(values) / len(values)


def parameter_count(model: nn.Module) -> int:
    return sum(parameter.numel() for parameter in model.parameters())


def compatible_checkpoint(checkpoint: object, config: Config) -> bool:
    """Only resume weights when the tensor shape contract is unchanged."""
    if not isinstance(checkpoint, dict) or checkpoint.get("format") != FORMAT or checkpoint.get("version") != VERSION:
        return False
    saved = checkpoint.get("config")
    if not isinstance(saved, dict):
        return False
    # Optimisation values may change between cycles; architecture may not.
    return all(saved.get(key) == getattr(config, key) for key in ("context", "width", "layers", "heads", "dropout"))


def atomic_torch_save(value: object, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=target.parent, prefix=f".{target.name}.", delete=False) as handle:
        temporary = Path(handle.name)
    try:
        torch.save(value, temporary)
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def atomic_json(value: object, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target.parent, prefix=f".{target.name}.", delete=False) as handle:
        json.dump(value, handle, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    try:
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def train(config: Config, max_checkpoint_mb: int) -> dict[str, object]:
    if config.width % config.heads:
        raise ValueError("width must be divisible by heads")
    torch.set_num_threads(max(1, min(4, os.cpu_count() or 1)))
    torch.manual_seed(config.seed)
    generator = random.Random(config.seed)
    tokenizer = ByteTokenizer()
    documents, provenance = corpus_documents(DEFAULT_CORPORA)
    train_docs, validation_docs, heldout_docs = deterministic_split(documents)
    train_rows = encoded_documents(train_docs, tokenizer)
    validation_rows = encoded_documents(validation_docs, tokenizer)
    heldout_rows = encoded_documents(heldout_docs, tokenizer)
    model = TinyDecoder(config)
    resumed_from = None
    cumulative_steps = 0
    if CHECKPOINT.exists():
        try:
            previous = torch.load(CHECKPOINT, map_location="cpu", weights_only=False)
            if compatible_checkpoint(previous, config):
                model.load_state_dict(previous["state_dict"])
                resumed_from = previous.get("createdAt")
                cumulative_steps = int(previous.get("training", {}).get("cumulativeSteps", 0))
        except Exception as error:
            print(f"Ignoring incompatible neural checkpoint: {error}", flush=True)
    optimizer = torch.optim.AdamW(model.parameters(), lr=config.learning_rate, weight_decay=config.weight_decay)
    started = time.time()
    losses: list[float] = []
    for _ in range(config.steps):
        inputs, targets = batch_from(train_rows, config, generator)
        optimizer.zero_grad(set_to_none=True)
        logits = model(inputs)
        loss = nn.functional.cross_entropy(logits.reshape(-1, VOCAB_SIZE), targets.reshape(-1))
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        losses.append(float(loss.item()))
    validation_loss = mean_loss(model, validation_rows, config, config.seed + 1)
    heldout_loss = mean_loss(model, heldout_rows, config, config.seed + 2)
    parameters = parameter_count(model)
    elapsed = max(time.time() - started, 0.001)
    checkpoint = {
        "format": FORMAT,
        "version": VERSION,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "config": asdict(config),
        "vocab": {"kind": "utf8-byte", "size": VOCAB_SIZE, "pad": PAD, "bos": BOS, "eos": EOS, "byteOffset": BYTE_OFFSET},
        "state_dict": model.state_dict(),
        "metrics": {"lastTrainLoss": losses[-1], "meanTrainLoss": sum(losses) / len(losses), "validationLoss": validation_loss, "heldoutLoss": heldout_loss},
        "training": {"resumedFrom": resumed_from, "cycleSteps": config.steps, "cumulativeSteps": cumulative_steps + config.steps},
        "provenance": provenance,
    }
    atomic_torch_save(checkpoint, CHECKPOINT)
    size = CHECKPOINT.stat().st_size
    if size > max_checkpoint_mb * 1024 * 1024:
        CHECKPOINT.unlink(missing_ok=True)
        raise ValueError(f"checkpoint exceeded {max_checkpoint_mb} MB cap and was removed")
    # The estimate is explicitly architecture-based, not measured accelerator throughput.
    estimated_training_flops = int(6 * parameters * config.context * config.batch_size * config.steps)
    metadata = {
        "format": FORMAT,
        "version": VERSION,
        "status": "checkpoint-ready",
        "architecture": "decoder-only byte transformer with explicit chat turns",
        "device": "cpu",
        "checkpoint": str(CHECKPOINT.relative_to(ROOT)).replace("\\", "/"),
        "checkpointBytes": size,
        "parameters": parameters,
        "config": asdict(config),
        "metrics": checkpoint["metrics"],
        "training": checkpoint["training"],
        "documents": {"total": len(documents), "train": len(train_docs), "validation": len(validation_docs), "heldout": len(heldout_docs)},
        "chatTraining": {
            "template": "<|system|>, <|user|>, <|assistant|>, <|end|>",
            "assistantTurnMarker": ASSISTANT_MARKER,
            "recordFormat": "structured chat transcript",
            "promotion": "requires independent held-out chat and code evaluation; loss alone is not a capability claim",
        },
        "estimatedTrainingFlops": estimated_training_flops,
        "estimatedTrainingFlopsNote": "Architecture estimate: 6 x parameters x context x batch x optimizer steps. Not a measured throughput or TOPS claim.",
        "elapsedSeconds": elapsed,
        "createdAt": checkpoint["createdAt"],
        "sourcePolicy": "Only declared local, attributable corpus files are read. Private prompts, credentials, browser history, and arbitrary web pages are excluded.",
    }
    atomic_json(metadata, METADATA)
    return metadata


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CPU-first AchLLM neural trainer")
    parser.add_argument("--steps", type=int, default=int(os.environ.get("ACHLLM_NEURAL_STEPS", "200")))
    parser.add_argument("--width", type=int, default=int(os.environ.get("ACHLLM_NEURAL_WIDTH", "128")))
    parser.add_argument("--layers", type=int, default=int(os.environ.get("ACHLLM_NEURAL_LAYERS", "2")))
    parser.add_argument("--heads", type=int, default=int(os.environ.get("ACHLLM_NEURAL_HEADS", "4")))
    parser.add_argument("--context", type=int, default=int(os.environ.get("ACHLLM_NEURAL_CONTEXT", "128")))
    parser.add_argument("--batch-size", type=int, default=int(os.environ.get("ACHLLM_NEURAL_BATCH", "8")))
    parser.add_argument("--max-checkpoint-mb", type=int, default=int(os.environ.get("ACHLLM_NEURAL_MAX_MB", "512")))
    return parser.parse_args()


if __name__ == "__main__":
    args = arguments()
    if not 1 <= args.steps <= 100_000:
        raise SystemExit("steps must be from 1 to 100000")
    config = Config(context=args.context, width=args.width, layers=args.layers, heads=args.heads, batch_size=args.batch_size, steps=args.steps)
    print(json.dumps(train(config, args.max_checkpoint_mb), indent=2))
