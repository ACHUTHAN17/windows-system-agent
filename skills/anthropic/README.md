# Bundled Anthropic Agent Skills

WinAgent bundles the Apache-2.0 skills from [anthropics/skills](https://github.com/anthropics/skills)
so the skill catalog remains available in offline mode. Each imported skill keeps its upstream
`SKILL.md`, `LICENSE.txt`, scripts, templates, and assets in its own directory.

Imported skill folders:

- `academy-guide`
- `algorithmic-art`
- `brand-guidelines`
- `canvas-design`
- `claude-api`
- `discernment-nudge`
- `frontend-design`
- `internal-comms`
- `mcp-builder`
- `skill-creator`
- `slack-gif-creator`
- `theme-factory`
- `web-artifacts-builder`
- `webapp-testing`

The upstream document-processing folders (`docx`, `pdf`, `pptx`, and `xlsx`) are intentionally
not vendored: Anthropic identifies those materials as source-available rather than open source.
They can be configured as a remote skill source by the user if their license permits it.

Upstream source: https://github.com/anthropics/skills
Upstream snapshot: 2026-10-16
