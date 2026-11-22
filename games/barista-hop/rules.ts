// BARISTA HOP!!: the climb itself, without a screen. The browser plays it and the cafe replays it to check a score, so
// the same seed and the same inputs must give the same climb on both. It only adds, multiplies, divides and compares;
// square roots and trigonometry are left out, so no engine can disagree about a last digit.
import { seeded } from '../kit/random.ts';

/** Goes on every run. Change it with any number below: a run recorded under other numbers replays differently. */
export const HOP_VERSION = 1;
export const HOP_HZ = 60;
const DT = 1 / HOP_HZ;

export const hopTuning = {
  /** The shaft is this many metres wide, and wraps: going out of one side comes in at the other. */
  width: 10,
  gravity: 30,
  /** Speed upward off a saucer: 2.8 m high. */
  jump: 13,
  /** Off a resident who tosses: 7.3 m high. */
  toss: 21,
  /** Off a resident who is rate limited: 1.2 m high, less than the gap to the next row. */
  weak: 8.5,
  /** A cup drunk in the air lifts this fast. */
  cupUp: 14,
  cups: 3,
  /** Sideways: the top speed, and how fast it is reached. */
  run: 8,
  grip: 50,
  /** A rocket climbs at `rocketSpeed` for this many steps, through everything. */
  rocketSteps: 150,
  rocketSpeed: 20,
  /** Falling this far below the highest point reached ends the climb: it is off the screen. */
  drop: 9,
  /** The gap between rows, at the bottom and from `gapRamp` metres up. */
  gapMin: 1.3,
  gapMax: 2.3,
  gapRamp: 600,
  /** Each row's sure saucer is at most this far sideways from the last row's. */
  reach: 3.2,
  saucer: 1.8,
  /** How far each side of a saucer the feet still catch it. */
  foot: 0.35,
  /** A takeaway counter spans the shaft every this many metres, and refills the cups. */
  counterEvery: 100,
  /** Nothing that breaks, moves or hurts below this height. */
  safeUntil: 40,
  /** No rate-limit cloud below this height. */
  cloudsFrom: 120,
  /** How far a cart rolls each side of its middle, and the steps of one round trip. */
  cartSpan: 1.2,
  cartSteps: 180,
  cloudSpan: 1.5,
  cloudSteps: 240,
  /** Half the width and half the height of a cloud, and how tall the barista is. */
  cloudWide: 0.95,
  cloudTall: 0.45,
  body: 1.3,
  /** Rows are laid this far above the highest point reached. */
  ahead: 24,
  /** 300 seconds. */
  maxSteps: 18_000,
  scoreCap: 99_999,
} as const;
const T = hopTuning;

export const hopLooks = ['muse', 'claude', 'dots', 'grok', 'gemini', 'deepseek', 'qwen', 'doubao'] as const;
export type HopLook = typeof hopLooks[number];
/** What a resident does to whoever lands on her saucer. It shows before the landing. */
export type HopDeed = 'toss' | 'rocket' | 'weak';
export type HopSteer = -1 | 0 | 1;

export interface HopSpot {
  /** `saucer` holds, `foam` holds once, `cart` rolls from side to side, `counter` spans the shaft and refills the cups. */
  kind: 'saucer' | 'foam' | 'cart' | 'counter';
  /** The middle, for a cart the middle of its track. */
  x: number;
  width: number;
  /** Where in its round trip a cart starts, in steps. */
  phase: number;
  who: { look: HopLook; deed: HopDeed; met: boolean } | null;
  /** A foam that has been stepped on. */
  gone: boolean;
}
export interface HopCloud { x: number; y: number; phase: number; gone: boolean }
export interface HopRow { index: number; y: number; spots: HopSpot[]; cloud: HopCloud | null }

export type HopEvent = 'hop' | 'toss' | 'rocket' | 'weak' | 'refill' | 'cup' | 'pop';
export type HopEnd = 'fell' | 'limited' | 'timeout';

/** One climb. Plain JSON: a copy of it is a climb that goes on from the same step. */
export interface HopRun {
  seed: number;
  step: number;
  x: number;
  /** The height of the feet. */
  y: number;
  vx: number;
  vy: number;
  /** The highest the feet have been. */
  top: number;
  cups: number;
  /** Steps of rocket left. */
  rocket: number;
  /** The rows still in play, lowest first. */
  rows: HopRow[];
  /** The next row to lay, how high the last one is, and where its sure saucer is. */
  next: number;
  laid: number;
  path: number;
  /** What the last step did, for the screen. */
  event: HopEvent | null;
  hops: number;
  tosses: number;
  rockets: number;
  cupsDrunk: number;
  end: HopEnd | null;
}

