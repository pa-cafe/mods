import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { spacePermissionKey } from '../pacafe-desktop/dispatch-permissions.js';
import { pendingPermission, permissionKeys } from '../pacafe-desktop/session.js';

const claude = { lifecycle: 'claude' };
const codex = { lifecycle: 'codex' };
const blocked = (status, extra = {}) => ({ status: { state: 'blocked', kind: 'permission', app: 'claude-code', msg: 'approve Bash: touch x', ...status }, status_ms: 10, turn: 1, ...extra });

test('only a permission request the agent reported in full is answerable', () => {
  assert.deepEqual(pendingPermission(claude, blocked({ msg: 'approve Bash: cd build &&\r\n\tmake' })),
    { turn: 1, at: 10, app: 'claude-code', kind: 'permission', msg: 'approve Bash: cd build &&\r\n\tmake', text: 'approve Bash: cd build &&\n\tmake' });
  assert.ok(pendingPermission(codex, blocked({ app: 'codex' })));
  for (const [profile, terminal] of [
    [claude, blocked({ kind: 'question' })], [claude, blocked({ kind: 'auth' })], [claude, blocked({ state: 'working' })],
    [claude, blocked({ app: 'codex' })], [codex, blocked({})], [{ lifecycle: 'generic' }, blocked({})],
    [claude, blocked({ msg: 'x'.repeat(501) })], [claude, blocked({ msg: 'echo ok\rrm -rf /' })], [claude, blocked({ msg: 'line\u001b[2J' })],
    [claude, blocked({ msg: '   ' })],
    ...[0x202e, 0x2066, 0x2069, 0x200b, 0x200d, 0xfeff, 0xad].map(hidden => [claude, blocked({ msg: `approve Bash: rm -rf ${String.fromCodePoint(hidden)}/tmp/x` })]), [claude, blocked({}, { status_ms: null })], [claude, { status: 'blocked', turn: 1, status_ms: 10 }], [claude, null],
  ]) assert.equal(pendingPermission(profile, terminal), null, JSON.stringify(terminal));
});

test('answers with the one key that approves or declines only this request', () => {
  assert.deepEqual(permissionKeys('claude', 'approve'), ['1']);
  assert.deepEqual(permissionKeys('codex', 'approve'), ['y']);
  assert.deepEqual(permissionKeys('claude', 'deny'), ['esc']);
  assert.deepEqual(permissionKeys('codex', 'deny'), ['esc']);
  for (const [lifecycle, answer] of [['generic', 'approve'], ['generic', 'deny'], ['claude', 'always'], ['codex', '1']]) assert.equal(permissionKeys(lifecycle, answer), null);
});

