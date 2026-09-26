# Imported tool candidates — REVIEW BEFORE USE

Everything under `candidates/` was found automatically — by `src/tool-crawler.js` (GitHub
repo search) or `src/tool-web-scout.js` (general web search) — and is **staged only**:
none of it is loaded by the agent and none of it runs.

A tool is executable code that runs with the agent's full privileges (files, shell,
registry, browser). Unlike skills (inert markdown), a tool candidate must be read and
understood by a person before it is trusted.

## Promoting a candidate to a real tool
1. Open the file under `candidates/` and read every line — treat it as untrusted input.
2. Check `candidates/sources.json` for provenance (source repo/URL + `found_via`: github-search or web-search).
3. If it's genuinely useful, hand-port the logic into a tool block in `src/tools.js`
   following the contract in ARCHITECTURE.md (`{ name, description, args, run(args, {cfg}) }`),
   adjusting paths/approvals/safety checks to match this repo's conventions.
4. Add a selftest entry, run `node src/index.js --selftest`, then delete the staged file.
5. Never copy-paste a candidate straight into tools.js unread — that reintroduces the
   exact risk this staging step exists to avoid.
