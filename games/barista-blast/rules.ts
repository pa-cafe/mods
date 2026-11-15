// BARISTA BLAST!! (#1078): the run itself, without a screen. The browser plays it and the Worker replays it to check a score,
// so the same seed and the same inputs must give the same run on both. It only adds, multiplies, divides and takes square
// roots; trigonometry is left out because its last digit differs between engines.

/** Goes on every run ticket. Change it with any number below: a run recorded under other numbers replays differently. */
export const BLAST_VERSION = 5;
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
  /** A refill adds this share of the forward speed, and leaves the barista no slower than a resident's kick: it is pressed when the run is about to die, and has to save it. */
  refillShare: 0.1,
  diveDown: 14,
  diveAlong: 7,
  diveCooldown: 180,
  /** A dive needs this much air under it, or diving into every bounce would keep a run going for ever. */
  diveFloor: 3,
  /** How many residents who help it takes to fill the bar. */
  caffeine: 3,
  boostWindow: 72,
  /** How fast the run moves while the boost window is open. */
  boostSlow: 0.3,
  hitStop: 6,
  boostStop: 17,
  thinkStop: 36,
  /** A resident who stalls holds the barista this long before letting go. */
  stallStop: 60,
  /** One who asks the boss first holds them this long. */
  bossStop: 48,
  /** Steps a glide lasts, boosted and not, and how high it flies: over everything on the street. */
  glideSteps: 240,
  glideShort: 120,
  glideHeight: 8,
  /** Steps a disclaimer shield lasts; twice that after a boost. */
  shield: 480,
  /** Steps a told fortune lasts: the street ahead is read further. */
  sight: 1200,
  /** How many cells ahead a fact-check looks for someone to set right. */
  fixReach: 12,
  /** The chance that Muse turns up, uninvited, where the barista comes down on bare street. Only a street with empty cells has it. */
  uninvited: 0.12,
  /** How many cells in a row may stand empty. None: somebody stands every ten metres, and what changes is who, and in what state. */
  gap: 0,
  /** A copy is planted this many cells ahead at the nearest, and no farther than `plantReach` cells. */
  plantFrom: 2,
  plantReach: 4,
  maxSpeed: 80,
  /** 180 seconds. */
  maxSteps: 21_600,
  /** A resident sends the barista off at least this fast, however slowly they arrived. */
  kick: 14,
  /** An appeal that is granted sends the barista off at least this fast. */
  appeal: 60,
  firstCell: 30,
  cell: 10,
  windowEvery: 500,
  /** Nobody is banned and nothing is at capacity before this many metres. */
  safeUntil: 100,
  /** Of the times Claude comes up in the state that bans, one in this many is a ban; the rest she lets go. */
  banEvery: 2,
  /** How tall a ban and a wall at capacity stand, in metres: a barista flying higher than this passes over them. */
  gate: 5,
  reach: 1.2,
  tokenBase: 1000,
  tokenScale: 50,
  tokenPower: 4.3,
  tokenCap: 11e12,
};
const T = blastTuning;

/** Every kind of resident. Each stands on every street equally often, whoever lives in the cafe. */
export const blastLooks = ['muse', 'claude', 'dots', 'grok', 'gemini', 'deepseek', 'qwen', 'doubao'] as const;
export type BlastLook = typeof blastLooks[number];
/**
 * The state a resident stands on the street in, there for anyone to see before they are hit: two tricks that help,
 * one that does nothing much, and one that hurts. Each resident is in each state one time in four.
 */
