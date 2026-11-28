import { exec, hc, knownAgents, panes, run, spaces } from 'herdr';
import { isOwnedSpace, ownedPlacement, ownedSpaceLabels } from './owned-space.js';
import { addressMatches, liveBinding, localAliasCandidate, matches, sameMachine } from './session.js';
import { codexSocketArgs, validSocket } from './team.js';

// These commands are shipped in Herdr's program table. Additional local flags
// and custom launchers are left to Herdr's normal, local agent menu.
const generic = {
  pi: 'pi', pig: 'pig', cursor: 'agent', copilot: 'copilot',
  amp: 'amp', grok: 'grok', 'dsh-tui': 'dsh-tui', goose: 'goose', antigravity: 'agy',
  kimi: 'kimi', kiro: 'kiro-cli', hermes: 'hermes', qoder: 'qodercli', muse: 'muse',
  crush: 'crush', gemini: 'gemini', ollama: 'ollama', omp: 'omp',
};
// eslint-disable-next-line no-control-regex
const absolute = path => typeof path === 'string' && /^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(path) && !/[\x00-\x1f\x7f]/.test(path);

export const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
// eslint-disable-next-line no-control-regex
export const label = value => String(value).replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, 80);
const json = async args => {
  const result = await hc([...args, '--json']);
  if (result.code !== 0) throw new Error('Herdr Core is unavailable.');
  return JSON.parse(result.stdout);
};

export function adapter(agent) {
  if (agent.shell) return null;
  if (agent.key === 'codex' && agent.run[0] === 'codex' && (agent.run.length === 1 || (agent.run.length === 2 && agent.run[1] === '--no-daemon'))) return 'codex';
  if (agent.key === 'claude' && agent.run.length === 1 && agent.run[0] === 'claude') return 'claude';
  if (agent.key === 'opencode' && agent.run.length === 1 && agent.run[0] === 'opencode') return 'opencode';
  if (agent.run.length === 1 && Object.hasOwn(generic, agent.key) && generic[agent.key] === agent.run[0]) return 'generic';
  return null;
}
export async function discovery() {
  const [{ core }, { machines }] = await Promise.all([json(['server', 'status']), json(['machine', 'ls'])]);
  const identities = new Map([[null, core], ...machines.filter(machine => machine.state === 'connected').map(machine => [machine.name, machine])]);
  const workspaces = spaces().filter(space => absolute(space.folder) && !isOwnedSpace(space.id, space.machine));
  const names = [...new Set(workspaces.map(space => space.machine))];
  /** @type {Map<string | null, Awaited<ReturnType<typeof knownAgents>> | null>} */
  const agents = new Map();
  await Promise.all(names.map(async on => {
    try { agents.set(on, await knownAgents({ on })); }
    catch { agents.set(on, null); }
  }));
  return { core, identities, workspaces, agents };
}
export function currentSpace(profile) {
  if (isOwnedSpace(profile.space, profile.on)) return undefined;
  return spaces().find(space => space.id === profile.space && space.machine === profile.on && space.folder === profile.folder);
}
export function allowed(profile, catalog) {
  return currentSpace(profile) && catalog.identities.get(profile.on)?.id === profile.core &&
    catalog.agents.get(profile.on)?.some(agent => agent.key === profile.key && agent.installed &&
      adapter(agent) === profile.lifecycle && JSON.stringify(agent.run) === JSON.stringify(profile.run));
}
async function executable(command, on) {
  // Resolve the locally approved executable, bypassing hc template names.
  let result = await exec('which', [command], { on, timeout: 4000 }).catch(() => null);
  if (!result || result.code !== 0) result = await exec('where.exe', [command], { on, timeout: 4000 }).catch(() => null);
  const path = result?.code === 0 ? result.stdout.trim().split(/\r?\n/)[0] : null;
  if (!absolute(path)) throw new Error('Agent executable could not be resolved.');
  return path;
}
export async function verifyWorkspace(profile) {
  if (!(await sameMachine(profile, json)) || !currentSpace(profile)) throw new Error('The approved workspace changed.');
}
export async function prepare(profile) {
  await verifyWorkspace(profile);
  return executable(profile.run[0], profile.on);
}
// The lead's Herdr address. Names are addresses, so the brief can name it before launch.
export const leadName = task => `pa-${task.slice(0, 23)}`;

// Core sets HC_TERMINAL_SOCKET only inside its terminals, so read it from a
// short one. Windows and unknown setups answer null, and Codex leads keep the
// plain workspace sandbox.
export async function coreSocket(profile) {
  const args = ['run', '--json', '--no-parent', '--no-notify', '--cwd', profile.folder];
  if (profile.on !== null) args.push('--on', profile.on);
  const result = await hc([...args, '--', '/usr/bin/printenv', 'HC_TERMINAL_SOCKET']).catch(() => null);
  if (result?.code !== 0) return null;
  let probe;
  try { probe = JSON.parse(result.stdout); } catch { return null; }
  if (addressMatches(profile, probe?.address)) await hc(['rm', probe.address]).catch(() => null);
  const socket = typeof probe?.output === 'string' ? probe.output.trim() : null;
  return validSocket(socket) ? socket : null;
}

