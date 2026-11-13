# AchLLM training data

AchLLM trains only from material with a recorded source, licence, and collection route. The current small CPU model benefits more from clean instruction examples than from a huge unreviewed dump.

## Enabled sources

1. **AchLLM teacher curriculum.** Original project-authored chat, coding, debugging, safety, and planning lessons. Install it with `npm run teach:achllm`; it is idempotent and records every lesson in the local manifest.
2. **UltraChat 200k.** The current bounded chat/code importer fetches small batches from `HuggingFaceH4/ultrachat_200k`, whose dataset card is MIT licensed. Keep the source URL and row identifiers already written to `models/seed-data/manifest.jsonl`.
3. **Owner-provided material.** Documents and code may be added only when the owner has the right to train on them and adds their source and licence to the manifest.
4. **Explicit chat donations.** A contributor can opt in through the dashboard. Likely credentials are rejected and non-consenting chats are never added.

The private owner dashboard enables its donation control by default, while retaining an opt-out before each send. Donated records carry offline script/language metadata so multilingual coverage can be measured instead of assumed.

## Reviewed future lanes

- **OpenAssistant OASST1** is Apache-2.0 and contains multilingual, human-authored conversation trees. It should be added only through a tree-aware importer that preserves parent/assistant context and filters deleted or low-quality branches.
- **Dolma** is useful for research-scale pretraining, but it is too large for this 4-vCPU host. It needs a separately reviewed, bounded, attributable subset and GPU training.

## Do not ingest

Do not train on browser history, private chats, credentials, paid/private documents, random scraping, or a dataset whose licence and provenance are unknown. Training data quality, licences, and evaluation matter more than raw row count.

## Multilingual scope

The teacher curriculum includes small original examples in English, Spanish, Tamil, Hindi, Arabic, Japanese, and Chinese. This creates a language-aware seed, not universal multilingual fluency. Meaningful multilingual chat requires large, balanced, attributable conversational data and per-language evaluation; OASST1 is the next reviewed lane.
