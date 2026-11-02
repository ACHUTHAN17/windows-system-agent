# WinAgent Orchestra

Every goal can run through one durable orchestration path:

```text
CLI / Desktop / Telegram / Web chat / MCP
                    |
             Conductor (Muse Spark)
                    |
      validated DAG + one optional approval
                    |
 Scheduler: dependencies, retries, locks, budget, stop
       |             |              |             |
    Native         Hermes        OpenClaw       Cloud
       \             |              |             /
                    Blackboard
```

The blackboard for each goal is local and durable:

```text
runs/<runId>/run.json
runs/<runId>/plan.json
runs/<runId>/tasks/<taskId>.json
runs/<runId>/events.jsonl
```

`runs/` is deliberately local runtime state and ignored by Git. It can contain private local paths, task text and tool output; publish a reviewed artifact or report instead of automatically pushing execution transcripts.

The desktop app, Telegram channel, web dashboard and MCP tool use this path automatically. For the CLI, use `--orchestrate` (or `--orchestra`):

```powershell
node src/index.js --orchestrate "inspect my Downloads and produce a report"
```

## Worker roles

| Role | Worker | Activation |
|---|---|---|
| Conductor | Muse Spark 1.1 | `ORCHESTRA_PLANNER_*` plus `MUSE_API_KEY` or `ORCHESTRA_PLANNER_KEY` |
| Native operator | WinAgent in-process | Always available |
| Long-horizon WSL2 worker | Hermes | `HERMES_COMMAND` |
| Gateway and subagents | OpenClaw | `OPENCLAW_COMMAND`, or a private configurable HTTP bridge |
| Cloud job | GitHub Actions | `GITHUB_REPO`, `GITHUB_PAT`, `CLOUD_WORKFLOW` |

If a planner or external worker is absent, WinAgent never fabricates an endpoint or command. The Conductor creates a single native task instead, and any planned external task reports the missing configuration in its durable task record.

## Muse Spark Conductor

Muse Spark is dedicated to plan construction. It does not replace `MODEL_*`, which remains available for normal agent reasoning. Add the following to a local `.env`; never commit it:

```ini
MUSE_API_KEY=your-meta-model-api-key
ORCHESTRA_PLANNER_PROVIDER=openai-compatible
ORCHESTRA_PLANNER_URL=https://api.meta.ai/v1
ORCHESTRA_PLANNER_MODEL=muse-spark-1.1
```

The Conductor is asked for JSON only. WinAgent validates IDs, dependencies, worker type, bounded retries/timeouts/resource locks, and cycles before any worker starts. If a plan is malformed or a model call fails, it falls back to one native task.

## Hermes WSL2 worker

Install and configure Hermes inside WSL2, then set a simple command name:

```ini
HERMES_COMMAND=hermes
```

For each Hermes DAG task WinAgent calls `wsl.exe -- hermes "<task goal>"` as argument values, not a host-shell command. The WSL command must exit with code 0 only after the task is complete.

## OpenClaw worker

Choose one owner-operated adapter. The command form is simplest for a local Gateway wrapper:

```ini
OPENCLAW_COMMAND=openclaw-worker
```

Or expose a private authenticated bridge:

```ini
OPENCLAW_URL=http://127.0.0.1:8787
OPENCLAW_TASK_PATH=/tasks
OPENCLAW_TOKEN=replace-me
```

The bridge receives `POST <OPENCLAW_URL><OPENCLAW_TASK_PATH>` with JSON `{ "goal", "taskId", "runId", "worker": "openclaw" }`. It must return success only after its subagent work is done. Do not expose this bridge to the public internet.

## Control and recovery

- The scheduler runs at most `ORCHESTRA_CONCURRENCY` tasks (default `2`).
- `resources` serialize conflicting tasks, such as screen/desktop input.
- Failed retryable tasks retry at most their bounded plan value (maximum `3`).
- `ORCHESTRA_BUDGET_MS` caps the complete run (default `20` minutes).
- The desktop Stop button triggers the scheduler kill switch, aborts external workers and asks the native worker to stop at its next safe check.
- `--plan` retains a single approval step for the validated DAG before execution.
