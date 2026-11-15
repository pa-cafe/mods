import { describe, expect, it } from 'vitest';
import { BLAST_HZ, BLAST_VERSION, blastAhead, blastAim, blastLooks, blastMeters, blastPower, blastTokens, blastTuning as T, replayBlast, startBlast, stepBlast, type BlastHit, type BlastInputs, type BlastRun } from './rules.ts';

type Cell = NonNullable<BlastRun['cells'][number]>;
const speedOf = (run: BlastRun) => Math.hypot(run.vx, run.vy);
const degrees = (run: BlastRun) => Math.atan2(run.vy, run.vx) * 180 / Math.PI;

/** A run about to reach the first cell of a street made only of `kinds`, moving level at `speed`, `y` metres up. */
function approaching(kinds: Cell['kind'][], { speed = 20, y = 1, luck = 0.9, caffeine = 0 } = {}) {
  const run = startBlast(1, blastLooks, 36, 54);
  run.cells = kinds.map((kind, index) => ({ kind, x: T.firstCell + T.cell * index }));
  Object.assign(run, { x: T.firstCell - 2, y, vx: speed, vy: 0, caffeine, luck: () => luck });
  return run;
}
/** Steps until the run has hit `count` things, and returns the last hit. */
function untilHit(run: BlastRun, count = 1): BlastHit {
  for (let step = 0; run.hits.length < count && !run.end && step < 2000; step++) stepBlast(run, false);
  expect(run.hits).toHaveLength(count);
  return run.hits[count - 1];
}
const steps = (run: BlastRun, count: number, tapAt = -1) => { for (let step = 0; step < count; step++) stepBlast(run, step === tapAt); };

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
    expect(blastTokens(1e6)).toBe(T.tokenCap);
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

  it('keeps walls and ban notices out of the first 100 metres and puts a takeaway window every 500', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const cells = far(seed).cells.filter(cell => cell !== null);
      expect(cells.filter(cell => cell.x < T.safeUntil && (cell.kind === 'wall' || cell.kind === 'notice'))).toEqual([]);
      expect(cells.filter(cell => cell.kind === 'window').map(cell => cell.x).slice(0, 3)).toEqual([500, 1000, 1500]);
      expect(cells[0].x).toBeGreaterThanOrEqual(T.firstCell);
    }
  });

  const residentsOf = (run: BlastRun) => run.cells.flatMap(cell => cell && blastLooks.some(look => look === cell.kind) && !cell.copy ? [cell] : []);

  it('puts every kind on every street equally often, whoever lives in the cafe', () => {
    for (const cast of [[], ['dots', 'dots', 'grok'], blastLooks] as const) {
      const kinds = residentsOf(far(7, cast)).map(cell => cell.kind), rounds = Math.floor(kinds.length / blastLooks.length);
      expect(rounds).toBeGreaterThan(10);
      // Every eight residents in a row are the eight kinds, each once.
      for (let round = 0; round < rounds; round++) expect([...kinds.slice(round * 8, round * 8 + 8)].sort()).toEqual([...blastLooks].sort());
    }
    // The order is drawn again each round, and the street is the same for every cafe.
    const one = residentsOf(far(7, [])).map(cell => cell.kind);
    expect(one.slice(0, 8)).not.toEqual(one.slice(8, 16));
    expect(residentsOf(far(7, ['dots', 'dots', 'grok'])).map(cell => cell.kind)).toEqual(one);
    expect(far(7, ['dots']).cells.map(cell => cell?.kind)).toEqual(far(7, []).cells.map(cell => cell?.kind));
  });

  it('a kind the cafe has is played by its residents in turn, and a kind it lacks by its own character', () => {
    const cells = residentsOf(far(5, ['dots', 'grok', 'dots']));
    expect(cells.filter(cell => cell.kind === 'dots').slice(0, 4).map(cell => cell.cast)).toEqual([0, 2, 0, 2]);
    expect(new Set(cells.filter(cell => cell.kind === 'grok').map(cell => cell.cast))).toEqual(new Set([1]));
    for (const kind of ['muse', 'claude', 'gemini', 'deepseek', 'qwen', 'doubao']) expect(cells.filter(cell => cell.kind === kind).every(cell => cell.cast === undefined)).toBe(true);
    // At most twelve of a cafe's residents take part.
    const crowd = far(5, Array.from({ length: 20 }, () => 'grok' as const));
    expect(Math.max(...crowd.cells.flatMap(cell => cell?.cast ?? []))).toBe(11);
  });

  it('leaves about half the cells empty and gives residents about three in ten', () => {
    let empty = 0, residents = 0, all = 0;
    for (let seed = 1; seed <= 30; seed++) for (const cell of far(seed).cells) { all++; if (!cell) empty++; else if (blastLooks.some(look => look === cell.kind)) residents++; }
    expect(empty / all).toBeGreaterThan(0.45);
    expect(empty / all).toBeLessThan(0.56);
    expect(residents / all).toBeGreaterThan(0.26);
    expect(residents / all).toBeLessThan(0.34);
  });
});

