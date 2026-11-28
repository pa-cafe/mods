import { appHome, exec, panes, terminals, window as herdrWindow } from 'herdr';
import { adapter, allowed, discovery, label, launch, lifecycle, placeInMain, prepare, releaseShellRecovery, terminalBinding, terminalFor, uuid, verifyWorkspace } from './core.js';
import { matches, sendStatus } from './session.js';
import { automaticPermissionDiscoveries, dispatchProfileLimit, editablePermissions, permittedProfiles, planPermissions, readPermissions, spacePermissionKey } from './dispatch-permissions.js';
import { isOwnedSpace } from './owned-space.js';
import { historyRequest, historyCursor } from './history-protocol.js';

const helper = async (action, ...args) => {
  const home = appHome();
  const result = await exec('node', [`${home}/mods/pacafe-desktop/credentials.mjs`, action, home, ...args], { timeout: action === 'wake' ? 100_000 : action === 'tokscale-usage' ? 50_000 : action === 'answer' ? 35_000 : 15_000 });
  if (result.code !== 0) throw new Error('The PA Cafe helper could not finish. Check that Node.js 18.17+ is on Herdr’s PATH.');
  return JSON.parse(result.stdout);
};
const retryDelays = [2000, 4000, 8000];
const captureLifetime = 45_000;
const discoveryInterval = 15_000;
const placementDelays = [2500, 5000, 10_000];
const watchesStandby = status => status === 'turn-finished' || status === 'unavailable';
const terminalSignature = terminal => terminal ? JSON.stringify([
  terminal.state, terminal.reason,
  typeof terminal.status === 'string' ? terminal.status : terminal.status?.state,
  (terminal.report ?? terminal.status)?.app, terminal.report?.state,
  terminal.turn, terminal.keep, terminal.pid, terminal.created_ms,
  terminal.foreground?.pid, terminal.foreground?.cwd, terminal.foreground?.argv?.[0],
]) : null;

const displayProfile = ({ id, machine, workspace, agent, lifecycle }) => ({ id, machine, workspace, agent, lifecycle });
// eslint-disable-next-line no-control-regex
const validPrompt = value => typeof value === 'string' && value.trim() && value.length <= 4000 && !/[\x00-\x08\x0b-\x1f\x7f]/.test(value);

export class DispatchBridge {
  profiles = [];
  sessions = [];
  taskStatus = new Map();
  deliveries = new Set();
  viewing = false;
  replyUploads = new Map();
  replyTurns = new Map();
  reportedTerminalSignatures = new Map();
  placementAttempts = new Map();
  revision = 0;
  wakeMode = 'check';
  wakeDelay = 500;
  awakeUntil = 0;

  constructor({ dispatchEnabled = true } = {}) {
    this.dispatchEnabled = dispatchEnabled;
  }

  async syncUsage(mode) {
    if (!this.connection?.usageHelperAvailable || this.usageBusy || this.closed) return;
    const device = this.connection;
    this.usageBusy = true;
    this.usageResult = null;
    this.changed();
    try {
      const result = await helper('tokscale-usage', device.url, mode);
      if (this.connection === device) this.usageResult = result;
    } catch {
      if (this.connection === device) this.usageResult = { history: 'unavailable', quota: 'unavailable' };
    } finally {
      this.usageBusy = false;
      this.changed();
    }
  }

  get busy() { return Boolean(this.pending || this.acting); }

  enqueue(action) {
    if (!this.ready || this.busy || this.closed) return false;
    this.pending = action;
    this.changed();
    this.wake?.();
    return true;
  }

  changed() { this.revision++; }

  stopHistory() {
    if (this.historySocket) void helper('history-stop', this.historySocket).catch(() => {});
    this.historySocket = null;
  }

  stop() {
    this.stopHistory();
    this.closed = true;
    this.pending = null;
    this.wake?.();
  }

