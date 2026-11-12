# AchLLM agent capability plan

AchLLM will not receive unrestricted system control. It must earn capability through measured, reversible stages.

## Current: research and chat baseline

The CPU model trains on attributed public chat/code records, explicit owner-donated chats, and a small Chromium-rendered Wikimedia reference lane. Chromium uses a temporary empty profile with extensions, sync, downloads, and the user profile excluded. It only visits the versioned Wikimedia allow-list.

## Stage 1: observe-only agent

- Read-only environment facts, browser page summaries, and sandbox file listings.
- Every tool result is logged with task ID and source.
- No changes, downloads, account actions, or private browser/session access.

## Stage 2: planned reversible work

- Generate a plan, execute it in a sandbox, and verify the expected result.
- Limit scope, time, output size, retries, and tool access per task.
- Allow only reversible draft/artifact creation in a dedicated workspace.

## Stage 3: controlled execution

- Introduce file edits and browser tasks only after repeatable evaluation success.
- Require explicit approval for destructive actions, software installation, account activity, and system settings.
- Keep a kill switch, audit log, rollback path, and isolated credentials.

## Release gates

No stage advances without a versioned evaluation suite, measured task-success rate, adversarial safety checks, no unresolved critical failures, and a reviewed release. The current byte-level baseline is not authorised for autonomous system control.
