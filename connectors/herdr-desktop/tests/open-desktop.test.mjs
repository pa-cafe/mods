import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { consumeOpenRequest, openDesktop } from '../pacafe-desktop/open-desktop.mjs';

test('an explicit opener is one-shot and never toggles an already-open Settings panel', async t => {
  const home = mkdtempSync(join(tmpdir(), 'pa-open-test-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const desktop = join(home, 'desktop');
  const calls = join(home, 'calls');
  writeFileSync(desktop, `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const [command,...args] = process.argv.slice(2);
if (command === 'status') console.log(JSON.stringify({ overlays: fs.existsSync(path.join(process.env.HERDR_APP_HOME, 'overlay')) ? ['pacafe-desktop'] : [] }));
else { fs.appendFileSync(path.join(process.env.HERDR_APP_HOME,'calls'),JSON.stringify([command,...args])+'\\n'); console.log('{}'); }
`);
  chmodSync(desktop, 0o700);
  await Promise.all([openDesktop(home, desktop, false), openDesktop(home, desktop, false)]);
  assert.deepEqual(JSON.parse(readFileSync(calls, 'utf8')), ['do', 'mod.open', '{"name":"pacafe-desktop"}']);
  assert.equal(consumeOpenRequest(home), true);
  assert.equal(consumeOpenRequest(home), false);
  writeFileSync(join(home, 'overlay'), '');
  rmSync(calls);
  await openDesktop(home, desktop, false);
  assert.equal(existsSync(calls), false);
  assert.equal(consumeOpenRequest(home), false);
});

test('a stale or invalid bootstrap request cannot open anything later', t => {
  const home = mkdtempSync(join(tmpdir(), 'pa-open-expiry-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const dir = join(home,'data','pacafe-desktop-link');
  const target = join(dir,'open-request.json');
  mkdirSync(dir, { recursive: true });
  for (const text of ['{malformed', '{"created":10001}', '{"created":90000}']) {
    writeFileSync(target, text);
    assert.equal(consumeOpenRequest(home,50000), false);
    assert.equal(existsSync(target), false);
  }
});