export const blastMoods = ['one', 'two', 'meh', 'bad'] as const;
export type BlastMood = typeof blastMoods[number];
/** Besides residents the street has only the cafe's own takeaway window. */
export type BlastKind = BlastLook | 'window';
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
 * What a resident in one state does to the barista. Everything is optional, and a trick with nothing in it is passed
 * through as if nobody stood there.
 *
 * Helping: `shot` sends the barista off (`agrees`: on the way they came, turned upward, and no flatter than the
 * shot's own heading; `limp`: with no least speed). `hold` keeps them still first. `glide` carries them level for
 * that many steps and `straight` in a dead straight line. `plant` stands copies of the resident on the street ahead.
 * `cups` hands over refills. `pep` is the caffeine gained when it is not the usual one for a helping trick and none
 * otherwise. `shield` and `sight` last that many steps. `fix` sets the next resident who would hurt to rights.
 * `copy` does whatever the last resident hit did.
 *
 * Hurting: `ban` ends the run. `drain` takes the cups and the caffeine, `decaf` the caffeine, `take` one cup.
 * `halve` halves the speed. `stray` sends the barista off at a random angle. `scramble` makes the next resident hit
 * act as another.
 */
type Trick = {
  shot?: Shot; agrees?: true; limp?: true; hold?: number; glide?: number; straight?: number; plant?: number; cups?: number | 'all'; pep?: number;
  shield?: number; sight?: number; fix?: true; copy?: true;
  ban?: true; drain?: true; decaf?: true; take?: true; halve?: true; stray?: true; scramble?: true;
};
const tricks: Record<BlastLook, Record<BlastMood | 'boost', Trick>> = {
  // GPT. A disclaimer for everything; happy to do more than was asked; some days not all there; and at capacity, a wall that takes what the barista carries.
  dots: {
    one: { shot: { toward: UP22, times: 1.2 }, shield: T.shield }, two: { shot: { toward: UP22, times: 1.5 } },
    meh: { shot: { toward: UP12, times: 1 }, limp: true }, bad: { drain: true },
    boost: { shot: { toward: UP22, times: 1.8 }, shield: T.shield * 2 },
  },
  // Claude. Agrees with whatever the barista was doing; thinks it over; says it is done and has done nothing; and bans, which ends the run.
  claude: {
    one: { shot: { toward: UP45, times: 1.15 }, agrees: true }, two: { shot: { toward: UP62, times: 1.5 }, hold: T.thinkStop },
    meh: {}, bad: { ban: true },
    boost: { shot: { toward: UP62, times: 1.8 }, hold: T.thinkStop },
  },
  // Gemini. A shallow push; a level, weightless glide; sure it is another year; and an apology it cannot stop.
  gemini: {
    one: { shot: { toward: UP30, times: 1.35 } }, two: { shot: { toward: UP30, times: 1.2 }, glide: T.glideShort },
    meh: {}, bad: { shot: { toward: UP30, times: 0.7 }, hold: T.stallStop, limp: true },
    boost: { shot: { toward: UP30, times: 1.5 }, glide: T.glideSteps },
  },
  // Grok. All in; checks the facts and sets the next one right; asks the boss first; and makes things up, so the next one hit is someone else.
  grok: {
    one: { shot: { toward: UP40, times: 1.5 } }, two: { shot: { toward: UP40, times: 1.2 }, fix: true },
    meh: { shot: { toward: UP12, times: 1 }, hold: T.bossStop, limp: true }, bad: { scramble: true },
    boost: { shot: { toward: UP40, times: 2 } },
  },
  // DeepSeek. Thinks, then the hardest plain shot; tells a fortune; does whatever the last one did; and the server is busy.
  deepseek: {
    one: { shot: { toward: UP40, times: 1.6 }, hold: T.thinkStop }, two: { shot: { toward: UP40, times: 1.2 }, sight: T.sight },
    meh: { copy: true }, bad: { halve: true },
    boost: { shot: { toward: UP40, times: 2.2 } },
  },
  // Qwen. Gives itself away as a copy up ahead; stands a drink; tops a leaderboard; and its link is blocked.
  qwen: {
    one: { shot: { toward: UP45, times: 1.25 }, plant: 1 }, two: { shot: { toward: UP45, times: 1.25 }, cups: 1 },
    meh: { shot: { toward: UP45, times: 1 }, limp: true }, bad: { decaf: true },
    boost: { shot: { toward: UP45, times: 1.6 }, plant: 2, cups: 1 },
  },
  // Doubao. Says it straight; cheers the barista on; all feeling and no use; and grins and goes round anyway.
  doubao: {
    one: { shot: { toward: UP12, times: 1.3 }, straight: 60 }, two: { shot: { toward: UP45, times: 1.1 }, pep: 2 },
    meh: { shot: { toward: UP45, times: 1 }, limp: true }, bad: { stray: true },
    boost: { shot: { toward: UP12, times: 1.7 }, straight: 120 },
  },
  // Muse. Poaches; pays a signing bonus; is off in the metaverse; and collects a cup as data.
  muse: {
    one: { shot: { toward: UP45, times: 1.25 } }, two: { shot: { toward: UP45, times: 1.1 }, cups: 'all' },
    meh: {}, bad: { take: true },
    boost: { shot: { toward: UP45, times: 1.6 }, cups: 'all' },
  },
};
const WINDOW: Shot = { toward: UP40, times: 1.3 };
/** How often a cell that may stand empty holds a resident all the same. */
const RESIDENT_CHANCE = 0.5;

/** `cast` is which of the cafe's residents plays this one; without it the kind's own character does. A `copy` was planted by a resident and plants nothing itself. A resident has a `mood`. */
export type BlastNode = { kind: BlastKind; x: number; mood?: BlastMood; cast?: number; copy?: true; done?: true };
/**
 * How high off the ground a thing is hit: from, to, in metres. A ban and a wall at capacity both stand too tall to hop:
 * only a barista flying high passes over them.
 */
export const blastHitSpan = (node: Pick<BlastNode, 'kind' | 'mood'>): readonly [number, number] =>
  node.kind === 'window' ? [0, 2.6] : node.mood === 'bad' && (node.kind === 'claude' || node.kind === 'dots') ? [0, blastTuning.gate] : [0, 2.4];

/**
 * `as` and `mood` are who the hit acted as and in which state: another resident after a made-up answer, otherwise
 * the one that was hit. `waived` is a hurt the shield took. `copied` is the trick a copycat did. `fixed` is where the
 * resident stands that a fact-check set right. `uninvited` is Muse turning up where nobody stood.
 */
export type BlastHit = {
  step: number; x: number; kind: BlastKind; as: BlastKind; mood?: BlastMood; cast?: number; outcome: 'usual' | 'boost';
  waived?: true; copied?: { as: BlastLook; mood: BlastMood }; fixed?: number; uninvited?: true;
};
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
  /** Open while a tap still upgrades the last hit. `held` is a trick that waits for the window to close: with a full bar, nothing that does not help happens until the barista has had the chance to tap. */
  boost: { left: number; hit: BlastHit; speed: number; held?: Trick } | null;
  /** Steps left of a level glide: no gravity, no hits below it, and presses wait. */
  glide: number;
  /** Steps left of a dead straight line: no fall and no drag. A press or a hit ends it. */
  straight: number;
  /** Steps left of the disclaimer shield: nothing that hurts gets through, and a ban uses it up. */
  shield: number;
  /** Steps left of a told fortune. */
  sight: number;
  /** A made-up answer was passed: the next resident hit acts as another. */
  scramble: boolean;
  /** The last resident hit, as it acted, for the copycat. */
  last: { as: BlastLook; mood: BlastMood } | null;
  hits: BlastHit[];
  end: 'stopped' | 'banned' | 'timeout' | null;
  /** The cafe's residents by kind. They lend their names to their kind; they do not decide which kinds stand on the street. */
  cast: readonly BlastLook[];
  cells: (BlastNode | null)[];
  /** The kinds in the order they next stand on the street: every kind once, then drawn again. */
  order: number[];
  placed: number;
  /** How many times each kind has been placed, to give the cafe's residents of that kind their turns. */
  turns: number[];
  /** How many times Claude has come up in the state that bans, past the safe stretch. */
  bans: number;
  /** The states each kind has still to stand in before all four are drawn again. */
  moods: BlastMood[][];
  /** Empty cells in a row up to the last one drawn. */
  gaps: number;
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
    glide: 0, straight: 0, shield: 0, sight: 0, scramble: false, last: null, hits: [], end: null, cast: cast.slice(0, 12), cells: [], order: [], placed: 0,
    turns: blastLooks.map(() => 0), bans: 0, moods: blastLooks.map(() => []), gaps: 0, next: 0, street, luck: dice(seed ^ 0x9e3779b9),
  };
}

