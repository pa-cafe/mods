import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

test('receiver shortcut revalidates the clicked pane and only ever dispatches pane.focus', async () => {
  const profile = { id: 'profile', on: null, core: 'local', space: 'approved-space', folder: '/fixture',
    key: 'codex', lifecycle: 'codex', agent: 'Codex', workspace: 'Fixture' };
  const session = { id: 'session', task: 'task', profile: profile.id, command: '/fixture/codex', address: 't1' };
  const terminal = { address: 't1', cwd: profile.folder, argv: [session.command], state: 'live', reason: null, pid: 301, created_ms: 41,
    foreground: { pid: 301, cwd: profile.folder, argv: [session.command] }, status: { state: 'blocked', app: 'codex' },
    labels: { 'pacafe.task': session.task, 'pacafe.profile': profile.id, 'pacafe.session': session.id } };
  let queried = terminal, nativePane = { pane: 'attached', terminal: 't1' }, allowProfile = true;
  const commands = [], callbacks = new Map(), calls = [];
  let spawned;
  const cx = { spawn: fn => { spawned = fn(cx); }, notify() {} };
  const builder = () => {
    let id, element;
    element = new Proxy({}, { get(_obj, key) {
      return (...args) => {
        if (key === 'id') id = args[0];
        if (key === 'on_click' && id) callbacks.set(id, () => args[0](null, cx));
        if (key === 'when' && args[0]) return args[1](element);
        return element;
      };
    } });
    return element;
  };
  globalThis.__paNativeAttentionTest = {
    builder, checking: () => false, props: () => ({}), window: () => ({ platform: 'linux' }),
    theme: () => ({ raised: '#121212', hover: '#222222', surface: '#444444', foreground: '#eeeeee', muted: '#555555' }),
    run: (command, args) => commands.push([command, args]), terminals: () => [terminal], panes: () => [nativePane],
    spaces: () => [{ id: profile.space, machine: null, folder: profile.folder }],
    hc: async args => { calls.push(args); return { code: 0, stdout: JSON.stringify(args[0] === 'server' ? { core: { id: profile.core } } : queried) }; },
  };
  const sdk = {
    'gpui-kit': 'class View {} const div=s.builder,image=s.builder; export { View, div, image };',
    'gpui-base': 'const Button={},Checkbox={},Input={},InputState={},h_flex=s.builder,v_flex=s.builder; export {Button,Checkbox,Input,InputState,h_flex,v_flex};',
    herdr: 'const {checking,props,window,theme,run,terminals,panes,spaces,hc}=s; const appHome=()=>{},closeOverlay=()=>{},exec=()=>{},focused=()=>{},pickFolder=()=>{},knownAgents=()=>[]; export {checking,props,window,theme,run,terminals,panes,spaces,hc,appHome,closeOverlay,exec,focused,pickFolder,knownAgents};',
  };
  const hook = registerHooks({ resolve(specifier, context, next) {
    const source = sdk[specifier];
    return source ? { url: 'data:text/javascript,' + encodeURIComponent('const s=globalThis.__paNativeAttentionTest;' + source), shortCircuit: true }
      : next(specifier, context);
  } });
  let view, bridgeRun, prototype;
  try {
    const { DispatchBridge } = await import('../pacafe-desktop/bridge.js');
    prototype = DispatchBridge.prototype;
    bridgeRun = prototype.run;
    prototype.run = async () => {};
    const { default: PACafeDesktop } = await import('../pacafe-desktop/main.js');
    view = new PACafeDesktop();
    view.init({}, cx);
    await spawned;
    const bridge = view.ownedBridge;
    bridge.connection = { url: 'http://127.0.0.1' };
    bridge.sessions = [session];
    bridge.usable = id => id === profile.id && allowProfile ? profile : null;
    const button = 'attention-' + session.id;
    const click = async () => {
      assert.ok(callbacks.has(button));
      callbacks.get(button)();
      await spawned;
    };

    view.render();
    queried = { ...terminal, created_ms: 42 };
    await click();
    assert.deepEqual(commands, []);
    assert.match(view.attentionError, /不在等候/);
    queried = terminal;
    nativePane = { pane: 'changed', terminal: 't1' };
    await click();
    assert.deepEqual(commands, []);
    nativePane = { pane: 'attached', terminal: 't1' };
    allowProfile = false;
    await click();
    assert.deepEqual(commands, []);
    allowProfile = true;
    await click();
    assert.deepEqual(commands, [['pane.focus', { pane: 'attached' }]]);
    assert.ok(calls.every(args => JSON.stringify(args) === '["server","status","--json"]' ||
      JSON.stringify(args) === '["get","t1","--json"]'));
  } finally {
    view?.close();
    if (prototype) prototype.run = bridgeRun;
    hook.deregister();
    delete globalThis.__paNativeAttentionTest;
  }
});
