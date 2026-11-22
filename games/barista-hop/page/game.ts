// BARISTA HOP!! in the browser: one canvas, the keyboard and the pointer. It plays the rules at their own pace, keeps
// what the player did, and hands the finished run to the page that carries it. The page decides what a run is worth:
// this file only remembers this browser's best.
import { HOP_HZ, HOP_VERSION, hopLooks, hopMeters, startHop, stepHop, type HopEnd, type HopInputs, type HopLook, type HopRun, type HopSteer } from '../rules.ts';
import { HOP_STEER_MAX, HOP_TAPS_MAX } from '../versions.ts';
import type { TextKey } from './i18n.ts';
import type { Shaft3d } from './shaft3d.ts';
import { HopView, loadPoses, type HopOver } from './view.ts';

const BEST = 'barista-hop-best';
const STEP_MS = 1000 / HOP_HZ;
/** A finished run's card takes no tap for this long, so the tap that was meant for the game does not dismiss it. */
const CARD_MS = 700;

/**
 * One finished run. `inputs` replays it under `version` on `seed` (rules.ts `replayHop`); it is null for a run with
 * more changes of lean or more taps than a record may hold, which was played and cannot be scored again.
 */
export type HopResult = { meters: number; record: boolean; seed: number; version: number; inputs: HopInputs | null; end: HopEnd; seconds: number };
export type HopOptions = {
  /** Who hops: the cafe's barista. Dots when left out. */
  look?: HopLook;
  /** The shaft of the next run. A new one every run when left out. */
  seed?(): number;
  ended?(result: HopResult): void;
  /**
   * A second canvas lying exactly under the game's, for the shaft in 3D. The game draws its flat shaft until the 3D one
   * has loaded, and for good where there is no WebGL or none is given.
   */
  backdrop?: HTMLCanvasElement | null;
  /** A recorded run to play back as the page opens, before the player's own first run. It is not reported to `ended` and sets no best. */
  watch?: { seed: number; inputs: HopInputs; /** How many times faster than it was played. 1 when left out. */ rate?: number };
};
export type HopGame = {
  /** Starts over, on a new shaft. */
  again(): void;
  /** Holds the climb still while the page asks something, and lets it go on after. */
  pause(on: boolean): void;
  recast(look: HopLook): void;
  /** Takes the game off the canvas and lets go of everything it listens to. */
  dispose(): void;
};

function read(key: string) { try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; } }
function write(key: string, value: number) { try { localStorage.setItem(key, String(value)); } catch { } }
const reasons: Record<HopEnd, TextKey> = { fell: 'Fell off the screen', limited: 'Hit a rate-limit cloud', timeout: 'Out of time' };