const wrap = (x: number) => { const r = x % T.width; return r < 0 ? r + T.width : r; };
/** How far `a` is to the right of `b` the short way round, from -width/2 to width/2. */
export const hopAcross = (a: number, b: number) => wrap(a - b + T.width / 2) - T.width / 2;
const swing = (step: number, phase: number, steps: number) => { const f = ((step + phase) % steps) / steps; return f < 0.5 ? 4 * f - 1 : 3 - 4 * f; };
/** Where a spot's middle is on `step`. */
export const hopSpotX = (spot: HopSpot, step: number) => spot.kind === 'cart' ? wrap(spot.x + T.cartSpan * swing(step, spot.phase, T.cartSteps)) : spot.x;
export const hopCloudX = (cloud: HopCloud, step: number) => wrap(cloud.x + T.cloudSpan * swing(step, cloud.phase, T.cloudSteps));
/** The score of a climb: whole metres, the highest the feet have been. */
export const hopMeters = (run: Pick<HopRun, 'top'>) => Math.min(T.scoreCap, Math.floor(run.top));

const ramp = (y: number, from: number, over: number) => Math.min(1, Math.max(0, (y - from) / over));

/** Lays row `index` on top of the last. It reads the seed and the row below, never the climb, so every climb on a seed sees the same shaft. */
function lay(run: HopRun) {
  const index = run.next++, rng = seeded((run.seed ^ Math.imul(index, 0x9e3779b1)) >>> 0), unit = () => rng() / 4_294_967_296;
  const gap = T.gapMin + (T.gapMax - T.gapMin) * ramp(run.laid, 0, T.gapRamp) * (0.6 + 0.4 * unit());
  const y = run.laid + gap, row: HopRow = { index, y, spots: [], cloud: null };
  const look = () => hopLooks[rng() % hopLooks.length];
  if (Math.floor(y / T.counterEvery) > Math.floor(run.laid / T.counterEvery)) {
    row.spots.push({ kind: 'counter', x: T.width / 2, width: T.width, phase: 0, who: null, gone: false });
  } else {
    const wild = y >= T.safeUntil, hard = ramp(y, T.safeUntil, 500);
    const x = wrap(run.path + (unit() * 2 - 1) * T.reach);
    const sure: HopSpot = { kind: wild && unit() < 0.1 + 0.25 * hard ? 'cart' : 'saucer', x, width: T.saucer, phase: rng() % T.cartSteps, who: null, gone: false };
    const lucky = unit();
    if (y >= 30 && lucky < 0.025) sure.who = { look: 'grok', deed: 'rocket', met: false };
    else if (y >= 12 && lucky < 0.13) sure.who = { look: look(), deed: 'toss', met: false };
    row.spots.push(sure);
    run.path = x;
    for (const odds of [0.75 - 0.4 * hard, 0.3 - 0.2 * hard]) {
      if (unit() >= odds) continue;
      const side = wrap(unit() * T.width);
      if (row.spots.some(spot => Math.abs(hopAcross(side, spot.x)) < T.saucer + T.cartSpan + 0.4)) continue;
      const extra: HopSpot = { kind: wild && unit() < 0.2 + 0.4 * hard ? 'foam' : 'saucer', x: side, width: T.saucer, phase: 0, who: null, gone: false };
      const mood = unit();
      if (extra.kind === 'saucer' && wild && mood < 0.18) extra.who = { look: look(), deed: 'weak', met: false };
      else if (extra.kind === 'saucer' && y >= 12 && mood > 0.92) extra.who = { look: look(), deed: 'toss', met: false };
      row.spots.push(extra);
    }
    if (y >= T.cloudsFrom && unit() < 0.06 + 0.16 * ramp(y, T.cloudsFrom, 600)) {
      row.cloud = { x: wrap(x + T.width / 2 + (unit() * 2 - 1) * 1.5), y: y + gap * 0.5, phase: rng() % T.cloudSteps, gone: false };
    }
  }
  run.rows.push(row);
  run.laid = y;
}

export function startHop(seed: number): HopRun {
  const run: HopRun = {
    seed: seed >>> 0, step: 0, x: T.width / 2, y: 0, vx: 0, vy: T.jump, top: 0, cups: T.cups, rocket: 0,
    rows: [{ index: 0, y: 0, spots: [{ kind: 'counter', x: T.width / 2, width: T.width, phase: 0, who: null, gone: false }], cloud: null }],
    next: 1, laid: 0, path: T.width / 2, event: null, hops: 0, tosses: 0, rockets: 0, cupsDrunk: 0, end: null,
  };
  while (run.laid < T.ahead) lay(run);
  return run;
}

function land(run: HopRun, row: HopRow, spot: HopSpot) {
  run.y = row.y;
  run.vy = T.jump;
  run.event = 'hop';
  run.hops++;
  if (spot.kind === 'foam') spot.gone = true;
  if (spot.kind === 'counter' && run.cups < T.cups) { run.cups = T.cups; run.event = 'refill'; }
  const who = spot.who;
  if (!who) return;
  who.met = true;
  run.event = who.deed;
  if (who.deed === 'toss') { run.vy = T.toss; run.tosses++; }
  else if (who.deed === 'weak') run.vy = T.weak;
  else { run.rocket = T.rocketSteps; run.vy = T.rocketSpeed; run.rockets++; }
}

