// Telegram channel: chat with the agent from your phone. Zero dependencies
// (plain Bot API HTTPS). Owner-locked, per-chat memory, bounded subtasks.
// Env/flags: TELEGRAM_TOKEN (required — @BotFather), TELEGRAM_ALLOW_FROM
// (comma chat ids, opt — empty = first chat to message becomes owner).
// Commands: /new (fresh context), /selftest, /stop (owner), /help.
import fs from 'node:fs';
import path from 'node:path';

export async function runTelegram({ root, token, allowFrom, runTask, runSelftest, log }) {
  const say = log || console.log;
  const api = async (m, body) => (await (await fetch(`https://api.telegram.org/bot${token}/${m}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
  })).json());
  const me = await api('getMe');
  if (!me.ok) throw new Error('telegram: bad token (' + (me.description || 'check @BotFather') + ')');
  const allowed = new Set(String(allowFrom || '').split(',').map(s => s.trim()).filter(Boolean));
  const memFile = (id) => path.join(root, 'memory', `chat-${String(id).replace(/[^0-9-]/g, '')}.md`);
  const readCtx = (id) => {
    try { return fs.readFileSync(memFile(id), 'utf8').split('\n').slice(-30).join('\n').slice(0, 4000); }
    catch { return ''; }
  };
  const writeCtx = (id, who, text) => {
    try {
      fs.mkdirSync(path.join(root, 'memory'), { recursive: true });
      fs.appendFileSync(memFile(id), `\n[${new Date().toISOString().slice(0, 16)}] ${who}: ${String(text).slice(0, 1000)}`);
    } catch {}
  };
  async function send(id, text) {
    const t = String(text || '(empty reply)');
    for (let i = 0; i < t.length; i += 4000) {
      await api('sendMessage', { chat_id: id, text: t.slice(i, i + 4000) });
    }
  }
  let offset = 0;
  let stopped = false;
  say(`telegram: @${me.result.username} listening (owner: ${allowed.size ? [...allowed].join(',') : 'first-chat-claims'}) — Ctrl+C stops`);
  while (!stopped) {
    let up;
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=50&offset=${offset}`);
      up = await r.json();
    } catch { await new Promise(r => setTimeout(r, 5000)); continue; }
    if (!up.ok) { await new Promise(r => setTimeout(r, 5000)); continue; }
    for (const u of up.result || []) {
      offset = u.update_id + 1;
      const msg = u.message;
      if (!msg || typeof msg.text !== 'string') continue;
      const id = msg.chat.id;
      const text = msg.text.trim();
      if (!allowed.size) {
        allowed.add(String(id));
        await send(id, `Locked to this chat (${id}) — you are the owner. Send any task, or /help.`);
      }
      if (!allowed.has(String(id))) { await send(id, 'Not authorized.'); continue; }
      writeCtx(id, 'user', text);
      if (text === '/stop') { await send(id, 'Stopped. Restart the agent to resume.'); stopped = true; break; }
      if (text === '/help') { await send(id, 'Send any task, one at a time. /new clears context. /selftest runs checks. /stop shuts me down.'); continue; }
      if (text === '/new') { try { fs.rmSync(memFile(id)); } catch {} await send(id, 'Fresh context.'); continue; }
      if (text === '/selftest') {
        await send(id, 'Running selftest…');
        try { await send(id, String(await runSelftest()).slice(0, 4000)); }
        catch (e) { await send(id, 'selftest error: ' + e.message); }
        continue;
      }
      try {
        const ctx = readCtx(id);
        const answer = await runTask((ctx ? `Recent chat with this user:\n${ctx}\n\nNew request: ` : '') + text);
        writeCtx(id, 'agent', answer);
        await send(id, answer);
      } catch (e) { await send(id, 'ERROR: ' + e.message); }
    }
  }
}
