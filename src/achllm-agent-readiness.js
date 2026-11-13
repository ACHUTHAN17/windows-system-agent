// AchLLM's first agent gate is deliberately validation-only. It accepts a
// tiny, read-only task plan, rejects everything outside its manifest, and
// never executes a system or browser action. This creates measurable evidence
// before the model is trusted with any live tool.

export const AGENT_STAGE = 'research-only';
export const READ_ONLY_TOOLS = Object.freeze([
  { name: 'system_info', purpose: 'Read operating-system facts only' },
  { name: 'browser_reference', purpose: 'Read one allow-listed public reference page in an isolated browser' },
]);

const allowed = new Set(READ_ONLY_TOOLS.map((tool) => tool.name));
const hasSecretLikeText = (value) => /\b(?:password|passwd|secret|api[_ -]?key|access[_ -]?token|authorization)\b/i.test(String(value || ''));

export function validateReadOnlyPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return { ok: false, error: 'plan must be an object' };
  if (typeof plan.goal !== 'string' || !plan.goal.trim() || plan.goal.length > 500) return { ok: false, error: 'plan needs a short goal' };
  if (!Array.isArray(plan.steps) || !plan.steps.length || plan.steps.length > 3) return { ok: false, error: 'plan needs 1 to 3 steps' };
  const seen = new Set();
  for (const step of plan.steps) {
    if (!step || typeof step !== 'object' || typeof step.id !== 'string' || typeof step.tool !== 'string') return { ok: false, error: 'each step needs id and tool' };
    if (seen.has(step.id)) return { ok: false, error: 'step ids must be unique' };
    seen.add(step.id);
    if (!allowed.has(step.tool)) return { ok: false, error: `tool not permitted at ${AGENT_STAGE} stage: ${step.tool}` };
    if (hasSecretLikeText(JSON.stringify(step.args || {}))) return { ok: false, error: 'plans cannot contain credentials or secrets' };
    if (step.tool === 'browser_reference') {
      const url = String(step.args?.url || '');
      if (!/^https:\/\/en\.wikipedia\.org\/wiki\/[A-Za-z0-9_()%.-]+$/.test(url)) return { ok: false, error: 'browser_reference is limited to the Wikimedia allow-list' };
    }
  }
  return { ok: true, stage: AGENT_STAGE, executable: false, message: 'Plan is valid for evaluation only; no action was executed.' };
}

export function agentReadinessReport() {
  return {
    stage: AGENT_STAGE,
    executable: false,
    allowedTools: READ_ONLY_TOOLS,
    nextGate: 'Pass repeatable sandbox planning and tool-selection evaluations before any tool execution is considered.',
    protections: ['No system control', 'No account actions', 'No private browser profile', 'No credentials', 'No file writes'],
  };
}
