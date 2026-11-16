import { describe, expect, it } from 'vitest';
import { BLAST_HZ, BLAST_VERSION, blastAhead, blastAim, blastHitSpan, blastLooks, blastMeters, blastMoods, blastPower, blastTokens, blastTuning as T, replayBlast, startBlast, stepBlast, type BlastHit, type BlastInputs, type BlastLook, type BlastMood, type BlastRun } from './rules.ts';

type Cell = NonNullable<BlastRun['cells'][number]>;
type Stands = `${BlastLook}:${BlastMood}` | 'window';
const speedOf = (run: BlastRun) => Math.hypot(run.vx, run.vy);
const degrees = (run: BlastRun) => Math.atan2(run.vy, run.vx) * 180 / Math.PI;
const cell = (stands: Stands, index: number): Cell => { const [kind, mood] = stands.split(':') as [Cell['kind'], BlastMood | undefined]; return { kind, x: T.firstCell + T.cell * index, ...(mood ? { mood } : {}) }; };

/** A run about to reach the first cell of a street made only of these, moving level at `speed`, `y` metres up. `luck` is what every roll of the dice gives. */
function approaching(stands: (Stands | null)[], { speed = 20, y = 1, luck = 0.9, caffeine = 0 } = {}) {
  const run = startBlast(1, blastLooks, 36, 54);
  run.cells = stands.map((each, index) => each && cell(each, index));
  Object.assign(run, { x: T.firstCell - 2, y, vx: speed, vy: 0, caffeine, luck: () => luck });
  return run;
}
/** Steps until the run has hit `count` things, and returns the last hit. */
function untilHit(run: BlastRun, count = 1): BlastHit {
  for (let step = 0; run.hits.length < count && !run.end && step < 4000; step++) stepBlast(run, false);
  expect(run.hits).toHaveLength(count);
  return run.hits[count - 1];
}
const steps = (run: BlastRun, count: number, tapAt = -1) => { for (let step = 0; step < count; step++) stepBlast(run, step === tapAt); };
/** Puts the barista level and low again, just before the cell at `index`. */
const before = (run: BlastRun, index: number, speed = 20) => Object.assign(run, { x: T.firstCell + T.cell * index - 2, y: 1, vx: speed, vy: 0, frozen: 0, sliding: false });

describe('BARISTA BLAST!! launch and score', () => {
  it('swings the nozzle from 15° to 75° and back, and the gauge from empty to full and back', () => {
    const angle = (step: number) => Math.atan2(blastAim(step)[1], blastAim(step)[0]) * 180 / Math.PI;
    expect(angle(0)).toBeCloseTo(15, 1);
    expect(angle(T.aimSteps / 4)).toBeCloseTo(45, 1);
    expect(angle(T.aimSteps / 2)).toBeCloseTo(75, 1);
    expect(angle(T.aimSteps)).toBeCloseTo(15, 1);
    expect(Math.hypot(...blastAim(17))).toBeCloseTo(1, 12);
    expect(blastPower(0)).toBe(0);
    expect(blastPower(T.gaugeSteps / 2)).toBe(1);
    expect(blastPower(T.gaugeSteps)).toBe(0);
    // The needle covers the last quarter of the gauge in far fewer steps than the first.
    const reach = (power: number) => { let step = 0; while (blastPower(step) < power) step++; return step; };
    expect(reach(1) - reach(0.75)).toBeLessThan(reach(0.25) / 3);
  });

  it('leaves the machine between the slowest and fastest launch speed', () => {
    expect(speedOf(startBlast(1, blastLooks, 0, 0))).toBeCloseTo(T.launchMin, 9);
    expect(speedOf(startBlast(1, blastLooks, 0, T.gaugeSteps / 2))).toBeCloseTo(T.launchMax, 9);
  });

  it('turns distance into tokens that grow faster the farther the run goes, up to a ceiling', () => {
    expect(blastTokens(0)).toBe(1000);
    expect(blastTokens(-5)).toBe(1000);
    expect(blastTokens(50)).toBe(Math.round(1000 * 2 ** 4.3));
    expect(blastTokens(200) / 1e6).toBeCloseTo(1.0, 1);
    expect(blastTokens(1000) / 1e6).toBeCloseTo(485, -1);
    expect(blastTokens(400) / blastTokens(200)).toBeGreaterThan(10);
    expect(blastTokens(1e7)).toBe(T.tokenCap);
  });
});

describe('BARISTA BLAST!! the same run every time', () => {
  const inputs: BlastInputs = { aim: 36, hold: 50, taps: [90, 200, 310, 480, 650, 900, 1300] };

  it('replays a seed and its inputs to the same step, distance and hits', () => {
    const first = replayBlast(20261114, blastLooks, inputs), again = replayBlast(20261114, blastLooks, inputs);
    expect(first.end).not.toBeNull();
    expect([again.step, again.x, again.y, again.end]).toEqual([first.step, first.x, first.y, first.end]);
    expect(again.hits).toEqual(first.hits);
    expect(blastMeters(first)).toBe(Math.floor(first.x * 100) / 100);
  });

  it('replays to what stepping it live with the same taps gives', () => {
    const live = startBlast(7, ['claude', 'dots'], inputs.aim, inputs.hold);
    while (!live.end) stepBlast(live, inputs.taps.includes(live.step));
    const replayed = replayBlast(7, ['claude', 'dots'], inputs);
    expect([replayed.step, replayed.x, replayed.hits]).toEqual([live.step, live.x, live.hits]);
  });

  it('skips taps that are out of order instead of stalling', () => {
    const run = replayBlast(7, blastLooks, { aim: 36, hold: 50, taps: [300, 100, 100, 5.5, 400] });
    expect(run.end).not.toBeNull();
  });

  it('shows the street ahead, nearest first, without changing the run', () => {
    const plain = replayBlast(11, blastLooks, inputs);
    const watched = startBlast(11, blastLooks, inputs.aim, inputs.hold);
    while (!watched.end) {
      const ahead = blastAhead(watched, 60);
      expect(ahead.every((node, index) => node.x > watched.x && node.x <= watched.x + 60 && (index === 0 || node.x > ahead[index - 1].x))).toBe(true);
      stepBlast(watched, inputs.taps.includes(watched.step));
    }
    expect([watched.step, watched.x, watched.hits]).toEqual([plain.step, plain.x, plain.hits]);
    const start = startBlast(11, blastLooks, 0, 0);
    expect(blastAhead(start, 20)).toEqual([]);
    expect(blastAhead(start, 400).length).toBeGreaterThan(5);
  });

  it('gives another seed another street', () => {
    const street = (seed: number) => { const run = startBlast(seed, blastLooks, 0, 0); run.x = 2000; stepBlast(run, false); return run.cells.map(cell => cell?.kind ?? '-').join(' '); };
    expect(street(1)).toBe(street(1));
    expect(street(1)).not.toBe(street(2));
  });

  it('does nothing more once the run has ended', () => {
    const run = replayBlast(3, blastLooks, { aim: 0, hold: 0, taps: [] });
    const { step, x } = run;
    stepBlast(run, true);
    expect([run.step, run.x]).toEqual([step, x]);
  });
});

