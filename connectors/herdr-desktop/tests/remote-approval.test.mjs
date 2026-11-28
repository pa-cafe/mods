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
import { approvesOnce, pendingPermission, permissionKeys } from '../pacafe-desktop/session.js';

const claude = { lifecycle: 'claude' };
const codex = { lifecycle: 'codex' };
const blocked = (status, extra = {}) => ({ status: { state: 'blocked', kind: 'permission', app: 'claude-code', msg: 'approve Bash: touch x', ...status }, status_ms: 10, turn: 1, ...extra });

test('only a tool request the agent named is answerable, never a bare label or the plan dialog', () => {
  assert.deepEqual(pendingPermission(claude, blocked({ msg: 'approve Bash: cd build &&\r\n\tmake' })),
    { turn: 1, at: 10, app: 'claude-code', kind: 'permission', msg: 'approve Bash: cd build &&\r\n\tmake', text: 'approve Bash: cd build &&\n\tmake' });
  assert.ok(pendingPermission(codex, blocked({ app: 'codex' })));
  for (const [profile, terminal] of [
    [claude, blocked({ kind: 'question' })], [claude, blocked({ kind: 'auth' })], [claude, blocked({ state: 'working' })],
    [claude, blocked({ app: 'codex' })], [codex, blocked({})], [{ lifecycle: 'generic' }, blocked({})],
    [claude, blocked({ msg: 'x'.repeat(501) })], [claude, blocked({ msg: 'echo ok\rrm -rf /' })], [claude, blocked({ msg: 'line\u001b[2J' })],
    [claude, blocked({ msg: '   ' })],
    ...['permission prompt', 'approve plan', 'sandbox request', 'goal proposal', 'approve ExitPlanMode: plan', 'approve mcp__x__y', 'approve mcp__x__y: mcp__x__y', 'approve Bash: npm run build…'].map(msg => [claude, blocked({ msg })]),
    [codex, blocked({ app: 'codex', msg: 'permission prompt' })],
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

const claudeDialog = first => [
  '⏺ Bash(touch x)', '', ' Bash command', '', '   touch x', '   Create the file', '', ' Do you want to proceed?',
  ` ❯ 1. ${first}`, '   2. Yes, and don\'t ask again for touch commands in /fixture/workspace', '   3. No, and tell Claude what to do differently (esc)', '',
].join('\n');
const codexDialog = (first, second = 'Yes, and don\'t ask again for this command in this session (p)') => [
  '  Would you like to run the following command?', '', '  $ touch x', '', `› 1. ${first}`, `  2. ${second}`,
  '  3. No, and tell Codex what to do differently (esc)', '', '  Press enter to confirm or esc to cancel',
].join('\n');

test('approves only when the key picks the once-only Yes on the dialog itself', () => {
  assert.equal(approvesOnce('claude', claudeDialog('Yes')), true);
  assert.equal(approvesOnce('claude', `╭──────╮\n│ ❯ 1. Yes                      │\n│   2. No (esc)                 │\n╰──────╯`), true);
  assert.equal(approvesOnce('codex', codexDialog('Yes, proceed (y)')), true);
  for (const [lifecycle, screen] of [
    ['claude', claudeDialog('Yes, clear context and bypass permissions')], ['claude', claudeDialog('Yes, and use auto mode')],
    ['claude', claudeDialog('Yes, and don\'t ask again')], ['claude', ' ❯ 1. No\n   2. Yes'], ['claude', ' ❯ 1. Yes'],
    // A "1. Yes" in the transcript above a dialog whose own first option is something else.
    ['claude', `1. Yes\n2. Maybe\n${claudeDialog('Yes, and manually approve edits')}`], ['claude', 'Working…'],
    ['codex', codexDialog('Yes, just this once (y)')], ['codex', codexDialog('Yes, proceed')],
    ['codex', codexDialog('Yes, proceed', 'Yes, and allow this host for this conversation (y)')], ['codex', claudeDialog('Yes')],
    ['generic', claudeDialog('Yes')], ['claude', null], ['claude', undefined],
  ]) assert.equal(approvesOnce(lifecycle, screen), false, `${lifecycle}: ${screen}`);
});

// The real helper against a fake Core (`hc get` and `hc connect`) and a fake cafe.
async function fixture(t, { lifecycle = 'claude', app = 'claude-code', take = { status: 200, answer: 'approve' }, onTake } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'pa-cafe-approval-fixture-'));
  const posts = [];
  const server = createServer(async (req, res) => {
    const pieces = [];
    for await (const body of req) pieces.push(body);
    const op = JSON.parse(Buffer.concat(pieces));
    posts.push(op);
    res.setHeader('Content-Type', 'application/json');
    if (op.op === 'approval-take') {
      onTake?.();
      res.statusCode = take.status;
      const taker = 'taker' in take ? take.taker : 'Q2lQb3RoZXJUYWtlck5vbmNlMQ';
      res.end(take.status === 200 ? JSON.stringify({ answer: take.answer, remaining: take.remaining ?? 12_000, ...(taker && { taker }) }) : '{}');
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
  const dispatch = permissions => put(join(folder, 'dispatch.json'), { device: url, permissions, profiles: [profile], sessions: [session] });
  put(join(folder, 'target.json'), { origin });
  put(join(folder, 'connection.json'), { url, secret, cafe: 'fixture' });
  dispatch({ version: 1, spaces: [spacePermissionKey(profile)], agents: [lifecycle] });
  const stub = join(home, 'hc');
  // terminal: what `get` shows. connect-get: what the pipe's terminal.get shows
  // once (a request that changes right before the press). screen: the dialog
  // terminal.read shows. after: the terminal once a key lands; without it the
  // key changes nothing. keys-result: Core's answer to the key. hold: how long
  // Core holds the key, as it does while a person is typing. drop: the
  // connection ends right after the key request.
  writeFileSync(stub, `#!${process.execPath}
const fs = require('fs');
const dir = process.env.TEST_HOME;
const read = name => JSON.parse(fs.readFileSync(dir + '/' + name, 'utf8'));
const has = name => fs.existsSync(dir + '/' + name);
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
      const reply = result => console.log(JSON.stringify({ jsonrpc: '2.0', id, result }));
      if (method === 'terminal.read') reply({ text: read('screen'), complete: true, how: 'screen' });
      else if (method === 'terminal.get') {
        const swap = has('connect-get');
        const live = read(swap ? 'connect-get' : 'terminal');
        if (swap) { fs.rmSync(dir + '/connect-get'); fs.writeFileSync(dir + '/terminal', JSON.stringify(live)); }
        reply(live);
      } else if (method === 'terminal.keys') {
        const live = read('terminal');
        fs.appendFileSync(dir + '/keys', params.keys.join(' ') + '\\n');
        if (has('drop')) process.exit(0);
        const press = () => {
          if (has('after')) fs.writeFileSync(dir + '/terminal', fs.readFileSync(dir + '/after'));
          reply(has('keys-result') ? read('keys-result') : { status: live.status && live.status.state, turn: live.turn });
        };
        if (has('hold')) setTimeout(press, read('hold')); else press();
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
  show('screen', lifecycle === 'codex' ? codexDialog('Yes, proceed (y)') : claudeDialog('Yes'));
  const keys = () => existsSync(join(home, 'keys')) ? readFileSync(join(home, 'keys'), 'utf8') : '';
  const report = { task: session.task, session: session.id, status: 'blocked', terminal, canSend: false };
  // The id the cafe would hold: whatever the helper reported at the last sync.
  const reported = async () => {
    await cli('request', url, JSON.stringify({ op: 'sync', profiles: [], reports: [{ ...report, prompt: true }] }));
    return posts.at(-1).reports[0].prompt;
  };
  const answer = prompt => cli('answer', url, JSON.stringify({ profile, session: { id: session.id, address: session.address, task: session.task, command: session.command }, terminal, prompt, id: '34c64b85-230f-4000-a358-6b85778f4421' }));
  const ops = () => posts.filter(op => op.op.startsWith('approval')).map(op => (op.outcome ? `${op.op}:${op.outcome}` : op.op) + (op.taker ? '+taker' : ''));
  const revoke = () => dispatch({ version: 1, spaces: [spacePermissionKey(profile)], agents: [] });
  return { cli, url, secret, report, record, show, keys, reported, answer, ops, posts, revoke };
}

const skip = process.platform === 'win32';
const waiting = { state: 'blocked', kind: 'permission', msg: 'approve Bash: touch x' };

test('reports the request Core shows, only for a blocked report the bridge marked', { skip }, async t => {
  const f = await fixture(t);
  f.show('terminal', f.record({ state: 'blocked', kind: 'permission', msg: `approve Bash: curl -H "Authorization: ${f.secret}"` }));
  await f.cli('request', f.url, JSON.stringify({ op: 'sync', profiles: [], reports: [{ ...f.report, prompt: true }, { ...f.report, task: 'other', session: 'other' }] }));
  const [marked, plain] = f.posts.at(-1).reports;
  assert.match(marked.prompt.id, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(marked.prompt.text, 'approve Bash: curl -H "Authorization: [redacted]"');
  assert.equal('prompt' in plain, false);
  // A question, the plan dialog, a bare label, a different binding or an unknown session sends no request text.
  for (const status of [{ state: 'blocked', kind: 'question', msg: 'Which file?' }, { ...waiting, msg: 'approve plan' }, { ...waiting, msg: 'permission prompt' }]) {
    f.show('terminal', f.record(status));
    assert.equal(await f.reported(), undefined, status.msg);
  }
  f.show('terminal', f.record(waiting, { pid: 556, foreground: { pid: 556, cwd: '/fixture/workspace', argv: ['/fixture/claude'] } }));
  assert.equal(await f.reported(), undefined);
  // The id moves with the request: a new turn or new words are a new request.
  f.show('terminal', f.record(waiting));
  const first = (await f.reported()).id;
  assert.equal((await f.reported()).id, first);
  f.show('terminal', f.record({ ...waiting, msg: 'approve Bash: touch y' }));
  assert.notEqual((await f.reported()).id, first);
  f.show('terminal', f.record(waiting, { turn: 2, status_ms: 2000 }));
  assert.notEqual((await f.reported()).id, first);
});

for (const [lifecycle, app, given, key] of [['claude', 'claude-code', 'approve', '1'], ['claude', 'claude-code', 'deny', 'esc'], ['codex', 'codex', 'approve', 'y'], ['codex', 'codex', 'deny', 'esc']]) {
  test(`${lifecycle}: presses ${key} for ${given} once, only while the same request is on screen`, { skip }, async t => {
    const f = await fixture(t, { lifecycle, app, take: { status: 200, answer: given } });
    f.show('terminal', f.record(waiting));
    const { id } = await f.reported();
    f.show('after', f.record({ state: given === 'approve' ? 'working' : 'idle' }, { status_ms: 2000 }));
    assert.equal(await f.answer(id), 'sent');
    assert.equal(f.keys(), `${key}\n`);
    assert.deepEqual(f.ops(), ['approval-take', 'approval-result:sent+taker']);
  });
}

test('presses nothing when the dialog’s first option approves more than this request', { skip }, async t => {
  for (const [lifecycle, app, screen] of [
    ['claude', 'claude-code', claudeDialog('Yes, clear context and bypass permissions')],
    ['codex', 'codex', codexDialog('Yes, and allow this host for this conversation (y)')],
  ]) {
    const f = await fixture(t, { lifecycle, app });
    f.show('terminal', f.record(waiting));
    f.show('screen', screen);
    assert.equal(await f.answer((await f.reported()).id), 'changed');
    assert.equal(f.keys(), '');
    assert.deepEqual(f.ops(), ['approval-take', 'approval-result:changed+taker']);
  }
});

test('a deny still presses Esc whatever the first option says', { skip }, async t => {
  const f = await fixture(t, { take: { status: 200, answer: 'deny' } });
  f.show('terminal', f.record(waiting));
  f.show('screen', claudeDialog('Yes, and don\'t ask again'));
  f.show('after', f.record({ state: 'idle' }, { status_ms: 2000 }));
  assert.equal(await f.answer((await f.reported()).id), 'sent');
  assert.equal(f.keys(), 'esc\n');
});

test('withdraws without taking or pressing when the request moved on before the desktop looked', { skip }, async t => {
  const f = await fixture(t);
  f.show('terminal', f.record(waiting));
  const { id } = await f.reported();
  f.show('terminal', f.record({ ...waiting, msg: 'approve Bash: rm -rf build' }, { status_ms: 1500 }));
  assert.equal(await f.answer(id), 'changed');
  assert.equal(f.keys(), '');
  assert.deepEqual(f.ops(), ['approval-result:changed']);
});

test('presses nothing when the request, the process or the permission changes between taking the answer and pressing', { skip }, async t => {
  for (const change of ['request', 'pid', 'permission']) {
    const f = await fixture(t, change === 'permission' ? { onTake: () => f.revoke() } : {});
    f.show('terminal', f.record(waiting));
    const { id } = await f.reported();
    if (change === 'request') f.show('connect-get', f.record({ ...waiting, msg: 'approve Bash: rm -rf build' }, { turn: 2, status_ms: 1500 }));
    if (change === 'pid') f.show('connect-get', f.record(waiting, { pid: 556, foreground: { pid: 556, cwd: '/fixture/workspace', argv: ['/fixture/claude'] } }));
    assert.equal(await f.answer(id), 'changed', change);
    assert.equal(f.keys(), '', change);
    assert.deepEqual(f.ops(), ['approval-take', 'approval-result:changed+taker'], change);
  }
});

test('presses nothing when the cafe does not hand the answer over', { skip }, async t => {
  const f = await fixture(t, { take: { status: 409 } });
  f.show('terminal', f.record(waiting));
  assert.equal(await f.answer((await f.reported()).id), 'changed');
  assert.equal(f.keys(), '');
  assert.deepEqual(f.ops(), ['approval-take']);
});

test('presses nothing for an answer, a time or a take it does not understand', { skip }, async t => {
  for (const take of [
    { status: 200, answer: 'approve', remaining: 3500 }, { status: 200, answer: 'approve', remaining: 20_000 },
    { status: 200, answer: 'approve', remaining: 1.5 }, { status: 200, answer: 'always' }, { status: 200, answer: 'approve', taker: null },
  ]) {
    const f = await fixture(t, { take });
    f.show('terminal', f.record(waiting));
    assert.equal(await f.answer((await f.reported()).id), 'changed', JSON.stringify(take));
    assert.equal(f.keys(), '', JSON.stringify(take));
    assert.deepEqual(f.ops(), ['approval-take', `approval-result:changed${take.taker === null ? '' : '+taker'}`], JSON.stringify(take));
  }
});

test('says unknown, not sent, when the request is still on screen after the key', { skip }, async t => {
  const f = await fixture(t);
  f.show('terminal', f.record(waiting));
  assert.equal(await f.answer((await f.reported()).id), 'unknown');
  assert.equal(f.keys(), '1\n');
  assert.deepEqual(f.ops(), ['approval-take', 'approval-result:unknown+taker']);
});

test('says unknown when Core pressed on a different status or turn, or the connection ended after the key', { skip }, async t => {
  for (const [name, value] of [['keys-result', { status: 'working', turn: 1 }], ['keys-result', { status: 'blocked', turn: 2 }], ['drop', true]]) {
    const f = await fixture(t);
    f.show('terminal', f.record(waiting));
    const { id } = await f.reported();
    f.show(name, value);
    f.show('after', f.record({ state: 'working' }, { status_ms: 2000 }));
    assert.equal(await f.answer(id), 'unknown', JSON.stringify(value));
    assert.equal(f.keys(), '1\n');
    assert.deepEqual(f.ops(), ['approval-take', 'approval-result:unknown+taker']);
  }
});

test('says unknown when Core held the key for a person typing, even if the request then left', { skip }, async t => {
  const f = await fixture(t);
  f.show('terminal', f.record(waiting));
  const { id } = await f.reported();
  f.show('hold', 1500);
  f.show('after', f.record({ state: 'working' }, { status_ms: 2000 }));
  assert.equal(await f.answer(id), 'unknown');
  assert.equal(f.keys(), '1\n');
  assert.deepEqual(f.ops(), ['approval-take', 'approval-result:unknown+taker']);
});
