import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { io } from 'socket.io-client';

const artifacts = path.resolve('artifacts', `replay-${Date.now()}`);
fs.mkdirSync(artifacts, { recursive: true });
const child = spawn(path.resolve('release/win-unpacked/LAN Chess.exe'), ['--remote-debugging-port=9237', `--user-data-dir=${path.join(artifacts, 'profile')}`], { stdio: 'ignore' });
let ws;
let guest;
let nextId = 0;
const pending = new Map();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  for (let i = 0; i < 60; i++) { const value = await fn(); if (value) return value; await sleep(250); }
  throw new Error(`Timed out: ${label}`);
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP request timed out: ${method}`)); }, 15000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`);
try {
  const target = await until(async () => {
    try { return (await (await fetch('http://127.0.0.1:9237/json')).json()).find(page => page.type === 'page'); } catch { return null; }
  }, 'desktop debug target');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (pending.has(message.id)) { const call = pending.get(message.id); pending.delete(message.id); message.error ? call.reject(message.error) : call.resolve(message.result); }
  };
  const status = await until(() => evaluate('window.desktop?.getStatus()'), 'desktop bridge');
  assert.equal(status.version, '1.2.4');
  await until(() => evaluate(`Boolean([...document.querySelectorAll('#panel-create button')].find(b => b.textContent.includes('Create Game') && !b.disabled))`), 'connected lobby');
  await evaluate(`[...document.querySelectorAll('#panel-create button')].find(b => b.textContent.includes('Create Game')).click()`);
  const code = await until(() => evaluate(String.raw`document.body.textContent.match(/ROOM\s+([A-Z0-9]{4})/)?.[1]`), 'room code');
  guest = io(`http://127.0.0.1:${status.port}`, { transports: ['websocket'] });
  let state;
  guest.on('game-state', next => { state = next; });
  await new Promise((resolve, reject) => { guest.on('connect', resolve); guest.on('connect_error', reject); });
  guest.emit('join-game', { roomCode: code, playerName: 'Replay acceptance guest' });
  await until(() => state?.status === 'active', 'active room');
  await sleep(300);
  await click('[data-square="e2"]');
  await click('[data-square="e4"]');
  await until(() => state?.moves.length === 1, 'white move');
  guest.emit('make-move', { from: 'e7', to: 'e5' });
  await until(() => state?.moves.length === 2, 'black move');
  await sleep(300);
  await click('[aria-label="Previous move"]');
  await until(() => evaluate(`document.querySelector('[data-square="e7"]').getAttribute('aria-label').includes('black Pawn')`), 'historical position');
  await click('[data-square="d2"]'); await click('[data-square="d4"]'); await sleep(300);
  assert.equal(state.moves.length, 2, 'history clicks must not send moves');
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Live').click()`);
  await click('[data-square="d2"]'); await click('[data-square="d4"]');
  await until(() => state?.moves.length === 3, 'live interaction restored');
  for (const [width, height] of [[1280, 800], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await sleep(300);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'no horizontal overflow');
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifacts, `${width}.png`), Buffer.from(screenshot.data, 'base64'));
  }
  console.log(`PASS: packaged LAN replay, read-only history, Live restoration, desktop/mobile overflow. Evidence: ${artifacts}`);
} finally {
  guest?.disconnect();
  if (ws?.readyState === WebSocket.OPEN) {
    void evaluate('window.close()').catch(() => {});
    await sleep(1000);
  }
  ws?.close();
  if (child.exitCode === null) child.kill();
}