/**
 * One step, a sixtieth of a second. `steer` leans left or right. `tap` drinks a cup, which lifts the barista: only on
 * the way down, and only while there are cups.
 */
export function stepHop(run: HopRun, steer: HopSteer, tap: boolean) {
  if (run.end) return;
  run.event = null;
  if (tap && run.cups > 0 && run.vy <= 0 && run.rocket === 0) { run.cups--; run.cupsDrunk++; run.vy = T.cupUp; run.event = 'cup'; }
  const want = steer * T.run, push = T.grip * DT;
  run.vx = run.vx < want ? Math.min(want, run.vx + push) : Math.max(want, run.vx - push);
  run.x = wrap(run.x + run.vx * DT);
  if (run.rocket > 0) { run.rocket--; run.vy = T.rocketSpeed; } else run.vy -= T.gravity * DT;
  const from = run.y;
  run.y += run.vy * DT;

  if (run.vy < 0) {
    landing: for (let at = run.rows.length - 1; at >= 0; at--) {
      const row = run.rows[at];
      if (row.y > from || row.y <= run.y) continue;
      for (const spot of row.spots) {
        if (spot.gone || Math.abs(hopAcross(run.x, hopSpotX(spot, run.step))) > spot.width / 2 + T.foot) continue;
        land(run, row, spot);
        break landing;
      }
    }
  }
  for (const row of run.rows) {
    const cloud = row.cloud;
    if (!cloud || cloud.gone || run.y > cloud.y + T.cloudTall || run.y + T.body < cloud.y - T.cloudTall) continue;
    if (Math.abs(hopAcross(run.x, hopCloudX(cloud, run.step))) > T.cloudWide) continue;
    // A rocket goes through a cloud, and feet coming down on one pop it and hop off it. Anything else is rate limited.
    if (run.rocket > 0) { cloud.gone = true; run.event = 'pop'; }
    else if (run.vy < 0 && from >= cloud.y) { cloud.gone = true; run.vy = T.jump; run.event = 'pop'; }
    else { run.end = 'limited'; return; }
  }

  if (run.y > run.top) run.top = run.y;
  run.step++;
  if (run.y < run.top - T.drop) { run.end = 'fell'; return; }
  if (run.step >= T.maxSteps) { run.end = 'timeout'; return; }
  while (run.laid < run.top + T.ahead) lay(run);
  while (run.rows.length && run.rows[0].y < run.top - T.drop - 2) run.rows.shift();
}

/** One thing above the barista, where it is now. `up` is how far above the feet, `across` how far to the right the short way round. */
export interface HopSight { up: number; across: number; x: number; y: number; kind: HopSpot['kind'] | 'cloud'; deed: HopDeed | null; width: number }

/** What is above the feet and no more than `metres` up, nearest first. Stepped-on foam and popped clouds are left out. */
export function hopAhead(run: HopRun, metres = 12): HopSight[] {
  const seen: HopSight[] = [];
  for (const row of run.rows) {
    if (row.y > run.y && row.y <= run.y + metres) {
      for (const spot of row.spots) {
        if (spot.gone) continue;
        const x = hopSpotX(spot, run.step);
        seen.push({ up: row.y - run.y, across: hopAcross(x, run.x), x, y: row.y, kind: spot.kind, deed: spot.who?.deed ?? null, width: spot.width });
      }
    }
    const cloud = row.cloud;
    if (cloud && !cloud.gone && cloud.y > run.y && cloud.y <= run.y + metres) {
      const x = hopCloudX(cloud, run.step);
      seen.push({ up: cloud.y - run.y, across: hopAcross(x, run.x), x, y: cloud.y, kind: 'cloud', deed: null, width: T.cloudWide * 2 });
    }
  }
  return seen.sort((a, b) => a.up - b.up);
}

/** What the player did: each `[step, steer]` leans that way from that step on, and each tap drinks a cup on that step. */
export interface HopInputs { steer: readonly (readonly [number, HopSteer])[]; taps: readonly number[] }

/** Plays a whole climb from its inputs. Steps must rise in both lists. */
export function replayHop(seed: number, inputs: HopInputs): HopRun {
  const run = startHop(seed);
  let lean: HopSteer = 0, turn = 0, tap = 0;
  while (!run.end) {
    while (turn < inputs.steer.length && inputs.steer[turn][0] <= run.step) lean = inputs.steer[turn++][1];
    while (tap < inputs.taps.length && inputs.taps[tap] < run.step) tap++;
    stepHop(run, lean, tap < inputs.taps.length && inputs.taps[tap] === run.step);
  }
  return run;
}
