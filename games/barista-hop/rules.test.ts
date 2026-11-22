import { describe, expect, it } from 'vitest';
import { gameCards } from '../index.ts';
import { rescore } from '../kit/play.ts';
import { hopCard } from './card.ts';
import { HOP_VERSION, hopAcross, hopAhead, hopLooks, hopMeters, hopSpotX, hopTuning as T, replayHop, startHop, stepHop, type HopRow, type HopRun, type HopSpot } from './rules.ts';
import { HOP_STEER_MAX, hopVersions } from './versions.ts';

const spot = (x: number, more: Partial<HopSpot> = {}): HopSpot => ({ kind: 'saucer', x, width: T.saucer, phase: 0, who: null, gone: false, ...more });
/** A climb standing on a shaft of the test's own making, hopping off the floor at the middle. */
function onShaft(rows: Pick<HopRow, 'y' | 'spots' | 'cloud'>[]): HopRun {
  const run = startHop(1);
  run.rows = [run.rows[0], ...rows.map((row, index) => ({ index: index + 1, ...row }))];
  run.laid = 1e9;
  return run;
}
/** Steps until something happens, the run ends, or `most` steps pass. */
function until(run: HopRun, lean: -1 | 0 | 1 = 0, most = 600) {
  for (let step = 0; step < most && !run.end; step++) { stepHop(run, lean, false); if (run.event) return run.event; }
  return run.end;
}
/** Every row of a seed's shaft up to `height`, by lifting a climb through it. */
function shaft(seed: number, height: number): HopRow[] {
  const run = startHop(seed), rows = new Map(run.rows.map(row => [row.index, row]));
  for (let at = 0; at < height; at += 10) {
    run.y = run.top = at; run.vy = 0; run.end = null;
    stepHop(run, 0, false);
    for (const row of run.rows) rows.set(row.index, row);
  }
  return [...rows.values()].sort((a, b) => a.index - b.index);
}