describe('BARISTA BLAST!! what each resident does', () => {
  it.each([
    ['muse', 0.9, 45, 1.25, 'usual'],
    ['claude', 0.9, 45, 1.15, 'usual'],
    ['dots', 0.9, 22, 1.2, 'usual'],
    ['dots', 0.1, 12, 1, 'odd'],
    ['grok', 0.9, 40, 1.5, 'usual'],
    ['grok', 0.1, 40, 0.8, 'odd'],
    ['gemini', 0.9, 30, 1.35, 'usual'],
    ['qwen', 0.9, 45, 1.25, 'usual'],
    ['qwen', 0.1, 45, 1, 'odd'],
  ] as const)('%s with luck %f sends the barista off at %i° and %f times the speed', (kind, luck, angle, times, outcome) => {
    const run = approaching([kind], { luck });
    const before = speedOf(run), hit = untilHit(run);
    expect(hit).toMatchObject({ kind, as: kind, outcome, x: T.firstCell });
    expect(degrees(run)).toBeCloseTo(angle, 0);
    expect(speedOf(run)).toBeCloseTo(before * times, 1);
    expect(run.caffeine).toBe(1);
    expect(run.frozen).toBe(T.hitStop);
  });

  it('kicks a barista who arrives slowly off at a minimum speed, but not on the unlucky outcome', () => {
    const slow = approaching(['muse'], { speed: 3 });
    untilHit(slow);
    expect(speedOf(slow)).toBeCloseTo(T.kick, 1);
    const unlucky = approaching(['grok'], { speed: 6, y: 0.3, luck: 0.1 });
    untilHit(unlucky);
    expect(speedOf(unlucky)).toBeLessThan(6);
  });

  it('never sends anyone off faster than the speed limit', () => {
    const run = approaching(['grok'], { speed: 79 });
    untilHit(run);
    expect(speedOf(run)).toBeCloseTo(T.maxSpeed, 1);
  });

  it('holds still for the hit pause, then carries on', () => {
    const run = approaching(['muse']);
    untilHit(run);
    const x = run.x;
    steps(run, T.hitStop);
    expect(run.x).toBe(x);
    stepBlast(run, false);
    expect(run.x).toBeGreaterThan(x);
  });

  it('is flown over by a barista above head height', () => {
    const run = approaching(['muse'], { y: 6 });
    steps(run, 20);
    expect(run.hits).toEqual([]);
  });
});