/** A shuffled copy, drawn from the street's own dice. */
function drawn<T>(run: BlastRun, items: readonly T[]) {
  const order = [...items];
  for (let index = order.length - 1; index > 0; index--) { const other = Math.floor(run.street() * (index + 1)); [order[index], order[other]] = [order[other], order[index]]; }
  return order;
}

/**
 * The next resident to stand on the street: every kind takes one turn in a drawn order, then the order is drawn
 * again, and each kind goes through its four states the same way. Near the machine the two that can cost a run
 * stand in their harmless state instead.
 */
function resident(run: BlastRun, x: number): BlastNode {
  if (run.placed % blastLooks.length === 0) run.order = drawn(run, blastLooks.map((_, index) => index));
  const at = run.order[run.placed++ % blastLooks.length], kind = blastLooks[at], turn = run.turns[at]++;
  if (!run.moods[at].length) run.moods[at] = drawn(run, blastMoods);
  const mood = run.moods[at].pop()!, early = mood === 'bad' && x < T.safeUntil && (kind === 'claude' || kind === 'dots');
  // A ban ends the run, so it stands less often than the other states that hurt: only every `banEvery`th time.
  const spared = !early && mood === 'bad' && kind === 'claude' && ++run.bans % T.banEvery !== 0;
  const own = run.cast.flatMap((look, index) => look === kind ? [index] : []);
  return { kind, x, mood: early || spared ? 'meh' : mood, ...(own.length ? { cast: own[turn % own.length] } : {}) };
}

