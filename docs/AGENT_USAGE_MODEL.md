# WinAgent agent-use model

WinAgent's agent-use model is a small, transparent routing classifier trained
from the repository's own labelled task examples. It runs entirely on a CPU and
has no API key, model download, or GPU dependency.

It is intentionally a **decision model**, not a language model. It classifies a
goal as `native`, `hermes`, `openclaw`, or `cloud`, returns a confidence score,
and is only allowed to influence the orchestra fallback when its suggested
worker is explicitly configured. Safety approval, tool validation, and the
scheduler remain the authority for every action.

## Train and inspect

```bash
npm run train:agent-model
node src/index.js --agent-model-status
```

Training data lives in `models/agent-usage.training.jsonl`; the generated,
versioned model is `models/agent-usage.model.json`. Add labelled examples from
verified completed runs, review them in Git, retrain, run tests, and commit the
dataset and model together. Do not treat an agent's self-reported completion as
a training label without evidence.

## Worker order

1. Muse Spark is the optional Conductor that makes the DAG when its owner key
   is configured.
2. The scheduler honours the approved DAG and routes tasks to Native, Hermes,
   OpenClaw, or GitHub Actions.
3. With no planner key, the local agent-use model makes a bounded worker
   preference. Missing worker configuration always falls back to Native.

This is the CPU-only role suited to a small machine. It cannot train or equal a
frontier generative model such as GPT-6, Astra, Argon, or Fable; those require
large pretrained weights and substantial training compute. The practical route
to better task performance is quality labelled traces, rigorous evaluations,
skills, and a capable optional planner.