describe('BARISTA BLAST!! the four model residents', () => {
  it('claude agrees: the barista goes on the way they came, turned upward and a little faster, and no flatter than 45°', () => {
    for (const [vx, vy, y] of [[12, -16, 2.3], [10, 12, 0.6], [20, -2, 1]]) {
      const run = approaching(['claude']);
      Object.assign(run, { vx, vy, y });
      let was = { vx: run.vx, vy: run.vy };
      while (!run.hits.length) { was = { vx: run.vx, vy: run.vy }; stepBlast(run, false); }
      // The hit lands inside a step, after that step's gravity: within two degrees of the heading the step began with.
      const came = Math.atan2(Math.abs(was.vy), was.vx) * 180 / Math.PI;
      expect(Math.abs(degrees(run) - Math.max(45, came))).toBeLessThan(2);
      expect(speedOf(run)).toBeCloseTo(Math.hypot(was.vx, was.vy) * 1.15, 0);
    }
  });

  it('gpt hands over one disclaimer with a shot, two with a boost, and none when it will not commit', () => {
    const run = approaching(['dots', 'dots'], { speed: 30 });
    for (const count of [1, 2]) { untilHit(run, count); expect(run.waivers).toBe(1); Object.assign(run, { y: 1, vx: 30, vy: 0 }); }
    const unsure = approaching(['dots'], { luck: 0.1 });
    untilHit(unsure);
    expect(unsure.waivers).toBe(0);
    const boosted = approaching(['dots', 'dots'], { caffeine: T.caffeine });
    untilHit(boosted);
    steps(boosted, 30, 29);
    expect(boosted.waivers).toBe(2);
    // A later plain shot does not take the second one away.
    Object.assign(boosted, { y: 1, vx: 30, vy: 0, frozen: 0 });
    untilHit(boosted, 2);
    expect(boosted.waivers).toBe(2);
  });

  it('a disclaimer takes the next rate limit or ban notice, one each, and nothing else', () => {
    const run = approaching(['limit', 'limit'], { speed: 30 });
    run.waivers = 1;
    const first = untilHit(run), vx = run.vx;
    expect(first.waived).toBe(true);
    expect(vx).toBeCloseTo(30, 0);
    expect(run.waivers).toBe(0);
    const second = untilHit(run, 2);
    expect(second.waived).toBeUndefined();
    expect(run.vx).toBeLessThan(vx * 0.6);
    const noticed = approaching(['notice'], { y: 4, caffeine: 2 });
    noticed.waivers = 2;
    expect(untilHit(noticed).waived).toBe(true);
    expect([noticed.refills, noticed.caffeine, noticed.waivers]).toEqual([T.refills, 2, 1]);
    const walled = approaching(['wall']);
    walled.waivers = 2;
    untilHit(walled);
    expect(walled.end).toBe('wall');
    expect(walled.waivers).toBe(2);
  });

  it('gemini stalls on an apology one time in four, then lets go a little slower', () => {
    const run = approaching(['gemini'], { luck: 0.1 }), before = speedOf(run), hit = untilHit(run);
    expect(hit.outcome).toBe('odd');
    expect(run.frozen).toBe(T.stallStop);
    expect(speedOf(run)).toBeCloseTo(before * 0.9, 1);
    expect(degrees(run)).toBeCloseTo(30, 0);
    expect(run.caffeine).toBe(1);
  });

  it('gemini boosted carries the barista level, above everything on the street, and presses wait until it ends', () => {
    const run = approaching(['gemini', 'wall', 'notice', 'wall'], { caffeine: T.caffeine });
    run.refills = 2;
    untilHit(run);
    steps(run, 30, 29);
    expect(run.glide).toBe(T.glideSteps);
    expect(run.y).toBe(T.glideHeight);
    expect(run.vy).toBe(0);
    expect(run.vx).toBeCloseTo(20 * 1.5, 1);
    steps(run, T.boostStop);
    const from = run.x;
    steps(run, T.glideSteps - 1, 40);
    // Two seconds at one height and one speed, over the walls and the notice; the press did nothing.
    expect(run.y).toBe(T.glideHeight);
    expect(run.x - from).toBeCloseTo(run.vx * (T.glideSteps - 1) / BLAST_HZ, 3);
    expect(run.hits).toHaveLength(1);
    expect(run.refills).toBe(2);
    expect(run.end).toBeNull();
    steps(run, 30);
    expect(run.glide).toBe(0);
    expect(run.y).toBeLessThan(T.glideHeight);
  });

  it('deepseek thinks first, then gives the hardest usual shot on the street', () => {
    const run = approaching(['deepseek']), before = speedOf(run), hit = untilHit(run);
    expect(hit.outcome).toBe('usual');
    expect(run.frozen).toBe(T.thinkStop);
    expect(speedOf(run)).toBeCloseTo(before * 1.6, 1);
    expect(degrees(run)).toBeCloseTo(40, 0);
    expect(run.caffeine).toBe(1);
  });

  it('deepseek is busy one time in three: the barista passes as if nobody stood there, even with a full bar', () => {
    for (const caffeine of [1, T.caffeine]) {
      const run = approaching(['deepseek'], { luck: 0.1, caffeine }), vx = run.vx, hit = untilHit(run);
      expect(hit).toMatchObject({ kind: 'deepseek', outcome: 'odd' });
      // Only the air has slowed them.
      expect(run.vx).toBeCloseTo(vx, 0);
      expect(degrees(run)).toBeLessThan(0);
      expect(run.frozen).toBe(0);
      expect(run.caffeine).toBe(caffeine);
      expect(run.boost).toBeNull();
    }
  });

  it('deepseek boosted is the hardest shot of all', () => {
    const run = approaching(['deepseek'], { caffeine: T.caffeine });
    untilHit(run);
    expect(run.boost?.left).toBe(T.boostWindow);
    steps(run, 30, 29);
    expect(run.hits[0].outcome).toBe('boost');
    expect(degrees(run)).toBeCloseTo(40, 0);
    expect(speedOf(run)).toBeCloseTo(20 * 2.2, 1);
    expect(run.caffeine).toBe(0);
  });

  it('qwen gives itself away: a copy stands on the nearest empty cell from two ahead, and a copy plants nothing', () => {
    const run = approaching(['qwen'], { speed: 30 });
    run.cells.push(null, { kind: 'limit', x: T.firstCell + 2 * T.cell }, null, null, null, null, null, null);
    untilHit(run);
    expect(run.cells[3]).toEqual({ kind: 'qwen', x: T.firstCell + 3 * T.cell, copy: true });
    expect(run.cells.filter(cell => cell?.copy)).toHaveLength(1);
    // Land on the copy: it acts as qwen and plants no more.
    Object.assign(run, { x: T.firstCell + 3 * T.cell - 2, y: 1, vx: 30, vy: 0 });
    const hit = untilHit(run, 2);
    expect(hit).toMatchObject({ kind: 'qwen', as: 'qwen', outcome: 'usual' });
    expect(run.caffeine).toBe(2);
    expect(run.cells.filter(cell => cell?.copy)).toHaveLength(1);
  });

  it('qwen plants nothing when it is out of luck or the street ahead is full', () => {
    const unlucky = approaching(['qwen'], { luck: 0.1 });
    unlucky.cells.push(null, null, null, null);
    untilHit(unlucky);
    expect(unlucky.cells.some(cell => cell?.copy)).toBe(false);
    const full = approaching(['qwen', 'dots', 'limit', 'gate', 'cache', 'dots']);
    untilHit(full);
    expect(full.cells.some(cell => cell?.copy)).toBe(false);
  });

  it('qwen boosted plants two copies and stands the barista a cup, up to the three they can hold', () => {
    for (const [had, has] of [[1, 2], [T.refills, T.refills]]) {
      const run = approaching(['qwen'], { caffeine: T.caffeine });
      run.cells.push(null, null, null, null, null, null);
      run.refills = had;
      untilHit(run);
      steps(run, 30, 29);
      expect(run.hits[0].outcome).toBe('boost');
      // One from the hit and two from the boost, on cells 2, 3 and 4.
      expect(run.cells.slice(0, 5).map(cell => Boolean(cell?.copy))).toEqual([false, false, true, true, true]);
      expect(run.refills).toBe(has);
      expect(speedOf(run)).toBeCloseTo(20 * 1.6, 1);
    }
  });

  it('doubao says it plainly: the flattest shot on the street, in a dead straight line for half a second', () => {
    const run = approaching(['doubao']), before = speedOf(run);
    untilHit(run);
    expect(speedOf(run)).toBeCloseTo(before * 1.3, 1);
    expect(degrees(run)).toBeCloseTo(12, 0);
    expect(run.caffeine).toBe(1);
    expect(run.straight).toBe(60);
    steps(run, T.hitStop);
    const from = { x: run.x, y: run.y, vx: run.vx, vy: run.vy };
    steps(run, 60);
    // No fall and no drag: the same speed and heading, and exactly where a ruler would put it.
    expect([run.vx, run.vy]).toEqual([from.vx, from.vy]);
    expect(run.x - from.x).toBeCloseTo(from.vx * 60 / BLAST_HZ, 6);
    expect(run.y - from.y).toBeCloseTo(from.vy * 60 / BLAST_HZ, 6);
    expect(run.straight).toBe(0);
    stepBlast(run, false);
    expect(run.vy).toBeLessThan(from.vy);
  });

  it('doubao boosted flies straight for a whole second, and a press or a hit ends the line', () => {
    const run = approaching(['doubao'], { caffeine: T.caffeine });
    untilHit(run);
    steps(run, 30, 29);
    expect(run.hits[0].outcome).toBe('boost');
    expect(speedOf(run)).toBeCloseTo(20 * 1.7, 1);
    expect(run.straight).toBe(120);
    expect(run.caffeine).toBe(0);
    steps(run, T.boostStop + 10);
    stepBlast(run, true);
    expect(run.straight).toBe(0);
    const again = approaching(['doubao', 'limit'], { speed: 30 });
    untilHit(again, 2);
    expect(again.straight).toBe(0);
  });

  it('doubao goes round after all one time in four: the barista ends up anywhere between 20° and 70° at the same speed', () => {
    for (const luck of [0.01, 0.12, 0.24]) {
      const run = approaching(['doubao'], { luck }), before = speedOf(run), hit = untilHit(run);
      expect(hit.outcome).toBe('odd');
      expect(speedOf(run)).toBeCloseTo(before, 1);
      expect(degrees(run)).toBeGreaterThan(19);
      expect(degrees(run)).toBeLessThan(71);
      expect(run.caffeine).toBe(1);
      expect(run.straight).toBe(0);
    }
  });
});