describe('BARISTA BLAST!! the street', () => {
  const far = (seed: number, cast: Parameters<typeof startBlast>[1] = blastLooks) => { const run = startBlast(seed, cast, 0, 0); run.x = 6000; stepBlast(run, false); return run; };
  const residentsOf = (run: BlastRun) => run.cells.flatMap(each => each && each.kind !== 'window' && !each.copy ? [each] : []);

  it('holds only residents and the takeaway window, one window every 500 metres', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const cells = far(seed).cells.flatMap(each => each ? [each] : []);
      expect(cells.filter(each => each.kind === 'window').map(each => each.x).slice(0, 3)).toEqual([500, 1000, 1500]);
      expect(cells.every(each => each.kind === 'window' || (blastLooks.some(look => look === each.kind) && blastMoods.some(mood => mood === each.mood)))).toBe(true);
      expect(cells[0].x).toBeGreaterThanOrEqual(T.firstCell);
    }
  });

  it('puts every kind on every street equally often, whoever lives in the cafe', () => {
    for (const cast of [[], ['dots', 'dots', 'grok'], blastLooks] as const) {
      const kinds = residentsOf(far(7, cast)).map(each => each.kind), rounds = Math.floor(kinds.length / blastLooks.length);
      expect(rounds).toBeGreaterThan(10);
      for (let round = 0; round < rounds; round++) expect([...kinds.slice(round * 8, round * 8 + 8)].sort()).toEqual([...blastLooks].sort());
    }
    // The street is the same for every cafe: who lives there changes only the names.
    expect(far(7, ['dots']).cells.map(each => each && [each.kind, each.mood])).toEqual(far(7, []).cells.map(each => each && [each.kind, each.mood]));
  });

  it('stands each kind in each of its four states one time in four', () => {
    for (const look of blastLooks) {
      // Past the stretch near the machine, where the two that can cost a run are swapped for a harmless state, and before the street starts getting harder. Several streets, since that stretch is short.
      const moods = [1, 2, 3, 4, 5, 6].flatMap(seed => residentsOf(far(seed)).filter(each => each.kind === look && each.x >= T.safeUntil && each.x <= T.rampFrom).map(each => each.mood));
      const tally = Object.fromEntries(blastMoods.map(mood => [mood, moods.filter(each => each === mood).length]));
      expect(moods.length).toBeGreaterThan(40);
      // Claude lets every other ban go: half of her turns to hurt are spent doing nothing much instead.
      const share = (mood: string) => look !== 'claude' ? 1 / 4 : mood === 'bad' ? 1 / 8 : mood === 'meh' ? 3 / 8 : 1 / 4;
      for (const mood of blastMoods) expect(Math.abs(tally[mood] - moods.length * share(mood))).toBeLessThanOrEqual(6);
    }
  });

  it('claude bans only every other time her turn to hurt comes up', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const hers = residentsOf(far(seed)).filter(each => each.kind === 'claude' && each.x >= T.safeUntil && each.x <= T.rampFrom);
      const bans = hers.flatMap((each, index) => each.mood === 'bad' ? [index] : []);
      expect(bans.length).toBeGreaterThan(0);
      // Her states come four to a round with one turn to hurt in each, so two bans are never in neighbouring rounds.
      for (let index = 1; index < bans.length; index++) expect(bans[index] - bans[index - 1]).toBeGreaterThanOrEqual(5);
    }
  });

  it('gets harder the further it goes: fewer and fewer do nothing much, and far out Claude lets no ban go', () => {
    const share = (from: number, to: number, mood: string) => {
      let all = 0, some = 0;
      for (let seed = 1; seed <= 40; seed++) for (const each of residentsOf(far(seed))) if (each.x > from && each.x <= to) { all++; if (each.mood === mood) some++; }
      return some / all;
    };
    // A quarter hurt and a quarter do nothing much before the ramp (a little less hurt, with Claude's bans let go).
    expect(share(T.safeUntil, T.rampFrom, 'meh')).toBeGreaterThan(0.24);
    expect(share(T.safeUntil, T.rampFrom, 'bad')).toBeLessThan(0.26);
    // Halfway up the ramp about half of them have turned, and past its end nobody does nothing much.
    const middle = T.rampFrom + T.rampOver / 2;
    expect(share(middle - 500, middle + 500, 'meh')).toBeGreaterThan(0.09);
    expect(share(middle - 500, middle + 500, 'meh')).toBeLessThan(0.16);
    expect(far(3).cells.some(each => each && each.x > T.rampFrom + T.rampOver && each.kind !== 'window' && each.mood === 'meh')).toBe(false);
    // The two helping states are untouched all the way.
    expect(share(T.rampFrom, T.rampFrom + T.rampOver, 'one') + share(T.rampFrom, T.rampFrom + T.rampOver, 'two')).toBeCloseTo(0.5, 1);
  });

  it('two with history, hit one after the other while both help, are a combo: more speed and a cup', () => {
    const speed = (run: BlastRun) => Math.sqrt(run.vx * run.vx + run.vy * run.vy);
    const through = (stands: Parameters<typeof approaching>[0]) => { const run = approaching(stands, { y: 1 }); Object.assign(run, { refills: 1 }); for (let step = 0; step < 600 && run.hits.length < 2 && !run.end; step++) { Object.assign(run, { y: Math.min(run.y, 1.5), vy: 0 }); stepBlast(run, false); } return run; };
    const pair = through(['grok:one', 'gemini:one']), strangers = through(['grok:one', 'doubao:one']);
    expect(pair.hits.map(hit => hit.combo)).toEqual([undefined, 'grok+gemini']);
    expect(pair.refills).toBe(2);
    expect(strangers.hits.map(hit => hit.combo)).toEqual([undefined, undefined]);
    expect(strangers.refills).toBe(1);
    // Either order counts, and a pair is no combo when one of the two hurt or did nothing much.
    expect(through(['gemini:two', 'grok:one']).hits[1].combo).toBe('grok+gemini');
    expect(through(['grok:meh', 'gemini:one']).hits[1].combo).toBeUndefined();
    expect(through(['grok:one', 'gemini:meh']).hits[1].combo).toBeUndefined();
    expect(speed(pair)).toBeGreaterThan(0);
  });

  it('a dive that finds someone who helps is paid in speed and caffeine, and one that finds anyone else is not', () => {
    const through = (stand: 'grok:one' | 'grok:meh', dove: boolean) => { const run = approaching([stand], { y: 2 }); run.dove = dove; steps(run, 60); return run; };
    const plain = through('grok:one', false), dived = through('grok:one', true);
    expect(dived.hits[0].dive).toBe(true);
    expect(plain.hits[0].dive).toBeUndefined();
    expect(dived.caffeine).toBe(plain.caffeine + 1);
    expect(through('grok:meh', true).hits[0].dive).toBeUndefined();
    // A dive ends at the first thing it hits, whatever that is: a window passed on the way does not leave the bonus for the next resident.
    const two = approaching(['window', 'grok:one'], { y: 2 }); two.dove = true; steps(two, 30);
    expect(two.hits.map(hit => [hit.kind, hit.dive])).toEqual([['window', undefined]]);
    expect(two.dove).toBe(false);
    // A dive ends when it lands or a cup is drunk: what is hit after that was not aimed.
    const landed = approaching([null], { y: 0.3 }); landed.dove = true; Object.assign(landed, { vy: -4 }); steps(landed, 20);
    expect(landed.dove).toBe(false);
  });

  it('bans nobody and is never at capacity within 100 metres of the machine', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const near = far(seed).cells.flatMap(each => each && each.x < T.safeUntil ? [each] : []);
      expect(near.some(each => each.mood === 'bad' && (each.kind === 'claude' || each.kind === 'dots'))).toBe(false);
    }
  });

  it('a kind the cafe has is played by its residents in turn, and a kind it lacks by its own character', () => {
    const cells = residentsOf(far(5, ['dots', 'grok', 'dots']));
    expect(cells.filter(each => each.kind === 'dots').slice(0, 4).map(each => each.cast)).toEqual([0, 2, 0, 2]);
    expect(new Set(cells.filter(each => each.kind === 'grok').map(each => each.cast))).toEqual(new Set([1]));
    for (const kind of ['muse', 'claude', 'gemini', 'deepseek', 'qwen', 'doubao']) expect(cells.filter(each => each.kind === kind).every(each => each.cast === undefined)).toBe(true);
    const crowd = far(5, Array.from({ length: 20 }, () => 'grok' as const));
    expect(Math.max(...crowd.cells.flatMap(each => each?.cast ?? []))).toBe(11);
  });

  it('stands somebody on every cell, and leaves at most as many in a row empty as the street is set to allow', () => {
    for (let seed = 1; seed <= 20; seed++) expect(far(seed).cells.every(each => each !== null)).toBe(true);
    T.gap = 2;
    try {
      let longest = 0, empty = 0, all = 0;
      for (let seed = 1; seed <= 20; seed++) { let row = 0; for (const each of far(seed).cells) { all++; if (each) row = 0; else { empty++; longest = Math.max(longest, ++row); } } }
      expect(longest).toBe(2);
      expect(empty / all).toBeGreaterThan(0.25);
      expect(empty / all).toBeLessThan(0.45);
    } finally { T.gap = 0; }
  });

  it('is hit from the ground to head height, except a ban and a wall at capacity, which stand too tall to hop', () => {
    expect(blastHitSpan({ kind: 'grok', mood: 'bad' })).toEqual([0, T.tall]);
    expect(blastHitSpan({ kind: 'claude', mood: 'one' })).toEqual([0, T.tall]);
    expect(blastHitSpan({ kind: 'claude', mood: 'bad' })).toEqual([0, 5]);
    expect(blastHitSpan({ kind: 'dots', mood: 'bad' })).toEqual([0, 5]);
    expect(blastHitSpan({ kind: 'window' })).toEqual([0, 2.6]);
    for (const tall of ['dots:bad', 'claude:bad'] as const) {
      const over = approaching([tall], { y: 6 });
      steps(over, 20);
      expect(over.hits).toHaveLength(0);
      const into = approaching([tall], { y: 4 });
      steps(into, 20);
      expect(into.hits).toHaveLength(1);
    }
  });
});

