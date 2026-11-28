// Only the native bridge invokes this helper. The cafe never selects its operations or paths.
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID, webcrypto } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, lstatSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { tmpdir } from 'node:os';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { createConnection, createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { TerminalHistory, historyLines, historyOutputLimit } from './history.mjs';
import { historyRequest, historyCursor } from './history-protocol.js';
import { setTimeout as delay } from 'node:timers/promises';
import { setTimeout, clearTimeout } from 'node:timers';
import { addressMatches, agentMessage, liveBinding, localAliasCandidate, sameMachine, sendStatus, validMessage } from './session.js';

import { permittedProfiles, readPermissions } from './dispatch-permissions.js';
import { codexBindingName, codexHookArguments, hookArguments, replyId, replyName } from './reply-hook.mjs';
import { syncTokscale, usageHelperAvailable } from './tokscale.mjs';

const [action, home, ...args] = process.argv.slice(2);
const folder = join(home, 'data', 'pacafe-desktop-link');
const info = new TextEncoder().encode('pa-cafe herdr link v1');
const { subtle } = webcrypto;
const defaultOrigin = 'https://pacafe.dnplus.dev';
function cafeOrigin(input) {
  const url = new URL(input);
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (!(url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid cafe origin');
  return url;
}
const origin = cafeOrigin(read('target.json')?.origin || process.env.PACAFE_DESKTOP_ORIGIN || defaultOrigin);
const target = url => ({
  origin: url.origin,
  kind: url.origin === defaultOrigin ? 'official' : ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ? 'local' : 'custom',
});

function write(name, value) {
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const target = join(folder, name);
  const temp = join(folder, randomUUID());
  writeFileSync(temp, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
  try { renameSync(temp, target); } finally { rmSync(temp, { force: true }); }
}
function read(name) {
  try { return JSON.parse(readFileSync(join(folder, name), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
const erase = name => rmSync(join(folder, name), { force: true });
function eraseReplies(state = null) {
  try {
    for (const name of readdirSync(folder)) {
      const id = /^(?:reply-|codex-thread-)([a-f0-9-]+)\.json$/.exec(name)?.[1];
      if (!replyId(id)) continue;
      const row = state?.sessions?.find(row => row.id === id);
      if (row?.replyPolicy !== 1 || !replyId(row.replyNonce)) {
        erase(replyName(id));
        erase(codexBindingName(id));
      }
    }
  } catch { /* Reply capture is optional. */ }
}
const emit = value => process.stdout.write(JSON.stringify(value));
const bytes = value => Buffer.from(value, 'base64url');
const link = '/api/herdr/desktop/link';
const runCore = promisify(execFile);
const coreBinary = process.platform === 'win32' ? 'herdr-core.exe' : 'hc';

async function post(path, data, secret, signal = AbortSignal.timeout(5000)) {
  const response = await fetch(new URL(path, origin), {
    method: 'POST', redirect: 'error',
    headers: { 'Content-Type': 'application/json', ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
    body: JSON.stringify(data), signal,
  });
  return { status: response.status, body: response.ok ? await response.json() : null };
}
async function pairing(path, data) {
  const { status, body } = await post(path, data);
  if (!body) throw new Error(`Pairing returned HTTP ${status}`);
  return body;
}
const publicConnection = value => value && ({ url: value.url, cafe: value.cafe, usageHelperAvailable: usageHelperAvailable() });
async function coreJson(args, { timeout = 2000, maxBuffer = 262_144 } = {}) {
  try {
    const { stdout } = await runCore(coreBinary, [...args, '--json'], { timeout, maxBuffer });
    return JSON.parse(stdout);
  } catch { throw new Error('Herdr Core could not read this session.'); }
}

function stillApproved(device, profile, session) {
  const state = read('dispatch.json');
  return connection(read('connection.json'))?.secret === device.secret && state?.device === device.url &&
    permittedProfiles(readPermissions(state.permissions), state.profiles).some(row => row.id === profile.id && JSON.stringify(row) === JSON.stringify(profile)) &&
    state.sessions.some(row => row.task === session.task && row.profile === profile.id && row.id === session.id &&
      row.address === session.address && row.command === session.command);
}

async function liveTerminal(device, { profile, session, terminal }) {
  if (typeof terminal !== 'string' || !terminal || !stillApproved(device, profile, session) ||
      !addressMatches(profile, session.address) || !await sameMachine(profile, coreJson)) return null;
  const live = await coreJson(['get', session.address]);
  let binding = liveBinding(profile, session, live);
  const alias = !binding && process.platform === 'darwin' && localAliasCandidate(profile, live);
  if (alias) {
    try { if (realpathSync(profile.folder) === alias) binding = liveBinding(profile, session, live, alias); } catch { return null; }
  }
  return binding === terminal && stillApproved(device, profile, session) ? live : null;
}

const historyDirectory = /^\/tmp\/pacafe-herdr-history-[a-zA-Z0-9]{6}$/;
const onHistoryPlatform = ['darwin', 'linux'].includes(process.platform);
const historySocket = directory => {
  if (!onHistoryPlatform || !historyDirectory.test(directory)) throw new Error('History is unavailable.');
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) throw new Error('History is unavailable.');
  return join(directory, 'requests');
};
function localHistoryRequest(directory, request) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(historySocket(directory));
    socket.setTimeout(13_000, () => socket.destroy(new Error('History timed out.')));
    socket.setEncoding('utf8');
    socket.once('error', reject);
    let body = '';
    socket.on('data', chunk => {
      body += chunk;
      if (body.length > 32_768) socket.destroy(new Error('Invalid history response.'));
    });
    socket.once('end', () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
    socket.once('connect', () => socket.write(`${JSON.stringify(request)}\n`));
  });
}
async function startHistory() {
  if (!onHistoryPlatform) return null;
  const directory = mkdtempSync('/tmp/pacafe-herdr-history-');
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'history-serve', home, directory],
    { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => {});
  child.unref();
  try {
    for (let tries = 0; tries < 30; ++tries) {
      if (await localHistoryRequest(directory, { ping: true }).catch(() => false)) return directory;
      await delay(35);
    }
  } catch { /* Failing to start history does not affect dispatch. */ }
  child.kill();
  rmSync(directory, { recursive: true, force: true });
  return null;
}
async function uploadHistory(cache, request) {
  const { url, target } = request;
  const value = connection(read('connection.json'));
  if (!value || value.url !== url) return { status: 403, body: null };
  const { session, profile, terminal, view, history } = target;
  if (!historyRequest(view) || !historyRequest(history?.request) ||
      !(history.cursor === null || historyCursor(history.cursor))) return { status: 409, body: null };
  const envelope = { op: 'history-page', task: session.task, session: session.id, terminal, view, request: history.request };
  if (profile.on !== null) return post(value.url, { ...envelope, page: { state: 'unavailable' } }, value.secret);
  const candidate = await liveTerminal(value, target);
  if (!candidate) return { status: 409, body: null };
  const ready = live => live && Number.isSafeInteger(live.turn) && ['idle', 'done'].includes(sendStatus(profile, live));
  const generation = JSON.stringify([value.secret, session.task, session.id, terminal]);
  let page = await cache.page(generation, history.cursor, async () => {
    if (!ready(candidate)) return null;
    const reading = await coreJson(['read', session.address, '--lines', String(historyLines)],
      { timeout: 3500, maxBuffer: historyOutputLimit }).catch(() => null);
    const current = await liveTerminal(value, target);
    if (!ready(current) || current.turn !== candidate.turn || !reading || typeof reading.text !== 'string' ||
        !['history', 'screen', 'stitched'].includes(reading.how)) return null;
    const text = reading.text.replaceAll(value.secret, '[redacted]').replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/gu, '');
    const lines = text.split('\n').length;
    return { text, truncated: reading.complete !== true || lines >= historyLines + current.rows || reading.how === 'stitched' };
  });
  if (!await liveTerminal(value, target)) return { status: 409, body: null };
  return post(value.url, { ...envelope, page }, value.secret);
}
async function serveHistory(directory) {
  const socketPath = historySocket(directory);
  const cache = new TerminalHistory();
  let expiry;
  const renew = () => {
    clearTimeout(expiry);
    expiry = setTimeout(() => process.exit(0), 185_000);
  };
  renew();
  process.once('exit', () => { try { rmSync(directory, { recursive: true, force: true }); } catch {} });
  let pending = false;
  const server = createServer(socket => {
    socket.setTimeout(13_000, () => socket.destroy());
    socket.on('error', () => {});
    socket.setEncoding('utf8');
    let body = '';
    const receive = async chunk => {
      body += chunk;
      if (body.length > 128_000) { socket.destroy(); return; }
      if (!body.endsWith('\n')) return;
      socket.removeListener('data', receive);
      try {
        const request = JSON.parse(body);
        if (request?.ping === true) { socket.end('true'); return; }
        if (request?.stop === true) { socket.end('true'); process.exit(0); }
        if (pending) { socket.end(JSON.stringify({ status: 409, body: null })); return; }
        pending = true;
        try {
          renew();
          socket.end(JSON.stringify(await uploadHistory(cache, request)));
        } finally { pending = false; }
      } catch { socket.end(JSON.stringify({ status: 409, body: null })); }
    };
    socket.on('data', receive);
  });
  server.maxConnections = 8;
  server.listen(socketPath);
}

function sendToCore(address, text, status, signal) {
  return new Promise(resolve => {
    // Use the supported JSON-RPC pipe so the message stays out of process arguments.
    const child = execFile(coreBinary, ['connect'], { signal, maxBuffer: 32_768 }, (error, stdout) => {
      if (error) { resolve('unknown'); return; }
      try {
        const { id, result, error: refused } = JSON.parse(stdout);
        if (id === 1 && Number.isSafeInteger(result?.turn) && typeof result.status === 'string') resolve('sent');
        else if (id === 1 && ['blocked', 'status_mismatch', 'not_found', 'finished'].includes(refused?.data?.kind)) resolve('refused');
        else resolve('unknown');
      } catch { resolve('unknown'); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'terminal.send', params: {
      terminal: address, text, ...(status === 'done' ? {} : { if: status }),
    } })}\n`);
  });
}

const fileByteLimit = 256 * 1024;
async function attachmentBytes(device, request, signal) {
  const response = await fetch(device.url, {
    method: 'POST', redirect: 'error', signal,
    headers: { Authorization: `Bearer ${device.secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'file', ...request }),
  });
  const size = Number(response.headers.get('Content-Length'));
  if (!response.ok || !response.body || !Number.isSafeInteger(size) || size <= 0 || size > fileByteLimit) return null;
  const reader = response.body.getReader();
  const data = new Uint8Array(size);
  let offset = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return offset === size ? data : null;
      if (offset + value.length > size) return null;
      data.set(value, offset);
      offset += value.length;
    }
  } finally { await reader.cancel().catch(() => undefined); }
}

async function putAttachment(device, target, request, extension, signal, authorized) {
  const data = await attachmentBytes(device, request, signal).catch(() => null);
  if (!data || signal.aborted) return { outcome: 'refused' };
  const staging = mkdtempSync(join(tmpdir(), 'pa-cafe-herdr-'));
  try {
    const file = join(staging, `attachment.${/^[a-z0-9]{1,8}$/.test(extension) ? extension : 'bin'}`);
    writeFileSync(file, data, { flag: 'wx', mode: 0o600 });
    if (!sendStatus(target.profile, await liveTerminal(device, target)) || !await authorized() || signal.aborted) return { outcome: 'refused' };
    // A put interrupted after starting has an ambiguous side effect. Never retry it.
    const { stdout } = await runCore(coreBinary, ['put', target.session.address, file, '--json'], { signal, maxBuffer: 4096 });
    const result = JSON.parse(stdout);
    // eslint-disable-next-line no-control-regex
    if (result.bytes !== data.length || typeof result.path !== 'string' || !isAbsolute(result.path) || result.path.length > 800 || /[\x00-\x1f\x7f-\x9f\u2028\u2029]/u.test(result.path)) return { outcome: 'unknown' };
    return { path: result.path };
  } catch { return { outcome: 'unknown' }; }
  finally { rmSync(staging, { recursive: true, force: true }); }
}

async function deliver(device, target) {
  const { profile, session, terminal, input, file } = target;
  const request = { task: session.task, session: session.id, terminal, id: input };
  if (!sendStatus(profile, await liveTerminal(device, target))) return;
  const requestStarted = Date.now();
  const { body } = await post(device.url, { op: file === true ? 'take-file' : 'take', ...request }, device.secret);
  if (!body) return;
  const remaining = Number.isSafeInteger(body.remaining) ? requestStarted + body.remaining - Date.now() : 0;
  const ack = outcome => post(device.url, { op: 'result', ...request, outcome }, device.secret);
  if (!validMessage(body.text) || !Number.isSafeInteger(remaining) || remaining <= 0 || remaining > 9000) {
    await ack('refused');
    return;
  }
  const controller = new globalThis.AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(remaining)]);
  const authorized = async () => {
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(1500)]);
    const answer = await post(device.url, { op: 'check', ...request }, device.secret, deadline);
    return answer.body?.ok === true;
  };
  // Core cancels a pending send when its caller disconnects. Keep checking the
  // lease and terminal while Core is holding for a local draft or delivering.
  const monitor = async () => {
    while (!signal.aborted) {
      await delay(500, undefined, { signal });
      if (!stillApproved(device, profile, session) || !await authorized() || !await liveTerminal(device, target)) controller.abort();
    }
  };
  const watch = monitor().catch(() => controller.abort());
  try {
    let attachment;
    if (file === true && profile.on !== null) { return await ack('refused'); }
    if (file === true) {
      const result = await putAttachment(device, target, request, body.extension ?? '', signal, authorized);
      if (!result.path) { return await ack(result.outcome); }
      attachment = result.path;
    }
    const live = await liveTerminal(device, target);
    const status = sendStatus(profile, live);
    if (!status || signal.aborted || !await authorized() || !stillApproved(device, profile, session)) {
      return await ack(attachment ? 'file-only' : 'refused');
    }
    const outcome = await sendToCore(session.address, agentMessage(attachment ? `${body.text} (Read the attached file at ${attachment}.)` : body.text), status, signal);
    await ack(attachment && outcome === 'refused' ? 'file-only' : outcome);
  } finally {
    controller.abort();
    await watch;
  }
}

