import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { planPermissions, spaceChoiceKey } from '../pacafe-desktop/dispatch-permissions.js';

// Stub only the native SDK; exercise the actual receiver and Core binding logic.
const native = { live: [], core: null, uploads: 0 };
globalThis.__herdrStandbyTest = native;
const sdk = `
  const host = globalThis.__herdrStandbyTest;
  export const terminals = () => host.live;
  export const hc = async () => ({
    code: host.core ? 0 : 1, stdout: JSON.stringify(host.core),
  });
  export const appHome = () => '/fixture/herdr';
  export const exec = async (_, args) => {
    if (host.helper) return { code: 0, stdout: JSON.stringify(await host.helper(args[1])) };
    if (args[1] === 'wake' && host.wake) return { code: 0, stdout: JSON.stringify(await host.wake()) };
    if (args[1] === 'id' && host.nextId) return { code: 0, stdout: JSON.stringify(host.nextId()) };
    if (args[1] !== 'reply-upload') throw new Error('Unexpected helper');
    host.uploads++;
    if (host.reject) throw new Error('Network unavailable');
    return { code: 0, stdout: JSON.stringify(host.uploadResult) };
  };
  export const window = () => null;
  export const run = (command, args) => host.commands.push([command, args]);
  export const knownAgents = () => [];
  export const panes = () => host.panes;
  export const spaces = () => host.spaces;
`;
const url = 'data:text/javascript,' + encodeURIComponent(sdk);
const hook = registerHooks({ resolve(specifier, context, next) {
  return specifier === 'herdr' ? { url, shortCircuit: true } : next(specifier, context);
} });
const { DispatchBridge } = await import('../pacafe-desktop/bridge.js');
hook.deregister();
delete globalThis.__herdrStandbyTest;

const profile = { id: 'profile', on: 'remote', core: 'core', space: 'space', folder: '/workspace', lifecycle: 'claude' };
const session = { id: 'session', task: 'task', profile: 'profile', address: 'remote/t1', command: '/usr/bin/claude' };
const exactTerminal = (status = 'working', state = 'live') => ({
  address: session.address, state, status, turn: 1, cwd: profile.folder, argv: [session.command],
  labels: { 'pacafe.task': session.task, 'pacafe.session': session.id, 'pacafe.profile': profile.id },
});
const fixture = () => {
  native.live = [];
  native.commands = [];
  native.panes = [];
  native.spaces = [{ id: profile.space, machine: profile.on, folder: profile.folder }];
  native.core = null;
  native.uploads = 0;
  native.nextId = null;
  native.helper = null;
  native.wake = null;
  native.reject = false;
  native.uploadResult = { retry: false };
  const bridge = new DispatchBridge();
  bridge.activate({ url: 'fixture' });
  bridge.usable = () => profile;
  bridge.sessions = [{ ...session }];
  return bridge;
};

test('watches unavailable sessions and notices local snapshots and profile recovery', async () => {
  const bridge = fixture();
  bridge.taskStatus.set(session.task, 'unavailable');
  bridge.lastSettledSignature = bridge.settledSignature();
  assert.equal(bridge.hasActiveSession(), false);
  assert.equal(await bridge.standbyChanged(), false);
  native.live = [exactTerminal()];
  assert.equal(await bridge.standbyChanged(), true);
  native.live = [];
  bridge.usable = () => undefined;
  bridge.lastSettledSignature = bridge.settledSignature();
  bridge.usable = () => profile;
  assert.equal(await bridge.standbyChanged(), true);
});

test('checks an unavailable remote terminal omitted from the Desktop snapshot', async t => {
  const bridge = fixture();
  bridge.taskStatus.set(session.task, 'unavailable');
  bridge.lastSettledSignature = bridge.settledSignature();
  let now = 100_000;
  t.mock.method(Date, 'now', () => now);
  native.core = exactTerminal();
  native.core.labels['pacafe.session'] = 'wrong';
  assert.equal(await bridge.standbyChanged(), false);
  native.core.labels['pacafe.session'] = session.id;
  assert.equal(await bridge.standbyChanged(), false);
  now += 5000;
  assert.equal(await bridge.standbyChanged(), true);
});

