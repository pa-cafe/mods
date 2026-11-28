import assert from 'node:assert/strict';
import test from 'node:test';
import { changePermissionChoices, defaultPermissions, permissionSelected, planPermissions, spacePermissionKey } from '../pacafe-desktop/dispatch-permissions.js';

test('new Spaces are selected and no Agent is allowed until the user chooses one', () => {
  const here = { on: null, core: 'core', space: 'here', folder: '/here', key: 'codex' };
  const there = { ...here, space: 'there', folder: '/there' };
  const options = [here, there];
  const start = defaultPermissions();
  assert.ok(permissionSelected(start, 'spaces', spacePermissionKey(here)));
  assert.ok(!permissionSelected(start, 'agents', 'codex'));
  assert.deepEqual(planPermissions(start, [], options).profiles, []);
  let after = changePermissionChoices(start, 'spaces', [spacePermissionKey(here)], false);
  after = changePermissionChoices(after, 'agents', ['codex'], true);
  assert.deepEqual(planPermissions(after, [], options).profiles, [there]);
  after = changePermissionChoices(after, 'agents', ['codex'], false);
  assert.deepEqual(planPermissions(after, [], options).profiles, []);
});
