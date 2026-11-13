// Generates the public, non-sensitive status document consumed by the GitHub
// Pages dashboard.  It deliberately reports facts from the local checkpoint
// and provenance manifest; it does not manufacture a "knowledge" score.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentReadinessReport } from '../src/achllm-agent-readiness.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seedDir = path.join(root, 'models', 'seed-data');
const modelFile = path.join(root, 'models', 'achllm.live.model.json');
const neuralMetadataFile = path.join(root, 'models', 'achllm-neural', 'metadata.json');
const neuralEvaluationFile = path.join(root, 'models', 'achllm-neural', 'chat-evaluation.json');
const neuralRuntimeFile = path.join(root, 'models', 'achllm-neural', 'training-state.json');
const manifestFile = path.join(seedDir, 'manifest.jsonl');
const safeRead = (file, fallback) => { try { return fs.readFileSync(file, 'utf8'); } catch { return fallback; } };
let model = {};
try { model = JSON.parse(safeRead(modelFile, '{}')); } catch {}
let neural = null;
try { neural = JSON.parse(safeRead(neuralMetadataFile, 'null')); } catch {}
let neuralEvaluation = null;
try { neuralEvaluation = JSON.parse(safeRead(neuralEvaluationFile, 'null')); } catch {}
let neuralRuntime = null;
try { neuralRuntime = JSON.parse(safeRead(neuralRuntimeFile, 'null')); } catch {}
const transitionRows = Object.values(model.transitions || {});
const learnedWeights = transitionRows.reduce((total, row) => total + (Array.isArray(row) ? row.length : 0), 0);
const averageCandidatesPerLookup = transitionRows.length ? learnedWeights / transitionRows.length : 0;
let serializedBytes = 0;
try { serializedBytes = fs.statSync(modelFile).size; } catch {}
const records = safeRead(manifestFile, '').split(/\r?\n/).filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
const domains = { chat: 0, code: 0, browser: 0, legacy: 0 };
for (const record of records) domains[record.domain === 'code' ? 'code' : record.domain === 'chat' ? 'chat' : record.domain === 'browser' ? 'browser' : 'legacy']++;
const status = {
  schema: 3,
  model: 'achllm',
  scope: ['chat', 'code', 'licensed browser reference'],
  identity: { godfather: 'Mr. Mohana Achuthan', record: 'docs/ACHLLM_IDENTITY.md' },
  updatedAt: new Date().toISOString(),
  checkpoint: { available: Boolean(model.format), format: model.format || null, order: model.order || null, trainedBytes: model.trainedBytes || 0, serializedBytes },
  modelStats: {
    architecture: 'byte-level backoff n-gram',
    learnedWeightEntries: learnedWeights,
    transitionContexts: transitionRows.length,
    vocabularyEntries: Array.isArray(model.vocabulary) ? model.vocabulary.length : 0,
    averageCandidatesPerLookup,
    compute: {
      flops: null,
      tops: null,
      note: 'Not applicable: AchLLM is a non-neural count model, not a tensor/FLOPS architecture. The dashboard reports actual transition-weight entries and lookup candidates instead.',
    },
  },
  neural: neural?.format === 'achllm-neural' ? {
    status: neural.status || 'checkpoint-ready', architecture: neural.architecture || null,
    checkpoint: neural.checkpoint || null, checkpointBytes: Number(neural.checkpointBytes || 0),
    parameters: Number(neural.parameters || 0), metrics: neural.metrics || null,
    config: neural.config || null, vocab: neural.vocab || null,
    training: neural.training || null,
    runtime: neuralRuntime || { state: 'unknown', note: 'trainer has not written runtime state yet' },
    estimatedTrainingFlops: Number(neural.estimatedTrainingFlops || 0),
    estimatedTrainingFlopsNote: neural.estimatedTrainingFlopsNote || null,
    chatTraining: neural.chatTraining || null,
    chatEvaluation: neuralEvaluation ? {
      createdAt: neuralEvaluation.createdAt || null,
      formatChecks: neuralEvaluation.formatChecks || null,
      qualityGate: neuralEvaluation.qualityGate || null,
      promotionEligible: neuralEvaluation.promotionEligible === true,
      note: neuralEvaluation.note || null,
    } : null,
    evaluation: neuralEvaluation?.promotionEligible === true
      ? 'independent evaluation marked this checkpoint eligible; release review still required'
      : 'validation and held-out loss recorded; direct samples require review and capability is not established',
  } : {
    status: 'not-trained',
    evaluation: 'Optional neural pipeline is installed in the repository but has not produced a checkpoint.',
  },
  training: { records: domains.chat + domains.code + domains.browser, chatRecords: domains.chat, codeRecords: domains.code, browserRecords: domains.browser, legacyRecordsExcluded: domains.legacy, source: 'HuggingFaceH4/ultrachat_200k + Wikimedia allow-list', license: 'MIT + CC BY-SA 4.0/GFDL' },
  publication: {
    status: 'published',
    scope: 'Live telemetry only',
    codeLicense: 'Proprietary — no permission granted',
    modelArtifactLicense: 'Proprietary — no permission granted',
    sourceDataLicense: 'MIT upstream; third-party rights remain with the source',
  },
  evaluation: {
    status: 'not-evaluated',
    note: 'Publication checks pass, but no held-out chat or code benchmark score has been published.',
    comparableToFrontier: false,
  },
  comparison: {
    status: 'awaiting-normalized-evidence',
    note: 'Published multi-model references are available in achllm-benchmarks.json. AchLLM remains unscored until it completes the exact benchmark harness.',
    benchmarkCatalog: 'achllm-benchmarks.json',
    aspects: ['chat', 'code', 'reasoning', 'math', 'multilingual', 'long-context', 'tool-use', 'vision', 'safety', 'efficiency'],
  },
  agentReadiness: agentReadinessReport(),
  security: {
    publicDataOnly: true, explicitChatDonationOnly: true, isolatedBrowserProfile: true,
    browserSourceAllowlist: ['https://en.wikipedia.org/wiki/'], noCredentials: true,
    noPrivatePrompts: true, neuralLoopbackOnly: true, checkpointAtomicWrites: true,
    serviceHardening: ['NoNewPrivileges', 'PrivateTmp', 'ProtectSystem=full'],
    note: 'Credentials and private prompts stay outside the corpus; the neural test endpoint listens only on loopback.',
  },
};
const output = path.join(root, 'docs', 'achllm-status.json');
const historyOutput = path.join(root, 'docs', 'achllm-history.json');
let history = [];
try { history = JSON.parse(safeRead(historyOutput, '[]')); } catch {}
if (!Array.isArray(history)) history = [];
const point = {
  updatedAt: status.updatedAt,
  trainedBytes: status.checkpoint.trainedBytes,
  serializedBytes: status.checkpoint.serializedBytes,
  learnedWeightEntries: status.modelStats.learnedWeightEntries,
  chatRecords: status.training.chatRecords,
  codeRecords: status.training.codeRecords,
  browserRecords: status.training.browserRecords,
  legacyRecordsExcluded: status.training.legacyRecordsExcluded,
  evaluatedAspects: 0,
};
const last = history.at(-1);
if (!last || last.trainedBytes !== point.trainedBytes || last.chatRecords !== point.chatRecords || last.codeRecords !== point.codeRecords) history.push(point);
else history[history.length - 1] = point;
history = history.slice(-168);
fs.writeFileSync(output, `${JSON.stringify(status, null, 2)}\n`);
fs.writeFileSync(historyOutput, `${JSON.stringify(history, null, 2)}\n`);
console.log(JSON.stringify({ output, historyOutput, updatedAt: status.updatedAt, records: status.training.records, trainedBytes: status.checkpoint.trainedBytes }));
