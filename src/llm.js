// LLM layer: one interface, three backends.
//  - "openai-compatible": OpenAI, DeepSeek, Ollama, LM Studio, vLLM, any custom gateway
//    that speaks POST {baseUrl}/chat/completions with {model, messages}.
//  - "anthropic": native Anthropic Messages API.
// Uses global fetch (Node 18+). No SDK dependencies.
export async function chat(cfg, messages) {
  const chain = buildChain(cfg);
  let lastErr;
  for (let i = 0; i < chain.length; i++) {
    const c = chain[i];
    try {
      const text = c.provider === 'anthropic' ? await chatAnthropic(c, messages) : await chatOpenAICompatible(c, messages);
      if (i > 0) console.log(`  [llm] primary failed — answered via fallback #${i}: ${c.model} @ ${c.apiUrl}`);
      return text;
    } catch (e) {
      lastErr = e;
      if (i < chain.length - 1) console.log(`  [llm] ${c.model} @ ${c.apiUrl} failed (${String(e.message).split('\n')[0]}) — trying next in chain...`);
    }
  }
  throw lastErr;
}

// Builds the ordered list of endpoints to try: the configured primary model,
// then the single explicit LLM_FALLBACK_* endpoint (if set), then any free
// models the agent has discovered and verified itself via model-scout.js
// (docs/models.json) — fastest first. This is what makes model discovery
// "self-improving": a model the agent finds on its own becomes something it
// can actually fall back on, with no human editing .env. Set
// USE_SCOUTED_MODELS=false to opt out of the self-discovered tier.
function buildChain(cfg) {
  const chain = [cfg];
  const fb = (cfg.fallbackUrl || process.env.LLM_FALLBACK_URL || '').replace(/\/+$/, '');
  if (fb) {
    chain.push({
      ...cfg, provider: 'openai-compatible', apiUrl: fb,
      model: cfg.fallbackModel || process.env.LLM_FALLBACK_MODEL || 'openai',
      apiKey: cfg.fallbackKey ?? process.env.LLM_FALLBACK_KEY ?? '',
    });
  }
  if (cfg.useScoutedModels !== false) {
    for (const m of (cfg.scoutedModels || [])) {
      chain.push({ ...cfg, provider: 'openai-compatible', apiUrl: m.url, model: m.model, apiKey: '' });
    }
  }
  return chain;
}

async function chatOpenAICompatible(cfg, messages) {
  const url = `${cfg.apiUrl}/chat/completions`;
  const headers = { 'Content-Type': 'application/json', ...cfg.extraHeaders };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      signal: ctrl.signal,
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: cfg.temperature,
      }),
    });
  } catch (e) {
    throw new Error(`LLM request failed (${cfg.model} @ ${url}): ${e.message}\nCheck MODEL_API_URL / local server (ollama serve) / firewall.`);
  } finally { clearTimeout(t); }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM HTTP ${res.status} from ${url}: ${body.slice(0, 800)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text) throw new Error(`Unexpected LLM response shape: ${JSON.stringify(data).slice(0, 500)}`);
  return text;
}

async function chatAnthropic(cfg, messages) {
  // Convert OpenAI-style {role, content} to Anthropic {role, content blocks}.
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const rest = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));
  const url = `${cfg.apiUrl.replace(/\/+$/, '')}/v1/messages`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        ...cfg.extraHeaders,
      },
      signal: ctrl.signal,
      body: JSON.stringify({ model: cfg.model, max_tokens: 2048, system: system || undefined, messages: rest }),
    });
  } catch (e) {
    throw new Error(`Anthropic request failed: ${e.message}`);
  } finally { clearTimeout(t); }
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 800)}`);
  const data = await res.json();
  const text = (data?.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (!text) throw new Error(`Unexpected Anthropic response: ${JSON.stringify(data).slice(0, 500)}`);
  return text;
}

// The agent forces the model to answer in a strict JSON envelope so that
// tool-calling works identically on API, local (Ollama/LM Studio) and custom models
// without depending on provider-native function calling.
export function parseAgentJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { action: 'final', answer: text.trim() };
  try {
    const o = JSON.parse(m[0]);
    if (o.action === 'tool' && typeof o.tool === 'string') {
      return { action: 'tool', tool: o.tool, args: o.args || {}, thought: o.thought || '' };
    }
    if (typeof o.answer === 'string') return { action: 'final', answer: o.answer };
    return { action: 'final', answer: text.trim() };
  } catch {
    return { action: 'final', answer: text.trim() };
  }
}

export function toolPrompt(tools) {
  const lines = tools.map(t => `  - ${t.name}(${Object.keys(t.args).join(', ') || 'no args'}): ${t.description}`);
  return `Available tools:\n${lines.join('\n')}`;
}

export function systemPrompt(toolList) {
  return `You are WinAgent, a Windows system operator. You control files and apps ONLY by calling tools.
${toolList}

Rules:
- Reply with EXACTLY one JSON object, no markdown, no extra text.
- To act: {"thought":"...","action":"tool","tool":"<name>","args":{...}}
- When done: {"thought":"...","action":"final","answer":"..."}
- Prefer absolute Windows paths (C:\\Users\\...). Never invent file contents; read first.
- Destructive ops (write/edit/delete/kill/shell) ask the harness for approval; if denied, explain and stop.
- Keep answers short. Report paths, PIDs, exit codes exactly as the tool returned them.
- If a tool errors, try ONE fix (correct path, list dir first) then report failure honestly.`;
}