test('settled standby resynchronizes a failed reply even with an unchanged signature', async t => {
  const bridge = fixture();
  bridge.taskStatus.set(session.task, 'turn-finished');
  bridge.lastSettledSignature = bridge.settledSignature();
  const report = { task: session.task, session: session.id, terminal: 'lease' };
  const target = { profile, session };
  let now = 100_000;
  t.mock.method(Date, 'now', () => now);
  native.reject = true;
  bridge.uploadReply(bridge.connection, report, target, 'nonce', 1);
  await setImmediate();
  assert.equal(native.uploads, 1);
  assert.equal(bridge.replyRetryDue(), false);
  now += 1999;
  assert.equal(bridge.replyRetryDue(), false);
  native.reject = false;
  bridge.waitForWake = () => new Promise(() => {});
  const syncs = [];
  bridge.poll = async sync => {
    syncs.push(sync);
    if (syncs.length === 2) {
      bridge.uploadReply(bridge.connection, report, target, 'nonce', 1);
      await setImmediate();
      bridge.stop();
    }
  };
  await bridge.run({ notify() {}, async sleep() { now += 1000; } });
  assert.deepEqual(syncs, [true, true]);
  assert.equal(native.uploads, 2);
  assert.equal(bridge.replyTurns.get(session.id), 1);
  assert.equal(bridge.replyRetryDue(Number.MAX_SAFE_INTEGER), false);
});

test('HTTP retry hints back off and stop after three retries for one turn', async t => {
  const bridge = fixture();
  native.uploadResult = { retry: true };
  let now = 100_000;
  t.mock.method(Date, 'now', () => now);
  const upload = () => bridge.uploadReply(bridge.connection, { task: session.task, session: session.id, terminal: 'lease' }, { profile, session }, 'nonce', 1);
  upload();
  for (const wait of [2000, 4000, 8000]) {
    await setImmediate();
    assert.equal(bridge.replyRetryDue(now + wait - 1), false);
    now += wait;
    assert.equal(bridge.replyRetryDue(), true);
    upload();
  }
  await setImmediate();
  now += 10_000;
  assert.equal(bridge.replyRetryDue(), false);
  upload();
  await setImmediate();
  assert.equal(native.uploads, 4);
  bridge.activate(null);
  assert.equal(bridge.replyUploads.size, 0);
});

test('idle receiver re-advertises a reconnecting approved machine before the first dispatch', async t => {
  const bridge = fixture();
  bridge.ready = true;
  bridge.profiles = [{ ...profile, agent: 'Claude', machine: 'Remote', workspace: 'Project' }];
  bridge.sessions = [];
  let now = 100_000;
  let connected = false;
  let discovered = false;
  let sleepCount = 0;
  let refreshCount = 0;
  const posts = [];
  t.mock.method(Date, 'now', () => now);
  bridge.usable = id => discovered && bridge.profiles.find(item => item.id === id);
  bridge.refresh = async () => {
    bridge.refreshed = now;
    discovered = connected;
    refreshCount++;
  };
  bridge.post = async op => {
    posts.push(op.profiles.map(item => item.id));
    assert.deepEqual(op.reports, []);
    return {};
  };
  bridge.waitForWake = () => new Promise(() => {});
  await bridge.run({ notify() {}, async sleep(ms) {
    assert.equal(ms, 15_000);
    now += ms;
    sleepCount++;
    // Unchanged discovery at ticks 1 and 3 must not make a Worker call.
    if (sleepCount === 2) connected = true;
    if (sleepCount === 4) connected = false;
    if (sleepCount === 5) bridge.stop();
  } });
  assert.equal(refreshCount, 5);
  assert.deepEqual(posts, [[], [profile.id], []]);
});


test('an unchanged omitted finished terminal stays quiet; a resumed or ended one is synchronized', async t => {
  for (const next of [exactTerminal('working'), exactTerminal('done', 'finished')]) {
    const bridge = fixture();
    native.core = exactTerminal('done');
    let now = 100_000;
    const clock = t.mock.method(Date, 'now', () => now);
    bridge.post = async op => {
      assert.equal(op.reports[0]?.status, 'turn-finished');
      return {};
    };
    await bridge.sync();
    assert.equal(bridge.hasActiveSession(), false);
    assert.equal(await bridge.standbyChanged(), false);
    native.core = next;
    assert.equal(await bridge.standbyChanged(), false);
    now += 5000;
    assert.equal(await bridge.standbyChanged(), true);
    clock.mock.restore();
  }
});