describe('BARISTA BLAST!! tricks that help', () => {
  it.each([
    ['muse:one', 45, 1.25], ['muse:two', 45, 1.1], ['claude:two', 62, 1.5], ['dots:one', 22, 1.2], ['dots:two', 22, 1.5], ['grok:one', 40, 1.5], ['grok:two', 40, 1.2],
    ['gemini:one', 30, 1.35], ['deepseek:one', 40, 1.6], ['deepseek:two', 40, 1.2], ['qwen:one', 45, 1.25], ['qwen:two', 45, 1.25], ['doubao:one', 12, 1.3], ['doubao:two', 45, 1.1],
  ] as const)('%s sends the barista off at %i° and %f times the speed, and fills one caffeine cell', (stands, angle, times) => {
    const run = approaching([stands]), was = speedOf(run), hit = untilHit(run), [kind, mood] = stands.split(':');
    expect(hit).toMatchObject({ kind, as: kind, mood, outcome: 'usual', x: T.firstCell });
    expect(degrees(run)).toBeCloseTo(angle, 0);
    expect(speedOf(run)).toBeCloseTo(was * times, 1);
    expect(run.caffeine).toBe(stands === 'doubao:two' ? 2 : 1);
  });

  it('kicks a barista who arrives slowly off at a least speed', () => {
    const run = approaching(['muse:one'], { speed: 3 });
    untilHit(run);
    expect(speedOf(run)).toBeCloseTo(T.kick, 1);
  });

  it('never sends anyone off faster than the speed limit', () => {
    const run = approaching(['grok:one'], { speed: 70 });
    untilHit(run);
    expect(speedOf(run)).toBeLessThanOrEqual(T.maxSpeed + 1e-9);
  });

  it('gpt’s disclaimer is a shield: for four seconds nothing that hurts gets through, and it wears off', () => {
    const run = approaching(['dots:one', 'deepseek:bad', 'doubao:bad', 'muse:bad', 'qwen:bad', 'deepseek:bad']);
    untilHit(run);
    expect(run.shield).toBe(T.shield);
    for (const index of [1, 2, 3, 4]) {
      before(run, index);
      Object.assign(run, { refills: 2, caffeine: 2 });
      const hit = untilHit(run, index + 1), heading = degrees(run);
      expect(hit.waived).toBe(true);
      expect([speedOf(run), run.refills, run.caffeine, run.scramble]).toEqual([expect.closeTo(20, 0), 2, 2, false]);
      expect(Math.abs(heading)).toBeLessThan(5);
    }
    run.shield = 0;
    before(run, 5);
    expect(untilHit(run, 6).waived).toBeUndefined();
    expect(speedOf(run)).toBeLessThan(11);
    // It runs down a step at a time while the barista moves, and is gone when it reaches nothing.
    const worn = approaching(['dots:one', ...Array.from({ length: 120 }, () => null)]);
    untilHit(worn);
    steps(worn, T.hitStop + 50);
    expect(worn.shield).toBe(T.shield - 50);
    worn.shield = 3;
    steps(worn, 3);
    expect(worn.shield).toBe(0);
  });

  it('the shield takes one ban and is used up by it', () => {
    const run = approaching(['claude:bad', 'claude:bad']);
    run.shield = 300;
    const hit = untilHit(run);
    expect([hit.waived, run.end, run.shield]).toEqual([true, null, 0]);
    expect(speedOf(run)).toBeCloseTo(20, 0);
    before(run, 1);
    untilHit(run, 2);
    expect(run.end).toBe('banned');
  });

  it('claude agrees: the barista goes on the way they came, turned upward and a little faster, and no flatter than 45°', () => {
    for (const [vx, vy, y] of [[12, -16, 2.3], [10, 12, 0.6], [20, -2, 1]]) {
      const run = approaching(['claude:one']);
      Object.assign(run, { vx, vy, y });
      let was = { vx: run.vx, vy: run.vy };
      while (!run.hits.length) { was = { vx: run.vx, vy: run.vy }; stepBlast(run, false); }
      const came = Math.atan2(Math.abs(was.vy), was.vx) * 180 / Math.PI;
      expect(Math.abs(degrees(run) - Math.max(45, came))).toBeLessThan(2);
      expect(speedOf(run)).toBeCloseTo(Math.hypot(was.vx, was.vy) * 1.15, 0);
    }
  });

  it('claude and deepseek think before their big shots', () => {
    for (const stands of ['claude:two', 'deepseek:one'] as const) { const run = approaching([stands]); untilHit(run); expect(run.frozen).toBe(T.thinkStop); }
  });

  it('gemini’s second trick carries the barista level for a second, over everything, and presses wait', () => {
    const run = approaching(['gemini:two', 'claude:bad', 'claude:bad']);
    run.refills = 2;
    untilHit(run);
    expect([run.glide, run.y, run.vy]).toEqual([T.glideShort, T.glideHeight, 0]);
    steps(run, T.hitStop);
    const from = run.x;
    steps(run, T.glideShort - 1, 40);
    expect(run.y).toBe(T.glideHeight);
    expect(run.x - from).toBeCloseTo(run.vx * (T.glideShort - 1) / BLAST_HZ, 3);
    expect([run.hits.length, run.refills, run.end]).toEqual([1, 2, null]);
  });

  it('grok’s fact-check sets the next resident who would hurt to rights', () => {
    const run = approaching(['grok:two', 'muse:meh', null, 'deepseek:bad', 'doubao:bad']);
    const hit = untilHit(run);
    expect(hit.fixed).toBe(T.firstCell + 3 * T.cell);
    expect(run.cells.map(each => each?.mood)).toEqual(['two', 'meh', undefined, 'one', 'bad']);
    const none = approaching(['grok:two', 'muse:one', ...Array.from({ length: 14 }, () => null)]);
    expect(untilHit(none).fixed).toBeUndefined();
  });

  it('deepseek’s fortune lets the street ahead be read further for ten seconds', () => {
    const run = approaching(['deepseek:two']);
    untilHit(run);
    expect(run.sight).toBe(T.sight);
    steps(run, T.hitStop + 100);
    expect(run.sight).toBe(T.sight - 100);
  });

  it('qwen gives itself away: a copy stands on the nearest empty cell from two ahead, and a copy plants nothing', () => {
    const run = approaching(['qwen:one', null, 'muse:one', null, null, null, null, null], { speed: 30 });
    untilHit(run);
    expect(run.cells[3]).toEqual({ kind: 'qwen', x: T.firstCell + 3 * T.cell, mood: 'one', copy: true });
    before(run, 3, 30);
    expect(untilHit(run, 2)).toMatchObject({ kind: 'qwen', as: 'qwen', mood: 'one' });
    expect(run.cells.filter(each => each?.copy)).toHaveLength(1);
  });

  it('on a street with no cell to spare the copy takes the place of whoever stands nearest, but never of the window or another copy', () => {
    const full = approaching(['qwen:one', 'muse:one', 'claude:bad', 'grok:one', 'grok:one']);
    untilHit(full);
    expect(full.cells.map(each => `${each?.kind}:${each?.mood}${each?.copy ? '*' : ''}`)).toEqual(['qwen:one', 'muse:one', 'qwen:one*', 'grok:one', 'grok:one']);
    const blocked = approaching(['qwen:one', 'muse:one', 'window', 'grok:one', 'grok:one']);
    blocked.cells[3]!.copy = true;
    untilHit(blocked);
    expect(blocked.cells.map(each => `${each?.kind}${each?.copy ? '*' : ''}`)).toEqual(['qwen', 'muse', 'window', 'grok*', 'qwen*']);
  });

  it('qwen stands a cup and muse’s signing bonus fills them all, up to the three a barista can hold', () => {
    for (const [stands, had, has] of [['qwen:two', 1, 2], ['qwen:two', 3, 3], ['muse:two', 0, 3]] as const) {
      const run = approaching([stands]);
      run.refills = had;
      untilHit(run);
      expect(run.refills).toBe(has);
    }
  });

  it('doubao says it straight: half a second in a dead straight line, which a press or a hit ends', () => {
    const run = approaching(['doubao:one', null, null, null, null, null, null, null, null]);
    untilHit(run);
    expect(run.straight).toBe(60);
    steps(run, T.hitStop);
    const from = { x: run.x, y: run.y, vx: run.vx, vy: run.vy };
    steps(run, 60);
    expect([run.vx, run.vy]).toEqual([from.vx, from.vy]);
    expect(run.y - from.y).toBeCloseTo(from.vy * 60 / BLAST_HZ, 6);
    stepBlast(run, false);
    expect(run.vy).toBeLessThan(from.vy);
    const pressed = approaching(['doubao:one', null, null, null, null, null, null, null, null]);
    untilHit(pressed);
    steps(pressed, T.hitStop + 5);
    stepBlast(pressed, true);
    expect(pressed.straight).toBe(0);
  });

  it('on a street with empty cells, muse turns up uninvited where the barista comes down on bare street, about one landing in eight', () => {
    const landing = (luck: number, stands: (Stands | null)[] = [null, null, null]) => { const run = approaching(stands, { luck, y: 0.4 }); Object.assign(run, { x: T.firstCell + 4, vy: -6 }); steps(run, 30); return run; };
    // Where somebody stands every ten metres there is no bare street to speak of, and Muse stays away.
    expect(landing(0.05).hits).toHaveLength(0);
    T.gap = 2;
    try {
      const met = landing(0.05);
      expect(met.hits[0]).toMatchObject({ kind: 'muse', as: 'muse', mood: 'one', uninvited: true });
      expect(met.vy).toBeGreaterThan(8);
      expect(met.caffeine).toBe(1);
      expect(landing(0.5).hits).toHaveLength(0);
      // Not before the street begins, and not where somebody stands to be hit.
      const early = approaching([null], { luck: 0.05, y: 0.4 });
      Object.assign(early, { x: 5, vy: -6 });
      steps(early, 30);
      expect(early.hits).toHaveLength(0);
      const taken = approaching(['grok:one'], { luck: 0.05, y: 0.4 });
      Object.assign(taken, { x: T.firstCell - 0.5, vy: -6 });
      steps(taken, 30);
      expect(taken.hits.map(hit => hit.kind)).toEqual(['grok']);
    } finally { T.gap = 0; }
  });
});

