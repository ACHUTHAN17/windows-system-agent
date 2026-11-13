// Reliable chat surface for AchLLM while its from-scratch neural decoder is
// still below the generation-quality gate. This is deliberately extractive:
// it answers only from the attributable local training corpus instead of
// presenting unstable neural completions as facts.
import fs from 'node:fs';
import path from 'node:path';

const STOP = new Set('about after again also among and are because been before being between both but can cannot could did does each for from had has have how into its just like more most not only other our out over should some such than that the their then there these this those through too use used using want was were what when where which who why will with would you your'.split(' '));
const cache = new Map();
const FOUNDATION = [
  { match: /\bwhat (?:is|does).{0,60}\balgorithm\b|\balgorithm\b.{0,60}\bwhat\b/i, content: 'An algorithm is a finite, ordered set of steps that transforms inputs into an intended output. Good algorithms define their inputs, outputs, and stopping condition.' },
  { match: /\bwhat (?:is|does).{0,60}\b(?:programming|code|coding)\b/i, content: 'Programming is the process of expressing instructions in a language that a computer can execute. It combines problem decomposition, implementation, testing, and maintenance.' },
  { match: /\bwhat (?:is|does).{0,60}\boperating system\b/i, content: 'An operating system manages a computer’s hardware and shared resources, then provides the interfaces and services that applications use.' },
  { match: /\bwhat (?:is|does).{0,60}\bdatabase\b/i, content: 'A database is an organized system for storing and retrieving data. A database management system controls how that data is structured, queried, updated, and protected.' },
  { match: /\bwhat (?:is|does).{0,60}\b(?:computer )?network\b/i, content: 'A computer network connects devices so they can exchange data through agreed communication rules, called protocols.' },
];

function terms(value) {
  return [...new Set(String(value || '').toLowerCase().match(/[a-z][a-z0-9_+-]{2,}/g)?.filter((word) => !STOP.has(word)) || [])];
}

function corpusAt(root) {
  const file = path.join(root, 'models', 'seed-data', 'chat-code-corpus.txt');
  try {
    const mtime = fs.statSync(file).mtimeMs;
    const previous = cache.get(file);
    if (previous?.mtime === mtime) return previous.chunks;
    const chunks = fs.readFileSync(file, 'utf8').split(/\r?\n\s*\r?\n/).map((chunk) => chunk.replace(/\s+/g, ' ').trim()).filter((chunk) => chunk.length >= 80);
    cache.set(file, { mtime, chunks });
    return chunks;
  } catch { return []; }
}

function score(queryTerms, candidate) {
  const text = String(candidate || '').toLowerCase();
  let matched = 0;
  for (const term of queryTerms) if (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'i').test(text)) matched++;
  return matched / Math.max(queryTerms.length, 1);
}

export function neuralGenerationReady(root) {
  try {
    const info = JSON.parse(fs.readFileSync(path.join(root, 'models', 'achllm-neural', 'metadata.json'), 'utf8'));
    const evaluation = JSON.parse(fs.readFileSync(path.join(root, 'models', 'achllm-neural', 'chat-evaluation.json'), 'utf8'));
    const metrics = info.metrics || {};
    return Boolean(
      info.status === 'checkpoint-ready'
      && Number(info.documents?.train || 0) >= 3_000
      && Number(metrics.validationLoss) > 0 && Number(metrics.validationLoss) <= 2.0
      && Number(metrics.heldoutLoss) > 0 && Number(metrics.heldoutLoss) <= 2.2
      // A low token loss is not enough to claim that a chat model is safe or
      // helpful.  A separate evaluation report must explicitly promote it.
      && evaluation?.promotionEligible === true,
    );
  } catch { return false; }
}

export function answerAchllmChat(root, prompt) {
  const question = String(prompt || '').trim();
  if (!question) return { mode: 'guarded', content: 'Please enter a question or task.' };
  if (/^(?:hi|hello|hey|yo)(?:\s|!|\.|$)/i.test(question)) {
    return { mode: 'chat', content: 'Hi — I am AchLLM. I answer from my attributable training corpus while the neural model continues training and evaluation.' };
  }
  const foundation = FOUNDATION.find((item) => item.match.test(question));
  if (foundation) return { mode: 'foundation', content: foundation.content };
  const queryTerms = terms(question);
  const chunks = corpusAt(root);
  let best = '', bestScore = 0;
  for (const chunk of chunks) {
    const value = score(queryTerms, chunk);
    if (value > bestScore) { best = chunk; bestScore = value; }
  }
  // Require enough distinct topical overlap. A generic shared word is not
  // evidence that a corpus passage answers the user's question.
  if (queryTerms.length >= 2 && bestScore >= 0.5 && best) {
    const excerpt = best.slice(0, 900).replace(/\s+/g, ' ').trim();
    return {
      mode: 'retrieval',
      content: `Based on relevant licensed training material:\n\n${excerpt}\n\nI am using verified retrieval here because the neural generator has not passed its chat-quality gate yet.`,
    };
  }
  return {
    mode: 'guarded',
    content: 'I do not have enough verified training material to answer that reliably yet. I will keep training on attributable public chat and code data rather than guess.',
  };
}
