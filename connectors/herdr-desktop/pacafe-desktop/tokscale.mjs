import { spawn } from 'node:child_process';
import { accessSync, constants, lstatSync } from 'node:fs';
import { open, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const maxHistory = 9 * 1024 * 1024;
const maxQuota = 250 * 1024;
const houseId = /^[a-z0-9-]{1,48}$/;
const graphTools = new Set(['codex', 'claude']);
const idPattern = /^[A-Za-z0-9._:-]{1,96}$/;
const quotaAge = 5 * 60;
const command = fileURLToPath(new URL(`./bin/pacafe-tokscale-history${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url));

export function usageHelperAvailable() {
  try { accessSync(command, constants.X_OK); return lstatSync(command).isFile(); }
  catch { return false; }
}

async function boundedBytes(file, limit) {
  const handle = await open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error('oversize');
    const bytes = Buffer.alloc(stat.size + 1);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    if (bytesRead !== stat.size) throw new Error('changed');
    return bytes.subarray(0, bytesRead);
  } finally { await handle.close(); }
}

const boundedJson = async (file, limit) => JSON.parse((await boundedBytes(file, limit)).toString('utf8'));

export function sameOriginToken(value, origin) {
  try {
    const url = new URL(value?.apiUrl);
    if (url.origin === origin && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash &&
        typeof value.token === 'string' && /^tt_[A-Za-z0-9_-]{43}$/.test(value.token)) return value.token;
  } catch { /* Missing or legacy origin cannot authorize any upload. */ }
  return null;
}

export function stableDevice(device, override) {
  if (typeof device?.id !== 'string' || !idPattern.test(device.id) || (override && override !== device.id)) return null;
  // Preserve the existing name on the server by omitting it; it can contain personal data.
  return { id: device.id };
}

const count = value => Number.isSafeInteger(value) && value >= 0;
const amount = value => Number.isFinite(value) && value >= 0;
const model = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:+/-]{0,159}$/.test(value) && !value.includes('..');
const isoTime = value => typeof value === 'string' && value.length <= 40 && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
const tokenFields = ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning'];

export function historyEnvelope(graph, device) {
  const { generatedAt, version } = graph?.meta ?? {};
  if (!device || !isoTime(generatedAt) || typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:[+-][A-Za-z0-9.-]+)?$/.test(version) ||
      !Array.isArray(graph?.contributions) || !graph.contributions.length) return null;
  const contributions = [];
  for (const day of graph.contributions) {
    if (!day || typeof day.date !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(day.date) ||
        !count(day.totals?.tokens) || !count(day.totals?.messages) || !amount(day.totals?.cost) ||
        !Array.isArray(day.clients) || !day.clients.length) return null;
    const clients = [];
    for (const row of day.clients) {
      if (!graphTools.has(row?.client) || !model(row.modelId) || !model(row.providerId) ||
          !count(row.messages) || !amount(row.cost) || !tokenFields.every(key => count(row.tokens?.[key]))) return null;
      clients.push({ client: row.client, modelId: row.modelId, providerId: row.providerId,
        tokens: Object.fromEntries(tokenFields.map(key => [key, row.tokens[key]])), cost: row.cost, messages: row.messages,
        ...(row.costMetadata && { costMetadata: { currency: 'USD', provenance: 'estimated', pricingVersion: null, source: 'Tokscale core cache' } }) });
    }
    contributions.push({ date: day.date, totals: { tokens: day.totals.tokens, messages: day.totals.messages,
      cost: day.totals.cost, costIsComplete: false }, clients });
  }
  // Project again at the upload boundary so future scanner fields cannot accidentally reach the host.
  return { meta: { generatedAt, version }, contributions, device: { id: device.id } };
}

const validPercent = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;
const label = (value, limit = 60) => typeof value === 'string' && value.length > 0 && value.length <= limit && /^[\p{L}\p{N} .()+%:_-]+$/u.test(value);
const providers = new Set(['codex', 'claude', 'claude-code', 'openai', 'anthropic']);

export function observedQuota(cache, now = Date.now()) {
  const time = Math.floor(now / 1000);
  if (!Array.isArray(cache?.data) || !Number.isSafeInteger(cache.timestamp) || cache.timestamp > time ||
      time - cache.timestamp > quotaAge) return null;
  const data = cache.data.flatMap(row => {
    const accountId = row?.account?.id;
    if (!providers.has(typeof row?.provider === 'string' ? row.provider.toLowerCase() : '') ||
        typeof accountId !== 'string' || !/^[a-zA-Z0-9:_-]{1,120}$/.test(accountId) ||
        (row.freshness && (row.freshness.stale !== false || !Number.isSafeInteger(row.freshness.fetched_at) ||
          row.freshness.fetched_at > time || time - row.freshness.fetched_at > quotaAge)) || !Array.isArray(row.metrics)) return [];
    const metrics = row.metrics.flatMap(metric => {
      if (!label(metric?.label) || !validPercent(metric.used_percent) || !validPercent(metric.remaining_percent)) return [];
      const resets_at = typeof metric.resets_at === 'string' && /^\d{4}-\d\d-\d\dT/.test(metric.resets_at) && Number.isFinite(Date.parse(metric.resets_at)) ? metric.resets_at : null;
      return [{ label: metric.label, used_percent: metric.used_percent, remaining_percent: metric.remaining_percent, resets_at }];
    }).slice(0, 8);
    return metrics.length ? [{ provider: row.provider, ...(label(row.plan, 40) ? { plan: row.plan } : {}),
      account: { id: accountId }, metrics }] : [];
  }).slice(0, 50);
  return data.length ? { timestamp: cache.timestamp, data } : null;
}

async function graph(scanner, env, config) {
  const temporary = await mkdtemp(join(tmpdir(), 'pacafe-tokscale-'));
  try {
    if (config) {
      const sandboxCache = join(temporary, 'cache');
      await mkdir(sandboxCache, { mode: 0o700 });
      for (const name of ['pricing-litellm.json', 'pricing-openrouter.json', 'pricing-models-dev.json']) {
        const prices = await boundedBytes(join(config, 'cache', name), 8 * 1024 * 1024).catch(() => null);
        if (prices) await writeFile(join(sandboxCache, name), prices, { mode: 0o600 });
      }
    }
    return await new Promise((resolve, reject) => {
      // Explicit allowlist: do not give the scanner upload tokens or API settings.
      const childEnv = { TOKSCALE_CONFIG_DIR: temporary, TOKSCALE_PRICING_CACHE_ONLY: '1' };
      for (const key of ['HOME', 'USERPROFILE', 'PATH', 'SYSTEMROOT', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'TZ']) {
        if (env[key]) childEnv[key] = env[key];
      }
      const proc = spawn(command, { env: childEnv, stdio: ['pipe', 'pipe', 'ignore'], timeout: 35_000 });
      const chunks = [];
      let size = 0;
      proc.stdout.on('data', chunk => {
        size += chunk.length;
        if (size > maxHistory) proc.kill();
        else chunks.push(chunk);
      });
      proc.stdin.on('error', reject);
      proc.on('error', reject);
      proc.on('close', code => {
        if (code !== 0 || size > maxHistory) return reject(new Error('scan'));
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { reject(new Error('scan')); }
      });
      proc.stdin.end(JSON.stringify(scanner));
    });
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

function holdLock(file) {
  return new Promise(resolve => {
    const child = spawn(command, ['--hold-lock', file], { stdio: ['pipe', 'pipe', 'ignore'],
      env: process.platform === 'win32' ? { SYSTEMROOT: process.env.SYSTEMROOT } : {} });
    const controller = new AbortController();
    let answer = '', reported = false, timer;
    const settle = value => {
      if (reported) return;
      reported = true;
      clearTimeout(timer);
      resolve(value);
    };
    const terminate = () => {
      controller.abort();
      child.kill();
      settle({ error: 'unavailable' });
    };
    timer = setTimeout(terminate, 2000);
    child.stdin.on('error', terminate);
    child.once('error', terminate);
    child.once('close', () => { controller.abort(); settle({ error: 'unavailable' }); });
    child.stdout.on('data', bytes => {
      answer += bytes;
      if (answer === 'locked\n' || answer === 'locked\r\n') {
        settle({ signal: controller.signal, release: () => child.stdin.end() });
      } else if (answer === 'busy\n' || answer === 'busy\r\n') {
        settle({ error: 'busy' });
      } else if (answer.length > 12) terminate();
    });
  });
}

/** Only a local Settings click invokes this; existing PA Cafe credentials are not moved or exposed. */
export async function syncTokscale(origin, { mode = 'preview', house, env = process.env, home = homedir(), request = fetch, scan = graph,
  now = Date.now, permitted = () => true, lockFile, lock = holdLock } = {}) {
  const config = env.TOKSCALE_CONFIG_DIR || (process.platform === 'darwin' ? join(home, '.config', 'tokscale')
    : process.platform === 'win32' ? join(env.APPDATA || join(home, 'AppData', 'Roaming'), 'tokscale')
    : join(env.XDG_CONFIG_HOME || join(home, '.config'), 'tokscale'));
  if (!isAbsolute(config)) return { history: 'unavailable', quota: 'unavailable' };
  if (mode !== 'preview' && mode !== 'upload') return { history: 'unavailable', quota: 'unavailable' };
  const uploading = mode === 'upload';
  let token;
  if (uploading) {
    if (typeof house !== 'string' || !houseId.test(house) || !permitted()) return { history: 'disconnected', quota: 'disconnected' };
    // Fork auth uses a fixed ~/.config location even when scanner config is overridden.
    const login = await boundedJson(join(home, '.config', 'tokscale', 'credentials.json'), 8192).catch(() => null);
    token = sameOriginToken(login, origin);
    if (!token) return { history: 'connect', quota: 'connect' };
  }
  if (!lockFile) return { history: 'unavailable', quota: 'unavailable' };
  const held = await lock(lockFile);
  if (!held.signal) return { history: held.error, quota: held.error };
  try {
    const settings = await boundedJson(join(config, 'settings.json'), 128 * 1024).catch(() => null);
    if (uploading) {
      if (settings?.autosubmit?.enabled !== false) return { history: 'autosubmit', quota: 'autosubmit' };
      // Old hosts may return 200 for an unrecognized query. Require the explicit
      // owner-and-house proof; neither mode guesses from a display name.
      const check = new URL('/api/auth/token', origin);
      check.searchParams.set('house', house);
      const matched = await (async () => {
        try {
          const response = await request(check, { method: 'GET', redirect: 'error',
            headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.any([held.signal, AbortSignal.timeout(5000)]) });
          if (!response.ok) return false;
          const receipt = await response.json();
          return receipt?.ok === true && receipt.houseMatched === true;
        } catch { return false; }
      })();
      if (!matched) return { history: 'house-not-verified', quota: 'house-not-verified' };
    }
    const send = async (path, data, limit) => {
      if (!permitted() || held.signal.aborted) return 'disconnected';
      const currentSettings = await boundedJson(join(config, 'settings.json'), 128 * 1024).catch(() => null);
      if (currentSettings?.autosubmit?.enabled !== false) return 'autosubmit';
      const body = JSON.stringify(data);
      if (Buffer.byteLength(body) > limit) return 'too-large';
      try {
        const response = await request(new URL(path, origin), { method: 'POST', redirect: 'error',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body, signal: AbortSignal.any([held.signal, AbortSignal.timeout(5000)]) });
        if (!response.ok) return response.status === 401 ? 'connect' : 'rejected';
        if (path === '/api/submit') {
          const receipt = await response.json();
          if (typeof receipt?.submissionId !== 'string') return 'rejected';
        }
        if (path === '/api/quota') {
          const receipt = await response.json();
          if (!Number.isSafeInteger(receipt?.pools) || receipt.pools < 1) return 'rejected';
        }
        return 'sent';
      } catch { return 'unavailable'; }
    };
    let history = 'no-device', days = 0;
    const device = stableDevice(await boundedJson(join(config, 'device.json'), 8192).catch(() => null), env.TOKSCALE_DEVICE_ID);
    if (device || !uploading) {
      // Different date buckets on the same device can make the host count the same history twice.
      const original = settings?.scanner;
      if (uploading && !original?.bucketTimezone) history = 'no-timezone';
      else {
        try {
          if (original?.bucketTimezone) new Intl.DateTimeFormat('en', { timeZone: original.bucketTimezone });
          const snapshot = await scan({ bucketTimezone: original?.bucketTimezone, extraScanPaths: original?.extraScanPaths }, env, config);
          // A preview needs no identity, never changes local Tokscale state, and exposes counts only.
          const payload = historyEnvelope(snapshot, device ?? { id: 'preview-only' });
          days = payload?.contributions.length ?? 0;
          history = !payload ? 'empty' : uploading ? await send('/api/submit', payload, maxHistory)
            : original?.bucketTimezone ? 'preview' : 'provisional';
        } catch { history = 'unavailable'; }
      }
    }
    const cache = await boundedJson(join(config, 'cache', 'subscription-usage-cache.json'), maxQuota).catch(() => null);
    const quota = observedQuota(cache, now());
    return { history, quota: !quota ? 'no-observation' : uploading ? await send('/api/quota', quota, maxQuota) : 'preview',
      ...(uploading ? {} : { days, accounts: quota?.data.length ?? 0 }) };
  } finally { held.release(); }
}
