import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { isOwnedSpace, ownedPlacement, ownedSpaceLabels } from '../pacafe-desktop/owned-space.js';

const helper = fileURLToPath(new URL('../pacafe-desktop/credentials.mjs', import.meta.url));
const session = '01234567-89ab-cdef-0123-456789abcdef';

test('uses one stable Core-derived Space ID across aliases/reconnects without reusing a display name or path', t => {
  const home = mkdtempSync(join(tmpdir(), 'pa-space-test-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const key = id => JSON.parse(execFileSync(process.execPath, [helper, 'owned-space', home, id], { encoding: 'utf8' }));
  const first = key('fixture-first-core');
  assert.equal(first, key('fixture-first-core'));
  assert.notEqual(first, key('fixture-other-core'));
  assert.equal(isOwnedSpace('PA Cafe', null), false);
  assert.equal(isOwnedSpace(first, null), true);
  assert.equal(isOwnedSpace(`remote/${first}`, 'remote'), true);
  assert.equal(isOwnedSpace(`mistaken/${first}`, 'remote'), false);
  assert.deepEqual(ownedSpaceLabels(first, session), [
    `herdr.space=${first}`, 'herdr.tab=tb-pacafe-0123456789abcdef0123456789abcdef',
  ]);
  assert.throws(() => ownedSpaceLabels('PA Cafe', session));
});

test('only names the owned unnamed Space with confirmed placement and never pulls user-moved tabs back', () => {
  const id = 'sp-pacafe-111111111111111111111111';
  const tab = { pane: 'pane', terminal: 'remote/t9', tab: 'owned-tab' };
  const ours = { id: `remote/${id}`, machine: 'remote', named: false, tabs: [{ id: tab.tab }] };
  const other = { id: 'remote/user', machine: 'remote', named: true, name: 'PA Cafe', tabs: [{ id: 'user-tab' }] };
  assert.deepEqual(ownedPlacement(id, 'remote', tab.terminal, [ours, other], [tab]), { pane: 'pane', rename: ours.id });
  assert.deepEqual(ownedPlacement(id, 'remote', tab.terminal, [{ ...ours, named: true }], [tab]), { pane: 'pane', rename: null });
  assert.deepEqual(ownedPlacement(id, 'remote', tab.terminal, [other], [{ ...tab, tab: 'user-tab' }]), { pane: 'pane', rename: null });
  assert.equal(ownedPlacement(id, 'remote', tab.terminal, [ours, other], []), null);
});