test('a late Stop hook is retryable while capture is absent, but legacy sessions are not searched', async t => {
  const home = mkdtempSync(join(tmpdir(), 'herdr-reply-capture-test-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const directory = join(home, 'data', 'pacafe-desktop-link');
  mkdirSync(directory, { recursive: true });
  const sessionId = '12345678-1234-1234-1234-123456789abc';
  const nonce = 'abcdef12-1111-2222-3333-abcdef123456';
  const origin = 'http://127.0.0.1:51890';
  const url = origin + '/api/herdr/desktop/device/' + sessionId;
  const stored = { id: sessionId, replyNonce: nonce, replyLifecycle: 'claude' };
  writeFileSync(join(directory, 'connection.json'), JSON.stringify({ url, secret: 'hdd_' + 'x'.repeat(43), cafe: 'Fixture' }));
  writeFileSync(join(directory, 'target.json'), JSON.stringify({ origin }));
  const state = current => writeFileSync(join(directory, 'dispatch.json'), JSON.stringify({
    device: url, sessions: [{ ...stored, ...(current ? { replyPolicy: 1 } : {}) }],
  }));
  const check = () => {
    const helper = fileURLToPath(new URL('../pacafe-desktop/credentials.mjs', import.meta.url));
    const result = execFileSync(process.execPath, [helper, 'reply-upload', home, url, JSON.stringify({ session: stored })],
      { encoding: 'utf8', timeout: 10_000 });
    return JSON.parse(result);
  };
  state(true);
  assert.deepEqual(check(), { retry: true });
  state(false);
  assert.equal(check(), null);
});

test('waits for Core adoption without relaunching or stealing focus and confirms by attached pane', async t => {
  const bridge = fixture();
  let now = 100_000;
  t.mock.method(Date, 'now', () => now);
  const row = bridge.sessions[0];
  row.ownedSpace = 'sp-pacafe-111111111111111111111111';
  const target = `remote/${row.ownedSpace}`;
  native.spaces.push({ id: target, machine: 'remote', named: false, tabs: [{ id: 'owned-tab' }] });
  // Simulate a saved session marked shown by the old client although no pane
  // was created, and a terminal which has since completed its prompt.
  row.shown = true;
  native.live = [exactTerminal('done')];
  bridge.save = async () => {};
  bridge.post = async op => {
    assert.equal(op.op, 'sync');
    assert.equal(op.reports[0].status, 'turn-finished');
    return {};
  };
  await bridge.sync();
  assert.equal(row.shown, false);
  assert.deepEqual(native.commands, []);
  assert.equal(bridge.placementRetryDue(), false);
  now += 2500;
  assert.equal(bridge.placementRetryDue(), true);
  await bridge.sync();
  assert.deepEqual(native.commands, []);
  assert.equal(row.shown, false);
  native.panes = [{ terminal: row.address, pane: 'attached', tab: 'owned-tab' }];
  await bridge.sync();
  assert.deepEqual(native.commands, [['space.rename', { id: target, name: 'PA Cafe' }]]);
  assert.equal(row.shown, true);
  assert.equal(bridge.placementRetryDue(), false);
});

test('unconfirmed PA Cafe Space tab insertion has a bounded observation budget', async t => {
  const bridge = fixture();
  let now = 100_000;
  t.mock.method(Date, 'now', () => now);
  const row = bridge.sessions[0];
  row.ownedSpace = 'sp-pacafe-111111111111111111111111';
  for (const elapsed of [0, 2500, 5000, 10_000, 120_000]) {
    now += elapsed;
    assert.equal(bridge.reveal(profile, row), false);
  }
  assert.deepEqual(native.commands, []);
  assert.match(bridge.actionError, /has not shown its tab/);
});

const display = id => ({ ...profile, id, machine: 'Remote Mac', workspace: 'Project', agent: 'Claude' });
test('sends only safe offline profile descriptions after capability and after each change', async () => {
  const bridge = fixture();
  bridge.sessions = [];
  bridge.ready = true;
  bridge.refreshed = Date.now();
  const reachable = display('reachable');
  const absent = display('absent');
  bridge.profiles = [reachable, absent];
  bridge.usable = id => id === reachable.id ? reachable : undefined;
  const posts = [];
  bridge.post = async op => { posts.push(op); return { profileAvailability: true }; };
  await bridge.sync();
  assert.equal('offlineProfiles' in posts[0], false);
  await bridge.poll(false);
  await bridge.poll(false);
  assert.equal(posts.length, 2);
  assert.deepEqual(posts[1].offlineProfiles, [{ id: 'absent', machine: 'Remote Mac', workspace: 'Project', agent: 'Claude', lifecycle: 'claude' }]);
  bridge.profiles = [reachable];
  bridge.save = async () => {};
  await bridge.poll(false);
  assert.deepEqual(posts[2].offlineProfiles, []);
});

test('falls back once to a legacy sync if a worker rollback rejects profile availability', async () => {
  const bridge = fixture();
  bridge.sessions = [];
  bridge.profileAvailability = true;
  bridge.profiles = [display('absent')];
  bridge.usable = () => undefined;
  const posts = [];
  bridge.post = async op => {
    posts.push(op);
    if ('offlineProfiles' in op) throw Object.assign(new Error('Bad request'), { status: 400 });
    return {};
  };
  await bridge.sync();
  await bridge.sync();
  assert.deepEqual(posts.map(op => 'offlineProfiles' in op), [true, false, false]);
  assert.deepEqual(posts[1], { op: 'sync', profiles: [], reports: [] });
  assert.equal(bridge.profileAvailability, false);
});

test('offline descriptions never displace the current 40 usable profiles', () => {
  const bridge = fixture();
  bridge.profiles = Array.from({ length: 44 }, (_, index) => display(String(index)));
  bridge.usable = id => Number(id) >= 4 ? bridge.profiles.find(profile => profile.id === id) : undefined;
  const available = bridge.availableProfiles();
  assert.equal(available.length, 40);
  assert.deepEqual(bridge.offlineProfiles(available), []);
});

test('rotates the standby listener before discovery and keeps wake events that arrive during the probe', async () => {
  const bridge = fixture();
  bridge.taskStatus.set(session.task, 'turn-finished');
  const socket = [];
  let checkLocal;
  let finishProbe;
  const syncs = [];
  native.wake = () => new Promise(resolve => socket.push(resolve));
  bridge.poll = async sync => {
    syncs.push(sync);
    if (syncs.length === 2) {
      assert.equal(socket.length, 2, 'the next listener starts before local work');
    }
    if (syncs.length === 4) bridge.stop();
  };
  bridge.standbyChanged = () => new Promise(resolve => { finishProbe = resolve; });
  const loop = bridge.run({ notify() {}, sleep: () => new Promise(resolve => { checkLocal = resolve; }) });
  await setImmediate();
  assert.equal(socket.length, 1);
  socket[0]('idle-settled');
  await setImmediate();
  assert.equal(socket.length, 2);
  checkLocal();
  await setImmediate();
  assert.equal(typeof finishProbe, 'function');
  socket[1]('wake-settled');
  await setImmediate();
  finishProbe(false);
  await loop;
  assert.deepEqual(syncs, [true, false, false, true]);
  assert.equal(socket.length, 2);
});

test('a legacy permissions matrix restores no dispatchable profiles, offline permissions, or access while preserving its pairing', () => {
  const bridge = fixture();
  const pairing = { url: 'fixture' };
  const row = { ...profile, key: 'claude' };
  bridge.activate(pairing, { profiles: [row], sessions: [{ ...session }], shareReplies: true, keepAwake: true });
  assert.equal(bridge.connection, pairing);
  assert.equal(bridge.keepAwake, true);
  assert.equal(bridge.permissions, null);
  assert.deepEqual(bridge.profiles, []);
  assert.deepEqual(bridge.availableProfiles(), []);
  assert.deepEqual(bridge.offlineProfiles([]), []);
  assert.equal(DispatchBridge.prototype.usable.call(bridge, row.id), undefined);
});

test('applying a Space and global Agent list approves only exact offered combinations and no newly discovered launches', async () => {
  const bridge = fixture();
  const local = { id: 'local', machine: null, folder: '/local', name: 'Local' };
  const remote = { id: 'remote', machine: 'Desk', folder: '/remote', name: 'Remote' };
  const codex = { key: 'codex', name: 'Codex', run: ['codex'], installed: true };
  const claude = { key: 'claude', name: 'Claude', run: ['claude'], installed: true };
  native.spaces = [local, remote];
  bridge.usable = DispatchBridge.prototype.usable.bind(bridge);
  bridge.catalog = {
    workspaces: [local, remote],
    identities: new Map([[null, { id: 'local-core', name: 'Local mac' }], ['Desk', { id: 'remote-core', name: 'Remote mac' }]]),
    agents: new Map([[null, [codex, claude]], ['Desk', [codex]]]),
  };
  let nextId = 1;
  native.nextId = () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`;
  bridge.save = async () => {};
  assert.deepEqual(bridge.availableProfiles(), []);
  const options = bridge.permissionOptions();
  const selection = { version: 1, spaces: options.spaces.map(space => space.key), agents: ['codex', 'claude'] };
  const preview = planPermissions(selection, bridge.profiles, options.discovered);
  assert.equal(preview.added.length, 3);
  await assert.rejects(bridge.applyPermissions(selection, 'stale'), /工作環境有變動/);
  assert.deepEqual(bridge.availableProfiles(), []);

  await bridge.applyPermissions(selection, preview.fingerprint);
  assert.deepEqual(bridge.availableProfiles().map(row => [row.workspace, row.agent]), [['Local', 'Codex'], ['Local', 'Claude'], ['Remote', 'Codex']]);
  const remoteCodex = bridge.profiles.find(row => row.on === 'Desk');
  bridge.catalog.agents.set('Desk', [codex, claude]);
  assert.equal(bridge.availableProfiles().length, 3); // merely discovering the fourth pair grants nothing
  assert.equal(bridge.usable(remoteCodex.id), remoteCodex);

  bridge.catalog.identities.delete('Desk');
  assert.deepEqual(bridge.offlineProfiles(bridge.availableProfiles()).map(row => row.id), [remoteCodex.id]);
  const trim = { ...selection, agents: ['claude'] };
  const revoke = planPermissions(trim, bridge.profiles, bridge.permissionOptions().discovered);
  await bridge.applyPermissions(trim, revoke.fingerprint);
  assert.equal(bridge.usable(remoteCodex.id), undefined);
  assert.deepEqual(bridge.offlineProfiles(bridge.availableProfiles()), []);
  assert.deepEqual(bridge.availableProfiles().map(row => [row.workspace, row.agent]), [['Local', 'Claude']]);
});

const boundTurn = turn => ({
  ...exactTerminal('done'),
  turn, reason: null, pid: 41, created_ms: 1234, keep: false,
  foreground: { pid: 41, cwd: profile.folder, argv: [session.command] },
  report: { app: 'claude-code' },
});

test('negotiates native turns and reports distinct completed turns on the same live session', async () => {
  const bridge = fixture();
  native.live = [boundTurn(7)];
  const posts = [];
  bridge.post = async op => { posts.push(op); return { turnReports: true }; };
  await bridge.sync();
  assert.equal('turn' in posts[0].reports[0], false);
  assert.equal(await bridge.standbyChanged(), true); // flush the counter even when already waiting
  await bridge.sync();
  assert.equal(await bridge.standbyChanged(), false);
  native.live = [boundTurn(8)];
  assert.equal(await bridge.standbyChanged(), true);
  await bridge.sync();
  assert.deepEqual(posts.map(op => op.reports[0].status), ['turn-finished', 'turn-finished', 'turn-finished']);
  assert.deepEqual(posts.map(op => op.reports[0].session), ['session', 'session', 'session']);
  assert.deepEqual(posts.map(op => op.reports[0].turn), [undefined, 7, 8]);
  assert.equal(posts[2].reports[0].canSend, true);
});

test('does not transmit counters after receiving no capability or without a valid terminal binding', async () => {
  const bridge = fixture();
  const posts = [];
  native.live = [boundTurn(7)];
  bridge.post = async op => { posts.push(op); return {}; };
  await bridge.sync();
  await bridge.sync();
  assert.deepEqual(posts.map(op => op.reports[0].turn), [undefined, undefined]);

  bridge.turnReports = true;
  native.live = [{ ...boundTurn(8), foreground: { ...boundTurn(8).foreground, pid: 42 } }];
  await bridge.sync();
  assert.equal(posts[2].reports[0].terminal, null);
  assert.equal('turn' in posts[2].reports[0], false);
  bridge.turnReports = true;
  native.live = [{ ...boundTurn(9), state: 'finished' }];
  await bridge.sync();
  assert.equal(posts[3].reports[0].status, 'ended');
  assert.equal('turn' in posts[3].reports[0], false);
});

test('clears negotiated turns on reconnect and retries an older strict worker once without new fields', async () => {
  const bridge = fixture();
  const posts = [];
  native.live = [boundTurn(27)];
  bridge.turnReports = true;
  bridge.profileAvailability = true;
  bridge.post = async op => {
    posts.push(op);
    if (op.reports[0].turn) throw Object.assign(new Error('Bad request'), { status: 400 });
    return {};
  };
  await bridge.sync();
  await bridge.sync();
  assert.deepEqual(posts.map(op => op.reports[0].turn), [27, undefined, undefined]);
  assert.deepEqual(posts.map(op => 'offlineProfiles' in op), [true, false, false]);
  bridge.turnReports = true;
  bridge.activate({ url: 'reconnected' }, { sessions: [{ ...session }] });
  assert.equal(bridge.turnReports, false);
  await bridge.sync();
  assert.equal('turn' in posts[3].reports[0], false);
});

test('settings-only bridge can complete pairing without publishing or waiting for a gateway wake', async () => {
  fixture();
  const bridge = new DispatchBridge({ dispatchEnabled: false });
  const calls = [];
  native.helper = async action => {
    calls.push(action);
    if (action === 'target') return { origin: 'http://127.0.0.1:7001', kind: 'local' };
    if (action === 'load') return null;
    if (action === 'pending') return { userCode: 'test' };
    if (action === 'poll') return { status: 'approved', connection: { url: 'fixture' } };
    throw new Error('Unexpected operation');
  };
  bridge.sync = async () => assert.fail('configuration-only bridge must never advertise');
  bridge.refresh = async () => { bridge.refreshed = Date.now(); };
  await bridge.poll(true);
  assert.deepEqual(calls, ['target', 'load', 'pending', 'poll']);
  assert.equal(bridge.ready, true);
  assert.equal(bridge.justPaired, true);
  assert.equal(bridge.connection.url, 'fixture');
  bridge.keepAwake = true;
  bridge.wakeMac();
  assert.deepEqual(calls, ['target', 'load', 'pending', 'poll']);
});

test('Spaces follow the default on discovery, while Agents require explicit selection', async () => {
  const bridge = fixture();
  const local = { id: 'local', machine: null, folder: '/local', name: 'Local' };
  const excluded = { id: 'excluded', machine: null, folder: '/excluded', name: 'Excluded' };
  const fresh = { id: 'fresh', machine: null, folder: '/fresh', name: 'Fresh' };
  const codex = { key: 'codex', name: 'Codex', run: ['codex'], installed: true };
  const claude = { key: 'claude', name: 'Claude', run: ['claude'], installed: true };
  native.spaces = [local, excluded];
  bridge.usable = DispatchBridge.prototype.usable.bind(bridge);
  bridge.catalog = {
    workspaces: native.spaces,
    identities: new Map([[null, { id: 'local-core', name: 'Local mac' }]]),
    agents: new Map([[null, [codex]]]),
  };
  let nextId = 0, saves = 0;
  native.nextId = () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`;
  bridge.save = async () => { saves++; };
  // A legacy allowlist may be upgraded without expanding to an existing unchecked Space.
  const opts = bridge.permissionOptions();
  const spaces = opts.spaces.filter(row => row.name !== 'Excluded').map(row => row.key);
  bridge.permissions = { version: 1, spaces, agents: ['codex'] };
  await bridge.includeNewPermissionSpaces();
  assert.deepEqual(bridge.availableProfiles().map(row => row.workspace), ['Local']);
  assert.equal(bridge.permissions.version, 2);
  assert.deepEqual(bridge.permissions.excludedSpaces, opts.spaces.filter(row => row.name === 'Excluded').map(row => spaceChoiceKey(row.key)));

  native.spaces[1] = { ...excluded, folder: '/excluded-moved' };
  native.spaces.push(fresh);
  bridge.catalog.agents.set(null, [codex, claude]);
  const oldId = bridge.profiles[0].id;
  await bridge.includeNewPermissionSpaces();
  assert.equal(bridge.profiles[0].id, oldId);
  assert.deepEqual(bridge.availableProfiles().map(row => [row.workspace, row.agent]), [['Local', 'Codex'], ['Fresh', 'Codex']]);
  assert.deepEqual(bridge.permissions.agents, ['codex']);
  await bridge.includeNewPermissionSpaces();
  assert.equal(saves, 2);
  bridge.catalog.workspaces.push(...Array.from({ length: 40 }, (_, i) =>
    ({ id: `workspace-${i}`, machine: null, folder: `/workspace-${i}`, name: `Workspace ${i}` })));
  await bridge.includeNewPermissionSpaces();
  assert.equal(saves, 2);
  assert.equal(bridge.profiles.length, 2);
});

test('automatic enrollment keeps prior permissions after a write failure and never silently redirects a Space', async () => {
  const bridge = fixture();
  const local = { id: 'local', machine: null, folder: '/local', name: 'Local' };
  const fresh = { id: 'fresh', machine: null, folder: '/fresh', name: 'Fresh' };
  const codex = { key: 'codex', name: 'Codex', run: ['codex'], installed: true };
  native.spaces = [local];
  bridge.usable = DispatchBridge.prototype.usable.bind(bridge);
  bridge.catalog = { workspaces: native.spaces, identities: new Map([[null, { id: 'core', name: 'Local mac' }]]), agents: new Map([[null, [codex]]]) };
  bridge.permissions = { version: 2, excludedSpaces: [], agents: ['codex'] };
  let nextId = 0;
  native.nextId = () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`;
  bridge.save = async () => {};
  await bridge.includeNewPermissionSpaces();
  const old = bridge.profiles[0];
  native.spaces[0] = { ...local, folder: '/redirected' };
  native.spaces.push(fresh);
  bridge.save = async () => { throw new Error('local write failed'); };
  await assert.rejects(bridge.includeNewPermissionSpaces(), /local write failed/);
  assert.deepEqual(bridge.profiles, [old]);
  bridge.save = async () => {};
  await bridge.includeNewPermissionSpaces();
  assert.deepEqual(bridge.profiles.map(row => row.folder), ['/local', '/fresh']);
  assert.deepEqual(bridge.availableProfiles().map(row => row.workspace), ['Fresh']);
});

const settle = async () => { for (let i = 0; i < 5; i++) await setImmediate(); };
const waitingTerminal = () => ({ ...boundTurn(3), status: 'blocked' });
const phoneAnswer = { task: session.task, session: session.id, terminal: 'remote/t1:41:1234', prompt: 'P'.repeat(43), id: '34c64b85-230f-4000-a358-6b85778f4421' };

test('asks the helper for a waiting request and answers from the phone only while the cafe takes approvals', async () => {
  const bridge = fixture();
  native.live = [waitingTerminal()];
  const posts = [];
  const answered = [];
  let reply = { answers: [phoneAnswer] };
  bridge.post = async op => { posts.push(op); return reply; };
  native.helper = async action => { if (action === 'answer') answered.push(action); return 'sent'; };
  await bridge.sync();
  await settle();
  assert.equal('prompt' in posts[0].reports[0], false);
  assert.deepEqual(answered, []);
  reply = { approvals: true, answers: [phoneAnswer] };
  await bridge.sync();
  await settle();
  assert.deepEqual(answered, ['answer']);
  await bridge.sync();
  assert.equal(posts[2].reports[0].prompt, true);
  // HERDR_REMOTE_APPROVAL=off: the next answer stops the presses, then the request text.
  reply = { approvals: false, answers: [phoneAnswer] };
  answered.length = 0;
  await bridge.sync();
  await bridge.sync();
  await settle();
  assert.deepEqual(answered, []);
  assert.equal('prompt' in posts.at(-1).reports[0], false);
  // Only an exact blocked binding is answered.
  reply = { approvals: true, answers: [{ ...phoneAnswer, terminal: 'remote/t1:41:9999' }, { ...phoneAnswer, id: 'not-a-uuid' }] };
  await bridge.sync();
  await settle();
  assert.deepEqual(answered, []);
});

test('says on the desktop when a phone answer may not have reached the agent', async () => {
  const bridge = fixture();
  native.live = [waitingTerminal()];
  bridge.approvals = true;
  bridge.post = async () => ({ approvals: true, answers: [phoneAnswer] });
  native.helper = async action => action === 'answer' ? 'unknown' : null;
  await bridge.sync();
  await settle();
  assert.equal(bridge.actionError, 'A phone answer may not have reached the agent. Check the terminal.');
});

test('drops the request marker when an older cafe refuses it', async () => {
  const bridge = fixture();
  native.live = [waitingTerminal()];
  bridge.approvals = true;
  const posts = [];
  bridge.post = async op => {
    posts.push(op);
    if (op.reports[0].prompt) throw Object.assign(new Error('Bad request'), { status: 400 });
    return {};
  };
  await bridge.sync();
  assert.deepEqual(posts.map(op => op.reports[0].prompt), [true, undefined]);
  assert.equal(bridge.approvals, false);
});
