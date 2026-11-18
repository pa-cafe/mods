import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blastTokens } from '../rules.ts';
import { atlasLook, hash, rocketOf } from './art';
import { carAt, catchAt, catchesGrok, PAD_CYCLE, padAt, padsIn, padSize, trainAt, wrapWords, type GagFrame } from './orbit-gags';
import { ORBIT, scenes } from './scenes';
import { propKey } from './street3d-props';

const metresAt = (tokens: number) => { let low = 0, high = 20_000; while (high - low > 0.5) { const middle = (low + high) / 2; if (blastTokens(middle) < tokens) low = middle; else high = middle; } return high; };
const frame: GagFrame = { centre: 2000, half: 32, top: 28 };
const ms = (seconds: number) => seconds * 1000;

describe('BARISTA BLAST!! visual gags: the wall of servers', () => {
  it('stands as a different piece once a boost has reset its limits, so the 3D street swaps it for one with green lights and the new sign', () => {
    const wall = { kind: 'wall' as const, x: 10, squash: 1, sign: 'LIMITS RESET' };
    expect(propKey(wall)).not.toBe(propKey({ ...wall, reset: true }));
    expect(propKey({ ...wall, reset: true })).toBe(propKey({ ...wall, reset: true }));
    expect(propKey({ kind: 'mail', x: 0, squash: 1, sign: 'BANNED' })).toBe('prop:mail:BANNED');
  });
});

describe('BARISTA BLAST!! visual gags: the rocket pad in orbit', () => {
  it('lives in the orbit scene, from a billion tokens up to the divine realm', () => {
    expect(scenes[ORBIT].from).toBe(1e9);
    expect(scenes[ORBIT + 1].from).toBe(1e11);
  });

  const walk = (breaks: boolean) => {
    const begins = hash(1, 71) * PAD_CYCLE;
    for (let cycle = 1; cycle < 300; cycle++) {
      const start = cycle * PAD_CYCLE * 1000 - begins * 1000 + 1;
      const states = Array.from({ length: PAD_CYCLE * 4 - 1 }, (_, i) => padAt(1, start + i * 250));
      if (states.some(state => state.stage === 'boom') === breaks) return states;
    }
    throw new Error('no such cycle found');
  };

  it('stands with the arms shut, lights up, lets go, and either climbs away or comes apart; then an empty pad gets a new rocket', () => {
    const whole = walk(false);
    expect(whole[0]).toMatchObject({ stage: 'stand', arms: 1, burn: 0, rocket: 1, lift: 0 });
    expect(whole.map(state => state.stage).filter((stage, index, all) => stage !== all[index - 1])).toEqual(['stand', 'fire', 'rise', 'empty', 'emerge']);
    const fire = whole.filter(state => state.stage === 'fire'), rise = whole.filter(state => state.stage === 'rise');
    expect(fire.at(-1)!.burn).toBeGreaterThan(0.9);
    expect(fire[0].arms).toBe(1);
    expect(rise.every(state => state.arms === 0 && state.burn === 1)).toBe(true);
    expect(rise.map(state => state.lift)).toEqual([...rise.map(state => state.lift)].sort((a, b) => a - b));
    expect(rise.at(-1)!.lift).toBeGreaterThan(30);
    expect(whole[0].smoke).toBe(-1);
    expect(whole.find(state => state.stage === 'empty')!.smoke).toBeGreaterThan(5);
    const back = whole.filter(state => state.stage === 'emerge');
    expect(back[0].rocket).toBeLessThan(0.1);
    expect(back.at(-1)!.arms).toBeGreaterThan(0.2);
  });

  it('comes apart in a bang on the way up in about two cycles in five, with the words for it showing for a few seconds', () => {
    const broken = walk(true);
    expect(broken.map(state => state.stage).filter((stage, index, all) => stage !== all[index - 1])).toEqual(['stand', 'fire', 'rise', 'boom', 'empty', 'emerge']);
    const bang = broken.filter(state => state.stage === 'boom');
    expect(bang.length * 0.25).toBeGreaterThanOrEqual(3.5);
    expect(bang.every(state => state.rocket === 0 && state.burn === 0)).toBe(true);
    let breaks = 0;
    for (let cycle = 0; cycle < 400; cycle++) if (padAt(2, cycle * PAD_CYCLE * 1000 + ms(10.2) - hash(2, 71) * PAD_CYCLE * 1000).stage === 'boom') breaks++;
    expect(breaks / 400).toBeGreaterThan(0.28);
    expect(breaks / 400).toBeLessThan(0.52);
  });

  it('lists the pads from just off one edge of the screen to just off the other, and scales one to the sky above the ground', () => {
    for (const centre of [1300, 2000, 2467, 3300]) {
      const pads = padsIn({ ...frame, centre });
      expect(pads[0].u).toBeLessThanOrEqual(-frame.half);
      expect(pads.at(-1)!.u).toBeGreaterThanOrEqual(frame.half);
      expect(pads.every(pad => pad.u > -frame.half - 120 && pad.u < frame.half + 120)).toBe(true);
    }
    const [first] = padsIn(frame), [later] = padsIn({ ...frame, centre: frame.centre + 100 });
    expect(first.u - later.u).toBeCloseTo(3, 0);
    expect(padSize({ ...frame, top: 8 })).toBe(0.45);
    expect(padSize({ ...frame, top: 200 })).toBe(1.5);
    expect(padSize(frame)).toBeGreaterThan(0.6);
  });

  it('sends a car and a train of satellites across now and then, never at the same height as the rocket’s tower top', () => {
    const times = Array.from({ length: 400 }, (_, i) => i * 1000);
    for (const pass of [carAt, trainAt]) {
      const seen = times.map(at => pass(at, frame));
      expect(seen.some(each => each.on)).toBe(true);
      expect(seen.some(each => !each.on)).toBe(true);
      for (const each of seen.filter(each => each.on)) { expect(Math.abs(each.u)).toBeLessThanOrEqual(frame.half + 60); expect(each.y).toBeLessThan(frame.top * 0.85); }
    }
  });

  it('splits long words over two lines at the space nearest the middle, and leaves short ones alone', () => {
    expect(wrapWords('Rapid unscheduled disassembly')).toEqual(['Rapid unscheduled', 'disassembly']);
    expect(wrapWords('快速非計畫性解體')).toEqual(['快速非計畫性解體']);
    expect(wrapWords('급속한 계획 외 분해')).toEqual(['급속한 계획 외 분해']);
    expect(wrapWords('Averyveryverylongwordwithoutspaces')).toEqual(['Averyveryverylongwordwithoutspaces']);
  });
});

