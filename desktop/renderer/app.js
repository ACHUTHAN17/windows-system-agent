'use strict';
(function () {
  const api = window.winagent;
  const $ = (id) => document.getElementById(id);
  const PRESETS = {
    free: { label: 'Free models (no key needed)', provider: 'openai-compatible', apiUrl: '', model: '' },
    ollama: { label: 'Ollama (local)', provider: 'openai-compatible', apiUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
    openai: { label: 'OpenAI', provider: 'openai-compatible', apiUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    anthropic: { label: 'Anthropic Claude', provider: 'anthropic', apiUrl: 'https://api.anthropic.com', model: '' },
    openrouter: { label: 'OpenRouter', provider: 'openai-compatible', apiUrl: 'https://openrouter.ai/api/v1', model: '' },
    custom: { label: 'Custom OpenAI-compatible', provider: 'openai-compatible', apiUrl: '', model: '' },
  };
  const STARTERS = [
    ['Tidy my Downloads', 'List the 20 biggest files in my Downloads folder and suggest what I can safely delete.'],
    ['What is slowing my PC?', 'Check CPU, memory and startup programs and tell me what is slowing this PC down.'],
    ['Summarize a folder', 'Look at my Documents folder and summarize what is in it.'],
    ['Disk space report', 'Show free space on every drive and the top 10 largest folders on C:.'],
  ];

  const S = { sessions: [], cur: null, view: 'chat', running: false, turn: null, settings: null, mode: 'task', skills: [], tools: [], saveT: null, attachments: [] };

  const uid = () => Math.random().toString(36).slice(2, 10);
  const cur = () => S.sessions.find(s => s.id === S.cur);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = window.MD.esc;

  const IMAGE_MARKER = /\[\[image:([A-Za-z0-9._\/-]+)\]\]/g;
  function renderAnswerWithImages(text) {
    const parts = String(text).split(IMAGE_MARKER); // [text, path, text, path, ..., text]
    let html = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) { if (parts[i]) html += window.MD.render(parts[i]); }
      else html += `<div class="gen-img-wrap"><img class="gen-img loading" data-path="${esc(parts[i])}" alt="generated image"></div>`;
    }
    return html || window.MD.render(text);
  }
  async function loadPendingImages(root) {
    const imgs = (root || document).querySelectorAll('.gen-img.loading');
    for (const img of imgs) {
      const p = img.dataset.path; if (!p) continue;
      img.dataset.path = ''; // claim it so refreshTurn's re-render doesn't double-fetch
      const data = await api.readImage(p);
      if (data) { img.src = data; img.classList.remove('loading'); img.alt = p; }
      else { img.replaceWith(el('div', 'dim', `(image unavailable: ${esc(p)})`)); }
    }
  }

  function saveSoon() { clearTimeout(S.saveT); S.saveT = setTimeout(() => api.sessionsSave(S.sessions.map(s => ({ ...s, messages: s.messages.slice(-200) }))), 400); }

  // ---------- sessions ----------
  function newSession() {
    if (S.running) return;
    const s = { id: uid(), title: 'New chat', messages: [], updated: Date.now() };
    S.sessions.unshift(s); S.cur = s.id; showView('chat'); renderAll(); $('input').focus();
  }
  function selectSession(id) { if (S.running) return; S.cur = id; showView('chat'); renderAll(); }
  function deleteSession(id) {
    if (S.running) return;
    S.sessions = S.sessions.filter(s => s.id !== id);
    if (S.cur === id) S.cur = S.sessions[0] ? S.sessions[0].id : null;
    if (!S.cur) return newSession();
    saveSoon(); renderAll();
  }
  function renderSidebar() {
    const box = $('chatList'); box.innerHTML = '';
    for (const s of S.sessions) {
      const it = el('div', 'chatitem' + (s.id === S.cur ? ' active' : ''));
      it.innerHTML = `<span class="t">${esc(s.title)}</span><button class="x" title="Delete chat">✕</button>`;
      it.onclick = () => selectSession(s.id);
      it.querySelector('.x').onclick = (e) => { e.stopPropagation(); deleteSession(s.id); };
      box.appendChild(it);
    }
  }

  // ---------- messages ----------
  function activityRow(a) {
    if (a.k === 'step') return `<div class="row-i step"><span class="dot"></span><span class="txt">${esc(a.text)}</span></div>`;
    if (a.k === 'tool') return `<div class="row-i ${a.ok === true ? 'ok' : a.ok === false ? 'bad' : ''}"><span class="dot"></span><span class="txt"><span class="nm">${esc(a.name)}</span> ${esc(a.summary || '')}</span></div>`;
    return `<div class="row-i"><span class="dot"></span><span class="txt">${esc(a.text)}</span></div>`;
  }
  function assistantNode(m) {
    const n = el('div', 'msg assistant');
    const steps = m.activity.filter(a => a.k === 'step' || a.k === 'tool').length;
    const running = m.status === 'running';
    let html = '<div class="avatar">&gt;_</div><div class="bubble">';
    if (m.activity.length || running) {
      html += `<details class="activity" ${running ? 'open' : ''}><summary>${running ? '<span class="spinner"></span>Working…' : 'Activity'} (${steps} step${steps === 1 ? '' : 's'})</summary><div class="rows">${m.activity.map(activityRow).join('')}</div></details>`;
    }
    if (m.approval) {
      const a = m.approval;
      html += `<div class="approval ${a.resolved ? 'done' : ''}" data-id="${a.id}"><b>${a.resolved ? 'Approval: ' + esc(a.resolved) : 'Approval needed'}</b><div class="lbl">${esc(a.label)}</div>`;
      if (!a.resolved) html += `<div class="btns">${a.options.includes('once') ? '<button class="allow" data-d="once">Allow once</button>' : ''}${a.options.includes('always') ? '<button data-d="always">Always allow</button>' : ''}<button class="deny" data-d="deny">Deny</button></div>`;
      html += '</div>';
    }
    if (m.text) html += `<div class="answer md">${renderAnswerWithImages(m.text)}</div>`;
    if (m.error) html += `<div class="err">${esc(m.error)}</div>`;
    if (!m.text && !m.error && !running && !m.approval) html += '<div class="dim">Done — no text answer was returned.</div>';
    html += '</div>';
    n.innerHTML = html;
    return n;
  }
  function userNode(m) {
    const n = el('div', 'msg user');
    const chips = (m.attachments || []).map(a => `<div class="chip">${a.isImage ? '🖼️' : '📄'} ${esc(a.name)}</div>`).join('');
    n.innerHTML = `<div class="bubble">${esc(m.text)}${chips ? `<div class="chips">${chips}</div>` : ''}</div>`;
    return n;
  }

  function renderMessages() {
    const box = $('messages'); const s = cur(); box.innerHTML = '';
    if (!s || !s.messages.length) {
      const w = el('div', 'welcome');
      w.innerHTML = `<h1>What should WinAgent do?</h1><p>${S.settings && S.settings.preset === 'free' ? 'Using free models by default — add your own key in Settings for better results.' : 'Describe a task. WinAgent will plan it and use its tools on this PC.'}</p><div class="cards"></div>`;
      const cards = w.querySelector('.cards');
      for (const [t, p] of STARTERS) { const c = el('div', 'card', `<b>${esc(t)}</b><span>${esc(p)}</span>`); c.onclick = () => send(p); cards.appendChild(c); }
      box.appendChild(w); return;
    }
    for (const m of s.messages) box.appendChild(m.role === 'user' ? userNode(m) : assistantNode(m));
    box.scrollTop = box.scrollHeight;
    loadPendingImages(box);
  }
  function refreshTurn() {
    const box = $('messages'); const nodes = box.querySelectorAll('.msg');
    const last = nodes[nodes.length - 1]; const s = cur();
    if (!last || !s) return renderMessages();
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    const wasOpen = last.querySelector('details') ? last.querySelector('details').open : true;
    const fresh = assistantNode(S.turn); const d = fresh.querySelector('details'); if (d && S.turn.status === 'running') d.open = wasOpen;
    box.replaceChild(fresh, last);
    if (near) box.scrollTop = box.scrollHeight;
    loadPendingImages(fresh);
  }

  // ---------- running ----------
  function attachmentsBlock() {
    if (!S.attachments.length) return '';
    const parts = S.attachments.filter(a => !a.error).map(a => {
      if (a.preview) return `\n\n[Attached file "${a.name}" — saved at ${a.path}, use file_read/file_fetch on that path for the full content]\n\`\`\`\n${a.preview}\n\`\`\``;
      return `\n\n[Attached ${a.isImage ? 'image' : 'file'} "${a.name}" saved at ${a.path} — use image analysis or file tools on that path as needed]`;
    });
    return parts.join('');
  }
  async function send(text) {
    text = String(text || '').trim();
    if (!text || S.running) return;
    const s = cur() || (newSession(), cur());
    if (!s.messages.length) s.title = text.slice(0, 44);
    const history = s.messages.filter(m => m.text).map(m => ({ role: m.role, text: m.text }));
    const attachments = S.attachments.filter(a => !a.error).map(a => ({ name: a.name, path: a.path, isImage: a.isImage }));
    const fullText = text + attachmentsBlock();
    s.messages.push({ role: 'user', text, attachments });
    const turn = { role: 'assistant', text: '', activity: [], approval: null, error: '', status: 'running', kind: 'task' };
    s.messages.push(turn); s.updated = Date.now(); S.turn = turn;
    $('input').value = ''; S.attachments = []; renderAttachRow(); autosize(); setRunning(true); renderAll();
    const r = await api.run(fullText, history);
    if (!r || !r.ok) { turn.status = 'error'; turn.error = r && r.error === 'busy' ? 'The agent is already running a task.' : `Could not start the agent: ${r && r.error}`; endTurn(); }
  }
  function renderAttachRow() {
    const row = $('attachRow'); row.innerHTML = '';
    row.hidden = !S.attachments.length;
    S.attachments.forEach((a, i) => {
      const chip = el('div', 'attachchip' + (a.error ? ' err' : ''));
      chip.innerHTML = `<span>${a.error ? '⚠ ' : (a.isImage ? '🖼️ ' : '📄 ')}${esc(a.name)}${a.error ? ' — ' + esc(a.error) : ''}</span><button title="Remove">✕</button>`;
      chip.querySelector('button').onclick = () => { S.attachments.splice(i, 1); renderAttachRow(); };
      row.appendChild(chip);
    });
  }
  async function pickAttachments() {
    const files = await api.attachFiles();
    if (files && files.length) { S.attachments.push(...files); renderAttachRow(); }
  }
  async function selftest() {
    if (S.running) return;
    showView('chat'); const s = cur() || (newSession(), cur());
    if (!s.messages.length) s.title = 'Agent self-test';
    s.messages.push({ role: 'user', text: 'Run the agent self-test' });
    const turn = { role: 'assistant', text: '', activity: [], approval: null, error: '', status: 'running', kind: 'selftest' };
    s.messages.push(turn); S.turn = turn; setRunning(true); renderAll();
    const r = await api.selftest();
    if (!r || !r.ok) { turn.status = 'error'; turn.error = `Could not start: ${r && r.error}`; endTurn(); }
  }
  function endTurn() { if (S.turn && S.turn.status === 'running') S.turn.status = 'done'; S.turn = null; setRunning(false); saveSoon(); renderAll(); }
  function setRunning(v) { S.running = v; $('send').hidden = v; $('stop').hidden = !v; $('input').disabled = false; }

  function onEvent(ev) {
    const t = S.turn; if (!t) return;
    switch (ev.t) {
      case 'step': t.activity.push({ k: 'step', text: `Step ${ev.n}: ${ev.text}` }); break;
      case 'tool': t.activity.push({ k: 'tool', name: ev.name, ok: ev.ok, summary: ev.summary }); break;
      case 'note': case 'log': if (t.activity.length < 300) t.activity.push({ k: 'note', text: ev.text }); break;
      case 'banner': $('modelPill').textContent = ev.text.replace(/\s*@\s*.*$/, '').slice(0, 60); $('modelPill').title = ev.text; break;
      case 'approval': t.approval = { id: ev.id, label: ev.label, options: ev.options, resolved: '' }; break;
      case 'resolved': if (t.approval) t.approval.resolved = ev.decision; break;
      case 'answer': t.text = t.kind === 'selftest' ? '```\n' + ev.text + '\n```' : ev.text; break;
      case 'error': t.error = ev.text; t.status = 'error'; break;
      case 'done': endTurn(); return;
    }
    refreshTurn();
  }

  // ---------- views ----------
  function showView(v) {
    S.view = v;
    for (const id of ['chat', 'skills', 'memory', 'tools', 'settings']) $('view-' + id).hidden = id !== v;
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    if (v === 'skills') loadSkills(); if (v === 'memory') loadMemory(); if (v === 'tools') loadTools(); if (v === 'settings') loadSettings();
  }
  function renderAll() { renderSidebar(); renderMessages(); $('title').textContent = (cur() && cur().title) || 'New chat'; }

  async function loadSkills() {
    S.skills = await api.skills(); $('skillCount').textContent = S.skills.length || '';
    const q = $('skillSearch').value.toLowerCase(); const box = $('skillList'); box.innerHTML = '';
    for (const s of S.skills.filter(x => (x.name + ' ' + x.description).toLowerCase().includes(q)).slice(0, 400)) {
      const it = el('div', 'item', `<b>${esc(s.name)}${s.origin ? `<span class="badge">${esc(s.origin)}</span>` : ''}</b><span>${esc(s.description)}</span>`);
      it.onclick = async () => { document.querySelectorAll('#skillList .item').forEach(i => i.classList.remove('active')); it.classList.add('active'); $('skillDetail').innerHTML = window.MD.render(await api.skillRead(s.name) || '_empty_'); };
      box.appendChild(it);
    }
  }
  async function loadTools() {
    S.tools = await api.tools(); $('toolCount').textContent = S.tools.length || '';
    const q = $('toolSearch').value.toLowerCase(); const box = $('toolList'); box.innerHTML = '';
    for (const t of S.tools.filter(x => (x.name + ' ' + x.description).toLowerCase().includes(q)))
      box.appendChild(el('div', 'item', `<b>${esc(t.name)}<span class="badge">${esc(t.origin)}</span></b><span>${esc(t.description)}</span>`));
  }
  let memFiles = [], memCur = null;
  async function loadMemory() {
    memFiles = await api.memoryList(); const box = $('memList'); box.innerHTML = '';
    for (const f of memFiles) { const it = el('div', 'item' + (f.name === memCur ? ' active' : ''), `<b>${esc(f.name)}</b>`); it.onclick = () => { memCur = f.name; $('memText').value = f.text; $('memState').textContent = ''; loadMemoryList(); }; box.appendChild(it); }
  }
  function loadMemoryList() { document.querySelectorAll('#memList .item').forEach(i => i.classList.toggle('active', i.textContent === memCur)); }

  // ---------- settings ----------
  function fillSettings() {
    const s = S.settings; if (!s) return;
    $('sPreset').value = s.preset; $('sUrl').value = s.apiUrl || ''; $('sModel').value = s.model || ''; $('sKey').value = '';
    $('sKey').placeholder = s.hasKey ? '•••••••• saved (leave blank to keep)' : 'paste your API key';
    $('keyNote').textContent = s.hasKey ? (s.keyEncrypted ? 'Key is stored encrypted with Windows DPAPI.' : 'Key is stored unencrypted (secure storage unavailable).') : '';
    $('sFull').checked = !!s.fullAuto; $('sRoots').value = s.allowedRoots || ''; $('sHotkey').value = s.hotkey || '';
    $('sStart').checked = !!s.startWithWindows; $('sTray').checked = !!s.closeToTray;
    $('sSyncStart').checked = !!s.syncOnStart; $('sSyncMem').checked = !!s.syncMemory; $('sSyncEng').checked = !!s.syncEngine;
    $('sRepo').value = s.githubRepo || ''; $('sPat').value = '';
    $('sPat').placeholder = s.hasGithubPat ? '•••••••• saved (leave blank to keep)' : 'ghp_… (repo scope)';
    $('sAutoPush').checked = !!s.autoPushLearned; $('sSelfImprove').checked = !!s.autoSelfImprove; $('sScouted').checked = s.useScoutedModels !== false;
    $('customFields').hidden = s.preset === 'free'; updateMode();
  }
  async function loadSettings() { S.settings = await api.getSettings(); fillSettings(); const i = await api.info(); $('aboutLine').textContent = `WinAgent desktop ${i.version} · agent folder: ${i.agentDir}`; }
  function updateMode() { const full = S.settings && S.settings.fullAuto; const b = $('modeBadge'); b.textContent = full ? 'Full control' : 'Ask before acting'; b.classList.toggle('full', !!full); }
  async function saveSettings() {
    const patch = {
      preset: $('sPreset').value, provider: PRESETS[$('sPreset').value].provider, apiUrl: $('sUrl').value.trim(), model: $('sModel').value.trim(),
      fullAuto: $('sFull').checked, allowedRoots: $('sRoots').value.trim(), hotkey: $('sHotkey').value.trim(),
      startWithWindows: $('sStart').checked, closeToTray: $('sTray').checked, syncOnStart: $('sSyncStart').checked, syncMemory: $('sSyncMem').checked, syncEngine: $('sSyncEng').checked,
      githubRepo: $('sRepo').value.trim(), autoPushLearned: $('sAutoPush').checked, autoSelfImprove: $('sSelfImprove').checked, useScoutedModels: $('sScouted').checked,
    };
    if ($('sKey').value.trim()) patch.apiKey = $('sKey').value.trim();
    if ($('sPat').value.trim()) patch.githubPat = $('sPat').value.trim();
    const r = await api.setSettings(patch); S.settings = r.settings; fillSettings();
    $('sState').textContent = r.hotkeyOk ? 'Saved.' : 'Saved — but that hotkey could not be registered (already in use?).';
  }

  // ---------- misc ----------
  function autosize() { const i = $('input'); i.style.height = 'auto'; i.style.height = Math.min(i.scrollHeight, 200) + 'px'; }

  async function init() {
    for (const [k, v] of Object.entries(PRESETS)) $('sPreset').appendChild(new Option(v.label, k));
    $('sPreset').onchange = () => { const p = PRESETS[$('sPreset').value]; $('customFields').hidden = $('sPreset').value === 'free'; if ($('sPreset').value !== 'custom') { $('sUrl').value = p.apiUrl; $('sModel').value = p.model; } };
    S.sessions = (await api.sessionsLoad()) || [];
    for (const s of S.sessions) for (const m of s.messages) if (m.status === 'running') m.status = 'done'; // an interrupted turn from last run
    if (!S.sessions.length) S.sessions.push({ id: uid(), title: 'New chat', messages: [], updated: Date.now() });
    S.cur = S.sessions[0].id;
    S.settings = await api.getSettings(); updateMode();
    api.skills().then(s => { $('skillCount').textContent = s.length || ''; }); api.tools().then(t => { $('toolCount').textContent = t.length || ''; });

    api.onEvent(onEvent);
    api.onSync((st) => { $('syncState').textContent = st.text; $('syncBtn').disabled = st.state === 'running'; if (st.state === 'done') { api.skills().then(s => { $('skillCount').textContent = s.length || ''; }); if (S.view === 'skills') loadSkills(); if (S.view === 'memory') loadMemory(); } });

    $('newChat').onclick = newSession;
    $('send').onclick = () => send($('input').value);
    $('stop').onclick = () => api.stop();
    $('input').addEventListener('input', autosize);
    $('input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send($('input').value); } });
    document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); newSession(); } });
    document.querySelectorAll('.nav button').forEach(b => { b.onclick = () => showView(S.view === b.dataset.view ? 'chat' : b.dataset.view); });
    $('attachBtn').onclick = pickAttachments;
    $('syncBtn').onclick = () => api.sync();
    api.onLearned((r) => { const t = `Pushed ${r.pushed.length} file(s) to agent-learned${r.errors.length ? ` (${r.errors.length} error(s))` : ''}.`; const e = $('learnState'); if (e) e.textContent = t; });
    api.onSelfImprove((r) => { const t = r.opened.length ? `Opened ${r.opened.length} pull request(s) for review: ${r.opened.map(o => o.url).join(', ')}` : (r.errors[0] || ''); const e = $('learnState'); if (e) e.textContent = t; });
    $('skillSearch').oninput = loadSkills; $('toolSearch').oninput = loadTools;
    $('memSave').onclick = async () => { if (!memCur) return; await api.memorySave(memCur, $('memText').value); $('memState').textContent = 'Saved.'; };
    $('memFolder').onclick = () => api.openAgentDir();
    $('sSave').onclick = saveSettings;
    $('sPick').onclick = async () => { const p = await api.pickFolder(); if (p) $('sRoots').value = [$('sRoots').value.trim(), p].filter(Boolean).join(', '); };
    $('sSelftest').onclick = selftest;
    $('sTest').onclick = () => { showView('chat'); newSession(); send('Reply with exactly the single word: OK'); };
    $('modeBadge').onclick = async () => { const r = await api.setSettings({ fullAuto: !(S.settings && S.settings.fullAuto) }); S.settings = r.settings; updateMode(); };

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-href]'); if (a) { e.preventDefault(); api.openExternal(a.dataset.href); return; }
      const cp = e.target.closest('.copy'); if (cp) { const code = cp.closest('.codeblock').querySelector('code').textContent; navigator.clipboard.writeText(code).then(() => { cp.textContent = 'Copied'; setTimeout(() => { cp.textContent = 'Copy'; }, 1200); }); return; }
      const b = e.target.closest('.approval .btns button'); if (b && S.turn && S.turn.approval) { api.approve(S.turn.approval.id, b.dataset.d); b.parentElement.querySelectorAll('button').forEach(x => { x.disabled = true; }); }
    });
    showView('chat'); renderAll();
    window.__winagentReady = true;
  }
  init();
})();
