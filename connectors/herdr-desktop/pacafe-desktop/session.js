export function addressMatches(profile, address) {
  if (typeof address !== 'string') return false;
  const prefix = profile.on === null ? '' : `${profile.on}/`;
  return address.startsWith(prefix) && /^t[a-z0-9]+$/.test(address.slice(prefix.length));
}
export function matches(profile, session, terminal) {
  return addressMatches(profile, session.address) && terminal?.address === session.address &&
    terminal.labels?.['pacafe.task'] === session.task && terminal.labels?.['pacafe.session'] === session.id &&
    terminal.labels?.['pacafe.profile'] === profile.id && terminal.cwd === profile.folder && terminal.argv?.[0] === session.command;
}

export function localAliasCandidate(profile, terminal) {
  const foreground = terminal?.foreground?.cwd;
  return profile.on === null && profile.folder.startsWith('/tmp/') && foreground === `/private${profile.folder}` ? foreground : null;
}

export function liveBinding(profile, session, terminal, realFolder = profile.folder) {
  if (!matches(profile, session, terminal) || terminal.state !== 'live' || terminal.reason !== null ||
      !Number.isSafeInteger(terminal.pid) || terminal.pid <= 0 || !Number.isSafeInteger(terminal.created_ms) ||
      terminal.foreground?.pid !== terminal.pid || terminal.foreground.cwd !== realFolder ||
      terminal.foreground.argv?.[0] !== session.command) return null;
  return `${terminal.address}:${terminal.pid}:${terminal.created_ms}`;
}

export function sendStatus(profile, terminal) {
  const report = terminal?.report ?? terminal?.status;
  if (profile.lifecycle === 'generic' || (profile.lifecycle === 'codex' ? report?.app !== 'codex' : !['claude', 'claude-code'].includes(report?.app))) return null;
  const status = typeof terminal.status === 'string' ? terminal.status : report.state;
  // Core's atomic --if guard supports idle and working. A kept terminal can
  // recover as a shell, so never send to it without that guard.
  return ['idle', 'working'].includes(status) || (status === 'done' && terminal.keep === false) ? status : null;
}

// Keep this wire boundary in sync with shared/herdr-desktop.ts in the cafe host.
// The host normalizes CRLF. TAB and LF are data; lone CR and other controls are not.
// eslint-disable-next-line no-control-regex
const terminalControls = /[\x00-\x08\x0b-\x1f\x7f-\x9f]/u;
export const validMessage = text => typeof text === 'string' && text.length <= 1000 &&
  text.trim().length > 0 && !terminalControls.test(text);

// The native terminal receives one physical line regardless of the chat's
// whitespace. If its foreground changes to a shell, the leading colon is
// a shell no-op, and its JSON argument contains no shell interpolation.
// Keep the framing neutral: this is input for the current terminal agent.
const shellSpecial = new Set('"\'\\$`%!^&|<>(){}[];#*?~');
export function agentMessage(text) {
  let literal = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const char = text[i];
    const unsafe = code < 0x20 || (code >= 0x7f && code <= 0x9f) ||
      code === 0x2028 || code === 0x2029 || (code >= 0xd800 && code <= 0xdfff) || shellSpecial.has(char);
    literal += unsafe ? `\\u${code.toString(16).padStart(4, '0')}` : char;
  }
  return `: message JSON: "${literal}"`;
}
export async function sameMachine(profile, json) {
  const machine = profile.on === null ? (await json(['server', 'status'])).core
    : (await json(['machine', 'ls'])).machines.find(row => row.name === profile.on && row.state === 'connected');
  return machine?.id === profile.core;
}

// A permission request the agent itself reported through OSC 7501. Only this
// kind is answerable from the cafe; questions and sign-ins stay in the terminal.
// Invisible format characters (bidi overrides, zero-width) are refused: the
// barista must not approve text that reads unlike what runs.
// Keep the text boundary in sync with shared/herdr-desktop.ts in the cafe host.
// eslint-disable-next-line no-control-regex
const promptControls = /[\x00-\x08\x0b-\x1f\x7f-\x9f\u2028\u2029\p{Cf}]/u;
export function pendingPermission(profile, terminal) {
  const report = terminal?.status;
  if (!report || typeof report !== 'object' || report.state !== 'blocked' || report.kind !== 'permission') return null;
  if (profile.lifecycle === 'codex' ? report.app !== 'codex' : profile.lifecycle !== 'claude' || !['claude', 'claude-code'].includes(report.app)) return null;
  if (!Number.isSafeInteger(terminal.turn) || !Number.isSafeInteger(terminal.status_ms) || typeof report.msg !== 'string') return null;
  const text = report.msg.replaceAll('\r\n', '\n').trim();
  // Never shorten it: the barista must see the whole request they answer.
  if (!text || text.length > 500 || promptControls.test(text)) return null;
  return { turn: terminal.turn, at: terminal.status_ms, app: report.app, kind: report.kind, msg: report.msg, text };
}

// Claude Code: 1 is "Yes" for this request only. Codex: y is "Yes, proceed"
// for this request only. Esc declines in both. Never a key that approves more.
export function permissionKeys(lifecycle, answer) {
  if (answer === 'deny') return ['claude', 'codex'].includes(lifecycle) ? ['esc'] : null;
  return answer === 'approve' ? { claude: ['1'], codex: ['y'] }[lifecycle] ?? null : null;
}
