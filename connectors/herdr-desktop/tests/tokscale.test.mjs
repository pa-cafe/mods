import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { historyEnvelope, observedQuota, sameOriginToken, stableDevice, syncTokscale } from '../pacafe-desktop/tokscale.mjs';

const origin = 'https://fixture.example';
const house = 'fixture-house';
const token = 'tt_' + 'A'.repeat(43);
const now = 1_790_000_000_000;
const day = { date: '2026-09-20', totals: { tokens: 7, cost: 0, messages: 1, costIsComplete: false },
  clients: [{ client: 'codex', modelId: 'model-fixture', providerId: 'openai', tokens: { input: 5, output: 2, cacheRead: 0, cacheWrite: 0, reasoning: 0 }, cost: 0, messages: 1 }] };
const graph = { meta: { generatedAt: new Date(now).toISOString(), version: '4.20.1' }, contributions: [day] };
const quota = { timestamp: now / 1000, data: [{ provider: 'Codex', email: 'do-not-send@example.test',
  account: { id: 'account-abcd', label: 'Do not send' }, metrics: [{ label: '5h', remaining_percent: 30,
    used_percent: 70, resets_at: '2026-09-21T00:00:00Z', remaining_label: 'private' }] }] };

async function fixture(t, extra = {}) {
  const home = await mkdtemp(join(tmpdir(), 'pacafe-usage-test-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const config = join(home, '.config', 'tokscale');
  await mkdir(join(config, 'cache'), { recursive: true });
  const save = (file, body) => writeFile(join(config, file), JSON.stringify(body));
  await save('credentials.json', { apiUrl: origin, token, username: 'Synthetic username' });
  await save('device.json', { id: 'existing_device', name: 'Do not send' });
  await save('settings.json', { scanner: { bucketTimezone: 'Asia/Taipei' }, autosubmit: { enabled: false } });
  await save('cache/subscription-usage-cache.json', quota);
  const calls = [];
  const semaphore = { locked: false };
  const opts = { env: { TOKSCALE_CONFIG_DIR: config, HOME: home }, home, house, lockFile: join(home, 'upload.lock'), now: () => now,
    lock: async () => {
      if (semaphore.locked) return { error: 'busy' };
      semaphore.locked = true;
      return { signal: new AbortController().signal, release: () => { semaphore.locked = false; } };
    },
    scan: async scanner => { assert.equal(scanner.bucketTimezone, 'Asia/Taipei'); return graph; },
    request: async (url, init) => {
      calls.push({ url, init });
      const reply = url.pathname === '/api/auth/token' ? { ok: true, houseMatched: true, user: { username: 'Synthetic' } }
        : url.pathname === '/api/quota' ? { pools: 1 } : { submissionId: 'fixture-submission' };
      return Response.json(reply);
    }, ...extra };
  return { opts, calls, save, config, semaphore };
}

test('default preview uses no network nor login and only returns counts', async t => {
  const f = await fixture(t);
  await rm(join(f.config, 'credentials.json'));
  assert.deepEqual(await syncTokscale(origin, f.opts), { history: 'preview', quota: 'preview', days: 1, accounts: 1 });
  assert.deepEqual(f.calls, []);
});

test('explicit upload preserves the existing owner/device partition and scoped payloads', async t => {
  const f = await fixture(t);
  const before = await readFile(join(f.config, 'settings.json'), 'utf8');
  assert.deepEqual(await syncTokscale(origin, { ...f.opts, mode: 'upload' }), { history: 'sent', quota: 'sent' });
  assert.deepEqual(f.calls.map(({ url, init }) => [url.pathname, init.method]), [['/api/auth/token', 'GET'], ['/api/submit', 'POST'], ['/api/quota', 'POST']]);
  assert.equal(f.calls[0].url.searchParams.get('house'), house);
  assert.ok(f.calls.every(({ url, init }) => url.origin === origin && init.redirect === 'error' && init.headers.Authorization === 'Bearer ' + token));
  const sent = JSON.parse(f.calls[1].init.body);
  assert.deepEqual(sent, { ...graph, device: { id: 'existing_device' } });
  const observed = JSON.parse(f.calls[2].init.body);
  assert.equal(observed.timestamp, quota.timestamp);
  assert.deepEqual(observed.data, [{ provider: 'Codex', account: { id: 'account-abcd' },
    metrics: [{ label: '5h', used_percent: 70, remaining_percent: 30, resets_at: '2026-09-21T00:00:00Z' }] }]);
  assert.equal(await readFile(join(f.config, 'settings.json'), 'utf8'), before);
});

test('history envelope never forwards new scanner fields, paths, or arbitrary cost details', () => {
  const incoming = { meta: { ...graph.meta, rawPrompt: 'private' }, contributions: [{ ...day, path: '/synthetic/private',
    totals: { ...day.totals, costIsComplete: true, raw: 'private' }, clients: [{ ...day.clients[0], command: 'private',
      tokens: { ...day.clients[0].tokens, raw: 'private' }, costMetadata: { source: '/private' } }] }] };
  const result = historyEnvelope(incoming, { id: 'fixture', name: 'private' });
  assert.equal(result.contributions[0].totals.costIsComplete, false);
  assert.deepEqual(result.contributions[0].clients[0].costMetadata,
    { currency: 'USD', provenance: 'estimated', pricingVersion: null, source: 'Tokscale core cache' });
  assert.doesNotMatch(JSON.stringify(result), /private|command|rawPrompt/);
  incoming.contributions[0].clients[0].modelId = '/home/fixture/data';
  assert.equal(historyEnvelope(incoming, { id: 'fixture' }), null);
});
test('older host, different house, or absent owner match cannot receive usage', async t => {
  const f = await fixture(t);
  for (const reply of [Response.json({ user: { username: 'Synthetic' } }), Response.json({}, { status: 403 }),
    Response.json({ ok: true, houseMatched: false })]) {
    const hits = [];
    const result = await syncTokscale(origin, { ...f.opts, mode: 'upload', scan: () => assert.fail('must not scan'),
      request: async url => { hits.push(url.pathname); return reply; } });
    assert.deepEqual(result, { history: 'house-not-verified', quota: 'house-not-verified' });
    assert.deepEqual(hits, ['/api/auth/token']);
  }
});

test('another origin, stale quota and unstable device never produce those uploads', async t => {
  const f = await fixture(t);
  assert.equal(sameOriginToken({ apiUrl: 'https://wrong.example', token }, origin), null);
  assert.equal(sameOriginToken({ apiUrl: origin + '/other', token }, origin), null);
  assert.equal(stableDevice({ id: 'old' }, 'new'), null);
  assert.equal(historyEnvelope({ ...graph, contributions: [{ clients: [{ client: 'cursor' }] }] }, { id: 'old' }), null);
  assert.equal(observedQuota(quota, now + 301_000), null);
  assert.equal(observedQuota({ ...quota, data: [{ ...quota.data[0], freshness: { stale: true, fetched_at: now / 1000 } }] }, now), null);
  await f.save('credentials.json', { apiUrl: 'https://other.example', token });
  assert.deepEqual(await syncTokscale(origin, { ...f.opts, mode: 'upload' }), { history: 'connect', quota: 'connect' });
  assert.deepEqual(f.calls, []);
});

test('does not overlap autosubmit or another local process and does not send after disconnect', async t => {
  const f = await fixture(t);
  f.semaphore.locked = true;
  assert.deepEqual(await syncTokscale(origin, { ...f.opts, mode: 'upload' }), { history: 'busy', quota: 'busy' });
  f.semaphore.locked = false;
  await f.save('settings.json', { scanner: { bucketTimezone: 'Asia/Taipei' }, autosubmit: { enabled: true } });
  assert.deepEqual(await syncTokscale(origin, { ...f.opts, mode: 'upload' }), { history: 'autosubmit', quota: 'autosubmit' });
  assert.deepEqual(f.calls, []);
  await f.save('settings.json', { scanner: { bucketTimezone: 'Asia/Taipei' }, autosubmit: { enabled: false } });
  let paired = true;
  const result = await syncTokscale(origin, { ...f.opts, mode: 'upload', permitted: () => paired, scan: async () => { paired = false; return graph; } });
  assert.deepEqual(result, { history: 'disconnected', quota: 'disconnected' });
  assert.deepEqual(f.calls.map(({ url }) => url.pathname), ['/api/auth/token']);
});
