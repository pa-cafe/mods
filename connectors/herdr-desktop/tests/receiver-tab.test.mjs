import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { receiverTabCommand } from '../pacafe-desktop/receiver-tab.js';

const local = (id, tabs, active = false) => ({ id, machine: null, active, tabs: tabs.map(id => ({ id })) });

test('starts a single local receiver without needing or touching a personal layout', t => {
  const dir = mkdtempSync(join(tmpdir(), 'herdr-personal-layout-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'my-main.json');
  const personal = Buffer.from('{\n  "id": "keep-layout", "custom": {"color": "#000000"}\n}\n');
  writeFileSync(file, personal);
  const remote = { id: 'ssh', machine: 'work-mac', active: true, tabs: [{ id: 'remote-tab' }] };
  const command = receiverTabCommand([remote, local('local', [])], [{ mod: 'pacafe-desktop', tab: 'remote-tab' }]);
  assert.deepEqual(command, ['tab.new', { mod: 'pacafe-desktop', space: 'local', name: 'PA Cafe', props: { role: 'receiver' }, focus: true }]);
  assert.deepEqual(readFileSync(file), personal);
  assert.equal(receiverTabCommand([remote], []), null);
});

test('reuses a restored or renamed receiver even if a different local Space is focused', () => {
  const spaces = [local('foreground', ['ordinary'], true), local('back', ['receiver'])];
  assert.deepEqual(receiverTabCommand(spaces, [
    { mod: 'other-mod', tab: 'ordinary', title: 'PA Cafe' }, { mod: 'pacafe-desktop', tab: 'receiver', title: 'Renamed pane' },
  ]), ['tab.select', { id: 'receiver' }]);
});