  /** @param {import('gpui-kit').AsyncContext} cx */
  async run(cx) {
    let sync = true;
    while (!this.closed) {
      if (this.pending) {
        const action = this.pending;
        this.pending = null;
        this.acting = true;
        sync = true;
        try { await action(this); this.actionError = ''; }
        catch (error) { this.actionError = error.message; }
        finally { this.acting = false; }
        if (this.closed) return;
        this.changed();
        cx.notify();
      }
      try {
        await this.poll(sync);
        this.pollError = this.wakeIssue ? 'Herdr is reconnecting to the cafe.' : '';
      } catch (error) { this.pollError = error.message; }
      if (this.closed) return;
      this.changed();
      cx.notify();
      if (this.pending) continue;
      const actionQueued = new Promise(resolve => { this.wake = () => resolve('action'); });
      const idle = Boolean(this.dispatchEnabled && this.connection && this.wakeMode !== 'legacy' && !this.viewing && !this.hasActiveSession());
      const settled = idle && this.sessions.some(session => this.usable(session.profile) && this.taskStatus.get(session.task) === 'turn-finished');
      const wait = idle ? this.waitForWake(cx, settled).then(outcome => ({ outcome })) : cx.sleep(this.viewing ? 400 : 2500).then(() => 'poll');
      const watchLocal = idle && this.sessions.some(session => watchesStandby(this.taskStatus.get(session.task)));
      const localCheck = watchLocal ? cx.sleep(this.pollError ? 10_000 : 1_000).then(() => 'local')
        : idle && (this.profiles.length || this.permissions?.agents.length) ? cx.sleep(discoveryInterval).then(() => 'discovery') : new Promise(() => {});
      const result = await Promise.race([wait, actionQueued, localCheck]);
      const outcome = typeof result === 'string' ? result : result.outcome;
      this.wake = null;
      if (this.closed) return;
      if (typeof result !== 'string') {
        this.wakeWait = null;
        // Replace a normally expired listener before running local discovery.
        // If a local check wins while it completes, consume its outcome next loop.
        if (outcome === 'idle' || outcome === 'idle-settled') void this.waitForWake(cx, settled);
      }
      if (outcome === 'revoked') {
        this.activate(null);
        await helper('forget').catch(() => undefined);
        this.actionError = 'The cafe revoked this desktop. Pair again to reconnect.';
      }
      sync = ['wake', 'wake-settled', 'legacy', 'unsupported-settled', 'poll', 'action'].includes(outcome) ||
        outcome === 'local' && (this.replyRetryDue() || this.placementRetryDue() || await this.standbyChanged());
    }
  }

  wakeMac() {
    if (!this.dispatchEnabled || !this.keepAwake || !this.connection || this.closed || Date.now() < this.awakeUntil) return;
    this.awakeUntil = Date.now() + 8000;
    // Short AC-only assertion. It outlives neither the receiver nor a crash by more than 12 seconds.
    void exec('/usr/bin/caffeinate', ['-s', '-t', '12'], { timeout: 15_000 }).catch(() => undefined);
  }

  hasActiveSession() {
    const settled = this.wakeMode === 'older-socket' ? [] : ['turn-finished'];
    return this.sessions.some(session => this.usable(session.profile) &&
      !['ended', 'unavailable', 'launch-failed', ...settled].includes(this.taskStatus.get(session.task)));
  }

  settledSignature() {
    const live = new Map(terminals().map(terminal => [terminal.address, terminal]));
    return JSON.stringify(this.sessions.filter(session => watchesStandby(this.taskStatus.get(session.task)))
      .map(session => {
        const terminal = live.get(session.address);
        const profile = this.usable(session.profile);
        return [session.id, Boolean(profile), terminalSignature(profile && matches(profile, session, terminal) ? terminal : null)];
      }));
  }

  async standbyChanged() {
    if (this.settledSignature() !== this.lastSettledSignature) return true;
    // The Desktop snapshot can omit a remote terminal. Check one exact Core
    // binding per interval, without asking the cafe while merely waiting.
    if (Date.now() < this.nextStandbyProbe) return false;
    const live = new Map(terminals().map(terminal => [terminal.address, terminal]));
    const candidates = this.sessions.filter(session => {
      if (!watchesStandby(this.taskStatus.get(session.task)) || !session.address) return false;
      const profile = this.usable(session.profile);
      return profile && !matches(profile, session, live.get(session.address));
    });
    if (!candidates.length) return false;
    this.nextStandbyProbe = Date.now() + 5000;
    const session = candidates[this.standbyProbeIndex++ % candidates.length];
    const profile = this.usable(session.profile);
    try {
      const terminal = await terminalFor(profile, session);
      return !this.closed && this.usable(session.profile) === profile &&
        terminalSignature(terminal) !== (this.reportedTerminalSignatures.get(session.id) ?? null);
    } catch {
      // Core itself may be temporarily unreachable; don't advertise a change
      // just because the probe failed to observe the terminal.
      return false;
    }
  }

