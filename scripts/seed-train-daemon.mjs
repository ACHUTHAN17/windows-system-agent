// A small, restartable cloud worker: fetch a bounded public batch, retrain the
// CPU model, then wait. It never silently expands storage or scrapes private
// pages; all provenance remains in models/seed-data/manifest.jsonl.
const intervalMs = Math.max(5 * 60_000, Number(process.env.SEED_TRAIN_INTERVAL_MS || 15 * 60_000));
const runOnce = async () => {
  const { spawn } = await import('node:child_process');
  const child = spawn(process.execPath, ['scripts/seed-train-once.mjs'], { stdio: 'inherit', env: process.env });
  await new Promise((resolve, reject) => child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`seed training exited ${code}`))));
};
for (;;) {
  try { await runOnce(); } catch (error) { console.error(`Seed cycle failed: ${error.message}`); }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