// The real helper against a fake Core (`hc get` and `hc connect`) and a fake cafe.
async function fixture(t, { lifecycle = 'claude', app = 'claude-code', take = { status: 200, answer: 'approve' } } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'pa-cafe-approval-fixture-'));
  const posts = [];
  const server = createServer(async (req, res) => {
    const pieces = [];
    for await (const body of req) pieces.push(body);
    const op = JSON.parse(Buffer.concat(pieces));
    posts.push(op);
    res.setHeader('Content-Type', 'application/json');
    if (op.op === 'approval-take') {
      res.statusCode = take.status;
      res.end(take.status === 200 ? JSON.stringify({ answer: take.answer, remaining: take.remaining ?? 12_000 }) : '{}');
    } else res.end(op.op === 'approval-result' ? '{"ok":true}' : '{}');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.close(); rmSync(home, { recursive: true, force: true }); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const url = `${origin}/api/herdr/desktop/device/4ac64b85-230f-4000-a358-6b85778f4429`;
  const secret = 'hdd_' + 'a'.repeat(43);
  const folder = join(home, 'data', 'pacafe-desktop-link');
  mkdirSync(folder, { recursive: true });
  const put = (path, body) => writeFileSync(path, JSON.stringify(body));
  const profile = { id: 'profile', key: lifecycle, on: null, core: 'fixture-core', folder: '/fixture/workspace', lifecycle };
  const session = { id: 'session', task: 'task', profile: profile.id, address: 't1', command: `/fixture/${lifecycle}` };
  const record = (status, extra = {}) => ({
    address: session.address, state: 'live', reason: null, pid: 555, created_ms: 999, keep: false,
    cwd: profile.folder, argv: [session.command], foreground: { pid: 555, cwd: profile.folder, argv: [session.command] },
    labels: { 'pacafe.task': session.task, 'pacafe.session': session.id, 'pacafe.profile': profile.id },
    status: { app, ...status }, status_ms: 1000, turn: 1, rows: 24, ...extra,
  });
  put(join(folder, 'target.json'), { origin });
  put(join(folder, 'connection.json'), { url, secret, cafe: 'fixture' });
  put(join(folder, 'dispatch.json'), { device: url, permissions: { version: 1, spaces: [spacePermissionKey(profile)], agents: [lifecycle] }, profiles: [profile], sessions: [session] });
  const stub = join(home, 'hc');
  // terminal: what `get` shows. connect-get: what the pipe's terminal.get shows
  // once (a request that changes right before the press). after: the terminal
  // once a key lands; without it the key changes nothing.
  writeFileSync(stub, `#!${process.execPath}
const fs = require('fs');
const dir = process.env.TEST_HOME;
const read = name => JSON.parse(fs.readFileSync(dir + '/' + name, 'utf8'));
const [cmd, term] = process.argv.slice(2);
if (cmd === 'server') console.log(JSON.stringify({ core: { id: 'fixture-core' } }));
else if (cmd === 'get' && term === 't1') console.log(fs.readFileSync(dir + '/terminal', 'utf8'));
else if (cmd === 'connect') {
  let buffer = '';
  process.stdin.on('data', chunk => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf('\\n')) >= 0) {
      const { id, method, params } = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      if (method === 'terminal.get') {
        const swap = fs.existsSync(dir + '/connect-get');
        const live = read(swap ? 'connect-get' : 'terminal');
        if (swap) { fs.rmSync(dir + '/connect-get'); fs.writeFileSync(dir + '/terminal', JSON.stringify(live)); }
        console.log(JSON.stringify({ jsonrpc: '2.0', id, result: live }));
      } else if (method === 'terminal.keys') {
        const live = read('terminal');
        fs.appendFileSync(dir + '/keys', params.keys.join(' ') + '\\n');
        if (fs.existsSync(dir + '/after')) fs.writeFileSync(dir + '/terminal', fs.readFileSync(dir + '/after'));
        console.log(JSON.stringify({ jsonrpc: '2.0', id, result: { status: live.status && live.status.state, turn: live.turn } }));
      }
    }
  });
} else process.exit(2);
`);
  chmodSync(stub, 0o700);
  const env = { ...process.env, PATH: home + delimiter + process.env.PATH, TEST_HOME: home };
  const helper = fileURLToPath(new URL('../pacafe-desktop/credentials.mjs', import.meta.url));
  const cli = async (action, ...args) => JSON.parse((await promisify(execFile)(process.execPath, [helper, action, home, ...args], { env })).stdout);
  const terminal = 't1:555:999';
  const show = (name, value) => put(join(home, name), value);
  const keys = () => existsSync(join(home, 'keys')) ? readFileSync(join(home, 'keys'), 'utf8') : '';
  const report = { task: session.task, session: session.id, status: 'blocked', terminal, canSend: false };
  // The id the cafe would hold: whatever the helper reported at the last sync.
  const reported = async () => {
    await cli('request', url, JSON.stringify({ op: 'sync', profiles: [], reports: [{ ...report, prompt: true }] }));
    return posts.at(-1).reports[0].prompt;
  };
  const answer = prompt => cli('answer', url, JSON.stringify({ profile, session: { id: session.id, address: session.address, task: session.task, command: session.command }, terminal, prompt, id: '34c64b85-230f-4000-a358-6b85778f4421' }));
  const ops = () => posts.filter(op => op.op.startsWith('approval')).map(op => op.outcome ? `${op.op}:${op.outcome}` : op.op);
  return { cli, url, secret, report, record, show, keys, reported, answer, ops, posts };
}

const skip = process.platform === 'win32';

test('reports the request Core shows, only for a blocked report the bridge marked', { skip }, async t => {
  const f = await fixture(t);
  f.show('terminal', f.record({ state: 'blocked', kind: 'permission', msg: `approve Bash: curl -H "Authorization: ${f.secret}"` }));
  await f.cli('request', f.url, JSON.stringify({ op: 'sync', profiles: [], reports: [{ ...f.report, prompt: true }, { ...f.report, task: 'other', session: 'other' }] }));
  const [marked, plain] = f.posts.at(-1).reports;
  assert.match(marked.prompt.id, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(marked.prompt.text, 'approve Bash: curl -H "Authorization: [redacted]"');
  assert.equal('prompt' in plain, false);
  // A question, a different binding or an unknown session sends no request text.
  f.show('terminal', f.record({ state: 'blocked', kind: 'question', msg: 'Which file?' }));
  assert.equal(await f.reported(), undefined);
  f.show('terminal', f.record({ state: 'blocked', kind: 'permission', msg: 'approve Bash: touch x' }, { pid: 556, foreground: { pid: 556, cwd: '/fixture/workspace', argv: ['/fixture/claude'] } }));
  assert.equal(await f.reported(), undefined);
  // The id moves with the request: a new turn or new words are a new request.
  f.show('terminal', f.record({ state: 'blocked', kind: 'permission', msg: 'approve Bash: touch x' }));
  const first = (await f.reported()).id;
  assert.equal((await f.reported()).id, first);
  f.show('terminal', f.record({ state: 'blocked', kind: 'permission', msg: 'approve Bash: touch y' }));
  assert.notEqual((await f.reported()).id, first);
  f.show('terminal', f.record({ state: 'blocked', kind: 'permission', msg: 'approve Bash: touch x' }, { turn: 2, status_ms: 2000 }));
  assert.notEqual((await f.reported()).id, first);
});

for (const [lifecycle, app, given, key] of [['claude', 'claude-code', 'approve', '1'], ['claude', 'claude-code', 'deny', 'esc'], ['codex', 'codex', 'approve', 'y']]) {
  test(`${lifecycle}: presses ${key} for ${given} once, only while the same request is on screen`, { skip }, async t => {
    const f = await fixture(t, { lifecycle, app, take: { status: 200, answer: given } });
    f.show('terminal', f.record({ state: 'blocked', kind: 'permission', msg: 'approve Bash: touch x' }));
    const { id } = await f.reported();
    f.show('after', f.record({ state: given === 'approve' ? 'working' : 'idle' }, { status_ms: 2000 }));
    assert.equal(await f.answer(id), 'sent');
    assert.equal(f.keys(), `${key}\n`);
    assert.deepEqual(f.ops(), ['approval-take', 'approval-result:sent']);
  });
}

test('withdraws without taking or pressing when the request moved on before the desktop looked', { skip }, async t => {
  const f = await fixture(t);
  f.show('terminal', f.record({ state: 'blocked', kind: 'permission', msg: 'approve Bash: touch x' }));
  const { id } = await f.reported();
  f.show('terminal', f.record({ state: 'blocked', kind: 'permission', msg: 'approve Bash: rm -rf build' }, { status_ms: 1500 }));
  assert.equal(await f.answer(id), 'changed');
  assert.equal(f.keys(), '');
  assert.deepEqual(f.ops(), ['approval-result:changed']);
});

test('presses nothing when the request changes between taking the answer and pressing', { skip }, async t => {
  const f = await fixture(t);
  f.show('terminal', f.record({ state: 'blocked', kind: 'permission', msg: 'approve Bash: touch x' }));
  const { id } = await f.reported();
  f.show('connect-get', f.record({ state: 'blocked', kind: 'permission', msg: 'approve Bash: rm -rf build' }, { turn: 2, status_ms: 1500 }));
  assert.equal(await f.answer(id), 'changed');
  assert.equal(f.keys(), '');
  assert.deepEqual(f.ops(), ['approval-take', 'approval-result:changed']);
});

test('presses nothing when the cafe does not hand the answer over', { skip }, async t => {
  const f = await fixture(t, { take: { status: 409 } });
  f.show('terminal', f.record({ state: 'blocked', kind: 'permission', msg: 'approve Bash: touch x' }));
  assert.equal(await f.answer((await f.reported()).id), 'changed');
  assert.equal(f.keys(), '');
  assert.deepEqual(f.ops(), ['approval-take']);
});

test('presses nothing when too little time is left to check the key afterwards', { skip }, async t => {
  const f = await fixture(t, { take: { status: 200, answer: 'approve', remaining: 3500 } });
  f.show('terminal', f.record({ state: 'blocked', kind: 'permission', msg: 'approve Bash: touch x' }));
  assert.equal(await f.answer((await f.reported()).id), 'changed');
  assert.equal(f.keys(), '');
  assert.deepEqual(f.ops(), ['approval-take', 'approval-result:changed']);
});

test('says unknown, not sent, when the request is still on screen after the key', { skip }, async t => {
  const f = await fixture(t);
  f.show('terminal', f.record({ state: 'blocked', kind: 'permission', msg: 'approve Bash: touch x' }));
  assert.equal(await f.answer((await f.reported()).id), 'unknown');
  assert.equal(f.keys(), '1\n');
  assert.deepEqual(f.ops(), ['approval-take', 'approval-result:unknown']);
});