  replyRetryDue(now = Date.now()) {
    return [...this.replyUploads.values()].some(entry => entry.nextAt <= now && now < entry.until);
  }

  uploadReply(connection, report, target, replyNonce, turn, replyLifecycle) {
    if (!Number.isSafeInteger(turn) || this.replyTurns.get(report.session) === turn) return;
    const now = Date.now();
    let entry = this.replyUploads.get(report.session);
    // A different turn waits for the prior operation to settle.
    if (entry?.pending || (entry?.turn === turn && !(entry.nextAt <= now && now < entry.until))) return;
    if (!entry || entry.turn !== turn) {
      entry = { turn, until: now + captureLifetime, nextAt: now, tries: 0, pending: false };
      this.replyUploads.set(report.session, entry);
    }
    entry.pending = true;
    entry.nextAt = Infinity;
    const retry = () => {
      const delay = retryDelays[entry.tries++];
      if (delay !== undefined && Date.now() + delay < entry.until) entry.nextAt = Date.now() + delay;
    };
    void helper('reply-upload', connection.url, JSON.stringify({ ...target, terminal: report.terminal, session: { ...target.session, replyNonce, ...(replyLifecycle && { replyLifecycle }) } }))
      .then(result => {
        if (this.closed || this.connection !== connection || this.replyUploads.get(report.session) !== entry) return;
        if (result?.retry) retry();
        else {
          this.replyTurns.set(report.session, turn);
          this.replyUploads.delete(report.session);
        }
      })
      .catch(retry)
      .finally(() => { entry.pending = false; });
  }

  async waitForWake(cx, settled) {
    if (this.wakeWait) return this.wakeWait;
    const connection = this.connection;
    const mode = settled && this.wakeMode !== 'settled' ? 'check-settled' : this.wakeMode;
    const delay = this.wakeDelay;
    const pending = (async () => {
      const result = await helper('wake', connection.url, mode).catch(() => 'retry');
      if (this.closed || this.connection !== connection) return 'idle';
      if (result === 'legacy') this.wakeMode = 'legacy';
      else if (result === 'wake-settled' || result === 'idle-settled') this.wakeMode = 'settled';
      else if (result === 'unsupported-settled') this.wakeMode = 'older-socket';
      else if (result === 'wake' || result === 'idle') this.wakeMode = this.wakeMode === 'older-socket' ? 'older-socket' : 'socket';
      this.wakeIssue = result === 'retry';
      if (result === 'retry') {
        this.wakeMode = 'check';
        await cx.sleep(delay);
        this.wakeDelay = Math.min(30_000, delay * 2);
      } else this.wakeDelay = 500;
      return result;
    })();
    this.wakeWait = pending;
    return pending;
  }

  async poll(sync) {
    if (!this.ready) {
      this.target = await helper('target');
      if (this.closed) return;
      const connection = await helper('load');
      if (this.closed) return;
      this.activate(connection, connection ? await helper('load-state', connection.url) : null);
      if (this.closed) return;
      if (!this.connection) this.pairing = await helper('pending');
      this.ready = true;
    }
    if (this.closed) return;
    if (this.pairing) {
      const result = await helper('poll');
      if (this.closed) return;
      if (result.status === 'approved') {
        this.activate(result.connection);
        this.justPaired = true;
        sync = true;
        this.pairing = null;
        this.actionError = '';
      } else if (result.status === 'expired' || result.status === 'denied') {
        this.pairing = null;
        this.actionError = `Pairing ${result.status}.`;
      }
    }
    if (!this.refreshed || Date.now() - this.refreshed >= discoveryInterval) await this.refresh();
    if (!this.dispatchEnabled || !this.connection || this.closed || this.busy) return;
    const profiles = this.availableProfiles();
    const offlineProfiles = this.offlineProfiles(profiles);
    // An approved machine reconnecting can make the first task dispatchable.
    // Discovery stays local; only a changed advertisement wakes up the cafe.
    if (sync || this.profileSignature(profiles, offlineProfiles) !== this.lastAdvertisedProfiles) await this.sync(profiles);
  }

