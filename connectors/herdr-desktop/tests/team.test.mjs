import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { helperLimit, teamBrief, teammates, teammateLimit } from '../pacafe-desktop/team.js';

// Stub only the native SDK; the launch, probe and bridge code run as shipped.
const native = { calls: [], answers: [], live: [] };
globalThis.__herdrTeamTest = native;
const sdk = `
  const host = globalThis.__herdrTeamTest;
  export const hc = async args => { host.calls.push(args); return host.answers.shift() ?? { code: 1, stdout: '' }; };
  export const terminals = () => host.live;
  export const panes = () => [];
  export const spaces = () => [];
  export const knownAgents = async () => [];
  export const exec = async () => ({ code: 1, stdout: '' });
  export const run = () => null;
  export const appHome = () => '/fixture/herdr';
  export const window = () => null;
`;
const url = 'data:text/javascript,' + encodeURIComponent(sdk);
const hook = registerHooks({ resolve(specifier, context, next) {
  return specifier === 'herdr' ? { url, shortCircuit: true } : next(specifier, context);
} });
const { adapter, coreSocket, launch, leadName } = await import('../pacafe-desktop/core.js');
const { DispatchBridge } = await import('../pacafe-desktop/bridge.js');
hook.deregister();
delete globalThis.__herdrTeamTest;

const task = '0f0e0d0c-0b0a-4908-8706-050403020100';
const socket = '/private/tmp/hc/herdr-core/main.sock';
const profile = lifecycle => ({ id: 'profile', on: null, core: 'core', space: 'space', folder: '/work/app', lifecycle, run: [lifecycle] });
const launched = () => ({ code: 0, stdout: JSON.stringify({ address: 't9' }) });
const argvOf = call => call.slice(call.indexOf('--') + 1);
const sessionId = '1a2b3c4d-0000-4000-8000-000000000001';
const space = 'sp-pacafe-0123456789abcdef01234567';

test('OpenCode is its own supported CLI, and other launchers stay as they were', () => {
  assert.equal(adapter({ key: 'opencode', run: ['opencode'] }), 'opencode');
  assert.equal(adapter({ key: 'opencode', run: ['opencode', '--model', 'x'] }), null);
  assert.equal(adapter({ key: 'claude', run: ['claude'] }), 'claude');
  assert.equal(adapter({ key: 'codex', run: ['codex', '--no-daemon'] }), 'codex');
  assert.equal(adapter({ key: 'pi', run: ['pi'] }), 'generic');
  assert.equal(adapter({ key: 'opencode', run: ['opencode'], shell: true }), null);
});

test('a lead may reach Core: Claude may run hc, Codex gets only the socket inside its sandbox', async () => {
  native.calls = [];
  native.answers = [launched(), launched(), launched(), launched(), launched()];
  const team = { brief: 'brief', socket };
  await launch(profile('claude'), '/bin/claude', task, sessionId, 'lead prompt', [], space, team);
  await launch(profile('claude'), '/bin/claude', task, sessionId, 'solo prompt', [], space);
  await launch(profile('codex'), '/bin/codex', task, sessionId, 'lead prompt', [], space, team);
  await launch(profile('codex'), '/bin/codex', task, sessionId, 'solo prompt', [], space);
  await launch(profile('opencode'), '/bin/opencode', task, sessionId, 'lead prompt', [], space, team);
  const [claudeLead, claudeSolo, codexLead, codexSolo, opencode] = native.calls.map(argvOf);

  assert.deepEqual(claudeLead, ['/bin/claude', '--permission-mode', 'default', '--allowedTools', 'Bash(hc:*)', '--', 'lead prompt']);
  assert.deepEqual(claudeSolo, ['/bin/claude', '--permission-mode', 'default', '--', 'solo prompt']);
  assert.deepEqual(codexLead, ['/bin/codex', '--no-daemon', '--enable', 'network_proxy',
    '-c', 'default_permissions="pacafe-lead"', '-c', 'permissions.pacafe-lead.extends=":workspace"',
    '-c', 'permissions.pacafe-lead.network.enabled=true', '-c', 'permissions.pacafe-lead.network.domains={}',
    '-c', `permissions.pacafe-lead.network.unix_sockets={"${socket}"="allow"}`,
    '--ask-for-approval', 'on-request', '--', 'lead prompt']);
  assert.ok(!codexLead.includes('--sandbox'), 'a legacy --sandbox would make Codex ignore the profile');
  assert.deepEqual(codexSolo, ['/bin/codex', '--no-daemon', '--sandbox', 'workspace-write', '--ask-for-approval', 'on-request', '--', 'solo prompt']);
  assert.deepEqual(opencode, ['/bin/opencode', '--prompt', 'lead prompt']);
  assert.ok(native.calls.every(call => call[call.indexOf('--name') + 1] === leadName(task)));
});

