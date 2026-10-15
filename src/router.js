// Shared request router. This layer runs before an LLM so obvious local actions
// never spend a model call. It is intentionally deterministic: an uncertain
// request always falls through to the normal agent loop.

const OPEN_VERB = /^(?:please\s+)?(?:can you\s+)?(open|launch|start|show me|show)\s+(.+?)[.!\s]*$/i;
const COMPOUND = /\b(and|then|so that|so i can|to see|summar?i[sz]|analy[sz]e|read\b|list\b|find\b|search|tell me|what|why|how|check|review|edit|delete|rename|compare|convert|write)\b/i;
const IMAGE_WORD = /\b(image|picture|illustration|logo|wallpaper|photo|icon|artwork|portrait|banner)\b/i;
const IMAGE_VERB = /\b(generate|create|draw|make|design|render|produce|paint|imagine)\b/i;

const FOLDERS = {
  downloads: 'downloads', download: 'downloads',
  documents: 'documents', docs: 'documents', 'my documents': 'documents',
  desktop: 'desktop',
  pictures: 'pictures', photos: 'pictures', 'my pictures': 'pictures',
  music: 'music', 'my music': 'music',
  videos: 'videos', 'my videos': 'videos', movies: 'videos',
  home: 'home', 'home folder': 'home', 'user folder': 'home', 'my computer': 'home', 'this pc': 'home',
  temp: 'temp', tmp: 'temp', appdata: 'appData',
};

const APPS = {
  notepad: 'notepad', 'note pad': 'notepad',
  calculator: 'calc', calc: 'calc',
  paint: 'mspaint', mspaint: 'mspaint',
  'command prompt': 'cmd', cmd: 'cmd', terminal: 'cmd',
  powershell: 'powershell', 'task manager': 'taskmgr', taskmgr: 'taskmgr',
  'control panel': 'control',
  settings: 'uri:ms-settings:',
  'system settings': 'uri:ms-settings:', 'windows settings': 'uri:ms-settings:',
  'file explorer': 'explorer', explorer: 'explorer', files: 'explorer',
  'recycle bin': 'uri:shell:RecycleBinFolder',
  chrome: 'chrome', 'google chrome': 'chrome', edge: 'msedge', 'microsoft edge': 'msedge',
  firefox: 'firefox', word: 'winword', 'microsoft word': 'winword',
  excel: 'excel', 'microsoft excel': 'excel', outlook: 'outlook',
  spotify: 'spotify', discord: 'discord', 'vs code': 'code', 'visual studio code': 'code',
  vscode: 'code', whatsapp: 'whatsapp',
};

export const ROUTER_SYSTEM_PROMPT = `You are the WinAgent routing layer. Before reasoning about a request, classify it:
- LOCAL: a single, unambiguous action on the user's Windows computer, such as opening Settings, Notepad, a known folder, or an explicit path. The harness executes these directly; never invent a tool call for them.
- IMAGE: the user explicitly asks to generate, draw, create, or design an image. Use image_generate with the user's visual description.
- AGENT: anything that needs reading, analysis, planning, multiple steps, web/model knowledge, or an unknown target. Continue through the normal tool-calling agent loop.
When uncertain, choose AGENT. Never claim a local action happened unless the harness reports success.`;

function looksLikePath(s) {
  return /^[A-Za-z]:[\\/]/.test(s) || /^\\\\[^\\]/.test(s) || s.startsWith('~');
}

function stripArticle(s) {
  return s.replace(/^(the|my|a|an)\s+/i, '').replace(/\s+folder$/i, '').trim();
}

function imagePrompt(text) {
  let prompt = String(text || '').trim();
  prompt = prompt.replace(/^(?:please\s+)?(?:generate|create|draw|make|design|render|produce|paint|imagine)\s+/i, '');
  prompt = prompt.replace(/^(?:an?\s+)?(?:image|picture|illustration|logo|wallpaper|photo|icon|artwork|portrait|banner)\s+(?:of|about|for)\s+/i, '');
  prompt = prompt.replace(/^(?:an?\s+)?(?:image|picture|illustration|logo|wallpaper|photo|icon|artwork|portrait|banner)\s*[:,-]?\s*/i, '');
  return prompt.trim() || String(text || '').trim();
}

function localRoute(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 120) return null;
  const m = t.match(OPEN_VERB);
  if (!m) return null;
  const rest = m[2].trim();
  if (COMPOUND.test(rest)) return null;
  const bare = stripArticle(rest);
  const lower = bare.toLowerCase();
  if (looksLikePath(rest)) return { kind: 'path', target: rest.replace(/^['"]|['"]$/g, ''), label: `Opened ${rest}` };
  if (FOLDERS[lower]) return { kind: 'folder', folder: FOLDERS[lower], label: `Opened your ${bare} folder` };
  if (APPS[lower]) {
    const target = APPS[lower];
    return { kind: target.startsWith('uri:') ? 'uri' : 'app', target, label: `Opened ${bare}` };
  }
  return null;
}

export function routeText(text) {
  const t = String(text || '').trim();
  const local = localRoute(t);
  if (local) return { kind: 'local', confidence: 'high', action: local, reason: 'single-purpose known local target' };
  if (IMAGE_VERB.test(t) && IMAGE_WORD.test(t) || /^(?:please\s+)?(?:draw|paint)\s+.+/i.test(t)) {
    return { kind: 'image', confidence: 'high', prompt: imagePrompt(t), reason: 'explicit image-generation request' };
  }
  return { kind: 'agent', confidence: 'fallback', reason: 'requires model reasoning or tool selection' };
}

export function localToolCall(route) {
  const a = route && route.action;
  if (!a) return null;
  if (a.kind === 'app' || a.kind === 'uri') return { tool: a.kind === 'uri' ? 'app_open' : 'app_launch', args: a.kind === 'uri' ? { target: a.target.slice(4) } : { command: a.target } };
  if (a.kind === 'path') return { tool: 'app_open', args: { target: a.target } };
  if (a.kind === 'folder') return { tool: 'app_open', args: { target: `__WINAGENT_FOLDER__:${a.folder}` } };
  return null;
}

export function resolveFolderTarget(folder, homeDir) {
  const base = String(homeDir || '').replace(/[\\/]$/, '');
  const map = {
    downloads: `${base}\\Downloads`, documents: `${base}\\Documents`, desktop: `${base}\\Desktop`,
    pictures: `${base}\\Pictures`, music: `${base}\\Music`, videos: `${base}\\Videos`,
    home: base, temp: null, appData: null,
  };
  return map[folder] || null;
}

export const ROUTER_FOLDERS = FOLDERS;
export const ROUTER_APPS = APPS;