  activate(connection, state = null) {
    this.usageResult = null;
    this.stopHistory();
    this.historySupported = false;
    this.justPaired = false;
    this.connection = connection;
    this.wakeWait = null;
    this.wakeMode = 'check';
    this.wakeIssue = false;
    this.wakeDelay = 500;
    this.nextStandbyProbe = 0;
    this.standbyProbeIndex = 0;
    this.lastSettledSignature = undefined;
    this.profileAvailability = false;
    this.turnReports = false;
    this.approvals = false;
    this.lastAdvertisedProfiles = this.profileSignature([], []);
    this.permissions = readPermissions(state?.permissions);
    this.profiles = permittedProfiles(this.permissions, state?.profiles);
    this.keepAwake = state?.keepAwake === true;
    this.sessions = state?.sessions ?? [];
    this.viewing = false;
    this.taskStatus.clear();
    this.replyTurns.clear();
    this.reportedTerminalSignatures.clear();
    this.placementAttempts.clear();
    this.replyUploads.clear();
    this.fileRelay = false;
    this.unsaved = false;
  }

  async save() {
    if (!this.connection || this.closed) return;
    this.unsaved = true;
    // Manual prompts live only in this bridge.
    const sessions = this.sessions.map(({ task, profile, id, command, address, shown, recoveryReleased, replyNonce, replyLifecycle, replyPolicy, ownedSpace }) => ({ task, profile, id, command, address, ...(isOwnedSpace(ownedSpace, null) ? { ownedSpace } : {}), ...(shown ? { shown } : {}), ...(recoveryReleased ? { recoveryReleased } : {}), ...(replyPolicy === 1 && replyNonce ? { replyNonce, replyLifecycle, replyPolicy } : {}) }));
    const state = { permissions: this.permissions, profiles: this.profiles, sessions, keepAwake: this.keepAwake };
    await helper('save-state', this.connection.url, JSON.stringify(state));
    this.unsaved = false;
  }

  async refresh() {
    this.catalog = await discovery();
    this.refreshed = Date.now();
    await this.includeNewPermissionSpaces();
  }

  async includeNewPermissionSpaces() {
    const connection = this.connection;
    if (!this.dispatchEnabled || !connection || this.closed || !this.permissions || !this.catalog) return;
    const opts = this.permissionOptions();
    const selection = editablePermissions(this.permissions, opts.spaces);
    const plan = () => planPermissions(selection, this.profiles,
      automaticPermissionDiscoveries(this.profiles, this.permissionOptions().discovered));
    const next = plan();
    if (next.profiles.length > dispatchProfileLimit || (!next.added.length && this.permissions.version === 2)) return;
    await this.savePermissionPlan(next, connection, plan);
  }

  async response(promise, connection) {
    const result = await promise;
    if (result.status === 401 || result.status === 403) {
      if (!this.closed && this.connection === connection) {
        this.activate(null);
        await helper('forget');
      }
      throw new Error('The cafe revoked this desktop. Pair again to reconnect.');
    }
    if (result.status === 409) return null;
    if (result.status < 200 || result.status >= 300) throw Object.assign(new Error(`The cafe is unavailable (HTTP ${result.status}).`), { status: result.status });
    return result.body;
  }

  post(op, connection = this.connection) {
    return this.response(helper('request', connection.url, JSON.stringify(op)), connection);
  }

  usable(id) {
    if (this.closed || !this.connection || !this.catalog) return;
    return this.profiles.find(profile => profile.id === id && allowed(profile, this.catalog));
  }

  availableProfiles() {
    return this.profiles.filter(profile => this.usable(profile.id)).slice(0, dispatchProfileLimit).map(displayProfile);
  }

  offlineProfiles(available) {
    const online = new Set(available.map(profile => profile.id));
    return this.profiles.filter(profile => !online.has(profile.id)).slice(0, dispatchProfileLimit - available.length).map(displayProfile);
  }

  profileSignature(available, offline, negotiated = this.profileAvailability) {
    return JSON.stringify(negotiated ? [available, offline] : available);
  }