test('reads Core\'s socket from a short terminal and removes it', async () => {
  native.calls = [];
  native.answers = [{ code: 0, stdout: JSON.stringify({ address: 't4', output: `${socket}\n` }) }, { code: 0, stdout: '' }];
  assert.equal(await coreSocket(profile('codex')), socket);
  assert.deepEqual(argvOf(native.calls[0]), ['/usr/bin/printenv', 'HC_TERMINAL_SOCKET']);
  assert.ok(native.calls[0].includes('--no-parent'));
  assert.deepEqual(native.calls[1], ['rm', 't4']);

  native.answers = [{ code: 0, stdout: JSON.stringify({ address: 't5', output: `/tmp/${'x'.repeat(120)}.sock` }) }, { code: 0, stdout: '' }];
  assert.equal(await coreSocket(profile('codex')), null, 'too long for a Unix socket');
  native.answers = [{ code: 0, stdout: JSON.stringify({ address: 't6', output: '/tmp/a"b.sock' }) }, { code: 0, stdout: '' }];
  assert.equal(await coreSocket(profile('codex')), null, 'would break the TOML and shell quoting');
  native.answers = [{ code: 1, stdout: '' }];
  assert.equal(await coreSocket(profile('codex')), null);
});

test('the brief names the lead, caps helpers, lists approved CLIs and says what goes back to the barista', () => {
  const brief = teamBrief({ lead: 'pa-0f0e0d0c', folder: '/work/app', clis: ['claude', 'codex', 'opencode', 'claude'], socket });
  assert.match(brief, /Your Herdr address is pa-0f0e0d0c\./);
  assert.ok(brief.includes(`up to ${helperLimit} helpers`));
  assert.ok(brief.includes("- Claude Code: hc run --bg --name NAME --cwd /work/app claude --permission-mode default --allowedTools 'Bash(hc send:*)' -- 'TASK'"));
  assert.ok(brief.includes(`'permissions.pacafe-team.network.unix_sockets={"${socket}"="allow"}'`));
  assert.ok(brief.includes("- OpenCode: hc run --bg --name NAME --cwd /work/app opencode --prompt 'TASK'"));
  assert.equal(brief.match(/- Claude Code:/g).length, 1);
  // TASK sits in single quotes, so the report line inside it uses double quotes.
  assert.ok(brief.includes('hc send pa-0f0e0d0c "[隊員 NAME] <result or blocker>"'));
  assert.match(brief, /one plain hc command per shell call/);
  for (const reserved of ['outside this folder', 'secrets', 'payments', 'deleting files', 'force-push', 'publishing', 'sending messages', 'unsure']) {
    assert.ok(brief.includes(reserved), reserved);
  }
  assert.ok(!teamBrief({ lead: 'pa-0f0e0d0c', folder: '/work/app', clis: ['codex'], socket: null }), 'Codex helpers need the socket');
  assert.ok(!teamBrief({ lead: 'pa-0f0e0d0c', folder: "/work/it's", clis: ['claude'], socket }));
  assert.ok(!teamBrief({ lead: 'pa-0f0e0d0c', folder: 'C:\\work', clis: ['claude'], socket }));
});

const terminal = (address, fields) => ({ address, state: 'live', parent: null, created_ms: Number(address.replace(/\D/g, '')), ...fields });
const claudeProgram = { key: 'claude', name: 'Claude Code', agent: true };
const codexProgram = { key: 'codex', name: 'Codex', agent: true };

