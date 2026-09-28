'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (ch, ...a) => ipcRenderer.invoke(ch, ...a);
const listen = (ch, cb) => {
  const fn = (_e, payload) => cb(payload);
  ipcRenderer.on(ch, fn);
  return () => ipcRenderer.removeListener(ch, fn);
};

// The ONLY surface the UI can touch. No Node, no fs, no shell in the renderer.
contextBridge.exposeInMainWorld('winagent', {
  info: () => invoke('app:info'),
  getSettings: () => invoke('settings:get'),
  setSettings: (patch) => invoke('settings:set', patch),
  run: (text, history) => invoke('agent:run', { text, history }),
  selftest: () => invoke('agent:selftest'),
  stop: () => invoke('agent:stop'),
  approve: (id, decision) => invoke('agent:approve', { id, decision }),
  onEvent: (cb) => listen('agent:event', cb),
  sync: () => invoke('sync:run'),
  onSync: (cb) => listen('sync:status', cb),
  skills: () => invoke('skills:list'),
  skillRead: (name) => invoke('skills:read', name),
  tools: () => invoke('tools:list'),
  memoryList: () => invoke('memory:list'),
  memorySave: (name, text) => invoke('memory:save', { name, text }),
  sessionsLoad: () => invoke('sessions:load'),
  sessionsSave: (list) => invoke('sessions:save', list),
  pickFolder: () => invoke('dialog:folder'),
  openAgentDir: () => invoke('shell:openAgentDir'),
  openExternal: (url) => invoke('shell:openExternal', url),
});