  async advertise(connection, profiles, reports, nativeTurns) {
    // An older cafe refuses the prompt field, so the plain body never has it.
    const plain = reports.map(row => {
      const copy = { ...row };
      delete copy.prompt;
      return copy;
    });
    const body = { op: 'sync', profiles, reports: plain, ...(this.fileRelay && { fileRelay: true }) };
    const extended = this.profileAvailability === true;
    const history = this.historySupported === true && ['macos', 'linux'].includes(herdrWindow()?.platform);
    const offline = extended ? this.offlineProfiles(profiles) : [];
    const turnReports = this.turnReports === true;
    const approvals = this.approvals === true;
    const observedTurns = (approvals ? reports : plain).map(row => {
      if (!turnReports) return row;
      const turn = nativeTurns.get(row.session);
      return row.terminal && Number.isSafeInteger(turn) && turn > 0 ? { ...row, turn } : row;
    });
    let result;
    try {
      result = await this.post({ ...body, reports: observedTurns, ...(extended && { offlineProfiles: offline }),
        ...(history && { terminalHistory: true }) }, connection);
    } catch (error) {
      if ((!extended && !history && !turnReports && !approvals) || error.status !== 400 || this.closed || this.connection !== connection) throw error;
      this.profileAvailability = false;
      this.turnReports = false;
      this.approvals = false;
      this.historySupported = false;
      this.stopHistory();
      result = await this.post(body, connection);
      return { result, signature: this.profileSignature(profiles, [], false), compatible: true };
    }
    return { result, signature: this.profileSignature(profiles, offline, extended) };
  }