describe('BARISTA BLAST!! the boost', () => {
  it.each([
    ['muse', 45, 1.6],
    ['claude', 62, 1.8],
    ['dots', 22, 1.7],
    ['grok', 40, 2],
  ] as const)('upgrades %s to %i° and %f times the arriving speed when tapped inside the window', (kind, angle, times) => {
    const run = approaching([kind], { caffeine: T.caffeine, luck: 0.1 });
    run.refills = 1;
    const hit = untilHit(run);
    expect(run.boost?.left).toBe(T.boostWindow);
    steps(run, 30, 29);
    expect(hit.outcome).toBe('boost');
    expect(run.boost).toBeNull();
    expect(run.caffeine).toBe(0);
    expect(degrees(run)).toBeCloseTo(angle, 0);
    expect(speedOf(run)).toBeCloseTo(20 * times, 1);
    expect(run.refills).toBe(kind === 'muse' ? T.refills : 1);
    expect(run.frozen).toBe((kind === 'claude' ? T.thinkStop : T.boostStop) - 1);
  });

  it('moves at a third of the speed while the window is open, and keeps the bar when the tap never comes', () => {
    const run = approaching(['muse'], { caffeine: T.caffeine });
    const hit = untilHit(run), x = run.x, vx = run.vx;
    stepBlast(run, false);
    expect(run.x - x).toBeCloseTo(vx * T.boostSlow / BLAST_HZ, 3);
    steps(run, T.boostWindow);
    expect(run.boost).toBeNull();
    expect(hit.outcome).toBe('usual');
    expect(run.caffeine).toBe(T.caffeine);
  });

  it('opens no window before the bar is full, and fills the bar one resident at a time', () => {
    const run = approaching(['dots', 'dots', 'dots', 'dots'], { speed: 30 });
    for (let count = 1; count <= 3; count++) {
      untilHit(run, count);
      expect(run.boost).toBeNull();
      expect(run.caffeine).toBe(count);
      Object.assign(run, { y: 1, vx: 30, vy: 0 });
    }
    untilHit(run, 4);
    expect(run.boost).not.toBeNull();
  });
});

