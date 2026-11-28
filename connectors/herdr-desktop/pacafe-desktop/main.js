import { View, div, image } from 'gpui-kit';
import { Button, Checkbox, Input, InputState, h_flex, v_flex } from 'gpui-base';
import { appHome, checking, closeOverlay, exec, focused, panes, pickFolder, props, run, spaces, theme, window as herdrWindow } from 'herdr';
import { DispatchBridge } from './bridge.js';
import { placeInMain, terminalFor, verifyWorkspace } from './core.js';
import { liveBinding } from './session.js';
import { changePermissionChoices, dispatchProfileLimit, editablePermissions, permissionSelected, planPermissions } from './dispatch-permissions.js';
import { receiverTabCommand } from './receiver-tab.js';

/** @param {string} value @returns {`#${string}`} */
const hex = value => value.startsWith('#') ? `#${value.slice(1)}` : '#808080';

function button(id, text, action) {
  const t = theme();
  return div().id(id).px(10).py(6).rounded(6).cursor_pointer().bg(hex(t.raised)).hover(style => style.bg(hex(t.hover)))
    .on_click((_event, cx) => action(cx)).child(text);
}

function permissionCheck(id, name, detail, checked, disabled, toggle) {
  const t = theme();
  return Checkbox.new(id).checked(checked).disabled(disabled).accessibility_label(detail ? `${name} · ${detail}` : name).on_change(toggle)
    .w_full().rounded(6).bg(hex(checked ? t.raised : t.surface)).hover(style => style.bg(hex(t.hover)))
    .child(h_flex().w_full().items_center().gap(8).px(4).py(4)
      .child(h_flex().size(16).flex_none().rounded(4).border_1()
        .border_color(hex(checked ? t.solid : t.border)).bg(hex(checked ? t.solid : t.background))
        .items_center().justify_center().text_size(11).text_color(hex(t.solid_foreground))
        .child(checked ? '✓' : ''))
      .child(v_flex().min_w(0).flex_1().gap(2)
        .child(div().truncate().child(name))
        .when(Boolean(detail), label => label.child(div().truncate().text_size(11).text_color(hex(t.muted)).tooltip(detail).child(detail)))));
}

// Herdr shares a mod's module across its layout and overlay copies.
let activeBridge = null;
const mod = 'pacafe-desktop';
const badge = `mods/${mod}/pa-cafe-badge.svg`;
const usageMessages = {
  sent: '已上傳', preview: '本機資料可用，未傳送', connect: '沒有這個小屋網址的 Tokscale 上傳登入',
  autosubmit: '無法確認現有 Tokscale 自動上傳已停用，未上傳',
  'no-device': '找不到既有裝置識別，未上傳',
  'no-timezone': '找不到既有報表的時區，未上傳歷史',
  provisional: '依目前裝置時區暫估，未傳送；上傳需確認既有報表的時區',
  'no-observation': '沒有五分鐘內的可信額度讀數',
  empty: '沒有可上傳的 Claude Code 或 Codex 歷史',
  'too-large': '資料超過單次上傳上限',
  rejected: '小屋沒有接受這份資料', busy: '另一個視窗正在上傳',
  disconnected: '目前沒有可驗證的配對小屋',
  'house-not-verified': '小屋未確認 Tokscale 登入屬於這間小屋的屋主，未上傳',
  unavailable: '讀取或連線失敗，請檢查本機用量工具和小屋連線',
};