  async sync(profiles = this.availableProfiles()) {
    const connection = this.connection;
    const live = new Map(terminals().map(terminal => [terminal.address, terminal]));
    let recovered = false;
    const reportTurns = new Map();
    const terminalSignatures = new Map();
    const reports = (await Promise.all(this.sessions.map(async session => {
      const profile = this.usable(session.profile);
      if (!profile) return null;
      if (this.taskStatus.get(session.task) === 'ended') return { task: session.task, session: session.id, status: 'ended', terminal: null, canSend: false };
      if (!session.address) {
        // A Core launch can survive losing its response. Adopt only an exact tagged match.
        const terminal = [...live.values()].find(terminal => matches(profile, { ...session, address: terminal.address }, terminal));
        if (terminal) {
          session.address = terminal.address;
          recovered = true;

        }
      }
      const snapshot = live.get(session.address);
      const terminal = matches(profile, session, snapshot) ? snapshot : session.address ? await terminalFor(profile, session).catch(() => null) : null;
      const status = session.address ? terminal ? lifecycle(profile, terminal) : 'unavailable' : 'launch-failed';
      if (terminal?.state === 'live') {
        // Older clients persisted a queued placement as shown. Retry only if
        // it had never released native recovery and no pane is attached.
        if (session.shown && !session.recoveryReleased && !panes().some(pane => pane.terminal === session.address)) {
          session.shown = false;
          recovered = true;
        }
        if (!session.shown && this.reveal(profile, session)) {
          session.shown = true;
          recovered = true;
        }
      }
      if (session.shown && !session.recoveryReleased && terminal && await releaseShellRecovery(profile, session, terminal).catch(() => false)) {
        session.recoveryReleased = true;
        recovered = true;
      }
      this.taskStatus.set(session.task, status);
      reportTurns.set(session.id, terminal?.turn);
      if (watchesStandby(status)) terminalSignatures.set(session.id, terminalSignature(terminal));
      const binding = await terminalBinding(profile, session, terminal);
      return { task: session.task, session: session.id, status, terminal: binding, canSend: Boolean(binding && sendStatus(profile, terminal)), ...(this.fileRelay && profile.on === null && { fileRelay: true }),
        // The helper reads the request from Core and replaces this, or drops it.
        ...(this.approvals && status === 'blocked' && binding && { prompt: true }) };
    }))).filter(Boolean);
    if (connection !== this.connection || this.closed) return;
    if (recovered || this.unsaved) await this.save();
    if (this.closed || this.busy) return;
    const settledSignature = this.settledSignature();
    const advertised = profiles.filter(profile => this.usable(profile.id));
    const { result, signature, compatible } = await this.advertise(connection, advertised, reports, reportTurns);
    if (!result || this.closed || connection !== this.connection) return;
    this.lastAdvertisedProfiles = signature;
    this.profileAvailability = !compatible && result.profileAvailability === true;
    this.historySupported = !compatible && result.terminalHistory === true;
    if (!this.historySupported) this.stopHistory();
    const learnedTurnReports = !this.turnReports && !compatible && result.turnReports === true;
    this.turnReports = !compatible && result.turnReports === true;
    // The cafe can switch phone answers off (HERDR_REMOTE_APPROVAL) without a new mod.
    this.approvals = !compatible && result.approvals === true;
    // A finished terminal may go straight into standby after the capability
    // handshake. Make one local check carry its initial bound counter.
    this.lastSettledSignature = learnedTurnReports &&
      reports.some(report => report.status === 'turn-finished' && report.terminal) ? undefined : settledSignature;
    this.reportedTerminalSignatures = terminalSignatures;

    const finished = new Set(reports.filter(report => report.status === 'turn-finished').map(report => report.session));
    for (const [session, entry] of this.replyUploads) {
      if (!entry.pending && !finished.has(session)) this.replyUploads.delete(session);
    }
    for (const report of reports) {
      if (report.status !== 'turn-finished') continue;
      const target = this.targetFor(report, reports);
      const session = this.sessions.find(item => item.id === report.session);
      if (target && session?.replyPolicy === 1 && session.replyNonce) {
        this.uploadReply(connection, report, target, session.replyNonce, reportTurns.get(report.session), session.replyLifecycle);
      }
    }
    this.fileRelay = result.fileRelay === true;

    for (const offer of Array.isArray(result.inputs) ? result.inputs.slice(0, 4) : []) {
      if (this.busy) break;
      const target = this.targetFor(offer, reports.filter(report => report.canSend));
      if (!target || !uuid(offer.id) || this.deliveries.has(offer.task)) continue;
      this.deliveries.add(offer.task);
      void helper('deliver', connection.url, JSON.stringify({ ...target, input: offer.id, terminal: offer.terminal, ...(offer.file === true && { file: true }) }))
        .catch(() => undefined).finally(() => this.deliveries.delete(offer.task));
    }

    // An answer the barista gave on the phone. The helper presses only the
    // request they saw, after reading it again; never anything on its own.
    for (const offer of this.approvals && Array.isArray(result.answers) ? result.answers.slice(0, 4) : []) {
      if (this.busy) break;
      const target = this.targetFor(offer, reports.filter(report => report.status === 'blocked'));
      if (!target || !uuid(offer.id) || !/^[A-Za-z0-9_-]{43}$/.test(offer.prompt) || this.deliveries.has(offer.task)) continue;
      this.deliveries.add(offer.task);
      void helper('answer', connection.url, JSON.stringify({ ...target, terminal: offer.terminal, prompt: offer.prompt, id: offer.id }))
        // A helper that stopped after taking the answer may have pressed it.
        .then(outcome => outcome === 'unknown', () => true)
        .then(unclear => { if (unclear) this.actionError = 'A phone answer may not have reached the agent. Check the terminal.'; })
        .finally(() => this.deliveries.delete(offer.task));
    }

    const views = Array.isArray(result.views) ? result.views.slice(0, 4) : [];
    this.viewing = views.length > 0;
    await Promise.all(views.map(async view => {
      const target = this.targetFor(view, reports);
      if (!target || this.busy || !uuid(view.view)) return;
      await this.response(helper('frame', connection.url, JSON.stringify({ ...target, view: view.view, terminal: view.terminal })), connection);
    }));
    if (this.historySupported) {
      // Exactly one history request at a time; a regular foreground frame
      // remains independent while the native side takes a bounded capture.
      const requested = views.find(view => historyRequest(view.view) && historyRequest(view.history?.request) &&
        (view.history.cursor === null || historyCursor(view.history.cursor)) && this.targetFor(view, reports));
      if (requested && !this.deliveries.has(requested.task) && !this.busy)
        await this.sendHistory(connection, this.targetFor(requested, reports), requested);
    }

    const next = Array.isArray(result.pending) && result.pending.find(entry => uuid(entry.task) && this.usable(entry.profile) && !this.sessions.some(session => session.task === entry.task));
    if (!next || this.closed || this.busy || connection !== this.connection) return;
    const profile = this.usable(next.profile);
    const command = await prepare(profile);
    if (this.closed || this.busy) return;
    const id = await helper('id');
    if (this.busy || !uuid(id) || !this.usable(profile.id) || connection !== this.connection) return;
    const ownedSpace = await helper('owned-space', profile.core);
    if (!isOwnedSpace(ownedSpace, null)) return;
    const captureAllowed = ['claude', 'codex'].includes(profile.lifecycle);
    const capture = result.replyCapture === true && captureAllowed && profile.on === null
      ? await helper('reply-args', connection.url, id, profile.lifecycle).catch(() => null) : null;
    if (this.closed || this.busy || connection !== this.connection || !this.usable(profile.id)) return;
    const job = await this.post({ op: 'claim', task: next.task, profile: profile.id, session: id, ...(capture ? { shareReplies: true } : {}) }, connection);
    if (!job || job.task !== next.task || job.profile !== profile.id || !validPrompt(job.prompt) ||
        connection !== this.connection || !this.usable(profile.id)) return;
    const session = { task: next.task, profile: profile.id, id, command, address: null, ownedSpace, ...(profile.lifecycle === 'generic' ? { prompt: job.prompt } : {}) };
    if (capture) {
      session.replyNonce = capture.nonce;
      session.replyLifecycle = profile.lifecycle;
      session.replyPolicy = 1;
    }
    this.sessions = [session, ...this.sessions].slice(0, 100);
    for (const id of this.placementAttempts.keys()) {
      if (!this.sessions.some(item => item.id === id)) this.placementAttempts.delete(id);
    }
    await this.save();
    try {
      if (!this.usable(profile.id)) return;
      await verifyWorkspace(profile);
      if (connection === this.connection && this.usable(profile.id)) {
        session.address = await launch(profile, command, session.task, id, job.prompt, capture?.args, ownedSpace);
        session.shown = this.reveal(profile, session);
      }
    } finally {
      if (!this.closed) await this.save();
    }
  }

