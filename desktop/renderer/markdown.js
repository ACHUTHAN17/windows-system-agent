// Tiny, safe markdown renderer: HTML-escapes everything first, then applies a small set of
// patterns. Links are inert (data-href) and opened by the main process (https only).
(function (root) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function inline(s) {
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="#" data-href="$2">$1</a>');
    s = s.replace(/(^|\s)(https:\/\/[^\s<]+)/g, '$1<a href="#" data-href="$2">$2</a>');
    return s;
  }

  function blocks(text) {
    const lines = text.split('\n');
    let html = '', list = null, para = [];
    const flushPara = () => { if (para.length) { html += '<p>' + para.join('<br>') + '</p>'; para = []; } };
    const flushList = () => { if (list) { html += `</${list}>`; list = null; } };
    for (const raw of lines) {
      const line = esc(raw);
      let m;
      if (!raw.trim()) { flushPara(); flushList(); continue; }
      if ((m = raw.match(/^(#{1,4})\s+(.*)$/))) { flushPara(); flushList(); const n = m[1].length + 1; html += `<h${n}>${inline(esc(m[2]))}</h${n}>`; continue; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(raw)) { flushPara(); flushList(); html += '<hr>'; continue; }
      if ((m = raw.match(/^\s*[-*]\s+(.*)$/))) { flushPara(); if (list !== 'ul') { flushList(); html += '<ul>'; list = 'ul'; } html += '<li>' + inline(esc(m[1])) + '</li>'; continue; }
      if ((m = raw.match(/^\s*\d+[.)]\s+(.*)$/))) { flushPara(); if (list !== 'ol') { flushList(); html += '<ol>'; list = 'ol'; } html += '<li>' + inline(esc(m[1])) + '</li>'; continue; }
      if ((m = raw.match(/^>\s?(.*)$/))) { flushPara(); flushList(); html += '<blockquote>' + inline(esc(m[1])) + '</blockquote>'; continue; }
      flushList();
      para.push(inline(line));
    }
    flushPara(); flushList();
    return html;
  }

  function render(md) {
    const parts = String(md || '').split('```');
    let html = '';
    parts.forEach((p, i) => {
      if (i % 2 === 1) {
        const nl = p.indexOf('\n');
        const lang = nl >= 0 ? p.slice(0, nl).trim() : '';
        const code = nl >= 0 ? p.slice(nl + 1) : p;
        html += `<div class="codeblock"><div class="codehead"><span>${esc(lang) || 'text'}</span><button class="copy" type="button">Copy</button></div><pre><code>${esc(code.replace(/\n$/, ''))}</code></pre></div>`;
      } else html += blocks(p);
    });
    return html;
  }

  const api = { render, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MD = api;
})(typeof window !== 'undefined' ? window : globalThis);
