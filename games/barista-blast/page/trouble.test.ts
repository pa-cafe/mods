import { describe, expect, it } from 'vitest';
import { startBlast, stepBlast, type BlastHit } from '../rules.ts';
import { milestoneTokens } from './copy';
import { blastEvents, glance, type BlastEvent } from './events';
import { takeoverFor } from './takeover';
import { troubleOf } from './trouble';

const hit = (as: BlastHit['as'], more: Partial<BlastHit> = {}): BlastHit => ({ step: 1, x: 10, kind: as, as, mood: 'bad', outcome: 'usual', ...more });
const struck = (h: BlastHit, held?: true): BlastEvent => ({ type: 'hit', hit: h, from: 1, to: 1, ...(held ? { held } : {}) });

describe('BARISTA BLAST!! trouble acted out', () => {
  it('cuts in for trouble that lands, and not for a shielded one, one still waiting on a tap, or a state that helps', () => {
    const grok = hit('grok');
    expect(troubleOf([struck(grok)])).toBe(grok);
    expect(troubleOf([struck(hit('grok', { waived: true }))])).toBeNull();
    expect(troubleOf([struck(hit('grok'), true)])).toBeNull();
    expect(troubleOf([struck(hit('grok', { mood: 'one' }))])).toBeNull();
    expect(troubleOf([{ type: 'lapsed', hit: grok, from: 1, to: 1 }])).toBe(grok);
    const copied = hit('qwen', { kind: 'deepseek' });
    expect(troubleOf([struck(copied)])).toBe(copied);
  });

  it('leaves the ban and the capacity wall to their own scenes before the letter and the band', () => {
    const ban: BlastEvent[] = [struck(hit('claude')), { type: 'end', end: 'banned' }], wall = [struck(hit('dots'))];
    expect(troubleOf(ban)).toBeNull();
    expect(takeoverFor(ban)).toBe('banned');
    expect(troubleOf(wall)).toBeNull();
    expect(takeoverFor(wall)).toBe('capacity');
  });

  it('finds trouble that lands in a real run, and reading it changes nothing', () => {
    const run = startBlast(2, ['claude', 'grok', 'gemini', 'dots'], 32, 54);
    let found: BlastHit | null = null;
    for (let step = 0; step < 4000 && !run.end && !found; step++) {
      const before = glance(run);
      stepBlast(run, false);
      const events = blastEvents(before, run, milestoneTokens), state = JSON.stringify(run);
      found = troubleOf(events);
      expect(JSON.stringify(run)).toBe(state);
    }
    expect(found).not.toBeNull();
    expect(found!.mood).toBe('bad');
  });
});