test('walks parent down from the lead, by name, with Herdr\'s status words', () => {
  const live = [
    terminal('t1', { name: 'pa-0f0e0d0c', program: claudeProgram, status: 'working' }),
    terminal('t3', { name: 'tests', parent: 't1', program: codexProgram, status: { app: 'codex', state: 'blocked' } }),
    terminal('t2', { name: 'fix', parent: 't1', program: claudeProgram, status: 'working' }),
    terminal('t4', { name: 'docs', parent: 't2', program: { key: 'program', name: 'x', agent: false }, foreground: { name: 'opencode' }, status: null }),
    terminal('t5', { name: 'gone', parent: 't1', program: claudeProgram, state: 'finished', status: 'done' }),
    terminal('t6', { name: 'elsewhere', parent: 't9', program: claudeProgram, status: 'idle' }),
    terminal('t7', { parent: 't1', argv: ['/opt/bin/codex'], status: 'done' }),
    terminal('t8', { name: 'live', parent: 't1', foreground: { name: 'claude.exe' }, argv: ['claude'], status: 'idle' }),
  ];
  assert.deepEqual(teammates('t1', live), [
    { name: 'fix', cli: 'Claude Code', status: 'working', parent: 'pa-0f0e0d0c' },
    { name: 'tests', cli: 'Codex', status: 'blocked', parent: 'pa-0f0e0d0c' },
    { name: 'gone', cli: 'Claude Code', status: 'ended', parent: 'pa-0f0e0d0c' },
    { name: 't7', cli: 'codex', status: 'done', parent: 'pa-0f0e0d0c' },
    { name: 'live', cli: 'claude', status: 'idle', parent: 'pa-0f0e0d0c' },
    { name: 'docs', cli: 'opencode', status: 'unreported', parent: 'fix' },
  ]);
  const crowd = Array.from({ length: 20 }, (_, i) => terminal(`t${i + 10}`, { name: `h${i}`, parent: 't1', program: claudeProgram, status: 'idle' }));
  assert.equal(teammates('t1', [live[0], ...crowd]).length, teammateLimit);
  const loop = [terminal('t1', { name: 'lead', parent: 't2' }), terminal('t2', { name: 'a', parent: 't1', program: claudeProgram })];
  assert.deepEqual(teammates('t1', loop), [{ name: 'a', cli: 'Claude Code', status: 'unreported', parent: 'lead' }]);
});

const exact = { id: 'session', task, profile: 'profile', address: 't1', command: '/bin/claude' };
const leadTerminal = terminal('t1', { name: 'pa-0f0e0d0c', status: 'working', turn: 1, cwd: '/work/app', argv: ['/bin/claude'], program: claudeProgram,
  labels: { 'pacafe.task': task, 'pacafe.session': 'session', 'pacafe.profile': 'profile' } });
const helperTerminal = terminal('t2', { name: 'fix', parent: 't1', status: 'working', program: claudeProgram });

function bridgeFixture(answers) {
  native.live = [leadTerminal, helperTerminal];
  const bridge = new DispatchBridge();
  bridge.activate({ url: 'fixture' });
  bridge.usable = () => profile('claude');
  bridge.sessions = [{ ...exact }];
  bridge.posts = [];
  bridge.post = async op => {
    bridge.posts.push(JSON.parse(JSON.stringify(op)));
    const answer = answers.shift();
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return bridge;
}
const sent = op => op.reports.map(row => row.teammates);

test('sends teammates only after the cafe says teammates: true', async () => {
  const bridge = bridgeFixture([{ teammates: true }, {}, {}]);
  await bridge.sync([]);
  assert.deepEqual(sent(bridge.posts[0]), [undefined], 'an unknown cafe never sees the field');
  await bridge.sync([]);
  assert.deepEqual(sent(bridge.posts[1]), [[{ name: 'fix', cli: 'Claude Code', status: 'working', parent: 'pa-0f0e0d0c' }]]);
  // The cafe stopped advertising it (an older version took over).
  await bridge.sync([]);
  assert.deepEqual(sent(bridge.posts[2]), [undefined]);
});

test('an older cafe that refuses the field gets the plain report once, then the flag is learned again', async () => {
  const refused = Object.assign(new Error('HTTP 400'), { status: 400 });
  const bridge = bridgeFixture([{ teammates: true }, refused, { teammates: true }, { teammates: true }, {}]);
  await bridge.sync([]);
  await bridge.sync([]);
  assert.ok(sent(bridge.posts[1])[0], 'tried with the list');
  assert.deepEqual(sent(bridge.posts[2]), [undefined], 'the retry is plain');
  assert.equal(bridge.teamReports, false, 'a compatible answer does not teach the flag');
  await bridge.sync([]);
  assert.deepEqual(sent(bridge.posts[3]), [undefined]);
  await bridge.sync([]);
  assert.ok(sent(bridge.posts[4])[0], 'learned again from the next plain answer');
});

test('a lead missing from the snapshot sends no list, so the cafe keeps the last one', async () => {
  const bridge = bridgeFixture([{ teammates: true }, {}]);
  await bridge.sync([]);
  native.live = [helperTerminal];
  native.answers = [{ code: 1, stdout: '' }];
  await bridge.sync([]);
  assert.deepEqual(sent(bridge.posts[1]), [undefined]);
});