  placementRetryDue() {
    return this.sessions.some(session => !session.shown && this.usable(session.profile) &&
      this.taskStatus.get(session.task) === 'turn-finished' &&
      (this.placementAttempts.get(session.id)?.next ?? Infinity) <= Date.now());
  }

  reveal(profile, session) {
    if (!this.usable(profile.id)) return false;
    const address = session.address;
    // Core labels drive adoption. A pane is confirmation; never move a tab
    // or select another Space to make it visible in the background.
    if (panes().some(pane => pane.terminal === address)) {
      try {
        if (!placeInMain(profile, address, false, session.ownedSpace)) return false;
        this.placementAttempts.delete(session.id);
        return true;
      } catch { return false; }
    }
    if (!session.ownedSpace) return false;
    const now = Date.now();
    const previous = this.placementAttempts.get(session.id);
    if (previous?.next > now) return false;
    const attempt = (previous?.attempt ?? 0) + 1;
    if (attempt > placementDelays.length + 1) {
      this.placementAttempts.set(session.id, { attempt, next: Infinity });
      this.actionError = 'The task started, but Herdr has not shown its tab in the PA Cafe Space.';
      return false;
    }
    const delay = placementDelays[attempt - 1] ?? placementDelays[0];
    this.placementAttempts.set(session.id, { attempt, next: now + delay });
    return false;
  }

  targetFor(offer, reports) {
    if (!reports.some(row => row.task === offer.task && row.session === offer.session && row.terminal === offer.terminal && row.terminal)) return null;
    const session = this.sessions.find(row => row.task === offer.task && row.id === offer.session);
    const profile = session && this.usable(session.profile);
    if (!profile) return null;
    const { id, address, task, command } = session;
    return { profile, session: { id, address, task, command } };
  }

  async sendHistory(connection, target, view) {
    if (this.closed || this.connection !== connection || !target) return;
    const body = JSON.stringify({ ...target, terminal: view.terminal, view: view.view, history: view.history });
    const upload = async () => {
      if (!this.historySocket) {
        const socket = await helper('history-start').catch(() => null);
        if (this.closed || this.connection !== connection || !this.usable(target.profile.id)) {
          if (socket) void helper('history-stop', socket).catch(() => {});
          return null;
        }
        this.historySocket = socket;
      }
      if (this.historySocket) return helper('history', this.historySocket, connection.url, body);
      return null;
    };
    let result = await upload();
    if (result?.status === 410) {
      this.historySocket = null;
      result = await upload();
    }
    if (!result || result.status === 410) return;
    await this.response(Promise.resolve(result), connection);
  }

