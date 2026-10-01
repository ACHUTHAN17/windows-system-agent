'use strict';
// Shared logic for every way a file can get attached: the native file dialog, dragging a
// file onto the window, or pasting an image from the clipboard. One path, one set of rules
// (size cap, text-inline vs path-reference, safe destination name), so all three behave
// identically and are testable without Electron.
const fs = require('node:fs');
const path = require('node:path');

const MAX_FILES = 10;
const MAX_BYTES = 25 * 1024 * 1024;
const TEXT_EXT = new Set(['.txt', '.md', '.json', '.csv', '.log', '.js', '.py', '.ts', '.html', '.css', '.yml', '.yaml']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

function safeName(original) {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${path.basename(original)}`.replace(/[^A-Za-z0-9._-]/g, '_');
}

function describe(agentDir, dest, name) {
  const dir = path.join(agentDir, 'uploads');
  const stat = fs.statSync(dest);
  const rel = path.relative(agentDir, dest).split(path.sep).join('/');
  const ext = path.extname(name).toLowerCase();
  let preview = '';
  if (TEXT_EXT.has(ext)) { try { preview = fs.readFileSync(dest, 'utf8').slice(0, 4000); } catch { /* binary despite extension */ } }
  return { name, path: rel, bytes: stat.size, isImage: IMAGE_EXT.has(ext), preview };
}

function copyFileIntoUploads(agentDir, srcPath) {
  const name = path.basename(srcPath);
  try {
    const stat = fs.statSync(srcPath);
    if (stat.size > MAX_BYTES) return { name, error: 'too large (25 MB max)' };
    const dir = path.join(agentDir, 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, safeName(srcPath));
    fs.copyFileSync(srcPath, dest);
    return describe(agentDir, dest, name);
  } catch (e) { return { name, error: e.message }; }
}

function saveBufferIntoUploads(agentDir, name, buffer) {
  const base = path.basename(name || 'pasted-image.png');
  try {
    if (buffer.length > MAX_BYTES) return { name: base, error: 'too large (25 MB max)' };
    const dir = path.join(agentDir, 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, safeName(base));
    fs.writeFileSync(dest, buffer);
    return describe(agentDir, dest, base);
  } catch (e) { return { name: base, error: e.message }; }
}

function attachFromPaths(agentDir, paths) {
  return (paths || []).slice(0, MAX_FILES).map((p) => copyFileIntoUploads(agentDir, p));
}

module.exports = { attachFromPaths, copyFileIntoUploads, saveBufferIntoUploads, MAX_FILES, MAX_BYTES, TEXT_EXT, IMAGE_EXT };
