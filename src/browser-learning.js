// Isolated browser-based research for AchLLM. This never opens a user's
// browser profile: it launches a disposable headless Chromium profile, visits
// only an allow-listed public source, and records licence/provenance per row.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { WIKIMEDIA_LICENSE } from './seed-training.js';

const TOPICS = ['Artificial_intelligence', 'Computer_programming', 'Operating_system', 'Software_engineering', 'Computer_security', 'Natural_language_processing', 'Algorithm', 'Computer_network', 'Database', 'Linux'];
const strip = (html) => String(html || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim();

export function browserWikimediaRecordFromDom(dom, { url } = {}) {
  const title = strip(String(dom).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/ - Wikipedia$/i, '').trim();
  const main = String(dom).match(/<(?:main|div)[^>]+(?:id=["']content["']|class=["'][^"']*mw-content[^"']*["'])[^>]*>([\s\S]*?)<\/(?:main|div)>/i)?.[1];
  // Some rendered Wikipedia layouts close a nested content div before the
  // article body. Fall back to the full rendered document in that case.
  const text = strip(main).length >= 300 ? strip(main) : strip(dom);
  if (!title || text.length < 300 || !/^https:\/\/en\.wikipedia\.org\/wiki\//.test(String(url || ''))) return null;
  return {
    id: `chromium-wikipedia-${crypto.createHash('sha256').update(`${url}\n${text}`).digest('hex').slice(0, 24)}`,
    source: url,
    title,
    text: text.slice(0, 12_000),
    license: WIKIMEDIA_LICENSE,
    domain: 'browser',
    collectionMethod: 'isolated-headless-chromium',
    collectedAt: new Date().toISOString(),
  };
}

export function renderWithIsolatedChromium(url, { browserBin = process.env.ACHLLM_BROWSER_BIN } = {}) {
  const candidates = browserBin ? [browserBin] : ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'achllm-chromium-'));
  try {
    for (const bin of candidates) {
      // Wikipedia's rendered DOM can be several megabytes even though the
      // retained, attributable training extract is capped at 12 KB below.
      const result = spawnSync(bin, ['--headless', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-dev-shm-usage', `--user-data-dir=${profile}`, '--dump-dom', url], { encoding: 'utf8', timeout: 45_000, maxBuffer: 8_000_000 });
      if (!result.error && result.status === 0 && result.stdout) return result.stdout;
    }
    throw new Error('No compatible headless Chromium executable was available');
  } finally {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 2 });
  }
}

export function collectBrowserWikimediaRecords({ count = 1, offset = 0, render = renderWithIsolatedChromium } = {}) {
  const records = [];
  const wanted = Math.max(1, Math.min(2, Number(count) || 1));
  for (let i = 0; i < wanted; i++) {
    const topic = TOPICS[(Math.max(0, Number(offset) || 0) + i) % TOPICS.length];
    const url = `https://en.wikipedia.org/wiki/${topic}`;
    const record = browserWikimediaRecordFromDom(render(url), { url });
    if (record) records.push(record);
  }
  return records;
}