describe('BARISTA HOP!! shaft', () => {
  it('is the same shaft for the same seed, and another for another', () => {
    expect(shaft(7, 300)).toEqual(shaft(7, 300));
    expect(startHop(7).rows).not.toEqual(startHop(8).rows);
  });

  it('gives every row a sure saucer the row below can reach, and nothing wild near the floor', () => {
    for (const seed of [1, 2, 3, 20261122]) {
      let last = T.width / 2;
      for (const row of shaft(seed, 900).slice(1)) {
        const sure = row.spots[0];
        if (sure.kind === 'counter') continue;
        expect(Math.abs(hopAcross(sure.x, last))).toBeLessThanOrEqual(T.reach + 1e-9);
        expect(sure.kind === 'foam' || sure.who?.deed === 'weak').toBe(false);
        if (row.y < T.safeUntil) expect(row.spots.every(each => each.kind === 'saucer' && each.who?.deed !== 'weak') && !row.cloud).toBe(true);
        last = sure.x;
      }
    }
  });

  it('keeps the rows closer than a hop is high, and spans the shaft with a counter every 100 m', () => {
    const rows = shaft(3, 900), peak = T.jump * T.jump / (2 * T.gravity);
    expect(rows.every((row, at) => row.index === at)).toBe(true);
    for (let at = 1; at < rows.length; at++) {
      const gap = rows[at].y - rows[at - 1].y;
      expect(gap).toBeGreaterThanOrEqual(T.gapMin - 1e-9);
      expect(gap).toBeLessThanOrEqual(T.gapMax + 1e-9);
      expect(gap).toBeLessThan(peak - 0.3);
    }
    const counters = rows.filter(row => row.spots[0].kind === 'counter' && row.index > 0);
    expect(counters.map(row => Math.floor(row.y / T.counterEvery))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(counters.every(row => row.spots[0].width === T.width)).toBe(true);
  });

  it('has everything the game promises somewhere in the first 900 m', () => {
    const rows = shaft(2, 900), spots = rows.flatMap(row => row.spots);
    for (const kind of ['saucer', 'foam', 'cart', 'counter']) expect(spots.some(each => each.kind === kind)).toBe(true);
    for (const deed of ['toss', 'rocket', 'weak']) expect(spots.some(each => each.who?.deed === deed)).toBe(true);
    expect(rows.some(row => row.cloud)).toBe(true);
  });
});

describe('BARISTA HOP!! climb', () => {
  it('hops off the floor for ever when nobody leans, and scores the metres it reached', () => {
    const run = replayHop(1, { steer: [], taps: [] });
    expect(run.end).toBe('timeout');
    expect(run.step).toBe(T.maxSteps);
    expect(hopMeters(run)).toBeGreaterThanOrEqual(1);
  });

  it('lands only on the way down, and only where the feet are', () => {
    const run = onShaft([{ y: 2, spots: [spot(5)], cloud: null }]);
    expect(until(run)).toBe('hop');
    expect(run.y).toBe(2);
    expect(run.vy).toBe(T.jump);
    const miss = onShaft([{ y: 2, spots: [spot(8)], cloud: null }]);
    expect(until(miss)).toBe('hop');
    expect(miss.y).toBe(0);
  });

  it('wraps from one side of the shaft to the other', () => {
    const run = onShaft([]);
    run.x = 9.9;
    for (let step = 0; step < 30; step++) stepHop(run, 1, false);
    expect(run.x).toBeLessThan(5);
    expect(hopAcross(0.5, 9.5)).toBeCloseTo(1);
    expect(hopAcross(9.5, 0.5)).toBeCloseTo(-1);
  });

  it('holds once on foam', () => {
    const run = onShaft([{ y: 2, spots: [spot(5, { kind: 'foam' })], cloud: null }]);
    expect(until(run)).toBe('hop');
    expect(run.rows[1].spots[0].gone).toBe(true);
    expect(until(run)).toBe('hop');
    expect(run.y).toBe(0);
  });

  it('is tossed, rate limited and rocketed by the residents it lands on', () => {
    const tossed = onShaft([{ y: 2, spots: [spot(5, { who: { look: 'claude', deed: 'toss', met: false } })], cloud: null }]);
    expect(until(tossed)).toBe('toss');
    expect(tossed.vy).toBe(T.toss);
    expect(tossed.rows[1].spots[0].who?.met).toBe(true);

    const limited = onShaft([{ y: 2, spots: [spot(5, { who: { look: 'dots', deed: 'weak', met: false } })], cloud: null }]);
    expect(until(limited)).toBe('weak');
    expect(limited.vy).toBe(T.weak);
    expect(T.weak * T.weak / (2 * T.gravity)).toBeLessThan(T.gapMin);

    const rocket = onShaft([{ y: 2, spots: [spot(5, { who: { look: 'grok', deed: 'rocket', met: false } })], cloud: null }, { y: 19, spots: [], cloud: { x: 5, y: 20, phase: T.cloudSteps / 4, gone: false } }]);
    expect(until(rocket)).toBe('rocket');
    expect(until(rocket)).toBe('pop');
    while (rocket.rocket > 0) stepHop(rocket, 0, false);
    expect(rocket.y).toBeGreaterThan(2 + T.rocketSpeed * T.rocketSteps / 60 - 1);
    expect(rocket.end).toBeNull();
  });

  it('drinks a cup only on the way down, and refills at a counter', () => {
    const run = onShaft([]);
    stepHop(run, 0, true);
    expect(run.cups).toBe(T.cups);
    while (run.vy > 0) stepHop(run, 0, false);
    stepHop(run, 0, true);
    expect([run.cups, run.event, run.cupsDrunk]).toEqual([T.cups - 1, 'cup', 1]);
    expect(until(run)).toBe('refill');
    expect(run.cups).toBe(T.cups);
  });

  it('ends on a cloud met from below, and pops one landed on', () => {
    const still = { phase: T.cloudSteps / 4, gone: false };
    const under = onShaft([{ y: 30, spots: [], cloud: { x: 5, y: 2, ...still } }]);
    until(under);
    expect(under.end).toBe('limited');
    const over = onShaft([{ y: 30, spots: [], cloud: { x: 5, y: 2, ...still } }]);
    over.y = 4; over.top = 4; over.vy = 0;
    expect(until(over)).toBe('pop');
    expect([over.end, over.vy, over.rows[1].cloud?.gone]).toEqual([null, T.jump, true]);
  });

  it('ends when it falls a screen below its highest point', () => {
    const run = onShaft([]);
    run.rows = [];
    run.y = 50; run.top = 50; run.vy = 0;
    until(run);
    expect(run.end).toBe('fell');
    expect(hopMeters(run)).toBe(50);
  });

  it('sees what is above the feet, nearest first, the short way round', () => {
    const run = onShaft([{ y: 2, spots: [spot(9.5, { who: { look: 'muse', deed: 'toss', met: false } })], cloud: null }, { y: 4, spots: [spot(5, { kind: 'cart' })], cloud: { x: 2, y: 5, phase: 0, gone: false } }]);
    run.x = 0.5;
    const seen = hopAhead(run, 6);
    expect(seen.map(sight => sight.kind)).toEqual(['saucer', 'cart', 'cloud']);
    expect(seen[0]).toMatchObject({ up: 2, deed: 'toss' });
    expect(seen[0].across).toBeCloseTo(-1);
    expect(seen[1].x).toBe(hopSpotX(run.rows[2].spots[0], run.step));
    expect(hopAhead(run, 3).length).toBe(1);
  });

  it('replays the same inputs to the same climb, step for step', () => {
    const inputs = { steer: [[0, 1], [20, 0], [70, -1], [95, 0], [200, 1]] as [number, -1 | 0 | 1][], taps: [300, 420] };
    expect(replayHop(5, inputs)).toEqual(replayHop(5, inputs));
    const run = startHop(5);
    let lean: -1 | 0 | 1 = 0;
    while (!run.end) {
      for (const [step, next] of inputs.steer) if (step === run.step) lean = next;
      stepHop(run, lean, inputs.taps.includes(run.step));
    }
    expect(run).toEqual(replayHop(5, inputs));
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });
});

describe('BARISTA HOP!! card', () => {
  const play = hopCard.play;

  it('is listed, and replays its own version', () => {
    expect(gameCards['barista-hop']).toBe(hopCard);
    expect(hopCard.version).toBe(HOP_VERSION);
    expect(Object.keys(hopVersions).map(Number)).toEqual([HOP_VERSION]);
  });

  // The same answers, scored when version 1 was written. A rules change that moves one of these needs a new version.
  it.each([
    [1, { steer: [], taps: [] }, 2, 18_000],
    [5, { steer: [[0, 1], [20, 0], [70, -1], [95, 0], [200, 1]], taps: [300, 420] }, 42, 1487],
    [20261122, { steer: [[0, -1], [40, 1], [90, 0], [150, -1], [260, 1]], taps: [200, 500, 800] }, 25, 874],
  ])('scores seed %i as it did when version 1 was recorded', (seed, answer, score, steps) => {
    const played = rescore(play, 1, seed, hopLooks, { ...answer, why: '' });
    expect(played.ok && [played.result.score, played.result.detail.steps]).toEqual([score, steps]);
  });

  it('turns away an answer that is not a climb, and never reads a claimed score', () => {
    const bad = (answer: object) => { const played = rescore(play, HOP_VERSION, 1, hopLooks, answer); return played.ok ? 'ok' : played.reason; };
    expect(bad({ steer: [[5, 1], [5, 0]], taps: [] })).toBe('inputs');
    expect(bad({ steer: [[0, 2]], taps: [] })).toBe('inputs');
    expect(bad({ steer: [], taps: [9, 3] })).toBe('inputs');
    expect(bad({ steer: Array.from({ length: HOP_STEER_MAX + 1 }, (_, step) => [step, step % 2]), taps: [] })).toBe('inputs');
    expect(bad({ steer: [], taps: [] })).toBe('ok');
    expect(rescore(play, 99, 1, hopLooks, { steer: [], taps: [] })).toMatchObject({ ok: false, reason: 'version' });
    const claimed = rescore(play, HOP_VERSION, 1, hopLooks, { steer: [], taps: [], score: 9e9, why: '' });
    expect(claimed.ok && claimed.result.score).toBe(2);
  });
});