async function openHandover(privateKey, sealed) {
  if (sealed?.v !== 1) throw new Error('Invalid pairing response');
  const own = await subtle.importKey('jwk', privateKey, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const peer = await subtle.importKey('raw', bytes(sealed.epk), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: peer }, own, 256);
  const hkdf = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  const key = await subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(), info }, hkdf, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return JSON.parse(new TextDecoder().decode(await subtle.decrypt({ name: 'AES-GCM', iv: bytes(sealed.iv), additionalData: info }, key, bytes(sealed.ct))));
}
function connection(value) {
  if (!value) return null;
  const url = new URL(value.url);
  if (url.origin !== origin.origin || url.username || url.password || url.search || url.hash ||
      !/^\/api\/herdr\/desktop\/device\/[a-f0-9-]{36}$/.test(url.pathname) ||
      !/^hdd_[A-Za-z0-9_-]{43}$/.test(value.secret) || typeof value.cafe !== 'string') throw new Error('Invalid desktop connection');
  return value;
}

const wakeProtocol = 'pacafe-herdr-wake-v1';
async function waitWake(device, mode) {
  if (typeof globalThis.WebSocket !== 'function') return 'legacy';
  const url = new URL(`${device.url}/wake`);
  let settled = mode === 'settled';
  if (mode === 'check' || mode === 'check-settled') {
    const support = await fetch(url, { redirect: 'error', headers: { Authorization: `Bearer ${device.secret}` }, signal: AbortSignal.timeout(4_000) }).catch(() => null);
    if (support?.status === 404 || support?.status === 405) return 'legacy';
    if (support?.status === 403) return 'revoked';
    const capability = support?.ok && await support.json().catch(() => null);
    if (capability?.protocol !== wakeProtocol) return 'retry';
    settled = capability.settled === true;
    if (!settled && mode === 'check-settled') return 'unsupported-settled';
  }
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return new Promise(resolve => {
    const socket = new globalThis.WebSocket(url, [wakeProtocol, device.secret]);
    let end = setTimeout(() => finish('retry'), 5_000);
    let finished = false;
    function finish(outcome) {
      if (finished) return;
      finished = true;
      clearTimeout(end);
      if (socket.readyState < 2) socket.close(1000);
      resolve(settled && ['wake', 'idle'].includes(outcome) ? `${outcome}-settled` : outcome);
    }
    socket.addEventListener('open', () => {
      if (socket.protocol !== wakeProtocol) return finish('retry');
      clearTimeout(end);
      // Herdr's exec API is necessarily bounded. The next wait reconnects.
      end = setTimeout(() => finish('idle'), 90_000);
    }, { once: true });
    socket.addEventListener('message', event => finish(event.data === 'wake' ? 'wake' : 'retry'), { once: true });
    socket.addEventListener('close', event => finish(event.code === 4001 ? 'revoked' : 'retry'), { once: true });
    socket.addEventListener('error', () => finish('retry'), { once: true });
  });
}