  permissionOptions() {
    const spaces = new Map();
    const agents = new Map();
    const discovered = [];
    const addSpace = row => spaces.set(spacePermissionKey(row), { key: spacePermissionKey(row), name: row.workspace, machine: row.machine, folder: row.folder });
    const addAgent = row => agents.set(row.key, { key: row.key, name: row.agent });
    for (const row of this.profiles) {
      addSpace(row);
      addAgent(row);
    }
    if (!this.catalog) return { spaces: [...spaces.values()], agents: [...agents.values()], discovered };
    for (const space of this.catalog.workspaces) {
      const machine = this.catalog.identities.get(space.machine);
      if (!machine?.id) continue;
      const base = { on: space.machine, core: machine.id, space: space.id, folder: space.folder,
        machine: label(space.machine ?? machine.name), workspace: label(space.name) };
      addSpace(base);
      for (const agent of this.catalog.agents.get(space.machine) ?? []) {
        const lifecycle = adapter(agent);
        if (!agent.installed || !lifecycle) continue;
        const row = { ...base, key: agent.key, agent: label(agent.name), lifecycle, run: agent.run };
        if (!allowed(row, this.catalog)) continue;
        addAgent(row);
        discovered.push(row);
      }
    }
    return { spaces: [...spaces.values()], agents: [...agents.values()], discovered };
  }

  async applyPermissions(selection, fingerprint) {
    const connection = this.connection;
    if (!connection || this.closed) return;
    const plan = () => planPermissions(selection, this.profiles, this.permissionOptions().discovered);
    const pending = plan();
    if (pending.fingerprint !== fingerprint) throw new Error('工作環境有變動，請確認清單後再套用。');
    if (pending.profiles.length > dispatchProfileLimit) throw new Error('最多開放 40 個工作區與 Agent 的組合。');
    await this.savePermissionPlan(pending, connection, plan);
    this.stopHistory();
  }

  async savePermissionPlan(pending, connection, plan) {
    const fingerprint = pending.fingerprint;
    const profiles = [];
    for (const row of pending.profiles) {
      if (row.id) profiles.push(row);
      else {
        const id = await helper('id');
        if (!uuid(id)) throw new Error('無法儲存派工設定。');
        profiles.push({ ...row, id });
      }
    }
    if (this.closed || connection !== this.connection) return;
    if (plan().fingerprint !== fingerprint) throw new Error('工作環境有變動，請確認清單後再套用。');
    const previous = { profiles: this.profiles, permissions: this.permissions, unsaved: this.unsaved };
    this.permissions = pending.permissions;
    this.profiles = profiles;
    try { await this.save(); }
    catch (error) {
      if (connection === this.connection) Object.assign(this, previous);
      throw error;
    }
  }

  async saveTarget(value) {
    const target = await helper('set-target', value);
    if (target.error === 'linked') throw new Error('請先中斷連線或取消配對，再變更小屋網址。');
    if (target.error) throw new Error('請輸入小屋的 HTTPS 網址；本機測試可用 HTTP。不要加路徑。');
    this.target = target;
  }

  async disconnect() {
    await this.post({ op: 'disconnect' });
    if (this.closed) return;
    await helper('forget');
    this.activate(null);
  }

  async cancelPairing() {
    await helper('cancel');
    this.pairing = null;
  }

  async pair() {
    if (!this.target || !this.catalog?.core?.name) throw new Error('Herdr 工作環境尚未就緒。');
    const pairing = await helper('pair', label(this.catalog.core.name).slice(0, 60));
    if (pairing.error === 404) throw new Error(`所選小屋尚未開放 Herdr 配對：${this.target.origin}`);
    if (pairing.error === 'offline') throw new Error(`連不到 ${this.target.origin}。若為本機測試，請確認測試站有開啟。`);
    if (pairing.error) throw new Error(`配對失敗（HTTP ${pairing.error}）：${this.target.origin}`);
    this.pairing = pairing;
  }

  async openApproval() {
    const url = this.pairing?.verificationUrl;
    if (!url) return;
    const platform = herdrWindow()?.platform;
    const commands = platform === 'macos' ? ['open', url] : platform === 'windows' ? ['rundll32.exe', 'url.dll,FileProtocolHandler', url] : ['xdg-open', url];
    const result = await exec(commands[0], commands.slice(1));
    if (result.code !== 0) throw new Error('Open the cafe approval address in your browser.');
  }
}
