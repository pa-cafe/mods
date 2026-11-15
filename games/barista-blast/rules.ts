// BARISTA BLAST!! (#1078): the run itself, without a screen. The browser plays it and the Worker replays it to check a score,
// so the same seed and the same inputs must give the same run on both. It only adds, multiplies, divides and takes square
// roots; trigonometry is left out because its last digit differs between engines.

/** Goes on every run ticket. Change it with any number below: a run recorded under other numbers replays differently. */
export const BLAST_VERSION = 3;
export const BLAST_HZ = 120;
const DT = 1 / BLAST_HZ;

export const blastTuning = {
  gravity: 22,
  /** Steps for the nozzle to swing from 15° up to 75° and back. */
  aimSteps: 144,
  /** Steps for the pressure gauge to run from empty to full and back. */
  gaugeSteps: 108,
  launchMin: 6,
  launchMax: 42,
  /** Share of forward speed lost to the air each second. */
  drag: 0.02,
  bounceUp: 0.62,
  bounceAlong: 0.8,
  /** A bounce that leaves the ground slower than this turns into a slide. */
  slideBelow: 2.5,
  friction: 14,
  stopBelow: 0.5,
  refills: 3,
  refillUp: 15,
  refillAlong: 5,
  diveDown: 14,
  diveAlong: 7,
  diveCooldown: 180,
  /** A dive needs this much air under it, or diving into every bounce would keep a run going for ever. */
  diveFloor: 3,
  caffeine: 3,
  boostWindow: 72,
  /** How fast the run moves while the boost window is open. */
  boostSlow: 0.3,
  hitStop: 10,
  boostStop: 17,
  thinkStop: 36,
  /** A resident who stalls holds the barista this long before letting go. */
  stallStop: 60,
  /** Steps a glide lasts, and how high it flies: over the wall and the notice. */
  glideSteps: 240,
  glideHeight: 8,
  /** A copy is planted this many cells ahead at the nearest, and no farther than `plantReach` cells. */
  plantFrom: 2,
  plantReach: 4,
  maxSpeed: 80,
  /** 90 seconds. */
  maxSteps: 10_800,
  /** Disclaimers a barista can hold. */
  waivers: 1,
  /** A resident sends the barista off at least this fast, however slowly they arrived. */
  kick: 14,
  wallBoost: 60,
  firstCell: 30,
  cell: 10,
  windowEvery: 500,
  /** No wall and no ban notice before this many metres. */
  safeUntil: 100,
  reach: 1.2,
  tokenBase: 1000,
  tokenScale: 50,
  tokenPower: 4.3,
  tokenCap: 110e9,
};
const T = blastTuning;

/** Every kind of resident. Each stands on every street equally often, whoever lives in the cafe. */
export const blastLooks = ['muse', 'claude', 'dots', 'grok', 'gemini', 'deepseek', 'qwen', 'doubao'] as const;
export type BlastLook = typeof blastLooks[number];
type BlastProp = 'window' | 'wall' | 'limit' | 'gate' | 'cache' | 'notice' | 'ghost';
export type BlastKind = BlastLook | BlastProp;
type Heading = readonly [number, number];

const heading = (x: number, y: number): Heading => { const length = Math.sqrt(x * x + y * y); return [x / length, y / length]; };
// Written out so no engine has to compute a sine: 12°, 22°, 30°, 40°, 45° and 62° above the ground.
const UP12 = heading(0.9781, 0.2079), UP22 = heading(0.9272, 0.3746), UP30 = heading(0.866, 0.5), UP40 = heading(0.766, 0.6428), UP45 = heading(1, 1), UP62 = heading(0.4695, 0.8829);
/** 0 is 15° above the ground, 1 is 75°, a half is 45°. */
const between = (u: number) => heading(0.9659 - 0.7071 * u, 0.2588 + 0.7071 * u);
const swing = (step: number, period: number) => { const at = (step % period) / period; return at < 0.5 ? at * 2 : 2 - at * 2; };

/** Where the nozzle points on this step of its swing. */
export const blastAim = (step: number) => between(swing(step, T.aimSteps));
/** The gauge after holding for this many steps, 0 to 1. Squared, so the needle is fastest near full. */
export const blastPower = (step: number) => { const at = swing(step, T.gaugeSteps); return at * at; };

/** How many tokens a distance burned: every doubling of the distance is about twenty times the tokens. */
export function blastTokens(meters: number) {
  return Math.min(T.tokenCap, Math.round(T.tokenBase * (1 + Math.max(0, meters) / T.tokenScale) ** T.tokenPower));
}