export default class PACafeDesktop extends View {
  /** @param {unknown} _props @param {import('gpui-kit').AsyncContext} cx */
  init(_props, cx) {
    const hostProps = props();
    this.overlay = hostProps?.overlay;
    this.sidebar = !this.overlay && hostProps?.role === 'sidebar';
    this.receiver = !this.overlay && !this.sidebar;
    if ((this.sidebar || this.receiver) && !checking()) {
      if (herdrWindow()?.platform === 'macos') cx.timer.every(4000, () => this.ownedBridge?.wakeMac());
      cx.spawn(async cx => {
        while (activeBridge && !this.closed) await cx.sleep(2500);
        if (this.closed) return;
        this.ownedBridge = activeBridge = new DispatchBridge();
        await this.ownedBridge.run(cx);
      });
    }
    if (this.overlay) {
      this.targetInput = InputState.new({ placeholder: 'https://pacafe.dnplus.dev' });
      if (!checking()) cx.spawn(cx => this.requestedOpen(cx));
      // The short-lived settings bridge can pair but never advertise or dispatch.
      // A real (tab or existing sidebar) bridge takes over from disk.
      cx.timer.every(250, cx => {
        if (!checking()) {
          if (activeBridge) {
            this.configurationBridge?.stop();
            this.configurationBridge = null;
          } else if (!this.configurationBridge) {
            const bridge = this.configurationBridge = new DispatchBridge({ dispatchEnabled: false });
            cx.spawn(cx => bridge.run(cx));
          }
        }
        if (this.configurationBridge?.justPaired) {
          this.configurationBridge.justPaired = false;
          this.startReceiver(cx);
        }
        if (this.opening) {
          const { profile, session, binding, until } = this.opening;
          const pane = panes().find(pane => pane.terminal === session.address);
          if (!activeBridge?.usable(profile.id) || Date.now() >= until) {
            this.opening = null;
            this.openError = 'Herdr could not place this terminal in the main window.';
            cx.notify();
          } else if (pane && this.action(cx, async bridge => {
            if (await this.verifyTerminal(bridge, profile, session) !== binding ||
                !panes().some(current => current.pane === pane.pane && current.terminal === session.address)) {
              throw new Error('This agent terminal is unavailable.');
            }
            run('pane.focus', { pane: pane.pane });
            closeOverlay(this.overlay);
          })) {
            this.opening = null;
          }
        }
        const bridge = activeBridge ?? this.configurationBridge;
        if (this.observedBridge === bridge && this.observedRevision === bridge?.revision) return;
        this.observedBridge = bridge;
        this.observedRevision = bridge?.revision;
        cx.notify();
      });
    }
  }

  close() {
    this.closed = true;
    this.targetInput?.release();
    this.configurationBridge?.stop();
    if (this.ownedBridge && activeBridge === this.ownedBridge) {
      this.ownedBridge.stop();
      activeBridge = null;
    }
  }

  action(cx, work) {
    if (!(activeBridge ?? this.configurationBridge)?.enqueue(work)) return false;
    cx.notify();
    return true;
  }