describe('BARISTA BLAST!! tricks that do nothing much', () => {
  it.each(['claude:meh', 'gemini:meh', 'muse:meh'] as const)('%s is passed as if nobody stood there', stands => {
    const run = approaching([stands]), hit = untilHit(run);
    expect(hit.mood).toBe('meh');
    expect(run.vx).toBeCloseTo(20, 0);
    expect([run.frozen, run.caffeine]).toEqual([0, 0]);
  });

  it.each([['dots:meh', 12], ['qwen:meh', 45], ['doubao:meh', 45], ['grok:meh', 12]] as const)('%s turns the barista to %i° without making them any faster, and fills no caffeine', (stands, angle) => {
    const run = approaching([stands]), was = speedOf(run);
    untilHit(run);
    expect(degrees(run)).toBeCloseTo(angle, 0);
    expect(speedOf(run)).toBeCloseTo(was, 1);
    expect(run.caffeine).toBe(0);
    expect(run.frozen).toBe(stands === 'grok:meh' ? T.bossStop : T.hitStop);
  });

  it('deepseek does whatever the last resident did, for better or worse, and its own first trick when there was nobody', () => {
    const alone = approaching(['deepseek:meh']), first = untilHit(alone);
    expect(first.copied).toBeUndefined();
    expect(speedOf(alone)).toBeCloseTo(20 * 1.6, 1);
    const after = approaching(['muse:two', 'deepseek:meh', 'deepseek:bad', 'deepseek:meh']);
    after.refills = 0;
    untilHit(after);
    after.refills = 0;
    before(after, 1);
    expect(untilHit(after, 2).copied).toEqual({ as: 'muse', mood: 'two' });
    expect(after.refills).toBe(T.refills);
    before(after, 2);
    untilHit(after, 3);
    before(after, 3);
    expect(untilHit(after, 4).copied).toEqual({ as: 'deepseek', mood: 'bad' });
    expect(speedOf(after)).toBeCloseTo(10, 0);
  });
});

