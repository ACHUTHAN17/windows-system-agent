#!/usr/bin/env node
// Creates server-only public-gateway configuration without persisting a raw
// password. Run on the Linux host: node scripts/configure-public-proxy.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const username = process.env.WINAGENT_PROXY_USER || process.argv[2];
if (!/^[A-Za-z0-9._-]{1,64}$/.test(username || '')) throw new Error('Usage: WINAGENT_PROXY_USER=<owner-name> node scripts/configure-public-proxy.mjs');
if (!process.stdin.isTTY) throw new Error('Run this command in an interactive terminal so the password is not stored in shell history.');

function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    let value = '';
    process.stdout.write(prompt);
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true); process.stdin.resume();
    const done = (error) => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener('keypress', onKey); process.stdout.write('\n'); error ? reject(error) : resolve(value); };
    const onKey = (str, key = {}) => {
      if (key.ctrl && key.name === 'c') return done(new Error('Cancelled'));
      if (key.name === 'return' || key.name === 'enter') return done();
      if (key.name === 'backspace') { value = value.slice(0, -1); return; }
      if (!key.ctrl && !key.meta && str) value += str;
    };
    process.stdin.on('keypress', onKey);
  });
}

const password = await readSecret('Create a gateway password (14+ characters): ');
if (password.length < 14) throw new Error('Gateway password must contain at least 14 characters.');
const confirm = await readSecret('Confirm gateway password: ');
if (password.length !== confirm.length || !crypto.timingSafeEqual(Buffer.from(password), Buffer.from(confirm))) throw new Error('Passwords do not match.');
const salt = crypto.randomBytes(16); const digest = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const encoded = `$scrypt$N=16384,r=8,p=1$${salt.toString('base64')}$${digest.toString('base64')}`;
const target = path.join(os.homedir(), '.config', 'winagent-public-proxy.env');
fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
const contents = `WINAGENT_PROXY_USER=${username}\nWINAGENT_PROXY_PASSWORD_HASH=${encoded}\nWINAGENT_CORS_ORIGIN=https://achuthan17.github.io\n`;
fs.writeFileSync(target, contents, { encoding: 'utf8', mode: 0o600 }); fs.chmodSync(target, 0o600);
console.log(`Wrote protected gateway configuration to ${target}`);