type Shot = { toward: Heading; times: number };
/**
 * What each resident does to the barista. `odd` is the chance of the unlucky outcome instead of the usual one.
 * `ponder` holds the barista for a moment before the usual shot. An odd `stall` holds them longer; an odd `miss` is
 * no hit at all: the barista passes through. `stray` sends them off at a random angle. `plant` puts copies of the
 * resident on the street ahead. `glide` is a boost that carries the barista level instead of throwing them. `straight`
 * is how many steps the barista then flies in a dead straight line, with no fall and no drag. `agrees` sends the
 * barista on the way they were already going, turned upward, instead of `usual.toward`. `waiver` is how many
 * disclaimers the barista holds after a hit, or after a boost: each takes the next rate limit or ban notice for them.
 */
type Effect = {
  usual: Shot; odd?: Shot & { chance: number; stall?: true; miss?: true; stray?: true }; boost: Shot;
  refill?: true; think?: true; ponder?: true; plant?: { usual: number; boost: number }; glide?: true; cup?: true; straight?: { usual: number; boost: number }; agrees?: true; waiver?: { usual: number; boost: number };
};
const residents: Record<BlastLook, Effect> = {
  muse: { usual: { toward: UP45, times: 1.25 }, boost: { toward: UP45, times: 1.6 }, refill: true },
  // You're absolutely right: whichever way the barista was going, that way, only faster. Boosted, it thinks it over first.
  claude: { usual: { toward: UP45, times: 1.15 }, boost: { toward: UP62, times: 1.8 }, think: true, agrees: true },
  // Nothing here is a guarantee: a cautious shot that comes with a disclaimer, two when boosted. One time in five it will not commit to anything.
  dots: { usual: { toward: UP22, times: 1.2 }, odd: { chance: 0.2, toward: UP12, times: 1 }, boost: { toward: UP22, times: 1.7 }, waiver: { usual: 1, boost: 2 } },
  grok: { usual: { toward: UP40, times: 1.5 }, odd: { chance: 0.3, toward: UP40, times: 0.8 }, boost: { toward: UP40, times: 2 } },
  // Sorry, sorry, sorry: one time in four it stalls on an apology. Boosted, it carries everything it remembers, level, for two seconds.
  gemini: { usual: { toward: UP30, times: 1.35 }, odd: { chance: 0.25, toward: UP30, times: 0.9, stall: true }, boost: { toward: UP30, times: 1.5 }, glide: true },
  // Thinks first, then the hardest usual shot on the street. One time in three the server is busy and nothing happens.
  deepseek: { usual: { toward: UP40, times: 1.6 }, odd: { chance: 0.35, toward: UP40, times: 1, miss: true }, boost: { toward: UP40, times: 2.2 }, ponder: true },
  // Gives itself away: a copy of it stands on the street ahead. Boosted, two copies and a cup on the house.
  qwen: { usual: { toward: UP45, times: 1.25 }, odd: { chance: 0.2, toward: UP45, times: 1 }, boost: { toward: UP45, times: 1.6 }, plant: { usual: 1, boost: 2 }, cup: true },
  // Says it plainly, no going round: the flattest shot on the street, and for a moment a dead straight line. One time in four it goes round after all and the barista ends up anywhere.
  doubao: { usual: { toward: UP12, times: 1.3 }, odd: { chance: 0.25, toward: UP12, times: 1, stray: true }, boost: { toward: UP12, times: 1.7 }, straight: { usual: 60, boost: 120 } },
};
const WINDOW: Shot = { toward: UP40, times: 1.3 };

/** What stands in a cell of the street that is neither empty nor a resident, and how often. */
const props: readonly { kind: BlastProp; chance: number; late?: true }[] = [
  { kind: 'wall', chance: 0.025, late: true },
  { kind: 'limit', chance: 0.05 },
  { kind: 'gate', chance: 0.04 },
  { kind: 'cache', chance: 0.03 },
  { kind: 'notice', chance: 0.02, late: true },
  { kind: 'ghost', chance: 0.02 },
];
const RESIDENT_CHANCE = 0.3;
/** How high off the ground each thing is hit: from, to. The ban notice floats; the wall is the only tall one. */
const span: Record<BlastProp | 'resident', readonly [number, number]> = {
  resident: [0, 2.4], window: [0, 2.6], wall: [0, 5], limit: [0, 2.4], gate: [0, 3], cache: [0, 1.2], notice: [3, 7], ghost: [0, 2.4],
};
/** How high off the ground a thing of this kind is hit: from, to, in metres. */
export const blastHitSpan = (kind: BlastKind) => span[kind in residents ? 'resident' : kind as BlastProp];
/** What a ghost can turn the next hit into. Nothing that ends the run or takes the refills away. */
const disguises: readonly BlastKind[] = [...blastLooks, 'limit', 'gate', 'cache'];