export function playHop(canvas: HTMLCanvasElement, options: HopOptions = {}): HopGame {
  const view = new HopView(canvas);
  let look: HopLook = options.look && hopLooks.includes(options.look) ? options.look : 'dots';
  let seed = 0, run: HopRun = startHop(0), phase: 'ready' | 'climbing' | 'over' = 'ready';
  let steer: [number, HopSteer][] = [], taps: number[] = [], lean: HopSteer = 0, tap = false, whole = true;
  let over: HopOver | null = null, overAt = 0, best = read(BEST);
  let last = 0, owed = 0, paused = false, frame = 0, touch = matchMedia('(pointer: coarse)').matches;
  const keys = new Set<string>(), pointers = new Map<number, number>();
  /** The run being played back, and how far into its two lists the playback is. */
  let watching = options.watch ?? null, turn = 0, sip = 0;

  function fresh() {
    seed = (options.seed?.() ?? Math.floor(Math.random() * 4_294_967_296)) >>> 0;
    run = startHop(seed); phase = 'ready'; steer = []; taps = []; lean = 0; tap = false; whole = true; over = null; owed = 0;
    view.reset();
    if (watching) { seed = watching.seed >>> 0; run = startHop(seed); phase = 'climbing'; turn = 0; sip = 0; }
  }

  /** Where the player is leaning now: the keys, or failing them the side of the screen a finger rests on. */
  function leaning(): HopSteer {
    const keyed = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    if (keyed) return keyed as HopSteer;
    let side = 0;
    for (const x of pointers.values()) side = x < canvas.getBoundingClientRect().width / 2 ? -1 : 1;
    return side as HopSteer;
  }

  function finish() {
    if (watching) {
      phase = 'over'; overAt = performance.now();
      over = { meters: hopMeters(run), record: false, reason: reasons[run.end!], hops: run.hops, tosses: run.tosses, rockets: run.rockets, cups: run.cupsDrunk };
      watching = null;
      return;
    }
    const meters = hopMeters(run), record = meters > best;
    if (record) { best = meters; write(BEST, best); }
    phase = 'over'; overAt = performance.now();
    over = { meters, record, reason: reasons[run.end!], hops: run.hops, tosses: run.tosses, rockets: run.rockets, cups: run.cupsDrunk };
    options.ended?.({ meters, record, seed, version: HOP_VERSION, inputs: whole ? { steer, taps } : null, end: run.end!, seconds: run.step / HOP_HZ });
  }

  function step(now: number) {
    if (watching) {
      const { steer: turns, taps: sips } = watching.inputs;
      while (turn < turns.length && turns[turn][0] <= run.step) lean = turns[turn++][1];
      while (sip < sips.length && sips[sip] < run.step) sip++;
      stepHop(run, lean, sip < sips.length && sips[sip] === run.step);
      view.feel(run, now);
      if (run.end) finish();
      return;
    }
    const want = leaning();
    if (want !== lean) { lean = want; if (steer.length < HOP_STEER_MAX) steer.push([run.step, lean]); else whole = false; }
    // A tap counts only where the rules would take it, so a mashed key does not fill the record with taps that did nothing.
    const drink = tap && run.cups > 0 && run.vy <= 0 && run.rocket === 0;
    tap = false;
    if (drink) { if (taps.length < HOP_TAPS_MAX) taps.push(run.step); else whole = false; }
    stepHop(run, lean, drink);
    view.feel(run, now);
    if (run.end) finish();
  }

  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    const passed = Math.min(100, now - (last || now));
    last = now;
    if (phase === 'climbing' && !paused) {
      owed += passed * (watching?.rate ?? 1);
      while (owed >= STEP_MS && phase === 'climbing') { owed -= STEP_MS; step(now); }
    }
    view.draw({ run, look, lean, now, best, phase, touch: touch && !watching, over });
    shaft?.draw({ run, ...view.lens(), now });
  }

  /** Any press: starts a run that is waiting, or leaves a finished run's card. Says whether the press was used up. */
  function press() {
    if (phase === 'ready') { phase = 'climbing'; return true; }
    if (phase === 'over') { if (performance.now() - overAt > CARD_MS) fresh(); return true; }
    return false;
  }

  const sideOf = (code: string) => code === 'ArrowLeft' || code === 'KeyA' ? 'left' : code === 'ArrowRight' || code === 'KeyD' ? 'right' : null;
  function keydown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const side = sideOf(event.code), cup = event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW';
    if (!side && !cup && event.code !== 'Enter') return;
    event.preventDefault();
    touch = false;
    if (side) keys.add(side);
    if (event.repeat) return;
    if (!press() && cup) tap = true;
  }
  function keyup(event: KeyboardEvent) { const side = sideOf(event.code); if (side) keys.delete(side); }
  function pointerdown(event: PointerEvent) {
    if (event.pointerType === 'touch') touch = true;
    event.preventDefault();
    if (press()) return;
    const box = canvas.getBoundingClientRect(), x = event.clientX - box.left, y = event.clientY - box.top, button = view.cupButton();
    if (touch && (x - button.x) ** 2 + (y - button.y) ** 2 <= (button.r * 1.25) ** 2) { tap = true; return; }
    // A mouse has no side to rest on: its click is a cup, and the keys lean.
    if (event.pointerType === 'mouse') { tap = true; return; }
    pointers.set(event.pointerId, x);
    canvas.setPointerCapture?.(event.pointerId);
  }
  function pointermove(event: PointerEvent) { if (pointers.has(event.pointerId)) pointers.set(event.pointerId, event.clientX - canvas.getBoundingClientRect().left); }
  function pointerup(event: PointerEvent) { pointers.delete(event.pointerId); }
  function blur() { keys.clear(); pointers.clear(); }
  function resize() {
    view.resize();
    const box = canvas.getBoundingClientRect();
    shaft?.resize(Math.max(1, box.width), Math.max(1, box.height), Math.min(2, window.devicePixelRatio || 1));
  }

  // The 3D shaft is its own download. If the browser takes its graphics away mid-climb, the flat shaft comes back.
  const backdrop = 'WebGL2RenderingContext' in window ? options.backdrop ?? null : null;
  let shaft: Shaft3d | null = null, alive = true;
  const lost = () => { shaft?.dispose(); shaft = null; view.bare = false; };
  backdrop?.addEventListener('webglcontextlost', lost, { once: true });
  if (backdrop) void import('./shaft3d.ts').then(({ Shaft3d }) => Shaft3d.open(backdrop)).then(made => {
    if (!alive) { made.dispose(); return; }
    shaft = made; view.bare = true; resize();
  }).catch(error => console.warn(error));

  canvas.style.touchAction = 'none';
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', pointerdown); canvas.addEventListener('pointermove', pointermove); canvas.addEventListener('pointerup', pointerup); canvas.addEventListener('pointercancel', pointerup);
  const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  watcher?.observe(canvas);
  loadPoses().catch(() => { });
  fresh(); view.resize();
  frame = requestAnimationFrame(tick);

  return {
    again: fresh,
    pause(on) { paused = on; if (!on) last = 0; },
    recast(next) { look = next; },
    dispose() {
      alive = false; backdrop?.removeEventListener('webglcontextlost', lost); shaft?.dispose(); shaft = null;
      cancelAnimationFrame(frame); watcher?.disconnect();
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', pointerdown); canvas.removeEventListener('pointermove', pointermove); canvas.removeEventListener('pointerup', pointerup); canvas.removeEventListener('pointercancel', pointerup);
    },
  };
}