describe('BARISTA BLAST!! visual gags: Grok’s boost', () => {
  it('gets the catch only in orbit, only her own, and not when a pilot lends a hand', () => {
    const inOrbit = metresAt(2e9), before = metresAt(5e8), divine = metresAt(2e11);
    expect(catchesGrok({ as: 'grok', x: inOrbit })).toBe(true);
    expect(catchesGrok({ as: 'grok', x: before })).toBe(false);
    expect(catchesGrok({ as: 'grok', x: divine })).toBe(false);
    expect(catchesGrok({ as: 'claude', x: inOrbit })).toBe(false);
    expect(catchesGrok({ as: 'grok', assist: 'qwen', x: inOrbit })).toBe(false);
  });

  it('plays out in order: the rocket drops in, the arms shut, the engines light, the arms let go, and she is flung', () => {
    const steps = Array.from({ length: 101 }, (_, i) => catchAt(i / 100));
    expect(steps[0].drop).toBeGreaterThan(20);
    expect(steps[30].drop).toBe(0);
    expect(steps[10].arms).toBe(0);
    expect(steps[50].arms).toBe(1);
    expect(steps[75].arms).toBe(0);
    expect(steps[40].burn).toBe(0);
    expect(steps[75].burn).toBe(1);
    expect(steps[40].clang).toBeGreaterThan(0.9);
    expect(steps.slice(0, 58).every(step => step.fling === 0 && step.lift === 0)).toBe(true);
    expect(steps.map(step => step.fling)).toEqual([...steps.map(step => step.fling)].sort((a, b) => a - b));
    expect(steps[100].fling).toBe(1);
    expect(steps[100].lift).toBeGreaterThan(50);
  });

  it('has her own picture for it on disk, only for her, and hands none over before it has arrived', async () => {
    const { default: rockets } = await import('../art/rocket.json');
    expect(Object.keys(rockets)).toEqual(['grok-bot']);
    expect(existsSync(`${import.meta.dirname}/../art/${rockets['grok-bot'].file}`)).toBe(true);
    for (const look of Object.values(atlasLook)) expect(rocketOf(look)).toBeNull();
  });
});