/** `cast` is which of the cafe's residents plays this one; without it the kind's own character does. A `copy` was planted by a resident and plants nothing itself. */
export type BlastNode = { kind: BlastKind; x: number; cast?: number; copy?: true; done?: true };
/** `waived` is a rate limit or ban notice that a disclaimer took instead of the barista. */
export type BlastHit = { step: number; x: number; kind: BlastKind; as: BlastKind; cast?: number; outcome: 'usual' | 'odd' | 'boost'; waived?: true };
export type BlastRun = {
  /** Steps since the launch. Taps are recorded against this. */
  step: number;
  x: number; y: number; vx: number; vy: number;
  sliding: boolean;
  refills: number;
  caffeine: number;
  diveAt: number;
  /** Steps left of the pause after a hit. */
  frozen: number;
  /** Open while a tap still upgrades the last hit. */
  boost: { left: number; hit: BlastHit; speed: number } | null;
  /** The next landing keeps all its speed. */
  spring: boolean;
  /** Steps left of a level glide: no gravity, no hits below it, and presses wait. */
  glide: number;
  /** Steps left of a dead straight line: no fall and no drag. A press or a hit ends it. */
  straight: number;
  /** Disclaimers in hand: each takes one rate limit or ban notice. */
  waivers: number;
  /** A ghost was passed: the next hit acts as something else. */
  scramble: boolean;
  hits: BlastHit[];
  end: 'stopped' | 'wall' | 'timeout' | null;
  /** The cafe's residents by kind. They lend their names to their kind; they do not decide which kinds stand on the street. */
  cast: readonly BlastLook[];
  cells: (BlastNode | null)[];
  /** The kinds in the order they next stand on the street: every kind once, then drawn again. */
  order: number[];
  placed: number;
  /** How many times each kind has been placed, to give the cafe's residents of that kind their turns. */
  turns: number[];
  next: number;
  street: () => number;
  luck: () => number;
};