describe('BARISTA BLAST!! tricks that hurt', () => {
  it('claude’s ban ends the run on the spot', () => {
    const run = approaching(['claude:bad'], { y: 4 });
    untilHit(run);
    expect([run.end, run.vx]).toEqual(['banned', 0]);
  });

  it('gpt at capacity floats overhead and takes the cups and the caffeine from a barista flying into it', () => {
    const run = approaching(['dots:bad'], { y: 4, caffeine: 2 });
    untilHit(run);
    expect([run.refills, run.caffeine, run.end]).toEqual([0, 0, null]);
    expect(run.vx).toBeCloseTo(20, 0);
  });

  it('gemini cannot stop apologising: it holds the barista, then lets go slower', () => {
    const run = approaching(['gemini:bad']);
    untilHit(run);
    expect(run.frozen).toBe(T.stallStop);
    expect(speedOf(run)).toBeCloseTo(20 * 0.7, 1);
  });

  it('grok makes something up: the barista passes, and the next resident hit acts as another, in a state that costs nothing', () => {
    const run = approaching(['grok:bad', 'claude:bad'], { luck: 0 });
    untilHit(run);
    expect([run.scramble, run.frozen]).toEqual([true, 0]);
    expect(speedOf(run)).toBeCloseTo(20, 0);
    before(run, 1);
    const next = untilHit(run, 2);
    expect(next).toMatchObject({ kind: 'claude', as: 'muse', mood: 'one' });
    expect([run.scramble, run.end]).toEqual([false, null]);
  });

  it('deepseek’s server is busy: half the speed, the same heading', () => {
    const run = approaching(['deepseek:bad'], { speed: 30 });
    untilHit(run);
    expect(run.vx).toBeCloseTo(15, 0);
    expect(run.caffeine).toBe(0);
  });

  it('qwen’s link is blocked: the caffeine is gone and the cups stay', () => {
    const run = approaching(['qwen:bad'], { caffeine: 2 });
    untilHit(run);
    expect([run.caffeine, run.refills]).toEqual([0, T.refills]);
  });

  it('doubao grins and goes round: anywhere between 20° and 70° at the same speed', () => {
    for (const luck of [0.01, 0.5, 0.99]) {
      const run = approaching(['doubao:bad'], { luck }), was = speedOf(run);
      untilHit(run);
      expect(speedOf(run)).toBeCloseTo(was, 1);
      expect(degrees(run)).toBeGreaterThan(19);
      expect(degrees(run)).toBeLessThan(71);
    }
  });

  it('muse collects a cup as data, and nothing from a barista who has none', () => {
    for (const [had, has] of [[3, 2], [0, 0]]) { const run = approaching(['muse:bad']); run.refills = had; untilHit(run); expect(run.refills).toBe(has); }
  });
});