describe('BARISTA BLAST!! things on the street', () => {
  it('the takeaway window fills the refills and sends the barista on; boosted, it fills the bar too', () => {
    const run = approaching(['window']);
    run.refills = 0;
    untilHit(run);
    expect(run.refills).toBe(T.refills);
    expect(degrees(run)).toBeCloseTo(40, 0);
    expect(speedOf(run)).toBeCloseTo(26, 1);
    expect(run.caffeine).toBe(0);
    const charged = approaching(['window'], { caffeine: T.caffeine });
    untilHit(charged);
    steps(charged, 5, 4);
    expect(charged.caffeine).toBe(T.caffeine);
    expect(charged.hits[0].outcome).toBe('boost');
  });

  it('the context window wall ends the run', () => {
    const run = approaching(['wall'], { y: 4 });
    untilHit(run);
    expect(run.end).toBe('wall');
    expect(blastMeters(run)).toBeLessThan(T.firstCell);
  });

  it('the wall is cleared by a barista above it', () => {
    const run = approaching(['wall'], { y: 6 });
    steps(run, 30);
    expect(run.end).toBeNull();
    expect(run.hits).toEqual([]);
  });

  it('with a full bar the wall waits for a tap, which becomes the strongest launch of the run', () => {
    const run = approaching(['wall'], { caffeine: T.caffeine });
    untilHit(run);
    expect(run.end).toBeNull();
    const x = run.x;
    steps(run, 40, 39);
    expect(run.x).toBe(x);
    expect(speedOf(run)).toBeCloseTo(T.wallBoost, 1);
    expect(degrees(run)).toBeCloseTo(45, 6);
    expect(run.caffeine).toBe(0);
    steps(run, T.boostStop + 5);
    expect(run.x).toBeGreaterThan(x);
    expect(run.end).toBeNull();
  });

  it('with a full bar and no tap the wall ends the run when the window closes', () => {
    const run = approaching(['wall'], { caffeine: T.caffeine });
    untilHit(run);
    steps(run, T.boostWindow - 1);
    expect(run.end).toBeNull();
    stepBlast(run, false);
    expect(run.end).toBe('wall');
  });

  it('the rate limit barrier halves the speed without turning the barista', () => {
    const run = approaching(['limit']);
    untilHit(run);
    expect(speedOf(run)).toBeCloseTo(10, 1);
    expect(run.boost).toBeNull();
  });

  it('the approval gate turns the barista somewhere between 20° and 70° at the same speed', () => {
    for (const [luck, angle] of [[0, 20], [0.5, 45], [0.999, 70]] as const) {
      const run = approaching(['gate'], { luck });
      const before = speedOf(run);
      untilHit(run);
      expect(degrees(run)).toBeCloseTo(angle, -0.5);
      expect(speedOf(run)).toBeCloseTo(before, 1);
    }
  });

  it('the prompt cache spring makes the next landing keep all its speed, once', () => {
    const run = approaching(['cache']);
    untilHit(run);
    expect(run.spring).toBe(true);
    Object.assign(run, { y: 0.01, vx: 20, vy: -10, frozen: 0 });
    stepBlast(run, false);
    expect(run.vx).toBeCloseTo(20, 1);
    expect(run.vy).toBeCloseTo(10, 0);
    expect(run.spring).toBe(false);
    Object.assign(run, { y: 0.01, vx: 20, vy: -10 });
    stepBlast(run, false);
    expect(run.vx).toBeCloseTo(20 * T.bounceAlong, 1);
    expect(run.vy).toBeCloseTo(10 * T.bounceUp, 0);
  });

  it('the ban notice floats: it takes the refills and the bar from a barista flying into it, and misses one underneath', () => {
    const under = approaching(['notice'], { y: 1, caffeine: 2 });
    steps(under, 20);
    expect(under.hits).toEqual([]);
    const into = approaching(['notice'], { y: 5, caffeine: 2 });
    const before = speedOf(into);
    untilHit(into);
    expect([into.refills, into.caffeine]).toEqual([0, 0]);
    expect(speedOf(into)).toBeCloseTo(before, 1);
  });

  it('the ban notice also closes a boost window that was still open', () => {
    const run = approaching(['muse', 'notice'], { caffeine: T.caffeine });
    untilHit(run);
    expect(run.boost).not.toBeNull();
    Object.assign(run, { x: T.firstCell + T.cell - 1.5, y: 5, vx: 30, vy: 0 });
    untilHit(run, 2);
    expect(run.boost).toBeNull();
    const speed = speedOf(run);
    run.frozen = 0; run.vy = 1; run.y = 1;
    stepBlast(run, true);
    expect(run.hits[0].outcome).toBe('usual');
    expect(speedOf(run)).toBeLessThan(speed + 1);
  });

  it('the ghost resident is passed through, and the next thing hit acts as something else', () => {
    const run = approaching(['ghost', 'muse'], { luck: 0 });
    const before = speedOf(run);
    untilHit(run);
    expect(run.frozen).toBe(0);
    expect(speedOf(run)).toBeCloseTo(before, 1);
    expect(run.caffeine).toBe(0);
    Object.assign(run, { y: 1, vy: 0 });
    const next = untilHit(run, 2);
    expect(next.kind).toBe('muse');
    expect(next.as).toBe('claude');
    // Claude agrees with a barista who arrives level by sending them off at its flattest, 45°.
    expect(degrees(run)).toBeCloseTo(45, 0);
    expect(run.scramble).toBe(false);
  });
});

