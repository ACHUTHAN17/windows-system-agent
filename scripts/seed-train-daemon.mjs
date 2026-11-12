// A small, restartable cloud worker: fetch a bounded public batch, retrain the
// CPU model, then wait. It never silently expands storage or scrapes private
// pages; all provenance remains in models/seed-data/manifest.jsonl.
const intervalMs = Math.max(5 * 60_000, Number(process.env.SEED_TRAIN_INTERVAL_MS || 15 * 60_000));
const distillEvery = Math.max(1, Number(process.env.SEED_DISTILL_EVERY || 4));
const statusSyncEvery = Math.max(1, Number(process.env.SEED_STATUS_SYNC_EVERY || 4));
const runOnce = async (script) => {
  const { spawn } = await import('node:child_process');
  const child = spawn(process.execPath, [script], { stdio: 'inherit', env: process.env });
  await new Promise((resolve, reject) => child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`seed training exited ${code}`))));
};
let cycle = 0;
for (;;) {
  const script = cycle > 0 && cycle % distillEvery === 0 ? 'scripts/seed-distill-once.mjs' : 'scripts/seed-train-once.mjs';
  try {
    await runOnce(script);
    await runOnce('scripts/write-achllm-status.mjs');
    if (process.env.ACHLLM_STATUS_PUSH === '1' && cycle % statusSyncEvery === 0) await runOnce('scripts/publish-achllm-status.mjs');
  } catch (error) { console.error(`Seed cycle failed: ${error.message}`); }
  cycle++;
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