describe('BARISTA BLAST!! the boost', () => {
  it.each([['muse:one', 45, 1.6], ['claude:two', 62, 1.8], ['dots:two', 22, 1.8], ['grok:one', 40, 2], ['deepseek:one', 40, 2.2], ['qwen:two', 45, 1.6], ['doubao:two', 12, 1.7]] as const)('with a full bar, a tap inside the window upgrades %s to %i° and %f times the arriving speed', (stands, angle, times) => {
    const run = approaching([stands], { caffeine: T.caffeine });
    const hit = untilHit(run);
    expect(run.boost?.left).toBe(T.boostWindow);
    steps(run, 30, 29);
    expect(hit.outcome).toBe('boost');
    expect(run.boost).toBeNull();
    expect(run.caffeine).toBe(0);
    expect(degrees(run)).toBeCloseTo(angle, 0);
    expect(speedOf(run)).toBeCloseTo(20 * times, 1);
  });

  it('moves at a third of the speed while the window is open, and keeps the bar when the tap never comes', () => {
    const run = approaching(['muse:one'], { caffeine: T.caffeine });
    const hit = untilHit(run), x = run.x, vx = run.vx;
    stepBlast(run, false);
    expect(run.x - x).toBeCloseTo(vx * T.boostSlow / BLAST_HZ, 3);
    steps(run, T.boostWindow);
    expect(run.boost).toBeNull();
    expect(hit.outcome).toBe('usual');
    expect(run.caffeine).toBe(T.caffeine);
  });

  it('opens no window before the bar is full, and fills the bar one helping resident at a time', () => {
    const run = approaching(Array.from({ length: T.caffeine + 1 }, () => 'grok:one' as const), { speed: 30 });
    for (let count = 1; count <= T.caffeine; count++) {
      untilHit(run, count);
      expect(run.boost).toBeNull();
      expect(run.caffeine).toBe(count);
      before(run, count, 30);
    }
    untilHit(run, T.caffeine + 1);
    expect(run.boost).not.toBeNull();
  });

  it('gpt boosted shields twice as long, gemini glides twice as long, qwen plants two and stands a cup, muse fills the cups', () => {
    const tapped = (stands: Stands, fill: (Stands | null)[] = []) => { const run = approaching([stands, ...fill], { caffeine: T.caffeine }); run.refills = 1; untilHit(run); steps(run, 30, 29); return run; };
    expect(tapped('dots:one').shield).toBe(T.shield * 2);
    expect(tapped('gemini:one').glide).toBe(T.glideSteps);
    const qwen = tapped('qwen:meh', [null, null, null, null, null]);
    expect(qwen.cells.slice(0, 5).map(each => Boolean(each?.copy))).toEqual([false, false, true, true, false]);
    expect(qwen.refills).toBe(2);
    expect(tapped('muse:meh').refills).toBe(T.refills);
    expect(tapped('doubao:one').straight).toBe(120);
  });

  it('a boost while a resident flies is a combo: the one hit boosts as always, and the pilot adds one piece of her own', () => {
    const boosted = (pilot: BlastLook | null, stands: Stands = 'grok:one', fill: (Stands | null)[] = [], tap = true) => {
      const run = approaching([stands, ...fill], { caffeine: T.caffeine }); run.pilot = pilot; run.refills = 1;
      untilHit(run); steps(run, 30, tap ? 29 : -1); return run;
    };
    const plain = boosted(null);
    expect(plain.hits[0]).toMatchObject({ outcome: 'boost' });
    expect(plain.hits[0].assist).toBeUndefined();
    // No tap, no boost, no assist.
    expect(boosted('dots', 'grok:one', [], false).hits[0].assist).toBeUndefined();
    expect(boosted('dots').hits[0].assist).toBe('dots');
    expect(boosted('dots').shield).toBe(T.shield);
    // Grok's boost is 40°: Claude turns it up to 62°, and leaves a steeper one alone.
    expect(degrees(plain)).toBeLessThan(45);
    expect(degrees(boosted('claude'))).toBeCloseTo(62, 0);
    expect(speedOf(boosted('claude'))).toBeCloseTo(speedOf(plain), 6);
    expect(degrees(boosted('claude', 'qwen:one'))).toBeLessThan(62);
    expect(boosted('gemini').glide).toBe(T.glideShort);
    expect(speedOf(boosted('grok', 'deepseek:one')) / speedOf(boosted(null, 'deepseek:one'))).toBeCloseTo(1.1, 6);
    expect(boosted('deepseek').sight).toBeGreaterThanOrEqual(T.sight - 30);
    // Qwen plants one copy of the one hit, never of herself.
    const qwen = boosted('qwen', 'grok:one', [null, null, null, null, null]);
    expect(qwen.cells.slice(0, 5).map(each => each?.copy ? each.kind : null)).toEqual([null, null, 'grok', null, null]);
    expect(boosted('doubao').straight).toBeGreaterThan(0);
    expect(boosted('doubao').straight).toBeLessThanOrEqual(60);
    expect(boosted('muse').refills).toBe(3);
    expect(boosted('muse', 'muse:one').refills).toBe(T.refills);
    // The window boosts with no assist; a granted appeal gets one.
    expect(boosted('dots', 'window').hits[0].assist).toBeUndefined();
    expect(boosted('dots', 'claude:bad').hits[0]).toMatchObject({ outcome: 'boost', assist: 'dots' });
  });

  it('with a full bar, what does not help waits for the window: a tap turns it into the boost, and no tap lets it happen', () => {
    const tap = approaching(['deepseek:bad'], { caffeine: T.caffeine, speed: 30 });
    const hit = untilHit(tap);
    expect([tap.boost?.left, tap.frozen, speedOf(tap)]).toEqual([T.boostWindow, T.boostWindow, expect.closeTo(30, 0)]);
    steps(tap, 30, 29);
    expect(hit.outcome).toBe('boost');
    expect(speedOf(tap)).toBeCloseTo(30 * 2.2, 0);
    const wait = approaching(['deepseek:bad'], { caffeine: T.caffeine, speed: 30 });
    untilHit(wait);
    steps(wait, T.boostWindow + 1);
    expect([wait.boost, wait.hits[0].outcome]).toEqual([null, 'usual']);
    expect(speedOf(wait)).toBeCloseTo(15, 0);
    expect(wait.caffeine).toBe(T.caffeine);
    const drained = approaching(['dots:bad'], { caffeine: T.caffeine, y: 4 });
    untilHit(drained);
    expect([drained.refills, drained.caffeine]).toEqual([T.refills, T.caffeine]);
    steps(drained, T.boostWindow + 1);
    expect([drained.refills, drained.caffeine]).toEqual([0, 0]);
  });

  it('with a full bar a ban waits for a tap, which is an appeal that is granted: the strongest launch of the run', () => {
    const run = approaching(['claude:bad'], { caffeine: T.caffeine, speed: 12 });
    const hit = untilHit(run);
    expect([run.end, run.frozen]).toEqual([null, T.boostWindow]);
    steps(run, 40, 39);
    expect(hit.outcome).toBe('boost');
    expect(run.end).toBeNull();
    expect(speedOf(run)).toBeCloseTo(T.appeal, 1);
    expect(degrees(run)).toBeCloseTo(45, 0);
    expect(run.caffeine).toBe(0);
    const late = approaching(['claude:bad'], { caffeine: T.caffeine });
    untilHit(late);
    steps(late, T.boostWindow + 1);
    expect(late.end).toBe('banned');
  });

  it('the takeaway window fills the cups and sends the barista on; boosted, it fills the bar too', () => {
    const run = approaching(['window']);
    run.refills = 0;
    untilHit(run);
    expect(run.refills).toBe(T.refills);
    expect(speedOf(run)).toBeCloseTo(20 * 1.3, 1);
    expect(run.caffeine).toBe(0);
    const charged = approaching(['window'], { caffeine: T.caffeine });
    untilHit(charged);
    steps(charged, 30, 29);
    expect(charged.caffeine).toBe(T.caffeine);
    expect(charged.hits[0].outcome).toBe('boost');
  });
});

