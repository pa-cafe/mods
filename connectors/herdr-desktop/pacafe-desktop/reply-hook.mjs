import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import { liveBinding, localAliasCandidate } from './session.js';

export const replyId = value => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
export const replyName = session => `reply-${session}.json`;
export const codexBindingName = session => `codex-thread-${session}.json`;
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";

export function hookArguments(executable, script, folder, session, nonce) {
  if (!replyId(session) || !replyId(nonce)) return [];
  const command = [executable, script, folder, session, nonce].map(quote).join(' ');
  return ['--session-id', session, '--settings', JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command, timeout: 3 }] }] } })];
}

// Native Stop/UserPromptSubmit payload and session-level config flags:
// https://developers.openai.com/codex/hooks
export function codexHookArguments(executable, script, folder) {
  // Keep the hook command and trust hash stable across dispatches. The local
  // Core terminal identity is resolved at invocation, never from the payload.
  const command = [executable, script, folder, 'codex'].map(quote).join(' ');
  const handler = `[{hooks=[{type="command",command=${JSON.stringify(command)},timeout=3}]}]`;
  return ['-c', `hooks.UserPromptSubmit=${handler}`, '-c', `hooks.Stop=${handler}`];
}

export function finalReply(input, session, nonce) {
  if (!replyId(session) || !replyId(nonce) || input?.session_id !== session || input?.hook_event_name !== 'Stop' ||
      typeof input.last_assistant_message !== 'string') return null;
  return replyText(input.last_assistant_message, nonce);
}

function replyText(message, nonce) {
  // eslint-disable-next-line no-control-regex
  const text = message.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '').trim().slice(0, 8000);
  return text ? { id: randomUUID(), nonce, text, time: Date.now() } : null;
}

function codexSession(state) {
  // Core gives the foreground program these values: https://herdr.dev/core/
  // Always recheck local Core and the approved task's terminal labels so
  // identical short addresses on two Cores cannot alias.
  const address = process.env.HC_TERMINAL_ID;
  const socket = process.env.HC_TERMINAL_SOCKET ?? process.env.HC_SOCKET;
  if (!/^t[a-z0-9]+$/.test(address ?? '') || !socket || !isAbsolute(socket)) return null;
  const row = state.sessions?.find(row => row.address === address && row.replyPolicy === 1 && row.replyLifecycle === 'codex');
  const profile = state.profiles?.find(profile => profile.id === row?.profile && profile.on === null && profile.lifecycle === 'codex');
  if (!profile || !replyId(row.id) || !replyId(row.replyNonce)) return null;
  const options = { env: { ...process.env, HC_SOCKET: socket }, encoding: 'utf8', timeout: 800, maxBuffer: 262_144 };
  const get = (...args) => JSON.parse(execFileSync('hc', [...args, '--json'], options));
  if (get('server', 'status').core?.id !== profile.core) return null;
  const terminal = get('get', address);
  const alias = localAliasCandidate(profile, terminal);
  const binding = liveBinding(profile, row, terminal) || (alias && realpathSync(profile.folder) === alias && liveBinding(profile, row, terminal, alias));
  return binding ? { session: row.id, nonce: row.replyNonce, profile } : null;
}

function codexReply(folder, input, session, nonce, profile) {
  if (!replyId(input?.session_id) || typeof input.turn_id !== 'string' || !input.turn_id || input.agent_id ||
      input.turn_id.length > 200 || typeof input.cwd !== 'string' ||
      realpathSync(input.cwd) !== realpathSync(profile.folder)) return null;
  const binding = join(folder, codexBindingName(session));
  if (input.hook_event_name === 'UserPromptSubmit') {
    // Pin the first trusted foreground conversation. Do not adopt /fork, a
    // nested thread, or an unrelated Codex process later in the same terminal.
    try { writeFileSync(binding, JSON.stringify({ thread: input.session_id, nonce }), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    return null;
  }
  if (input.hook_event_name !== 'Stop' || input.stop_hook_active === true || typeof input.last_assistant_message !== 'string') return null;
  const bound = JSON.parse(readFileSync(binding, 'utf8'));
  if (bound.thread !== input.session_id || bound.nonce !== nonce) return null;
  const reply = replyText(input.last_assistant_message, nonce);
  if (!reply) return null;
  // Retries/repeated Stop for the same Codex turn must remain one bubble.
  const bytes = createHash('sha256').update(JSON.stringify([nonce, bound.thread, input.turn_id])).digest().subarray(0, 16);
  bytes[6] = 0x80 | (bytes[6] & 0x0f); // RFC 9562 custom UUIDv8.
  bytes[8] = 0x80 | (bytes[8] & 0x3f);
  const hex = bytes.toString('hex');
  return { ...reply, id: [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [folder, sessionArg, nonceArg] = process.argv.slice(2);
  const codex = sessionArg === 'codex';
  try {
    const state = JSON.parse(readFileSync(join(folder, 'dispatch.json'), 'utf8'));
    const target = codex ? codexSession(state) : replyId(sessionArg) && replyId(nonceArg) &&
      state.sessions?.some(row => row.id === sessionArg && row.replyNonce === nonceArg && row.replyPolicy === 1 && row.replyLifecycle === 'claude') &&
      { session: sessionArg, nonce: nonceArg };
    if (!target) throw new Error('Reply sharing unavailable');
    const { session, nonce, profile } = target;
    const chunks = [];
    let size = 0;
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > 1024 * 1024) break;
      chunks.push(chunk);
    }
    const input = size <= 1024 * 1024 && JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const reply = input && (codex ? codexReply(folder, input, session, nonce, profile) : finalReply(input, session, nonce));
    if (reply) {
      mkdirSync(folder, { recursive: true, mode: 0o700 });
      const temp = join(folder, randomUUID());
      writeFileSync(temp, JSON.stringify({ ...reply, ...(codex && { lifecycle: 'codex' }) }), { flag: 'wx', mode: 0o600 });
      try { renameSync(temp, join(folder, replyName(session))); } finally { rmSync(temp, { force: true }); }
    }
  } catch { /* A capture failure must never block the agent. */ }
  if (codex) process.stdout.write('{}');
}
