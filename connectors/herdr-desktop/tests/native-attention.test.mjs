import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nativeAttentionTarget } from '../pacafe-desktop/session.js';

const profile = { id: 'profile', on: null, folder: '/fixture', lifecycle: 'codex' };
const session = { id: 'session', task: 'task', command: '/fixture/codex', address: 't1' };
const paneList = [{ pane: 'attached', terminal: 't1' }, { pane: 'other', terminal: 't2' }];
const terminal = {
  address: 't1', cwd: profile.folder, argv: [session.command], state: 'live', reason: null, pid: 301, created_ms: 41,
  foreground: { pid: 301, cwd: profile.folder, argv: [session.command] },
  status: { state: 'blocked', app: 'codex' },
  labels: { 'pacafe.task': 'task', 'pacafe.profile': 'profile', 'pacafe.session': 'session' },
};

test('identifies only the exact attached native terminal for a waiting local agent', () => {
  assert.deepEqual(nativeAttentionTarget(profile, session, terminal, paneList),
    { binding: 't1:301:41', pane: 'attached' });
  assert.deepEqual(nativeAttentionTarget({ ...profile, lifecycle: 'claude' }, session,
    { ...terminal, status: 'blocked', report: { app: 'claude-code' } }, paneList),
    { binding: 't1:301:41', pane: 'attached' });
  assert.notEqual(nativeAttentionTarget(profile, session, { ...terminal, created_ms: 42 }, paneList).binding, 't1:301:41');
  assert.notEqual(nativeAttentionTarget(profile, session, terminal, [{ terminal: 't1', pane: 'moved' }]).pane, 'attached');
});

test('never offers the native shortcut for stale, unapproved, unrelated, or unattached sessions', () => {
  for (const input of [
    { status: { state: 'working', app: 'codex' } }, { status: { state: 'blocked', app: 'other' } },
    { labels: { ...terminal.labels, 'pacafe.session': 'other' } }, { state: 'finished' },
    { foreground: { ...terminal.foreground, pid: 302 } }, { cwd: '/other' }, { reason: 'process-lost' }, { address: 't2' },
  ]) assert.equal(nativeAttentionTarget(profile, session, { ...terminal, ...input }, paneList), null);
  for (const candidate of [null, { ...profile, on: 'remote' }, { ...profile, lifecycle: 'generic' }]) {
    assert.equal(nativeAttentionTarget(candidate, session, terminal, paneList), null);
  }
  assert.equal(nativeAttentionTarget(profile, session, terminal, paneList.slice(1)), null);
});
