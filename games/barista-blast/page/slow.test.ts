import { describe, expect, it } from 'vitest';
import { blastLooks, blastTokens, replayBlast } from '../rules.ts';
import { milestoneTokens } from './copy';
import { advanceBlast, aimingPhase, pressBlast, releaseBlast, type BlastPhase } from './phase';
import { skipsSlow, SLOW_MS, SLOW_RATE, slowSkip, slowsDown } from './slow';

describe('BARISTA BLAST!! slow motion after a hit', () => {
  it('skips the same share of the clock for a press as for the frame it falls in, and none once the slow motion is over', () => {
    const skipped = 1 - SLOW_RATE;
    expect(slowSkip(33, SLOW_MS)).toBeCloseTo(33 * skipped, 6);
    expect(slowSkip(20, SLOW_MS)).toBeCloseTo(20 * skipped, 6);
    expect(slowSkip(100, 40)).toBeCloseTo(40 * skipped, 6);
    expect(slowSkip(50, 0)).toBe(0);
    expect(slowSkip(-5, SLOW_MS)).toBe(0);
  });

  it('is slower than the third of a second at 30% it was, and absent with motion reduced', () => {
    expect(SLOW_RATE).toBeLessThan(0.3);
    expect(SLOW_MS).toBeGreaterThan(320);
    const flying = { kind: 'flying', run: { boost: null } } as unknown as BlastPhase;
    const hit = [{ type: 'boost', hit: {} }] as unknown as Parameters<typeof slowsDown>[1];
    expect(slowsDown(flying, hit, false)).toBe(true);
    expect(slowsDown(flying, hit, true)).toBe(false);
  });

  function play(seed: number, every: number, skip: boolean) {
    let hidden = 0, slow = 0, last = 0, skips = 0, inWindow = 0;
    const game = (wall: number) => wall - hidden;
    const stamp = (at: number) => game(at) - (slow ? slowSkip(at - last, slow) : 0);
    let phase: BlastPhase = aimingPhase(seed, 0, blastLooks);
    phase = pressBlast(phase, 300);
    phase = releaseBlast(phase, 700);
    last = 700;
    let tapAt = 2400;
    for (let wall = 700 + 1000 / 60; phase.kind === 'flying' && wall < 600_000; wall += 1000 / 60) {
      for (; tapAt <= wall && tapAt < 9000; tapAt += every) {
        const at = stamp(tapAt);
        if (phase.kind === 'flying' && phase.run.boost) inWindow++;
        if (skip && skipsSlow(phase, slow)) { hidden += slowSkip(tapAt - last, slow); slow = 0; skips++; }
        phase = pressBlast(phase, at);
      }
      if (slow) { hidden += slowSkip(wall - last, slow); slow -= Math.min(slow, wall - last); }
      last = wall;
      const { phase: next, events } = advanceBlast(phase, game(wall), milestoneTokens);
      if (slowsDown(next, events, false)) slow = SLOW_MS;
      if (next.kind !== 'flying') slow = 0;
      phase = next;
    }
    if (phase.kind !== 'result') throw new Error(`the run did not end: ${phase.kind}`);
    return { phase, skips, inWindow };
  }

  it('a recorded run replays to the same score whether its slow motion was skipped or played out', () => {
    let skipped = 0, windows = 0;
    for (const seed of [11, 2024, 77_777, 913_408, 5, 31_337, 424_242, 1_000_003]) {
      for (const skip of [false, true]) {
        const { phase, skips, inWindow } = play(seed, 110, skip);
        if (skip) skipped += skips; else expect(skips).toBe(0);
        windows += inWindow;
        const replayed = replayBlast(seed, phase.cast, phase.inputs);
        expect(replayed.step).toBe(phase.run.step);
        expect(replayed.x).toBe(phase.run.x);
        expect(blastTokens(replayed.x)).toBe(blastTokens(phase.run.x));
      }
    }
    expect(skipped).toBeGreaterThan(0);
    expect(windows).toBeGreaterThan(0);
  });

  it('a tap inside a boost window or after the slow motion has ended does not skip anything', () => {
    const open = { kind: 'flying', run: { boost: { left: 10 } } } as unknown as BlastPhase;
    const shut = { kind: 'flying', run: { boost: null } } as unknown as BlastPhase;
    expect(skipsSlow(open, SLOW_MS)).toBe(false);
    expect(skipsSlow(shut, SLOW_MS)).toBe(true);
    expect(skipsSlow(shut, 0)).toBe(false);
  });
});