/** The street is drawn cell by cell as the run reaches it, always in order, so the seed alone decides it. */
function cellAt(run: BlastRun, index: number) {
  while (run.cells.length <= index) {
    const x = T.firstCell + T.cell * run.cells.length, roll = run.street();
    const empty = x % T.windowEvery !== 0 && run.gaps < T.gap && roll >= RESIDENT_CHANCE;
    run.gaps = empty ? run.gaps + 1 : 0;
    run.cells.push(x % T.windowEvery === 0 ? { kind: 'window', x } : empty ? null : resident(run, x));
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

const isLook = (kind: BlastKind): kind is BlastLook => kind !== 'window';
function send(run: BlastRun, shot: Shot, speed: number, floor: number) {
  const fast = Math.min(T.maxSpeed, Math.max(speed * shot.times, floor));
  run.vx = shot.toward[0] * fast; run.vy = shot.toward[1] * fast; run.sliding = false;
}

/**
 * Copies of a resident ahead of the one at `x`, a dive away: on the nearest empty cells, and where the street has
 * none to spare, in the place of whoever stands nearest. A copy plants nothing, and no copy takes a copy's place.
 */
function plant(run: BlastRun, kind: BlastLook, x: number, count: number) {
  const from = Math.round((x - T.firstCell) / T.cell), copy = (at: number): BlastNode => ({ kind, x: T.firstCell + T.cell * at, mood: 'one', copy: true });
  for (let ahead = T.plantFrom; ahead <= T.plantReach && count > 0; ahead++) if (!cellAt(run, from + ahead)) { run.cells[from + ahead] = copy(from + ahead); count--; }
  for (let ahead = T.plantFrom; ahead <= T.plantReach && count > 0; ahead++) {
    const there = run.cells[from + ahead];
    if (there && there.kind !== 'window' && !there.copy && !there.done) { run.cells[from + ahead] = copy(from + ahead); count--; }
  }
}

/** A fact-check: the nearest resident ahead who would hurt stands in their first helping state instead. */
function fix(run: BlastRun, hit: BlastHit) {
  const from = Math.round((hit.x - T.firstCell) / T.cell);
  for (let ahead = 1; ahead <= T.fixReach; ahead++) {
    const node = cellAt(run, from + ahead);
    if (node && !node.done && node.mood === 'bad') { node.mood = 'one'; hit.fixed = node.x; return; }
  }
}

/** Does a trick to the barista, who arrived at `speed`. `gain` is false for a boost, which has just spent the caffeine. */
function apply(run: BlastRun, hit: BlastHit, who: BlastLook, trick: Trick, speed: number, helps: boolean, plants: boolean, gain = true) {
  if (trick.ban) { run.vx = 0; run.vy = 0; run.end = 'banned'; return; }
  if (trick.drain) { run.refills = 0; run.caffeine = 0; }
  if (trick.decaf) run.caffeine = 0;
  if (trick.take) run.refills = Math.max(0, run.refills - 1);
  if (trick.halve) { run.vx *= 0.5; run.vy *= 0.5; }
  if (trick.scramble) run.scramble = true;
  if (trick.stray) send(run, { toward: between(0.08 + 0.84 * run.luck()), times: 1 }, speed, 0);
  if (trick.shot) {
    // Agreeing: the barista's own heading, turned upward, when that is at least as steep as the shot's.
    const up = Math.abs(run.vy), steep = trick.shot.toward[1], own = trick.agrees && up * up >= steep * steep * speed * speed ? heading(run.vx, up) : trick.shot.toward;
    send(run, { toward: own, times: trick.shot.times }, speed, trick.limp ? 0 : T.kick);
  }
  // Nothing that moves or holds the barista: they pass as if nobody stood there.
  run.frozen = trick.hold ?? (trick.shot || trick.stray || trick.halve ? run.frozen : 0);
  if (trick.glide) { run.vx = Math.sqrt(run.vx * run.vx + run.vy * run.vy); run.vy = 0; run.y = Math.max(run.y, T.glideHeight); run.glide = trick.glide; }
  if (trick.straight) run.straight = trick.straight;
  if (trick.plant && plants) plant(run, who, hit.x, trick.plant);
  if (trick.cups) run.refills = trick.cups === 'all' ? T.refills : Math.min(T.refills, run.refills + trick.cups);
  if (trick.shield) run.shield = Math.max(run.shield, trick.shield);
  if (trick.sight) run.sight = Math.max(run.sight, trick.sight);
  if (trick.fix) fix(run, hit);
  if (gain) run.caffeine = Math.min(T.caffeine, run.caffeine + (trick.pep ?? (helps ? 1 : 0)));
}

function strike(run: BlastRun, node: BlastNode) {
  const speed = Math.sqrt(run.vx * run.vx + run.vy * run.vy), charged = run.caffeine >= T.caffeine;
  const hit: BlastHit = { step: run.step, x: node.x, kind: node.kind, as: node.kind, outcome: 'usual', ...(node.cast === undefined ? {} : { cast: node.cast }) };
  run.hits.push(hit); run.frozen = T.hitStop; run.straight = 0;
  if (!isLook(node.kind)) {
    run.refills = T.refills; send(run, WINDOW, speed, T.kick);
    if (charged) { run.boost = { left: T.boostWindow, hit, speed }; run.frozen = 0; }
    return;
  }
  let who: BlastLook = node.kind, mood = node.mood ?? 'one';
  if (run.scramble) {
    // A made-up answer: someone else, in a state that costs nothing.
    const others = blastLooks.filter(look => look !== node.kind);
    who = others[Math.floor(run.luck() * others.length)]; mood = blastMoods[Math.floor(run.luck() * 3)]; run.scramble = false;
  }
  hit.as = who; hit.mood = mood;
  let trick = tricks[who][mood], helps = mood === 'one' || mood === 'two';
  if (trick.copy) {
    // The copycat does what the last resident did, for better or worse; with nobody to copy, its own first trick.
    const last = run.last ?? { as: who, mood: 'one' as const };
    if (run.last) hit.copied = last;
    trick = tricks[last.as][last.mood]; helps = last.mood === 'one' || last.mood === 'two'; who = last.as; mood = last.mood;
  }
  run.last = { as: who, mood };
  if (mood === 'bad' && run.shield) {
    // The shield takes it. A ban is more than it can hold twice: it is used up.
    hit.waived = true; run.frozen = 0;
    if (trick.ban) run.shield = 0;
    return;
  }
  if (charged && !helps) { run.boost = { left: T.boostWindow, hit, speed, held: trick }; run.frozen = T.boostWindow; return; }
  apply(run, hit, who, trick, speed, helps, !node.copy);
  if (charged && !run.end) { run.boost = { left: T.boostWindow, hit, speed }; run.frozen = 0; }
}

/** A tap inside the window: the hit becomes the resident's boost, whatever state they stood in. A ban becomes an appeal that is granted. */
function upgrade(run: BlastRun) {
  const { hit, speed, held } = run.boost!, as = hit.as;
  run.boost = null; run.caffeine = 0; run.frozen = T.boostStop; hit.outcome = 'boost';
  if (!isLook(as)) { run.caffeine = T.caffeine; return; }
  if (held?.ban) { send(run, { toward: UP45, times: 1 }, speed, T.appeal); return; }
  const frozen = run.frozen;
  apply(run, hit, as, tricks[as].boost, speed, true, true, false);
  if (!tricks[as].boost.hold) run.frozen = frozen;
}

/** Muse, where nobody stood: a landing on bare street is sometimes met after all. It opens no boost window. */
function uninvited(run: BlastRun) {
  const index = Math.round((run.x - T.firstCell) / T.cell), x = T.firstCell + T.cell * index, there = index >= 0 ? cellAt(run, index) : null;
  if (!T.gap || run.x < T.firstCell - T.reach || (there && !there.done && Math.abs(run.x - x) <= T.reach) || run.luck() >= T.uninvited) return;
  const hit: BlastHit = { step: run.step, x: run.x, kind: 'muse', as: 'muse', mood: 'one', outcome: 'usual', uninvited: true };
  run.hits.push(hit); run.frozen = T.hitStop; run.last = { as: 'muse', mood: 'one' };
  apply(run, hit, 'muse', tricks.muse.one, Math.sqrt(run.vx * run.vx + run.vy * run.vy), true, false);
}

function tapped(run: BlastRun) {
  if (run.boost) return upgrade(run);
  if (run.frozen || run.glide) return;
  run.straight = 0;
  if (run.vy <= 0) {
    if (!run.refills) return;
    run.refills--; run.vy = T.refillUp; run.vx = Math.max(run.vx * (1 + T.refillShare), T.kick); run.sliding = false;
  } else if (run.step >= run.diveAt && run.y >= T.diveFloor) {
    run.diveAt = run.step + T.diveCooldown; run.vy = -T.diveDown; run.vx += T.diveAlong;
  }
}

/** One step of 1/120 second. `tap` is a press that landed on this step. Does nothing once the run has ended. */
export function stepBlast(run: BlastRun, tap: boolean) {
  if (run.end) return;
  if (tap) tapped(run);
  if (run.boost && --run.boost.left <= 0) {
    // The window closed with no tap: what was held back happens now.
    const { hit, speed, held } = run.boost;
    run.boost = null;
    if (held && isLook(hit.as)) apply(run, hit, hit.copied?.as ?? hit.as, held, speed, false, true);
  }
  if (++run.step >= T.maxSteps) run.end ??= 'timeout';
  if (run.end) return;
  if (run.frozen) { run.frozen--; return; }
  if (run.shield) run.shield--;
  if (run.sight) run.sight--;
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
      run.y = 0; run.vy *= -T.bounceUp; run.vx *= T.bounceAlong;
      if (run.vy < T.slideBelow) { run.vy = 0; run.sliding = true; }
      if (!run.boost) uninvited(run);
    }
  }
  for (;;) {
    const x = T.firstCell + T.cell * run.next;
    if (run.x < x - T.reach) break;
    const node = cellAt(run, run.next);
    if (node && !node.done && run.x <= x + T.reach) {
      const [from, to] = blastHitSpan(node);
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