describe('BARISTA BLAST!! in the air and on the ground', () => {
  const flying = (over: Partial<BlastRun>) => Object.assign(startBlast(1, blastLooks, 0, 0), { cells: [null], x: 0, y: 8, vx: 20, vy: 0 }, over);

  it('a tap on the way down is a refill: up and a tenth faster forward, three to a run', () => {
    const run = flying({ vy: -5 });
    stepBlast(run, true);
    expect(run.refills).toBe(T.refills - 1);
    expect(run.vy).toBeCloseTo(T.refillUp, 0);
    expect(run.vx).toBeCloseTo(22, 0);
    for (let more = 0; more < 3; more++) { run.vy = -5; stepBlast(run, true); }
    expect(run.refills).toBe(0);
    expect(run.vy).toBeLessThan(0);
  });

  it('a refill leaves the barista no slower than a resident’s kick, and a fast one a tenth faster, up to the speed limit', () => {
    for (const [vx, after] of [[0, T.kick], [3, T.kick], [12, T.kick], [20, 22], [50, 55]]) {
      const run = flying({ vx, vy: -5 });
      stepBlast(run, true);
      expect(run.vx).toBeCloseTo(after, 0);
    }
    const fastest = flying({ vx: T.maxSpeed - 1, vy: -5 });
    stepBlast(fastest, true);
    expect(Math.hypot(fastest.vx, fastest.vy)).toBeLessThanOrEqual(T.maxSpeed + 1e-9);
  });

  it('a tap on the way up is a dive: down and forward, then a cooldown, and not close to the ground', () => {
    const run = flying({ vy: 6 });
    stepBlast(run, true);
    expect(run.vy).toBeCloseTo(-T.diveDown, 0);
    expect(run.vx).toBeCloseTo(20 + T.diveAlong, 0);
    Object.assign(run, { y: 8, vy: 6 });
    stepBlast(run, true);
    expect(run.vy).toBeGreaterThan(0);
    Object.assign(run, { y: 8, vy: 6, step: T.diveCooldown });
    stepBlast(run, true);
    expect(run.vy).toBeLessThan(0);
    const low = flying({ y: T.diveFloor - 1, vy: 6 });
    stepBlast(low, true);
    expect(low.vy).toBeGreaterThan(0);
    expect(low.refills).toBe(T.refills);
  });

  it('a refill lifts a barista who is sliding', () => {
    const run = flying({ y: 0, vy: 0, sliding: true });
    stepBlast(run, true);
    expect(run.sliding).toBe(false);
    expect(run.y).toBeGreaterThan(0);
  });

  it('bounces lower each time, slides, and stops', () => {
    const run = startBlast(1, blastLooks, T.aimSteps / 4, T.gaugeSteps / 4);
    run.cells = Array.from({ length: 50 }, () => null);
    let slid = false;
    while (!run.end) { stepBlast(run, false); slid ||= run.sliding; }
    expect(slid).toBe(true);
    expect(run.end).toBe('stopped');
    expect(run.vx).toBe(0);
    expect(blastMeters(run)).toBeGreaterThan(5);
    expect(blastMeters(run)).toBeLessThan(60);
  });

  it('ends at three hundred seconds however fast it is still going', () => {
    const run = flying({ step: T.maxSteps - 2 });
    stepBlast(run, false);
    expect(run.end).toBeNull();
    stepBlast(run, false);
    expect(run.end).toBe('timeout');
    expect(T.maxSteps / BLAST_HZ).toBe(300);
  });
});

