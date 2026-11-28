import { spacePermissionKey } from '../pacafe-desktop/dispatch-permissions.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { TerminalHistory } from '../pacafe-desktop/history.mjs';

test('pages one immutable snapshot oldest-to-newest without repeating or splitting characters', async () => {
  const history = new TerminalHistory();
  const text = ('x'.repeat(100) + '繁😀\n').repeat(380) + 'last';
  let captures = 0;
  const read = () => { ++captures; return { text, truncated: true }; };
  const first = await history.page('linked terminal', null, read);
  assert.ok(first.text.endsWith('last'));
  assert.match(first.before, /^[A-Za-z0-9_-]{1,160}$/);
  assert.equal(first.truncated, true);
  const chunks = [first.text];
  let cursor = first.before;
  while (cursor) {
    const next = await history.page('linked terminal', cursor, read);
    assert.equal(next.truncated, true);
    assert.ok(next.text.length <= 16_000);
    assert.ok(next.text.isWellFormed());
    chunks.unshift(next.text);
    cursor = next.before;
  }
  assert.equal(chunks.join(''), text);
  assert.deepEqual(await history.page('linked terminal', null, read), first);
  assert.equal(captures, 1);
});

test('cursor cannot access a different binding, guess an unissued offset, or retry an expired generation', async () => {
  const history = new TerminalHistory();
  const read = () => ({ text: '😀'.repeat(18_000) + '\nZ' });
  const first = await history.page('first', null, read);
  const second = await history.page('second', null, read);
  assert.notEqual(first.before, second.before);
  const unavailable = { state: 'unavailable' };
  assert.deepEqual(await history.page('first', second.before, () => null), unavailable);
  assert.deepEqual(await history.page('first', first.before.split('_')[0] + '_10000', () => null), unavailable);
  assert.deepEqual(await history.page('first', first.before, () => null, Date.now() + 200_000), unavailable);
  assert.deepEqual(await history.page('new', null, () => null), unavailable);
});

test('an unbroken wide row is paged without losing a surrogate', async () => {
  const history = new TerminalHistory();
  const text = '😀'.repeat(8_001) + 'x';
  const tail = await history.page('Long line', null, () => ({ text }));
  const head = await history.page('Long line', tail.before, () => null);
  assert.equal(head.text + tail.text, text);
  assert.ok(head.text.isWellFormed() && tail.text.isWellFormed());
});

import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

test('native helper negotiates an exact local binding and never captures a working, mismatched, or cached page', { skip: process.platform === 'win32' }, async () => {
  const home = mkdtempSync(join(tmpdir(), 'pa-cafe-history-fixture-'));
  const reports = [];
  const server = createServer(async (req, res) => {
    const pieces = [];
    for await (const body of req) pieces.push(body);
    reports.push(JSON.parse(Buffer.concat(pieces)));
    res.setHeader('Content-Type', 'application/json');
    res.end('{}');
  });
  let socket;
  const helper = fileURLToPath(new URL('../pacafe-desktop/credentials.mjs', import.meta.url));
  const env = { ...process.env, PATH: home + delimiter + process.env.PATH, TEST_HOME: home };
  const cli = async (action, ...args) => JSON.parse((await promisify(execFile)(process.execPath, [helper, action, home, ...args], { env })).stdout);
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const url = `${origin}/api/herdr/desktop/device/4ac64b85-230f-4000-a358-6b85778f4429`;
    const secret = 'hdd_' + 'a'.repeat(43);
    const folder = join(home, 'data', 'pacafe-desktop-link');
    mkdirSync(folder, { recursive: true });
    const put = (path, body) => writeFileSync(path, JSON.stringify(body));
    const profile = { id: 'profile', key: 'codex', on: null, core: 'fixture-core', folder: '/fixture/workspace', lifecycle: 'codex' };
    const session = { id: 'session', task: 'task', profile: profile.id, address: 't1', command: '/fixture/codex' };
    const record = {
      address: session.address, state: 'live', reason: null, pid: 555, created_ms: 999, keep: false,
      cwd: profile.folder, argv: [session.command], foreground: { pid: 555, cwd: profile.folder, argv: [session.command] },
      labels: { 'pacafe.task': session.task, 'pacafe.session': session.id, 'pacafe.profile': profile.id },
      status: { state: 'done', app: 'codex' }, turn: 1, rows: 24,
    };
    put(join(folder, 'target.json'), { origin });
    put(join(folder, 'connection.json'), { url, secret, cafe: 'fixture' });
    put(join(folder, 'dispatch.json'), { device: url, permissions: { version: 1, spaces: [spacePermissionKey(profile)], agents: ['codex'] }, profiles: [profile], sessions: [session] });
    put(join(home, 'terminal'), record);
    const stub = join(home, 'hc');
    writeFileSync(stub, `#!${process.execPath}
const fs = require('fs');
const dir = process.env.TEST_HOME;
const [cmd, term, flag, count] = process.argv.slice(2);
if (cmd === 'server') console.log(JSON.stringify({ core: { id: 'fixture-core' } }));
else if (cmd === 'get' && term === 't1') console.log(fs.readFileSync(dir + '/terminal', 'utf8'));
else if (cmd === 'read' && term === 't1' && flag === '--lines' && count === '10000') {
  fs.appendFileSync(dir + '/reads', 'once\\n');
  console.log(JSON.stringify({ how: 'history', complete: true, text: 'old\\n'.repeat(5000) + '${secret}' }));
} else process.exit(2);
`);
    chmodSync(stub, 0o700);
    socket = await cli('history-start');
    assert.ok(socket);
    const terminal = 't1:555:999';
    const request = '34c64b85-230f-4000-a358-6b85778f4421';
    const view = '44c64b85-230f-4000-a358-6b85778f4421';
    const fetchHistory = (cursor, binding = terminal, viewer = view) =>
      cli('history', socket, url, JSON.stringify({ profile, session, terminal: binding, view: viewer, history: { request, cursor } }));
    assert.equal((await fetchHistory(null, 't1:555:998')).status, 409);
    put(join(home, 'terminal'), { ...record, status: { app: 'codex', state: 'working' } });
    assert.equal((await fetchHistory(null)).status, 200);
    assert.deepEqual(reports.pop().page, { state: 'unavailable' });
    put(join(home, 'terminal'), record);
    assert.equal((await fetchHistory(null)).status, 200);
    const first = reports.pop();
    assert.ok(first.page.text.endsWith('[redacted]'));
    assert.ok(first.page.before);
    assert.equal(first.terminal, terminal);
    assert.equal((await fetchHistory(first.page.before, terminal, '54c64b85-230f-4000-a358-6b85778f4421')).status, 200);
    const second = reports.pop();
    assert.equal(second.page.text + first.page.text, 'old\n'.repeat(5000) + '[redacted]');
    assert.equal(readFileSync(join(home, 'reads'), 'utf8'), 'once\n');
  } finally {
    if (socket) await cli('history-stop', socket).catch(() => {});
    server.close();
    rmSync(home, { recursive: true, force: true });
  }
});