switch (action) {
  case 'target': emit(target(origin)); break;
  case 'pending': {
    const pending = read('pending.json');
    emit(pending?.origin === origin.origin && pending.expiresAt > Date.now() && /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(pending.userCode)
      ? { userCode: pending.userCode, expiresAt: pending.expiresAt, verificationUrl: new URL(`/?herdrDesktop=${pending.userCode}`, origin).href } : null);
    break;
  }
  case 'set-target': {
    try {
      const selected = cafeOrigin(args[0]?.trim());
      const changed = selected.origin !== origin.origin;
      if (changed && (read('connection.json') || read('pending.json')?.expiresAt > Date.now())) { emit({ error: 'linked' }); break; }
      write('target.json', { origin: selected.origin });
      if (changed) erase('pending.json');
      emit(target(selected));
    } catch { emit({ error: 'invalid' }); }
    break;
  }
  case 'pair': {
    const key = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const publicKey = Buffer.from(await subtle.exportKey('raw', key.publicKey)).toString('base64url');
    const result = await post(link, { label: args[0], publicKey }).catch(() => null);
    if (!result?.body) { emit({ error: result?.status ?? 'offline' }); break; }
    const { deviceCode, userCode, expiresAt } = result.body;
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(userCode) || !/^hd_[A-Za-z0-9_-]{43}$/.test(deviceCode) ||
        !Number.isSafeInteger(expiresAt)) throw new Error('Invalid pairing code');
    write('pending.json', { deviceCode, userCode, expiresAt, origin: origin.origin, privateKey: await subtle.exportKey('jwk', key.privateKey) });
    emit({ userCode, expiresAt, verificationUrl: new URL(`/?herdrDesktop=${userCode}`, origin).href });
    break;
  }
  case 'poll': {
    const pending = read('pending.json');
    if (!pending || pending.expiresAt <= Date.now()) { erase('pending.json'); emit({ status: 'expired' }); break; }
    if (pending.origin && pending.origin !== origin.origin) { emit({ status: 'expired' }); break; }
    const result = await pairing(`${link}/poll`, { deviceCode: pending.deviceCode });
    if (result.status === 'approved') {
      const value = connection(await openHandover(pending.privateKey, result.sealed));
      if (!value) throw new Error('Invalid desktop connection');
      write('connection.json', value);
      erase('pending.json');
      emit({ status: result.status, connection: publicConnection(value) });
    } else {
      if (result.status === 'expired' || result.status === 'denied') erase('pending.json');
      emit({ status: result.status });
    }
    break;
  }
  case 'load': {
    if (read('pending.json')?.expiresAt <= Date.now()) erase('pending.json');
    emit(publicConnection(connection(read('connection.json'))));
    break;
  }
  case 'load-state':
  case 'save-state': {
    const device = connection(read('connection.json'));
    if (!device || device.url !== args[0]) throw new Error('The paired device changed');
    if (action === 'load-state') {
      const state = read('dispatch.json');
      const permissions = readPermissions(state?.permissions);
      emit(state?.device === device.url ? { permissions, profiles: permittedProfiles(permissions, state.profiles),
        sessions: state.sessions, keepAwake: state.keepAwake } : null);
    } else {
      const { permissions, profiles, sessions, keepAwake } = JSON.parse(args[1]);
      const approved = readPermissions(permissions);
      const state = { device: device.url, permissions: approved, profiles: permittedProfiles(approved, profiles), sessions, keepAwake };
      write('dispatch.json', state);
      eraseReplies(state);
      emit(null);
    }
    break;
  }
  case 'reply-args': {
    const value = connection(read('connection.json'));
    const session = args[1];
    const lifecycle = args[2] ?? 'claude';
    const state = read('dispatch.json');
    if (process.platform === 'win32' || !['codex', 'claude'].includes(lifecycle) || value?.url !== args[0] ||
        state?.device !== value?.url || !replyId(session)) {
      emit(null); break;
    }
    const nonce = randomUUID();
    const hook = lifecycle === 'codex' ? codexHookArguments : hookArguments;
    emit({ nonce, args: hook(process.execPath, join(home, 'mods', 'pacafe-desktop', 'reply-hook.mjs'), folder, session, nonce) });
    break;
  }
  case 'reply-upload': {
    const value = connection(read('connection.json'));
    const target = JSON.parse(args[1]);
    const { session, terminal } = target;
    const codex = session.replyLifecycle === 'codex';
    const allowed = () => {
      const state = read('dispatch.json');
      const lifecycle = codex ? 'codex' : 'claude';
      return state?.device === value?.url && state.sessions.some(row => row.id === session.id &&
        row.replyPolicy === 1 && row.replyNonce === session.replyNonce && row.replyLifecycle === lifecycle) &&
        (!target.profile || (target.profile.lifecycle === lifecycle && target.profile.on === null && stillApproved(value, target.profile, session)));
    };
    if (!value || value.url !== args[0] || !replyId(session.id) || !replyId(session.replyNonce) || !allowed()) { emit(null); break; }
    const file = replyName(session.id);
    const reply = read(file);
    // Core can report a finished turn before the Stop hook writes the
    // capture. The bridge checks again with its bounded per-turn backoff.
    if (!reply) { emit({ retry: true }); break; }
    if (reply.nonce !== session.replyNonce || (reply.lifecycle === 'codex') !== codex || !replyId(reply.id) || typeof reply.text !== 'string') { emit(null); break; }
    if (!Number.isSafeInteger(reply.time) || Date.now() - reply.time > 45_000) { erase(file); emit(null); break; }
    const live = await liveTerminal(value, target);
    const agent = live?.report ?? live?.status;
    const status = typeof live?.status === 'string' ? live.status : agent?.state;
    if (!live || !allowed() || !(codex ? agent?.app === 'codex' : ['claude-code', 'claude'].includes(agent?.app)) || status !== 'done') { emit({ retry: allowed() }); break; }
    const result = await post(value.url, { op: 'reply', task: session.task, session: session.id, terminal, id: reply.id,
      text: reply.text.replaceAll(value.secret, '[redacted]') }, value.secret);
    if (result.status === 200 && read(file)?.id === reply.id) erase(file);
    emit({ retry: [408, 409, 425, 429].includes(result.status) || result.status >= 500 });
    break;
  }
  case 'wake': {
    const value = connection(read('connection.json'));
    if (!value || value.url !== args[0]) { emit('revoked'); break; }
    emit(await waitWake(value, args[1]).catch(() => 'retry'));
    break;
  }
  case 'request': {
    const value = connection(read('connection.json'));
    if (!value || value.url !== args[0]) { emit({ status: 403, body: null }); break; }
    const op = JSON.parse(args[1]);
    if (!['sync', 'claim', 'disconnect'].includes(op.op)) throw new Error('Invalid device request');
    emit(await post(value.url, op, value.secret));
    break;
  }
  case 'history-start': emit(await startHistory()); break;
  case 'history-stop': emit(await localHistoryRequest(args[0], { stop: true }).catch(() => null)); break;
  case 'history-serve': await serveHistory(args[0]); break;
  case 'history': {
    const result = await localHistoryRequest(args[0], { url: args[1], target: JSON.parse(args[2]) }).catch(() => null);
    emit(result ?? { status: 410, body: null });
    break;
  }
  case 'frame': {
    const value = connection(read('connection.json'));
    if (!value || value.url !== args[0]) { emit({ status: 403, body: null }); break; }
    const target = JSON.parse(args[1]);
    const { session, terminal, view } = target;
    if (!await liveTerminal(value, target)) { emit({ status: 409, body: null }); break; }
    const screen = await coreJson(['read', session.address, '--lines', '0']);
    if (screen.how !== 'screen' || typeof screen.text !== 'string' || !await liveTerminal(value, target)) { emit({ status: 409, body: null }); break; }
    const text = screen.text.replaceAll(value.secret, '[redacted]').slice(0, 16_000);
    emit(await post(value.url, { op: 'frame', task: session.task, session: session.id, terminal, view, text }, value.secret));
    break;
  }
  case 'deliver': {
    const value = connection(read('connection.json'));
    if (value?.url === args[0]) await deliver(value, JSON.parse(args[1]));
    emit(null);
    break;
  }
  case 'forget': erase('connection.json'); erase('pending.json'); erase('dispatch.json'); eraseReplies(); emit(null); break;
  case 'cancel': erase('pending.json'); emit(null); break;
  case 'owned-space': {
    const [core] = args;
    if (typeof core !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(core)) throw new Error('Invalid Core identity');
    // A Core's ID persists across app and device reconnects. Namespace its ID
    // without collecting a path, account, machine nickname or mutable Space name.
    emit(`sp-pacafe-${createHash('sha256').update('pa-cafe:herdr-space:v1\0').update(core).digest('hex').slice(0, 24)}`);
    break;
  }
  case 'id': emit(randomUUID()); break;
  case 'tokscale-usage': {
    const paired = connection(read('connection.json'));
    if (!paired || args[0] !== paired.url) { emit({ history: 'disconnected', quota: 'disconnected' }); break; }
    if (!usageHelperAvailable()) { emit({ history: 'unavailable', quota: 'unavailable' }); break; }
    emit(await syncTokscale(origin.origin, {
      mode: args[1], house: paired.house,
      lockFile: join(folder, 'tokscale-upload.lock'),
      permitted: () => {
        try { return connection(read('connection.json'))?.secret === paired.secret; }
        catch { return false; }
      },
    }).catch(() => ({ history: 'unavailable', quota: 'unavailable' })));
    break;
  }
  default: throw new Error('Unknown desktop operation');
}
