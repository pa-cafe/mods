import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';

const scanner = process.env.PACAFE_TEST_USAGE_SCANNER;
const exec = promisify(execFile);

test('native usage helper reads synthetic history, previews offline and uploads only after matched scoped proof',
  { skip: !scanner, timeout: 30_000 }, async t => {
    const fresh = await mkdtemp(join(tmpdir(), 'pacafe-native-usage-test-'));
    t.after(() => rm(fresh, { recursive: true, force: true }));
    const home = join(fresh, 'home'), profile = join(fresh, 'profile'), mod = join(profile, 'mods', 'pacafe-desktop');
    const config = join(home, '.config', 'tokscale'), codex = join(home, '.codex'), claude = join(home, '.claude');
    const linked = join(profile, 'data', 'pacafe-desktop-link');
    const day = '2026-09-20';
    const sessions = join(codex, 'sessions', '2026', '09', '20');
    await mkdir(join(profile, 'mods'), { recursive: true });
    await cp(fileURLToPath(new URL('../pacafe-desktop/', import.meta.url)), mod, { recursive: true, filter: src => !src.endsWith('/bin') });
    await Promise.all([mkdir(sessions, { recursive: true }), mkdir(claude, { recursive: true }), mkdir(join(config, 'cache'), { recursive: true }),
      mkdir(join(mod, 'bin'), { recursive: true }), mkdir(linked, { recursive: true })]);
    const binary = join(mod, 'bin', process.platform === 'win32' ? 'pacafe-tokscale-history.exe' : 'pacafe-tokscale-history');
    await copyFile(scanner, binary);
    await chmod(binary, 0o700);
    const token = 'tt_' + 'Z'.repeat(43), secret = 'hdd_' + 'Y'.repeat(43), house = 'fixture-house';
    const seen = [];
    let proof = false;
    const server = createServer(async (req, res) => {
      let input = '';
      for await (const chunk of req) input += chunk;
      seen.push({ url: req.url, method: req.method, authorization: req.headers.authorization, data: input ? JSON.parse(input) : null });
      const result = req.url?.startsWith('/api/auth/token') ? proof ? { ok: true, houseMatched: true } : { user: { username: 'Older fixture' } }
        : req.url === '/api/quota' ? { pools: 1 } : { submissionId: 'isolated-fixture' };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
    await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).on('error', reject));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const url = `${origin}/api/herdr/desktop/device/00000000-0000-0000-0000-000000000001`;
    const json = (prefix, file, data) => writeFile(join(prefix, file), JSON.stringify(data), { mode: 0o600 });
    await json(linked, 'connection.json', { url, secret, cafe: 'Synthetic Cafe', house });
    await json(config, 'credentials.json', { apiUrl: origin, token });
    await json(config, 'device.json', { id: 'tokscale-existing-device', name: 'not transmitted' });
    await json(config, 'settings.json', { scanner: { bucketTimezone: 'Asia/Taipei' }, autosubmit: { enabled: false } });
    await json(config, 'cache/subscription-usage-cache.json', { timestamp: Math.floor(Date.now() / 1000), data: [
      { provider: 'Codex', account: { id: 'acct_fixture', email: 'not-transmitted@example.test' },
        metrics: [{ label: '5h', used_percent: 40, remaining_percent: 60 }] },
    ] });
    const usage = { input_tokens: 10, cached_input_tokens: 2, output_tokens: 3 };
    await writeFile(join(sessions, `rollout-${day}T16-00-00-fixture.jsonl`), [
      { timestamp: `${day}T16:00:00Z`, type: 'turn_context', payload: { model: 'gpt-5.2', rawPrompt: 'not transmitted' } },
      { timestamp: `${day}T16:00:01Z`, type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: usage, last_token_usage: usage } } },
    ].map(line => JSON.stringify(line)).join('\n') + '\n');
    const env = { HOME: home, USERPROFILE: home, CODEX_HOME: codex, CLAUDE_CONFIG_DIR: claude, TOKSCALE_CONFIG_DIR: config, TZ: 'UTC',
      PACAFE_DESKTOP_ORIGIN: origin, ...(process.platform === 'win32' && { SYSTEMROOT: process.env.SYSTEMROOT }) };
    const call = async (action, ...args) => JSON.parse((await exec(process.execPath, [join(mod, 'credentials.mjs'), action, profile, ...args], { env })).stdout);
    assert.deepEqual(await call('load'), { url, cafe: 'Synthetic Cafe', usageHelperAvailable: true });
    assert.deepEqual(await call('tokscale-usage', url, 'preview'), { history: 'preview', quota: 'preview', days: 1, accounts: 1 });
    assert.deepEqual(seen, []);
    assert.deepEqual(await call('tokscale-usage', url, 'upload'), { history: 'house-not-verified', quota: 'house-not-verified' });
    assert.deepEqual(seen.map(hit => hit.url), [`/api/auth/token?house=${house}`]);
    proof = true;
    seen.length = 0;
    const unpinned = { autosubmit: { enabled: false } };
    await json(config, 'settings.json', unpinned);
    assert.deepEqual(await call('tokscale-usage', url, 'preview'), { history: 'provisional', quota: 'preview', days: 1, accounts: 1 });
    assert.deepEqual(seen, []);
    assert.deepEqual(await call('tokscale-usage', url, 'upload'), { history: 'no-timezone', quota: 'sent' });
    assert.deepEqual(seen.map(hit => hit.url), [`/api/auth/token?house=${house}`, '/api/quota']);
    assert.deepEqual(JSON.parse(await readFile(join(config, 'settings.json'), 'utf8')), unpinned);
    assert.deepEqual(JSON.parse(await readFile(join(config, 'device.json'), 'utf8')),
      { id: 'tokscale-existing-device', name: 'not transmitted' });
    await json(config, 'settings.json', { scanner: { bucketTimezone: 'Asia/Taipei' }, autosubmit: { enabled: false } });
    seen.length = 0;
    assert.deepEqual(await call('tokscale-usage', url, 'upload'), { history: 'sent', quota: 'sent' });
    assert.deepEqual(seen.map(hit => [hit.url, hit.method]), [[`/api/auth/token?house=${house}`, 'GET'], ['/api/submit', 'POST'], ['/api/quota', 'POST']]);
    assert.ok(seen.every(hit => hit.authorization === 'Bearer ' + token));
    assert.deepEqual(seen[1].data.device, { id: 'tokscale-existing-device' });
    assert.equal(seen[1].data.contributions[0].totals.tokens, 13);
    assert.equal(seen[1].data.contributions[0].date, '2026-09-21');
    assert.deepEqual(seen[2].data.data[0].account, { id: 'acct_fixture' });
    assert.doesNotMatch(JSON.stringify(seen.map(hit => hit.data)), /not[ -]transmitted|hdd_|rollout-|\.codex|rawPrompt/u);
  });