describe('BARISTA BLAST!! in the air and on the ground', () => {
  const flying = (over: Partial<BlastRun>) => Object.assign(startBlast(1, blastLooks, 0, 0), { cells: [null], x: 0, y: 8, vx: 20, vy: 0 }, over);

  it('a tap on the way down is a refill: up and forward, three to a run', () => {
    const run = flying({ vy: -5 });
    stepBlast(run, true);
    expect(run.refills).toBe(T.refills - 1);
    expect(run.vy).toBeCloseTo(T.refillUp, 0);
    expect(run.vx).toBeCloseTo(20 + T.refillAlong, 0);
    for (let more = 0; more < 3; more++) { run.vy = -5; stepBlast(run, true); }
    expect(run.refills).toBe(0);
    expect(run.vy).toBeLessThan(0);
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

  it('ends at ninety seconds however fast it is still going', () => {
    const run = flying({ step: T.maxSteps - 2 });
    stepBlast(run, false);
    expect(run.end).toBeNull();
    stepBlast(run, false);
    expect(run.end).toBe('timeout');
    expect(T.maxSteps / BLAST_HZ).toBe(90);
  });
});

describe('BARISTA BLAST!! over many runs', () => {
  it('always ends inside ninety seconds and the furthest distance the speed limit allows', () => {
    let state = 99;
    const roll = () => { state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0; return state / 4_294_967_296; };
    const meters: number[] = [];
    for (let seed = 1; seed <= 400; seed++) {
      const taps = Array.from({ length: 60 }, () => Math.floor(roll() * 3000)).sort((a, b) => a - b);
      const run = replayBlast(seed, blastLooks, { aim: Math.floor(roll() * T.aimSteps), hold: Math.floor(roll() * T.gaugeSteps), taps });
      expect(run.step).toBeLessThanOrEqual(T.maxSteps);
      expect(run.x).toBeLessThanOrEqual(T.maxSpeed * 90);
      expect(Number.isFinite(run.x) && run.x >= 0 && run.y >= 0).toBe(true);
      meters.push(blastMeters(run));
    }
    meters.sort((a, b) => a - b);
    // Guards the tuning, loosely: a typical careless run is tens to a few hundred metres, and long runs do happen.
    expect(meters[200]).toBeGreaterThan(40);
    expect(meters[200]).toBeLessThan(400);
    expect(meters[399]).toBeGreaterThan(600);
  });

  it('carries a version for run tickets', () => {
    expect(BLAST_VERSION).toBe(3);
  });
});
