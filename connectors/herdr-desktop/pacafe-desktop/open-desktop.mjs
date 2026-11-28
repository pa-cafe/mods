// Explicit installer/open action only. No network, service, or layout edits.
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const file = home => join(home, 'data', 'pacafe-desktop-link', 'open-request.json');
const validFor = 30_000;

export function consumeOpenRequest(home, now = Date.now()) {
  if (!isAbsolute(home)) throw new Error('A full Herdr profile path is required.');
  const target = file(home);
  const consumed = `${target}.${randomUUID()}`;
  try { renameSync(target, consumed); }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  try {
    const { created } = JSON.parse(readFileSync(consumed, 'utf8'));
    return Number.isSafeInteger(created) && now >= created && now - created <= validFor;
  } catch { return false; }
  finally { rmSync(consumed, { force: true }); }
}

export async function openDesktop(home, executable, start = true) {
  if (!isAbsolute(home) || !isAbsolute(executable)) throw new Error('Full Desktop and profile paths are required.');
  const data = join(home, 'data', 'pacafe-desktop-link');
  mkdirSync(data, { recursive: true, mode: 0o700 });
  const lock = join(data, 'open-request.lock');
  try { mkdirSync(lock, { mode: 0o700 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const age = Date.now() - (statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
    if (age <= 60_000) return; // A concurrent explicit opener is already working.
    try { rmdirSync(lock); mkdirSync(lock, { mode: 0o700 }); }
    catch (error) { if (error.code === 'ENOENT' || error.code === 'EEXIST') return; throw error; }
  }
  try { await openInHerdr(home, executable, start); }
  finally { try { rmdirSync(lock); } catch { /* An expired lock may already be gone. */ } }
}

async function openInHerdr(home, executable, start) {
  const env = { ...process.env, HERDR_APP_HOME: home };
  const command = async (...args) => {
    const value = JSON.parse((await exec(executable, args, { env, timeout: 2000 })).stdout);
    if (value?.error) throw new Error('Herdr Desktop did not accept the request.');
    return value;
  };
  let status = await command('status').catch(() => null);
  if (!status && start) {
    const app = spawn(executable, [], { env, detached: true, stdio: 'ignore', windowsHide: false });
    let failure;
    app.on('error', error => { failure = error; });
    app.unref();
    const until = Date.now() + 15_000;
    while (!status && !failure && Date.now() < until) {
      await sleep(250);
      status = await command('status').catch(() => null);
    }
  }
  if (!status) throw new Error('Herdr Desktop did not open. Open it and run the PA Cafe tab command again.');
  // mod.open toggles overlays. Never close a Settings panel a person is using.
  if (status.overlays?.includes('pacafe-desktop')) return;
  const target = file(home);
  const staged = `${target}.${randomUUID()}`;
  writeFileSync(staged, JSON.stringify({ created: Date.now() }), { flag: 'wx', mode: 0o600 });
  try {
    renameSync(staged, target);
    await command('do', 'mod.open', JSON.stringify({ name: 'pacafe-desktop' }));
  } catch (error) {
    rmSync(target, { force: true });
    throw error;
  } finally { rmSync(staged, { force: true }); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  const [operation, home, executable] = process.argv.slice(2);
  try {
    if (operation === 'consume') process.stdout.write(JSON.stringify(consumeOpenRequest(home)));
    else if (operation === 'open' || operation === 'show') await openDesktop(home, executable, operation === 'open');
    else throw new Error('Expected open, show or consume.');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
