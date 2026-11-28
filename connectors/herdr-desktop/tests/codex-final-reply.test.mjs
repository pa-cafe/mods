import { spacePermissionKey } from '../pacafe-desktop/dispatch-permissions.js';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { codexHookArguments, codexBindingName, replyName } from '../pacafe-desktop/reply-hook.mjs';

const sessionId = '12345678-1234-1234-1234-123456789abc';
const nonce = 'abcdef12-1111-2222-3333-abcdef123456';
const thread = '01234567-1234-1234-1234-123456789abc';
const otherThread = 'fedcba98-1234-1234-1234-123456789abc';
const hook = fileURLToPath(new URL('../pacafe-desktop/reply-hook.mjs', import.meta.url));
const helper = fileURLToPath(new URL('../pacafe-desktop/credentials.mjs', import.meta.url));

test('Codex capture uses only structured, invocation-local hooks without overriding hook trust', () => {
  const args = codexHookArguments('/bin/node', '/a path/pa\'s.mjs', '/app/config', sessionId, nonce);
  assert.equal(args.length, 4);
  assert.ok(args[1].startsWith('hooks.UserPromptSubmit='));
  assert.ok(args[3].startsWith('hooks.Stop='));
  assert.ok(!args[1].includes(nonce));
  assert.ok(!args[1].includes(sessionId));
  assert.ok(!args.join(' ').includes('bypass'));
});

test('only the final Chinese assistant message from the pinned Codex turn reaches the paired cafe', { skip: process.platform === 'win32' }, async t => {
  const home = mkdtempSync(join(tmpdir(), 'herdr-codex-reply-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const directory = join(home, 'data', 'pacafe-desktop-link');
  const bin = join(home, 'bin');
  const workspace = realpathSync(home);
  mkdirSync(directory, { recursive: true });
  mkdirSync(bin);
  const target = { profile: { id: 'fixture-profile', key: 'codex', on: null, core: 'fixture-core', folder: workspace, lifecycle: 'codex' },
    session: { id: sessionId, task: sessionId, profile: 'fixture-profile', address: 'ta1', command: '/usr/bin/codex', replyNonce: nonce, replyLifecycle: 'codex' },
    terminal: 'ta1:123:456' };
  const native = { address: 'ta1', state: 'live', reason: null, pid: 123, created_ms: 456, cwd: workspace, argv: ['/usr/bin/codex'],
    foreground: { pid: 123, cwd: workspace, argv: ['/usr/bin/codex'] }, status: 'done', report: { app: 'codex' },
    labels: { 'pacafe.task': sessionId, 'pacafe.profile': target.profile.id, 'pacafe.session': sessionId } };
  writeFileSync(join(bin, 'hc'), `#!/bin/sh\ncase "$1" in server) printf '%s' '{"core":{"id":"fixture-core"}}';; get) cat "$NATIVE_FIXTURE";; esac\n`, { mode: 0o700 });
  const nativeFixture = join(home, 'native.json');
  const updateNative = status => writeFileSync(nativeFixture, JSON.stringify({ ...native, status }));
  const seen = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    assert.equal(req.headers.authorization, 'Bearer ' + secret);
    seen.push(JSON.parse(body));
    res.setHeader('content-type', 'application/json');
    res.end('{"ok":true}');
  });
  t.after(() => server.close());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const url = origin + '/api/herdr/desktop/device/' + sessionId;
  const secret = 'hdd_' + 'x'.repeat(43);
  const state = current => writeFileSync(join(directory, 'dispatch.json'), JSON.stringify({
    device: url, permissions: { version: 1, spaces: [spacePermissionKey(target.profile)], agents: ['codex'] }, sessions: [{ ...target.session, ...(current ? { replyPolicy: 1 } : {}) }], profiles: [target.profile],
  }));
  writeFileSync(join(directory, 'connection.json'), JSON.stringify({ url, secret, cafe: 'Fixture' }));
  writeFileSync(join(directory, 'target.json'), JSON.stringify({ origin }));
  const run = (script, argv, input) => new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [script, ...argv], { env: { PATH: `${bin}:/usr/bin:/bin`, NATIVE_FIXTURE: nativeFixture, HC_TERMINAL_ID: 'ta1', HC_TERMINAL_SOCKET: join(home,'core.sock') }, timeout: 5000 },
      (err, out) => err ? reject(err) : resolve(JSON.parse(out)));
    child.stdin.end(input && JSON.stringify(input));
  });
  const send = event => run(hook, [directory, 'codex'], {
    cwd: workspace, session_id: thread, turn_id: 'turn-one', ...event,
  });
  const upload = () => run(helper, ['reply-upload', home, url, JSON.stringify(target)]);
  const spool = join(directory, replyName(sessionId));
  const binding = join(directory, codexBindingName(sessionId));
  const final = { hook_event_name: 'Stop', last_assistant_message: '這是一則測試回覆，繁體中文顯示正常。' };
  updateNative('done');
  state(false);
  await send({ hook_event_name: 'UserPromptSubmit', prompt: 'PRIVATE INPUT' });
  assert.equal(existsSync(binding), false);
  assert.equal(await upload(), null);

  state(true);
  await send(final);
  assert.deepEqual(await upload(), { retry: true }); // must bind a trusted foreground prompt first
  await send({ hook_event_name: 'UserPromptSubmit', prompt: 'PRIVATE INPUT' });
  await send({ ...final, hook_event_name: 'SubagentStop', agent_id: 'nested' });
  await send({ ...final, session_id: otherThread, last_assistant_message: 'AUXILIARY TITLE' });
  await send({ ...final, stop_hook_active: true });
  assert.equal(existsSync(spool), false);

  await send(final);
  const first = JSON.parse(readFileSync(spool, 'utf8'));
  assert.match(first.id, /^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  await send(final);
  assert.equal(JSON.parse(readFileSync(spool, 'utf8')).id, first.id);
  assert.equal(JSON.parse(readFileSync(binding, 'utf8')).thread, thread);
  updateNative('working');
  assert.deepEqual(await upload(), { retry: true });
  assert.deepEqual(seen, []);
  updateNative('done');
  assert.deepEqual(await upload(), { retry: false });
  assert.deepEqual(seen, [{ op: 'reply', task: sessionId, session: sessionId, terminal: target.terminal, id: first.id, text: final.last_assistant_message }]);
  assert.equal(existsSync(spool), false);

  await send(final);
  state(false);
  assert.equal(await upload(), null);
  assert.equal(seen.length, 1);
});