/** Mulberry32: whole-number arithmetic only, so every engine draws the same numbers. */
function dice(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** A run that has just left the machine. `aim` and `hold` are the steps the nozzle and the gauge had swung for. */
export function startBlast(seed: number, cast: readonly BlastLook[], aim: number, hold: number): BlastRun {
  const street = dice(seed), toward = blastAim(aim), speed = T.launchMin + (T.launchMax - T.launchMin) * blastPower(hold);
  return {
    step: 0, x: 0, y: 0, vx: toward[0] * speed, vy: toward[1] * speed, sliding: false, refills: T.refills, caffeine: 0, diveAt: 0, frozen: 0, boost: null,
    spring: false, glide: 0, straight: 0, waivers: 0, scramble: false, hits: [], end: null, cast: cast.slice(0, 12), cells: [], order: [], placed: 0, turns: blastLooks.map(() => 0), next: 0, street, luck: dice(seed ^ 0x9e3779b9),
  };
}

/** The next resident to stand on the street: every kind takes one turn in a drawn order, then the order is drawn again. */
function resident(run: BlastRun, x: number): BlastNode {
  if (run.placed % blastLooks.length === 0) {
    run.order = blastLooks.map((_, index) => index);
    for (let index = run.order.length - 1; index > 0; index--) { const other = Math.floor(run.street() * (index + 1)); [run.order[index], run.order[other]] = [run.order[other], run.order[index]]; }
  }
  const at = run.order[run.placed++ % blastLooks.length], kind = blastLooks[at], turn = run.turns[at]++;
  const own = run.cast.flatMap((look, index) => look === kind ? [index] : []);
  return own.length ? { kind, x, cast: own[turn % own.length] } : { kind, x };
}

/** The street is drawn cell by cell as the run reaches it, always in order, so the seed alone decides it. */
function cellAt(run: BlastRun, index: number) {
  while (run.cells.length <= index) {
    const x = T.firstCell + T.cell * run.cells.length, roll = run.street();
    let node: BlastNode | null = null;
    if (x % T.windowEvery === 0) node = { kind: 'window', x };
    else if (roll < RESIDENT_CHANCE) node = resident(run, x);
    else {
      let edge = RESIDENT_CHANCE;
      for (const prop of props) {
        edge += prop.chance;
        if (roll < edge) { if (!prop.late || x >= T.safeUntil) node = { kind: prop.kind, x }; break; }
      }
    }
    run.cells.push(node);
  }
  return run.cells[index];
}

/**
 * What stands on the street from the barista to `meters` ahead, nearest first. `behind` also lists what the barista has
 * just passed the middle of by no more than that: something within `reach` behind can still be hit. Looking does not change the run.
 */
export function blastAhead(run: BlastRun, meters: number, behind = 0) {
  const ahead: BlastNode[] = [];
  for (let index = Math.max(0, run.next); T.firstCell + T.cell * index <= run.x + meters; index++) {
    const node = cellAt(run, index);
    if (node && !node.done && node.x > run.x - behind) ahead.push(node);
  }
  return ahead;
}

const isLook = (kind: BlastKind): kind is BlastLook => kind in residents;
function send(run: BlastRun, shot: Shot, speed: number, floor: number) {
  const fast = Math.min(T.maxSpeed, Math.max(speed * shot.times, floor));
  run.vx = shot.toward[0] * fast; run.vy = shot.toward[1] * fast; run.sliding = false;
}

/** Copies of a resident on the nearest empty cells ahead of the one at `x`, a dive away. A copy plants nothing. */
function plant(run: BlastRun, kind: BlastLook, x: number, count: number) {
  const from = Math.round((x - T.firstCell) / T.cell);
  for (let ahead = T.plantFrom; ahead <= T.plantReach && count > 0; ahead++) {
    if (cellAt(run, from + ahead)) continue;
    run.cells[from + ahead] = { kind, x: T.firstCell + T.cell * (from + ahead), copy: true }; count--;
  }
}

function strike(run: BlastRun, node: BlastNode) {
  let as = node.kind;
  if (run.scramble && as !== 'ghost') {
    const others = disguises.filter(kind => kind !== node.kind);
    as = others[Math.floor(run.luck() * others.length)]; run.scramble = false;
  }
  const speed = Math.sqrt(run.vx * run.vx + run.vy * run.vy), charged = run.caffeine >= T.caffeine;
  const hit: BlastHit = { step: run.step, x: node.x, kind: node.kind, as, outcome: 'usual', ...(node.cast === undefined ? {} : { cast: node.cast }) };
  run.hits.push(hit); run.frozen = T.hitStop; run.straight = 0;
  if (isLook(as)) {
    const effect = residents[as], unlucky = effect.odd && run.luck() < effect.odd.chance;
    if (unlucky) hit.outcome = 'odd';
    // The server is busy: the barista goes on as if nobody stood there.
    if (unlucky && effect.odd!.miss) { run.frozen = 0; return; }
    // Agreeing: the barista's own heading, turned upward, and no flatter than 45°.
    const up = Math.abs(run.vy), own: Shot | null = effect.agrees && up * up >= 0.5 * speed * speed ? { toward: heading(run.vx, up), times: effect.usual.times } : null;
    send(run, unlucky ? { toward: effect.odd!.stray ? between(0.08 + 0.84 * run.luck()) : effect.odd!.toward, times: effect.odd!.times } : own ?? effect.usual, speed, unlucky ? 0 : T.kick);
    run.caffeine = Math.min(T.caffeine, run.caffeine + 1);
    if (!unlucky && effect.straight) run.straight = effect.straight.usual;
    if (unlucky && effect.odd!.stall) run.frozen = T.stallStop;
    else if (!unlucky && effect.ponder) run.frozen = T.thinkStop;
    if (!unlucky && effect.plant && !node.copy) plant(run, as, node.x, effect.plant.usual);
    if (!unlucky && effect.waiver) run.waivers = Math.max(run.waivers, effect.waiver.usual);
  } else if (as === 'window') { run.refills = T.refills; send(run, WINDOW, speed, T.kick); }
  else if (as === 'wall') { run.vx = 0; run.vy = 0; if (!charged) run.end = 'wall'; }
  else if ((as === 'limit' || as === 'notice') && run.waivers) { run.waivers--; hit.waived = true; }
  else if (as === 'limit') { run.vx *= 0.5; run.vy *= 0.5; }
  else if (as === 'gate') send(run, { toward: between(0.08 + 0.84 * run.luck()), times: 1 }, speed, 0);
  else if (as === 'cache') run.spring = true;
  else if (as === 'notice') { run.refills = 0; run.caffeine = 0; run.boost = null; }
  else { run.scramble = true; run.frozen = 0; }
  if (charged && (isLook(as) || as === 'window' || as === 'wall')) { run.boost = { left: T.boostWindow, hit, speed }; run.frozen = as === 'wall' ? T.boostWindow : 0; }
}

function upgrade(run: BlastRun) {
  const { hit, speed } = run.boost!, as = hit.as;
  run.boost = null; run.caffeine = 0; run.frozen = T.boostStop; hit.outcome = 'boost';
  if (isLook(as)) {
    const effect = residents[as];
    send(run, effect.boost, speed, T.kick);
    if (effect.straight) run.straight = effect.straight.boost;
    if (effect.waiver) run.waivers = effect.waiver.boost;
    if (effect.refill) run.refills = T.refills;
    if (effect.cup) run.refills = Math.min(T.refills, run.refills + 1);
    if (effect.think) run.frozen = T.thinkStop;
    if (effect.plant) plant(run, as, hit.x, effect.plant.boost);
    if (effect.glide) { run.vx = Math.sqrt(run.vx * run.vx + run.vy * run.vy); run.vy = 0; run.y = Math.max(run.y, T.glideHeight); run.glide = T.glideSteps; }
  } else if (as === 'window') run.caffeine = T.caffeine;
  else send(run, { toward: UP45, times: 1 }, T.wallBoost, T.wallBoost);
}

function tapped(run: BlastRun) {
  if (run.boost) return upgrade(run);
  if (run.frozen || run.glide) return;
  run.straight = 0;
  if (run.vy <= 0) {
    if (!run.refills) return;
    run.refills--; run.vy = T.refillUp; run.vx += T.refillAlong; run.sliding = false;
  } else if (run.step >= run.diveAt && run.y >= T.diveFloor) {
    run.diveAt = run.step + T.diveCooldown; run.vy = -T.diveDown; run.vx += T.diveAlong;
  }
}

/** One step of 1/120 second. `tap` is a press that landed on this step. Does nothing once the run has ended. */
export function stepBlast(run: BlastRun, tap: boolean) {
  if (run.end) return;
  if (tap) tapped(run);
  if (run.boost && --run.boost.left <= 0) { if (run.boost.hit.as === 'wall') run.end = 'wall'; run.boost = null; }
  if (++run.step >= T.maxSteps) run.end ??= 'timeout';
  if (run.end) return;
  if (run.frozen) { run.frozen--; return; }
  const dt = run.boost ? DT * T.boostSlow : DT;
  if (run.sliding) {
    run.vx -= T.friction * dt;
    if (run.vx < T.stopBelow) { run.vx = 0; run.end = 'stopped'; return; }
    run.x += run.vx * dt;
  } else if (run.glide) {
    run.glide--; run.x += run.vx * dt;
  } else if (run.straight) {
    run.straight--; run.x += run.vx * dt; run.y += run.vy * dt;
  } else {
    run.vy -= T.gravity * dt; run.vx -= run.vx * T.drag * dt;
    const square = run.vx * run.vx + run.vy * run.vy;
    if (square > T.maxSpeed * T.maxSpeed) { const slow = T.maxSpeed / Math.sqrt(square); run.vx *= slow; run.vy *= slow; }
    run.x += run.vx * dt; run.y += run.vy * dt;
    if (run.y <= 0 && run.vy < 0) {
      run.y = 0;
      if (run.spring) { run.vy = -run.vy; run.spring = false; } else { run.vy *= -T.bounceUp; run.vx *= T.bounceAlong; }
      if (run.vy < T.slideBelow) { run.vy = 0; run.sliding = true; }
    }
  }
  for (;;) {
    const x = T.firstCell + T.cell * run.next;
    if (run.x < x - T.reach) break;
    const node = cellAt(run, run.next);
    if (node && !node.done && run.x <= x + T.reach) {
      const [from, to] = span[isLook(node.kind) ? 'resident' : node.kind];
      if (run.y >= from && run.y <= to) { node.done = true; strike(run, node); }
    }
    if (run.x <= x + T.reach) break;
    run.next++;
  }
}

/** What a player did in one run: how long the nozzle and the gauge had swung, then every tap, in steps since the launch. */
export type BlastInputs = { aim: number; hold: number; taps: readonly number[] };

/** Plays a recorded run to its end. Taps must be whole steps in rising order; anything else is ignored. */
export function replayBlast(seed: number, cast: readonly BlastLook[], inputs: BlastInputs) {
  const run = startBlast(seed, cast, inputs.aim, inputs.hold);
  let tap = 0;
  while (!run.end) {
    while (tap < inputs.taps.length && inputs.taps[tap] < run.step) tap++;
    const now = inputs.taps[tap] === run.step;
    if (now) tap++;
    stepBlast(run, now);
  }
  return run;
}

/** Distance of a run in metres, to the centimetre. */
export const blastMeters = (run: BlastRun) => Math.floor(run.x * 100) / 100;