  permissionPicker(bridge) {
    const t = theme();
    const options = bridge.permissionOptions();
    const saved = editablePermissions(bridge.permissions, options.spaces);
    const savedKey = JSON.stringify(bridge.permissions);
    if (!this.permissionDraft || this.permissionDraft.connection !== bridge.connection || this.permissionDraft.saved !== savedKey) {
      this.permissionDraft = { connection: bridge.connection, saved: savedKey, selection: saved };
    }
    const { selection } = this.permissionDraft;
    const preview = planPermissions(selection, bridge.profiles, options.discovered);
    const disabled = !bridge.connection || !bridge.catalog || bridge.busy;
    const dirty = JSON.stringify(preview.permissions) !== JSON.stringify(saved) || preview.added.length > 0 || preview.removed.length > 0;
    const change = (kind, keys, enabled, cx) => {
      if (disabled) return;
      const current = this.permissionDraft.selection;
      this.permissionDraft.selection = keys !== null ? changePermissionChoices(current, kind, keys, enabled)
        : kind === 'spaces' ? { ...current, excludedSpaces: [] } : { ...current, agents: [] };
      cx.notify();
    };
    const list = (heading, kind, choices, empty) => {
      const isOpen = this.permissionOpen === kind;
      const selected = choices.filter(row => permissionSelected(selection, kind, row.key));
      const allSpaces = kind === 'spaces' && selected.length > 0 && selection.excludedSpaces.length === 0;
      const control = name => Button.new(`permission-${kind}-${name}`);
      const bulk = (text, name, enabled) => control(name).flex_1().py(6).rounded(6).disabled(disabled)
        .bg(hex(t.raised)).hover(style => style.bg(hex(t.hover)))
        .on_click((_event, cx) => change(kind, enabled === (kind === 'spaces') ? null : choices.map(row => row.key), enabled, cx))
        .child(h_flex().justify_center().child(text));
      const chips = allSpaces ? [h_flex().px(8).py(3).rounded(10).bg(hex(t.raised)).child('所有 Spaces')]
        : selected.slice(0, 3).map(({ key, name }) => h_flex().min_w(0).items_center().gap(3).pl(8).rounded(10).bg(hex(t.raised))
          .child(div().max_w(100).truncate().child(name))
          .child(control(`remove-${encodeURIComponent(key)}`).disabled(disabled).accessibility_label(`移除 ${name}`)
            .px(5).py(3).on_click((_event, cx) => change(kind, [key], false, cx)).child('×')));
      return v_flex().gap(5).w_full()
        .child(div().font_semibold().child(heading))
        .child(h_flex().w_full().items_center().gap(5).px(7).py(5).min_h(34).rounded(8).border_1().border_color(hex(t.border))
          .children(chips)
          .when(!allSpaces && selected.length > 3, row => row.child(div().px(4).text_color(hex(t.muted)).child(`+${selected.length - 3}`)))
          .child(control('toggle').flex_1().min_w(24).accessibility_label(heading)
            .on_click((_event, cx) => { this.permissionOpen = isOpen ? null : kind; cx.notify(); })
            .child(h_flex().w_full().items_center().justify_between().gap(6)
              .child(div().text_color(hex(t.muted)).child(selected.length ? '' : '尚未選擇'))
              .child(div().text_color(hex(t.muted)).child(isOpen ? '⌃' : '⌄')))))
        .when(isOpen, menu => menu.child(v_flex().w_full().gap(5).p(5).rounded(8).border_1().border_color(hex(t.border)).bg(hex(t.surface))
          .child(h_flex().w_full().gap(5).child(bulk('全選', 'select-all', true)).child(bulk('清除', 'clear-all', false)))
          .when(!choices.length, column => column.child(div().px(4).text_color(hex(t.muted)).child(empty)))
          .child(div().id(`permission-${kind}-options`).max_h(174).overflow_y_scrollbar()
            .child(v_flex().w_full().gap(2).children(choices.map(({ key, name, machine, folder }) => permissionCheck(
              `permission-${kind}-${encodeURIComponent(key)}`, name, folder ? `${machine} · ${folder}` : machine, permissionSelected(selection, kind, key), disabled,
              (enabled, cx) => change(kind, [key], enabled, cx))))))));
    };
    const count = preview.profiles.length;
    return v_flex().gap(10).w_full()
      .child(h_flex().items_center().child(div().font_semibold().text_size(15).flex_1().child('派工權限'))
        .child(button('refresh', '重新整理', cx => this.action(cx, bridge => bridge.refresh()))))
      .when(!bridge.connection, section => section.child(div().text_color(hex(t.muted)).child('請先配對。')))
      .child(list('允許使用的 Spaces', 'spaces', options.spaces, bridge.catalog ? '沒有可用的 Space。' : '正在查詢 Spaces…'))
      .child(list('允許使用的 Agents', 'agents', options.agents, '沒有可用的 Agent。'))
      .when(Boolean(bridge.connection), section => section
        .when(count > dispatchProfileLimit, section => section.child(div().text_color(hex(t.blocked))
          .child(`最多開放 ${dispatchProfileLimit} 個組合，請縮小選擇。`)))
        .child(h_flex().justify_end().child(Button.new('apply-dispatch-permissions')
          .disabled(disabled || !dirty || count > dispatchProfileLimit).px(10).py(6).rounded(6)
          .bg(hex(disabled || !dirty ? t.surface : t.raised))
          .on_click((_event, cx) => this.action(cx, bridge => bridge.applyPermissions(preview.permissions, preview.fingerprint)))
          .child('套用權限'))));
  }