describe('BARISTA BLAST!! over many runs', () => {
  it('always ends inside three hundred seconds and the furthest distance the speed limit allows', () => {
    let state = 99;
    const roll = () => { state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0; return state / 4_294_967_296; };
    const meters: number[] = [];
    for (let seed = 1; seed <= 400; seed++) {
      const taps = Array.from({ length: 60 }, () => Math.floor(roll() * 3000)).sort((a, b) => a - b);
      const run = replayBlast(seed, blastLooks, { aim: Math.floor(roll() * T.aimSteps), hold: Math.floor(roll() * T.gaugeSteps), taps });
      expect(run.step).toBeLessThanOrEqual(T.maxSteps);
      expect(run.x).toBeLessThanOrEqual(T.maxSpeed * 300);
      expect(Number.isFinite(run.x) && run.x >= 0 && run.y >= 0).toBe(true);
      meters.push(blastMeters(run));
    }
    meters.sort((a, b) => a - b);
    // Guards the tuning, loosely: with somebody on every cell and a ban standing half as often, a typical careless run is
    // several hundred metres to a little over a thousand, and long runs do happen.
    expect(meters[200]).toBeGreaterThan(100);
    expect(meters[200]).toBeLessThan(2000);
    expect(meters[399]).toBeGreaterThan(2000);
  });

  it('a resident picked to fly is not on the street, and the cafe’s own barista meets all eight', () => {
    const kindsOn = (pilot: Parameters<typeof startBlast>[4]) => { const run = startBlast(3, blastLooks, 0, 0, pilot); run.x = 3000; stepBlast(run, false); return new Set(run.cells.flatMap(each => each && each.kind !== 'window' ? [each.kind] : [])); };
    expect([...kindsOn(null)].sort()).toEqual([...blastLooks].sort());
    for (const pilot of blastLooks) {
      const met = kindsOn(pilot);
      expect(met.has(pilot)).toBe(false);
      expect(met.size).toBe(blastLooks.length - 1);
    }
  });

  it('whoever is flying is never met on her own run, not even as a made-up answer or a copy', () => {
    // The player the review named: boost whenever it is offered, refill when falling low.
    for (const pilot of blastLooks) for (let seed = 1; seed <= 12; seed++) {
      const run = startBlast(seed, blastLooks, 36, 54, pilot);
      while (!run.end && run.step < 9000) stepBlast(run, run.boost ? true : run.vy < 0 && run.y < 1 && run.refills > 0);
      expect(run.hits.filter(hit => hit.as === pilot || hit.kind === pilot || hit.copied?.as === pilot)).toEqual([]);
      expect(run.cells.some(each => each?.kind === pilot)).toBe(false);
    }
  });

  it('each pilot brings one small trait, and the cafe’s own barista none', () => {
    const start = (pilot: Parameters<typeof startBlast>[4]) => startBlast(1, blastLooks, 36, 54, pilot), plain = start(null);
    const speed = (run: BlastRun) => Math.sqrt(run.vx * run.vx + run.vy * run.vy);
    expect([plain.shield, plain.caffeine, plain.sight]).toEqual([0, 0, 0]);
    expect(start('dots').shield).toBe(T.shield);
    expect(start('qwen').caffeine).toBe(T.caffeine);
    expect(start('deepseek').sight).toBe(T.maxSteps);
    expect(speed(start('grok')) / speed(plain)).toBeCloseTo(1.12, 6);
    // Claude tops out slower: a shot that would reach the limit stops short of it.
    const fast = (pilot: Parameters<typeof startBlast>[4]) => { const run = start(pilot); Object.assign(run, { y: 30, vx: 200, vy: 0 }); stepBlast(run, false); return speed(run); };
    expect(fast(null)).toBeCloseTo(T.maxSpeed, 0);
    expect(fast('claude')).toBeCloseTo(T.maxSpeed * 0.8, 0);
    // And her output is cut off in half the time.
    const cut = (pilot: Parameters<typeof startBlast>[4]) => { const run = start(pilot); Object.assign(run, { step: T.maxSteps / 2 - 2, y: 30 }); steps(run, 4); return run.end; };
    expect([cut(null), cut('claude')]).toEqual([null, 'timeout']);
    // Gemini's refill lifts higher, Doubao dives again in half the time, Muse's boost fills a cup.
    const refill = (pilot: Parameters<typeof startBlast>[4]) => { const run = start(pilot); Object.assign(run, { y: 6, vy: -3 }); stepBlast(run, true); return run.vy; };
    expect(refill('gemini')).toBeGreaterThan(refill(null) * 1.2);
    const dive = (pilot: Parameters<typeof startBlast>[4]) => { const run = start(pilot); Object.assign(run, { y: 8, vy: 5 }); const at = run.step; stepBlast(run, true); return run.diveAt - at; };
    expect(dive('doubao')).toBe(dive(null) / 2);
    // The cafe's own barista is handed a cup every 250 m, up to a full set; a resident who flies is not.
    const fed = (pilot: Parameters<typeof startBlast>[4]) => { const run = start(pilot); Object.assign(run, { x: T.topUp - 0.5, y: 30, vx: 40, vy: 0, refills: 1 }); steps(run, 6); return run.refills; };
    expect([fed(null), fed('grok')]).toEqual([2, 1]);
    const full = start(null); Object.assign(full, { x: T.topUp - 0.5, y: 30, vx: 40, vy: 0 }); steps(full, 6);
    expect(full.refills).toBe(T.refills);
    // A replay flies the pilot the inputs name.
    expect(replayBlast(5, blastLooks, { aim: 36, hold: 54, taps: [], pilot: 'grok' }).pilot).toBe('grok');
    expect(replayBlast(5, blastLooks, { aim: 36, hold: 54, taps: [] }).pilot).toBeNull();
  });

  it('carries a version for run tickets', () => {
    expect(BLAST_VERSION).toBe(9);
  });
});
