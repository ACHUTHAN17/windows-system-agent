# Skill: open-models — the LLM landscape, free tiers, omni-routing (researched live)

Researched from OpenCode (sst/opencode, MIT ~170k stars), OpenRouter docs,
LangGraph/CrewAI/Agents-SDK comparisons, and our own probe logs. Two jobs:
pick the right model per task, and never pay when free suffices.

## Free / keyless (verified live by our scout — see docs/models.json)
- **Pollinations** (`https://text.pollinations.ai/openai`, models `openai`,
  `openai-fast` = GPT-OSS 20B): zero key, OpenAI-compatible POST + GET fallback.
  Our default. Respect it: no hot loops, cache answers.
- **GitHub Models** (`https://models.github.ai/inference`, PAT as key, free
  quotas): `gpt-4o-mini`, `gpt-4o`, `DeepSeek-V3`, `Llama-3.3-70B`… — the
  biggest free models available. Chat preset built in.
- Dead (retired from scout, don't retry blindly): DuckDuckGo AI (vkd blocks
  servers), KeylessAI (DNS dead), Pollinations mistral/llama/qwen (left the
  anonymous tier), crax.lol (blocks cross-origin browsers).

## Cheap with one key
- **OpenRouter** (`https://openrouter.ai/api/v1`, one key): hundreds of models,
  many with `:free` suffix variants (rate-limited, key still required).
  `.env`: `MODEL_API_URL=https://openrouter.ai/api/v1`,
  `MODEL_API_KEY=sk-or-…`, `MODEL_NAME=<vendor>/<model>:free`.
- **Puter.js**: 400+ models browser-side, but visitors pay via Puter account —
  not zero-friction. Roadmap only, never the default.

## Local (private, offline, $0)
- **Ollama** (`http://localhost:11434/v1`, `ollama serve` + `ollama pull llama3.1`),
  **LM Studio** (`http://localhost:1234/v1`). Default `.env` targets Ollama.

## Omni-routing (the right model per call, automatically)
1. Chat page: Free → GitHub Models → Custom fallback chain, registry-driven.
2. Standalone: primary `.env` model + opt-in `LLM_FALLBACK_URL`
   (+`LLM_FALLBACK_MODEL`, `LLM_FALLBACK_KEY`) — one automatic retry on primary
   failure. Free default fallback: Pollinations.
3. Cost rule: cheap/keyless for loops, research, drafts; paid flagship only for
   hard reasoning. Never loop a paid model on retries without a cap.

## What we adopt from the open-source world
- **OpenCode**: build/plan modes (= our `--yes`/`--plan`), `{server}_{tool}` MCP
  names (= our `mcp_<server>_<tool>`), `AGENTS.md` project rules (= auto-loaded
  into our prompt), model-agnostic harness (our llm.js), TUI+desktop+mobile
  surfaces (= our REPL/dashboard/Telegram/chat).
- **LangGraph**: checkpoint/resume + audit trails → our `agent-audit.log` +
  core memory (full time-travel = roadmap).
- **CrewAI**: role crews + A2A interop → our `task_delegate` fan-out (A2A = roadmap).
- **OpenAI Agents SDK**: handoffs + guardrails + tracing → our delegate +
  approvals + audit.
- **models.dev**: community model registry → our `docs/models.json` + scout.
- **officekit** (MIT, agent-first): already wired as MCP/filesystem path.

## Rules
- Never commit keys (`.env` gitignored; Actions secrets for cloud).
- Verify a "free" endpoint with `reply with exactly: scout-ok` before trusting it.
- Record what works in `docs/models.json` via the scout — never hardcode hope.