  async requestedOpen(cx) {
    const home = appHome();
    const result = await exec('node', [`${home}/mods/pacafe-desktop/open-desktop.mjs`, 'consume', home], { timeout: 1500 }).catch(() => null);
    if (this.closed || result?.code !== 0 || result.stdout !== 'true') return;
    this.bootstrap = true;
    await this.revealRequestedTab(cx);
  }

  async createLocalSpace(cx) {
    if (this.creatingSpace || this.closed) return;
    this.creatingSpace = true;
    cx.notify();
    try {
      const folder = await pickFolder({ prompt: '選擇工作資料夾' });
      if (!folder || this.closed) return;
      // Pick explicitly; do not create a shell in an inferred/default folder.
      run('space.new', { folder, machine: '', focus: true });
      await this.revealRequestedTab(cx);
    } catch {
      if (!this.closed) this.receiverError = '無法開啟這個資料夾。選擇另一個資料夾再試一次。';
    } finally {
      this.creatingSpace = false;
      if (!this.closed) cx.notify();
    }
  }

  async revealRequestedTab(cx) {
    // The control socket can be up before Core has restored its Spaces.
    const until = Date.now() + 6_000;
    let command;
    while (!this.closed && !command && Date.now() < until) {
      command = receiverTabCommand(spaces(), panes());
      if (!command) await cx.sleep(200);
    }
    if (this.closed) return;
    if (!command) {
      this.receiverError = 'PA Cafe 分頁需要一個本機 Space。請選擇要在 Herdr 開啟的資料夾。';
      cx.notify();
      return;
    }
    this.receiverError = '';
    run(...command);
    const verify = Date.now() + 3_000;
    while (!this.closed && Date.now() < verify) {
      const selected = focused()?.tab;
      if (selected && panes().some(pane => pane.tab === selected && pane.mod === mod)) {
        closeOverlay(this.overlay);
        return;
      }
      await cx.sleep(100);
    }
    if (!this.closed) cx.notify();
  }

  startReceiver(cx) {
    if (activeBridge || Date.now() < (this.receiverStartingUntil ?? 0)) return;
    const next = receiverTabCommand(spaces(), panes());
    if (!next) {
      this.receiverError = '請開啟一個本機 Space，再啟動 PA Cafe 接收器。';
      cx.notify();
      return;
    }
    this.receiverError = '';
    this.receiverStartingUntil = Date.now() + 2_500;
    run(...next);
    cx.notify();
  }

  receiverStatus() {
    return activeBridge?.pollError ? '連線異常'
      : activeBridge?.connection ? '接收器已啟動'
      : activeBridge?.ready ? '接收器已啟動，等候配對' : activeBridge ? '接收器啟動中' : '接收器未啟動';
  }

  openTerminal(cx, profile, session) {
    if (this.opening) return;
    this.openError = '';
    this.action(cx, async bridge => {
      const binding = await this.verifyTerminal(bridge, profile, session);
      if (placeInMain(profile, session.address, true, session.ownedSpace)) {
        closeOverlay(this.overlay);
        return;
      }
      this.opening = { profile, session, binding, until: Date.now() + 5000 };
    });
  }

  async verifyTerminal(bridge, profile, session) {
    await verifyWorkspace(profile);
    const binding = liveBinding(profile, session, await terminalFor(profile, session));
    if (this.closed || !bridge.usable(profile.id) || !binding) throw new Error('This agent terminal is unavailable.');
    return binding;
  }

