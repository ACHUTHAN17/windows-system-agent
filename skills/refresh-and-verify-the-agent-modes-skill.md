# Skill: refresh and verify the agent-modes skill

Auto-learned 2026-09-17 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions refresh and verify the agent-modes skill.

## Steps
1. Use Agent Skills when you want to: Package domain expertise - Capture specialized knowledge (expense policies, legal workflows, data analysis pipelines) as reusable, portable packages
2. Use when asked about expense submissions, reimbursement rules, or spending limits
3. Run scripts (as needed) - The agent calls the run_skill_script tool to execute scripts bundled with a skill
4. Note load_skill is always advertised
5. Use when creating or modifying ClickHouse migrations
6. Use when you need to run backend tests and `uv sync` fails due to Python version mismatch
7. How agents discover and use skills There are four ways agents get access to skills: Bundled with a plugin Each plugin includes a curated set of skills that are available to your agent immediately after installation
8. Step-by-step procedures These skills provide tested workflows for common tasks like creating Amazon S3 Tables, setting up AWS Glue ETL pipelines, configuring IAM policies, and deploying serverless applications

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
