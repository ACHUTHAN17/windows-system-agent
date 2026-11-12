// Opt-in GitHub telemetry publication.  The dashboard data is public by
// design, but this script never enables itself: the server operator must set
// ACHLLM_STATUS_PUSH=1 and provide a write-capable GitHub deploy credential.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim());
  return result.stdout.trim();
};

if (process.env.ACHLLM_STATUS_PUSH !== '1') {
  console.log(JSON.stringify({ published: false, reason: 'Set ACHLLM_STATUS_PUSH=1 only after configuring a GitHub deploy credential.' }));
  process.exit(0);
}
run(['pull', '--rebase', 'origin', 'main']);
const pending = run(['status', '--porcelain', '--', 'docs/achllm-status.json']);
if (!pending) {
  console.log(JSON.stringify({ published: false, reason: 'No dashboard status change.' }));
  process.exit(0);
}
run(['add', 'docs/achllm-status.json']);
run(['-c', 'user.name=AchLLM telemetry', '-c', 'user.email=achllm@users.noreply.github.com', 'commit', '-m', 'chore(achllm): publish training telemetry']);
run(['push', 'origin', 'main']);
console.log(JSON.stringify({ published: true, file: 'docs/achllm-status.json' }));