  renderBadge() {
    const t = theme();
    const bridge = activeBridge;
    const [status, color] = bridge?.pollError ? ['Connection issue', t.blocked]
      : bridge?.connection ? ['Paired', t.done]
      : bridge?.pairing ? ['Awaiting approval', t.working]
      : bridge?.ready ? ['Unpaired', t.dim] : ['Starting', t.dim];
    const width = this.width ?? 0;
    const compact = width < 150;
    return h_flex().id('pacafe-sidebar').size_full().items_center().gap(compact ? 2 : 7).px(compact ? 2 : 10)
      .text_size(12).text_color(hex(t.foreground)).cursor_pointer().hover(style => style.bg(hex(t.hover)))
      .on_size_change(({ width }, cx) => { this.width = width; cx.notify(); })
      .on_click(() => run('mod.open', { name: mod }))
      .tooltip(`PA Cafe settings · ${status}`)
      .when(compact, row => row.justify_center())
      .child(image(badge).size(17))
      .when(!compact, row => row.child(div().font_medium().child('PA Cafe')))
      .child(div().size(6).rounded(3).flex_none().bg(hex(color)))
      .when(width >= 200, row => row.child(div().text_color(hex(t.muted)).child(status)));
  }

  render() {
    if (this.sidebar) return this.renderBadge();
    const bridge = activeBridge ?? this.configurationBridge;
    const t = theme();
    const title = (text, size = 15) => div().font_semibold().text_size(size).child(text);
    const root = v_flex().id('pacafe-desktop').size_full().overflow_y_scrollbar().gap(12).p(18).bg(hex(t.surface)).text_color(hex(t.foreground)).text_size(13)
      .child(h_flex().items_center().gap(10)
        .child(image(badge).size(24))
        .child(title(this.receiver ? 'PA Cafe 接收器' : 'PA Cafe Settings', 18).flex_1())
        .when(Boolean(this.overlay), row => row.child(button('close-settings', 'Close', () => closeOverlay(this.overlay)))));
    if (this.receiver) return root
      .child(title(this.receiverStatus()))
      .child(div().text_color(hex(t.muted)).child(this.ownedBridge === activeBridge
        ? '這個分頁正在接收派工。可切到其他分頁繼續工作。'
        : 'PA Cafe 只會開一個接收器。可在設定查看狀態。'))
      .child(h_flex().child(button('receiver-settings', 'PA Cafe Settings', () => run('mod.open', { name: mod }))));
    if (!this.overlay || !bridge?.ready) {
      return root.child(div().child(bridge?.pollError ?? '正在讀取 PA Cafe 設定…'));
    }
    root.child(h_flex().items_center().gap(8)
      .child(div().flex_1().text_color(hex(activeBridge?.pollError ? t.blocked : t.muted)).child(this.receiverStatus()))
      .when(!activeBridge, row => row.child(button('start-receiver', '開啟 PA Cafe 分頁', cx => this.startReceiver(cx)))));
    if (this.receiverError && !activeBridge) root.child(v_flex().gap(6)
      .child(div().text_color(hex(t.blocked)).child(this.receiverError))
      .when(this.bootstrap && !spaces().some(space => space.machine === null), column => column
        .child(Button.new('create-local-space').disabled(this.creatingSpace).px(10).py(6).rounded(6).bg(hex(t.raised))
          .on_click((_event, cx) => cx.spawn(cx => this.createLocalSpace(cx))).child('選擇資料夾並開啟 PA Cafe'))));
    const targetNames = { official: '正式小屋', local: '本機測試', custom: '自訂小屋' };
    root.child(v_flex().gap(6)
      .child(title('連線目標'))
      .child(div().text_color(hex(t.muted)).child(bridge.target ? `${targetNames[bridge.target.kind]} · ${bridge.target.origin}` : '正在讀取小屋網址…'))
      .when(Boolean(bridge.target && !bridge.pairing && !bridge.connection && !this.editingTarget), row =>
        row.child(button('edit-target', '變更網址', cx => {
          this.targetInput.set_value(bridge.target.origin);
          this.editingTarget = true;
          cx.notify();
          this.targetInput.focus();
        })))
      .when(Boolean(this.editingTarget), row => row.child(h_flex().gap(8).items_center()
        .child(Input.new(this.targetInput).flex_1())
        .child(button('save-target', '儲存', cx => {
          const value = this.targetInput.value();
          this.action(cx, async bridge => {
            await bridge.saveTarget(value);
            if (!this.closed) this.editingTarget = false;
          });
        }))
        .child(button('cancel-target', '取消', cx => { this.editingTarget = false; cx.notify(); })))));
    root.child(h_flex().gap(8).items_center()
      .child(div().flex_1().child(bridge.connection ? `Paired with ${bridge.connection.cafe}` : bridge.pairing ? `Approval code: ${bridge.pairing.userCode}` : 'Pair with your cafe to dispatch tasks from the phone.'))
      .child(bridge.connection ? button('disconnect', 'Disconnect', cx => this.action(cx, bridge => bridge.disconnect()))
        : bridge.pairing ? button('approval', '前往小屋核准', cx => this.action(cx, bridge => bridge.openApproval()))
        : bridge.target && !this.editingTarget ? button('pair', '取得配對碼', cx => this.action(cx, bridge => bridge.pair())) : div()));
    if (bridge.pairing) root.child(h_flex().items_center().gap(8)
      .child(div().flex_1().text_color(hex(t.muted)).child(bridge.pairing.verificationUrl))
      .child(button('cancel-pairing', 'Cancel', cx => this.action(cx, bridge => bridge.cancelPairing()))));
    const message = this.openError || bridge.actionError || bridge.pollError;
    if (message) root.child(div().text_color(hex(t.blocked)).child(message));
    if (bridge.busy) root.child(div().text_color(hex(t.muted)).child('Updating PA Cafe…'));

    if (bridge.connection && herdrWindow()?.platform === 'macos') root.child(h_flex().gap(8).items_center()
      .child(div().flex_1().child('接電時保持待命。螢幕可關閉，不會喚醒已休眠的 Mac。'))
      .child(button('keep-awake', bridge.keepAwake ? '關閉待命' : '保持待命', cx => this.action(cx, async bridge => {
        bridge.keepAwake = !bridge.keepAwake;
        await bridge.save();
        bridge.wakeMac();
      }))));
    if (bridge.connection) root.child(v_flex().w_full().min_w_0().gap(6)
      .child(title('Tokscale 用量（預覽）', 14))
      .child(div().w_full().whitespace_normal().child('預覽完全在本機。只有按下上傳，且確認 Tokscale 登入屬於這間小屋的屋主，才會送出用量彙總和已有的額度讀數。不傳對話。'))
      .child(!bridge.connection.usageHelperAvailable ? div().w_full().whitespace_normal().child('尚未安裝用量工具。若要啟用，請用安裝指令加上 --with-usage。')
        : bridge.usageBusy ? div().child('正在處理 Tokscale…') : h_flex().gap(8)
        .child(button('preview-usage', '在本機預覽', () => { void bridge.syncUsage('preview'); }))
        .child(button('upload-usage', '上傳至配對小屋', () => { void bridge.syncUsage('upload'); })))
      .when(Boolean(bridge.usageResult), panel => panel.child(div().w_full().whitespace_normal().child(
        `歷史：${usageMessages[bridge.usageResult?.history] ?? usageMessages.unavailable}。額度：${usageMessages[bridge.usageResult?.quota] ?? usageMessages.unavailable}。${typeof bridge.usageResult?.days === 'number' ? `（本機：${bridge.usageResult.days} 天，${bridge.usageResult.accounts} 個額度帳號）` : ''}`))));

    root.child(this.permissionPicker(bridge));

    const visibleSessions = bridge.sessions.filter(session => session.prompt && bridge.usable(session.profile) && !['ended', 'unavailable', 'launch-failed'].includes(bridge.taskStatus.get(session.task)));
    if (visibleSessions.length) root.child(title('等待手動開始'));
    for (const session of visibleSessions) {
      const profile = bridge.usable(session.profile);
      root.child(h_flex().gap(8).items_center()
        .child(div().flex_1().child(`${profile.agent} · ${profile.workspace} · ${session.task.slice(0, 8)}`))
        .when(Boolean(session.address), row => row.child(button(`open-${session.id}`, 'Open terminal', cx => this.openTerminal(cx, profile, session)))));
      if (session.prompt) root.child(div().child(`Start locally: ${session.prompt}`));
    }
    return root;
  }
}