// `team` (a lead with a brief) lets the lead reach Core: Claude may run hc,
// and Codex may use Core's socket from inside its workspace sandbox.
export async function launch(profile, command, task, session, prompt, replyArgs = [], ownedSpace, team = null) {
  const args = ['run', '--json', '--bg', '--no-parent', '--no-notify', '--cwd', profile.folder,
    '--name', leadName(task),
    '--label', `pacafe.task=${task}`, '--label', `pacafe.session=${session}`, '--label', `pacafe.profile=${profile.id}`];
  for (const value of ownedSpaceLabels(ownedSpace, session)) args.push('--label', value);
  if (profile.on !== null) args.push('--on', profile.on);
  // Codex runs its commands inside the terminal only with --no-daemon.
  const daemonless = profile.run.includes('--no-daemon') ? [] : ['--no-daemon'];
  const codexSandbox = team && validSocket(team.socket) ? codexSocketArgs(team.socket) : ['--sandbox', 'workspace-write'];
  const argv = profile.lifecycle === 'codex'
    ? [command, ...profile.run.slice(1), ...daemonless, ...codexSandbox, '--ask-for-approval', 'on-request', ...replyArgs, '--', prompt]
    : profile.lifecycle === 'claude' ? [command, '--permission-mode', 'default', ...(team ? ['--allowedTools', 'Bash(hc:*)'] : []), ...replyArgs, '--', prompt]
    : profile.lifecycle === 'opencode' ? [command, '--prompt', prompt]
    : [command];
  if (profile.lifecycle === 'generic' && /[\s;|&<>$`*?(){}~'"]/.test(command)) {
    throw new Error('The generic agent needs a direct executable path.');
  }
  const result = await hc([...args, '--', ...argv]);
  if (result.code !== 0) throw new Error('Herdr Core could not launch the agent.');
  const { address } = JSON.parse(result.stdout);
  if (!addressMatches(profile, address)) throw new Error('The terminal is not on the approved machine.');
  return address;
}

export function placeInMain(profile, address, focusExisting = false, ownedSpace) {
  if (!addressMatches(profile, address) || !currentSpace(profile)) throw new Error('The approved workspace changed.');
  if (ownedSpace) {
    const placement = ownedPlacement(ownedSpace, profile.on, address, spaces(), panes());
    if (!placement) return false; // Core labels already ask Herdr to adopt it.
    if (placement.rename) run('space.rename', { id: placement.rename, name: 'PA Cafe' });
    if (focusExisting) run('pane.focus', { pane: placement.pane });
    return true;
  }
  const pane = panes().find(item => item.terminal === address);
  if (pane) {
    if (focusExisting) run('pane.focus', { pane: pane.pane });
    return true;
  }
  if (!focusExisting) return false; // Pre-upgrade terminals are never rehomed or focused automatically.
  run('space.select', { id: profile.space });
  run('terminal.keep', { terminal: address, place: 'tab' });
  // Herdr queues commands; later inspection of an attached pane confirms placement.
  return false;
}

export async function releaseShellRecovery(profile, session, terminal) {
  if (!matches(profile, session, terminal) || terminal.state !== 'live' ||
      !panes().some(pane => pane.terminal === terminal.address)) return false;
  if (terminal.keep === false) return true;
  const result = await hc(['keep', terminal.address, '--off', '--json']);
  return result.code === 0;
}

export async function terminalBinding(profile, session, terminal) {
  const direct = liveBinding(profile, session, terminal);
  const alias = !direct && localAliasCandidate(profile, terminal);
  if (!alias) return direct;
  const resolved = await exec('/bin/pwd', ['-P'], { cwd: profile.folder, timeout: 1000 }).catch(() => null);
  return resolved?.code === 0 && resolved.stdout.trim() === alias ? liveBinding(profile, session, terminal, alias) : null;
}

export async function terminalFor(profile, session) {
  if (!addressMatches(profile, session.address)) return null;
  const terminal = await json(['get', session.address]);
  return matches(profile, session, terminal) ? terminal : null;
}
export function lifecycle(profile, terminal) {
  if (terminal.state === 'finished') return 'ended';
  if (terminal.state !== 'live') return 'unavailable';
  if (profile.lifecycle === 'generic') return 'manual-start';
  const report = terminal.report ?? terminal.status;
  const app = report?.app;
  const apps = profile.lifecycle === 'codex' ? ['codex'] : profile.lifecycle === 'opencode' ? ['opencode'] : ['claude', 'claude-code'];
  if (app && !apps.includes(app)) return 'unreported';
  const status = typeof terminal.status === 'string' ? terminal.status : terminal.status?.state;
  if (status === 'done' && terminal.turn > 0) return 'turn-finished';
  if (status === 'error') return 'agent-error';
  if (['working', 'blocked', 'idle'].includes(status)) return status;
  return 'unreported';
}
