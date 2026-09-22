# Skill: agent-modes — run modes and how to work them in parallel

WinAgent is one brain with six bodies. Pick per task; combine for speed.

## Modes
1. **Interactive REPL** (`run.bat`, no args): back-and-forth, approvals inline.
   Commands: `model tools skills memory goals learn <topic> selftest exit`.
2. **One-shot task** (`run.bat "do X" [--yes] [--skill a,b]`): single task, exits.
   `--yes`/`AUTO_YES=true` = full-agent mode (no prompts, audit-logged).
3. **Idle-learn** (`--idle-learn [--idle-seconds 2] [--learn-cooldown 300]`):
   quiet REPL auto-runs self-upgrade cycles. For foreground sessions.
4. **Daemon** (`--daemon 300 [--learn-cycles N]`): headless forever-loop of
   learn cycles (research → distill → install to skills//memory). For nights.
5. **Learn once** (`--learn "topic"` or REPL `learn <topic>`): single guided
   research→install cycle, then exit. For explicit study orders.
6. **Full-agent** (any mode + `--yes`): end-to-end, no prompts. Default for
   automation; never for first contact with destructive targets.

## Parallel learning + executing (the time-saver)
- Same turn, independent calls TOGETHER: research + probes + reads in one batch
  (one round-trip instead of five). Never batch dependents (read-after-write).
- Long + short: start the slow job (installs, scrapes, daemon cycles) FIRST in
  background, do quick tasks meanwhile, collect slow results last.
- Daemon + REPL: daemon learns in background while REPL serves tasks; both
  share `skills/` + `memory/` (files are the bus — re-read before use).
- Learn-while-blocked: when a push/deploy waits on a human (OTP, approval,
  collaborator), spend the wait on queued learning, never idle-spin.
- Cap it: 2-4 concurrent tracks max; one writer per file; verify each track
  separately before reporting.

## Which mode when
- Unknown domain → `--learn` first, then the task.
- User present + chatting → REPL (+`--idle-learn` for free upgrades).
- User away + goals queued → `--daemon`.
- Scripted pipelines → one-shot + `--yes` + audit review after.
- New machine → PAWWORK.md protocol, then selftest, then serve.


---
## Field update 2026-09-17
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-17 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Use when creating or modifying ClickHouse migrations
2. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
3. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills



---
## Field update 2026-09-17
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-17 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. How agents discover and use skills There are four ways agents get access to skills: Bundled with a plugin Each plugin includes a curated set of skills that are available to your agent immediately after installation
10. Step-by-step procedures These skills provide tested workflows for common tasks like creating Amazon S3 Tables, setting up AWS Glue ETL pipelines, configuring IAM policies, and deploying serverless applications

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Skills - Agent Toolkit for AWS
  https://docs.aws.amazon.com/agent-toolkit/latest/userguide/skills.html



---
## Field update 2026-09-17
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-17 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. How agents discover and use skills There are four ways agents get access to skills: Bundled with a plugin Each plugin includes a curated set of skills that are available to your agent immediately after installation
10. Step-by-step procedures These skills provide tested workflows for common tasks like creating Amazon S3 Tables, setting up AWS Glue ETL pipelines, configuring IAM policies, and deploying serverless applications

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Skills - Agent Toolkit for AWS
  https://docs.aws.amazon.com/agent-toolkit/latest/userguide/skills.html



---
## Field update 2026-09-18
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-18 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. Use OpenAI-compatible APIs, Gemini, GitHub Models, Codex OAuth, Codex, Ollama, Atomic Chat, and other supported backends while keeping one terminal-first workflow: prompts, tools, agents, MCP, slash commands, and streaming output

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- GitHub - Gitlawb/openclaude: runs anywhere. uses anything
  https://github.com/Gitlawb/openclaude



---
## Field update 2026-09-18
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-18 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Use when creating or modifying ClickHouse migrations
2. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
3. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
4. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
5. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
6. Use when asked about expense submissions, reimbursement rules, or spending limits
7. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
8. Note load_skill is always advertised
9. How agents discover and use skills There are four ways agents get access to skills: Bundled with a plugin Each plugin includes a curated set of skills that are available to your agent immediately after installation
10. Step-by-step procedures These skills provide tested workflows for common tasks like creating Amazon S3 Tables, setting up AWS Glue ETL pipelines, configuring IAM policies, and deploying serverless applications

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- Skills - Agent Toolkit for AWS
  https://docs.aws.amazon.com/agent-toolkit/latest/userguide/skills.html



---
## Field update 2026-09-18
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-18 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. How agents discover and use skills There are four ways agents get access to skills: Bundled with a plugin Each plugin includes a curated set of skills that are available to your agent immediately after installation
10. Step-by-step procedures These skills provide tested workflows for common tasks like creating Amazon S3 Tables, setting up AWS Glue ETL pipelines, configuring IAM policies, and deploying serverless applications

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Skills - Agent Toolkit for AWS
  https://docs.aws.amazon.com/agent-toolkit/latest/userguide/skills.html



---
## Field update 2026-09-18
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-18 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. How Skills Work Each skill is a Markdown file ( SKILL.md ) that describes a specific engineering workflow
10. Choose a skill Browse the skills/ directory
11. Use the meta-skill for discovery when needed If your agent does not route skills natively, start with the using-agent-skills skill loaded
12. Install the individual skills and let the host activate them on demand instead

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- agent-skills/docs/getting-started.md at main - GitHub
  https://github.com/addyosmani/agent-skills/blob/main/docs/getting-started.md



---
## Field update 2026-09-18
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-18 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. How agents discover and use skills There are four ways agents get access to skills: Bundled with a plugin Each plugin includes a curated set of skills that are available to your agent immediately after installation
10. Step-by-step procedures These skills provide tested workflows for common tasks like creating Amazon S3 Tables, setting up AWS Glue ETL pipelines, configuring IAM policies, and deploying serverless applications

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Skills - Agent Toolkit for AWS
  https://docs.aws.amazon.com/agent-toolkit/latest/userguide/skills.html



---
## Field update 2026-09-18
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-18 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. How agents discover and use skills There are four ways agents get access to skills: Bundled with a plugin Each plugin includes a curated set of skills that are available to your agent immediately after installation
10. Step-by-step procedures These skills provide tested workflows for common tasks like creating Amazon S3 Tables, setting up AWS Glue ETL pipelines, configuring IAM policies, and deploying serverless applications

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Skills - Agent Toolkit for AWS
  https://docs.aws.amazon.com/agent-toolkit/latest/userguide/skills.html



---
## Field update 2026-09-18
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-18 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. Use Agent Mode - Visual Studio (Windows) | Microsoft Learn Skip to main content Skip to Ask Learn chat experience This browser is no longer supported
10. Use agent mode In agent mode, Copilot operates autonomously and determines the relevant context for your prompt
11. Enter your prompt, and then select Send or select the Enter key to submit it
12. To review individual code changes that the agent made, review the specific change at each step

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Use Agent Mode - Visual Studio (Windows) | Microsoft Learn
  https://learn.microsoft.com/en-us/visualstudio/ide/copilot-agent-mode?view=visualstudio



---
## Field update 2026-09-19
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-19 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Azure Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/training/support/agent-skills



---
## Field update 2026-09-19
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-19 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Use when creating or modifying ClickHouse migrations
2. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
3. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
4. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
5. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
6. Use when asked about expense submissions, reimbursement rules, or spending limits
7. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
8. Note load_skill is always advertised

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- Hands On: VS 2026 Insiders Adds Guided Skill Building in Agent Mode
  https://visualstudiomagazine.com/articles/2026/05/15/building-a-custom-copilot-skill-a-hands-on-guide-to-agent-mode-in-visual-studio-2026.aspx



---
## Field update 2026-09-19
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-19 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. Use Agent Mode - Visual Studio (Windows) | Microsoft Learn Skip to main content Skip to Ask Learn chat experience This browser is no longer supported
10. Use agent mode In agent mode, Copilot operates autonomously and determines the relevant context for your prompt
11. Enter your prompt, and then select Send or select the Enter key to submit it
12. To review individual code changes that the agent made, review the specific change at each step

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Use Agent Mode - Visual Studio (Windows) | Microsoft Learn
  https://learn.microsoft.com/en-us/visualstudio/ide/copilot-agent-mode?view=visualstudio



---
## Field update 2026-09-19
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-19 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. How agents discover and use skills There are four ways agents get access to skills: Bundled with a plugin Each plugin includes a curated set of skills that are available to your agent immediately after installation
10. Step-by-step procedures These skills provide tested workflows for common tasks like creating Amazon S3 Tables, setting up AWS Glue ETL pipelines, configuring IAM policies, and deploying serverless applications

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Skills - Agent Toolkit for AWS
  https://docs.aws.amazon.com/agent-toolkit/latest/userguide/skills.html



---
## Field update 2026-09-19
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-19 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. Use Agent Mode - Visual Studio (Windows) | Microsoft Learn Skip to main content Skip to Ask Learn chat experience This browser is no longer supported
10. Use agent mode In agent mode, Copilot operates autonomously and determines the relevant context for your prompt
11. Enter your prompt, and then select Send or select the Enter key to submit it
12. To review individual code changes that the agent made, review the specific change at each step

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Use Agent Mode - Visual Studio (Windows) | Microsoft Learn
  https://learn.microsoft.com/en-us/visualstudio/ide/copilot-agent-mode?view=visualstudio



---
## Field update 2026-09-19
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-19 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. How agents discover and use skills There are four ways agents get access to skills: Bundled with a plugin Each plugin includes a curated set of skills that are available to your agent immediately after installation
10. Step-by-step procedures These skills provide tested workflows for common tasks like creating Amazon S3 Tables, setting up AWS Glue ETL pipelines, configuring IAM policies, and deploying serverless applications

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Skills - Agent Toolkit for AWS
  https://docs.aws.amazon.com/agent-toolkit/latest/userguide/skills.html



---
## Field update 2026-09-20
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-20 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. How agents discover and use skills There are four ways agents get access to skills: Bundled with a plugin Each plugin includes a curated set of skills that are available to your agent immediately after installation
10. Step-by-step procedures These skills provide tested workflows for common tasks like creating Amazon S3 Tables, setting up AWS Glue ETL pipelines, configuring IAM policies, and deploying serverless applications

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Skills - Agent Toolkit for AWS
  https://docs.aws.amazon.com/agent-toolkit/latest/userguide/skills.html



---
## Field update 2026-09-20
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-20 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. How skills differ from tools Tools and skills are complementary, not competing
10. How skills work: progressive disclosure Skills are designed to be context-efficient

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Adding Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/journey/adding-skills



---
## Field update 2026-09-20
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-20 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. How skills differ from tools Tools and skills are complementary, not competing
10. How skills work: progressive disclosure Skills are designed to be context-efficient

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Adding Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/journey/adding-skills



---
## Field update 2026-09-20
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-20 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Use when creating or modifying ClickHouse migrations
2. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
3. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
4. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
5. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
6. Use when asked about expense submissions, reimbursement rules, or spending limits
7. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
8. Note load_skill is always advertised
9. How skills differ from tools Tools and skills are complementary, not competing
10. How skills work: progressive disclosure Skills are designed to be context-efficient

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- Adding Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/journey/adding-skills



---
## Field update 2026-09-20
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-20 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Use Agent Skills in VS Code
  https://code.visualstudio.com/docs/agent-customization/agent-skills



---
## Field update 2026-09-20
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-20 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Use Agent Skills in VS Code
  https://code.visualstudio.com/docs/agent-customization/agent-skills



---
## Field update 2026-09-20
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-20 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Use Agent Skills in VS Code
  https://code.visualstudio.com/docs/agent-customization/agent-skills



---
## Field update 2026-09-21
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-21 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. How skills differ from tools Tools and skills are complementary, not competing
10. How skills work: progressive disclosure Skills are designed to be context-efficient

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Adding Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/journey/adding-skills



---
## Field update 2026-09-21
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-21 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Use Agent Skills in VS Code
  https://code.visualstudio.com/docs/agent-customization/agent-skills



---
## Field update 2026-09-21
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-21 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Use Agent Skills in VS Code
  https://code.visualstudio.com/docs/agent-customization/agent-skills



---
## Field update 2026-09-21
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-21 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. How skills differ from tools Tools and skills are complementary, not competing
8. How skills work: progressive disclosure Skills are designed to be context-efficient
9. Use when creating or modifying ClickHouse migrations
10. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- Adding Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/journey/adding-skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes



---
## Field update 2026-09-21
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-21 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- skills/skills/architect/agent-modes at main · jsmastery-pro/skills
  https://github.com/jsmastery-pro/skills/tree/main/skills/architect/agent-modes
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes



---
## Field update 2026-09-22
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-22 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. Use when creating or modifying ClickHouse migrations
8. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
9. How skills differ from tools Tools and skills are complementary, not competing
10. How skills work: progressive disclosure Skills are designed to be context-efficient

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes
- Adding Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/journey/adding-skills



---
## Field update 2026-09-22
# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-22 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Download Microsoft Edge More info about Internet Explorer and Microsoft Edge Table of contents Exit editor mode Ask Learn Ask Learn Reading mode Table of contents Read in English Add Add to Plans Edit Copy Markdown Print Note Access to this page requires authorization
2. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
3. Enable interoperability - Reuse the same skill across different Agent Skills-compatible products
4. Use when asked about expense submissions, reimbursement rules, or spending limits
5. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
6. Note load_skill is always advertised
7. How skills differ from tools Tools and skills are complementary, not competing
8. How skills work: progressive disclosure Skills are designed to be context-efficient
9. Use when creating or modifying ClickHouse migrations
10. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Agent Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/agents/skills
- Adding Skills | Microsoft Learn
  https://learn.microsoft.com/en-us/agent-framework/journey/adding-skills
- implementing-agent-modes by PostHog — Agent Skill
  https://agentskills.codes/skills/implementing-agent-modes

