import { describe, expect, it } from 'vitest';
import { gameCards } from '../index.ts';
import { rescore } from '../kit/play.ts';
import { blastCard } from './card.ts';
import { BLAST_VERSION, blastLooks, replayBlast } from './rules.ts';
import { blastRules, blastVersions } from './versions.ts';

// The same answer, scored under each version when this table was made. A frozen version that scores it differently
// has been edited, and every run recorded under it would now replay to another score.
const grokRun = { aim: 31, hold: 51, taps: Array.from({ length: 60 }, (_, i) => i * 50 + 30), pilot: 'grok' as const };
const three = ['claude', 'dots', 'qwen'] as const, one = ['claude'] as const;
const recorded: [version: number, seed: number, cast: readonly string[], answer: object, score: number, meters: number][] = [
  [7, 1, three, { aim: 36, hold: 50, taps: [90, 200, 310, 480, 650, 900, 1300] }, 21_287_748_354, 2480.38],
  [7, 20261116, three, { aim: 30, hold: 54, taps: [120, 260, 400, 700, 1000, 1400, 1800, 2400], pilot: 'claude' }, 15_469_657, 421.26],
  [7, 1, one, grokRun, 13_862_796_223, 2240.15],
  [8, 1, three, { aim: 36, hold: 50, taps: [90, 200, 310, 480, 650, 900, 1300] }, 662_179_530, 1078.97],
  [8, 20261116, three, { aim: 30, hold: 54, taps: [120, 260, 400, 700, 1000, 1400, 1800, 2400], pilot: 'claude' }, 1_154_824_366, 1234.86],
  [8, 1, one, grokRun, 29_918_777_287, 2688.8],
];

describe('BARISTA BLAST!! rules versions', () => {
  it('keeps the live version and every frozen one', () => {
    expect(Object.keys(blastVersions).map(Number)).toEqual([7, 8, 9]);
    expect(blastCard.version).toBe(BLAST_VERSION);
    expect(blastVersions[BLAST_VERSION]).toBeDefined();
    expect(gameCards['barista-blast']).toBe(blastCard);
    expect(Object.keys(blastCard.play.rules)).toEqual(Object.keys(blastVersions));
    expect(Object.keys(blastRules)).toEqual(Object.keys(blastVersions));
    expect(blastRules[BLAST_VERSION].replayBlast).toBe(replayBlast);
  });

  it.each(recorded)('v%i seed %i still scores what it scored when recorded', (version, seed, cast, answer, score, meters) => {
    const rules = blastVersions[version];
    const result = rules.replay(seed, cast, rules.inputs.parse(answer));
    expect(result.score).toBe(score);
    expect(result.detail.meters).toBe(meters);
  });

  it('scores the live version exactly as the live rules do', () => {
    const answer = { ...grokRun, why: 'tap every 50 steps' };
    const played = rescore(blastCard.play, BLAST_VERSION, 1, ['claude'], answer);
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    const run = replayBlast(1, ['claude'], grokRun);
    expect(played.result.seconds).toBe(run.step / 120);
    expect(played.result.detail.steps).toBe(run.step);
    expect(played.why).toBe('tap every 50 steps');
  });

  it('turns away an answer it cannot score', () => {
    const play = blastCard.play;
    const reason = (answer: unknown, version = BLAST_VERSION, cast: readonly string[] = blastLooks) => { const played = rescore(play, version, 1, cast, answer); return played.ok ? 'ok' : played.reason; };
    expect(reason({ aim: 0, hold: 0, taps: [], why: '' })).toBe('ok');
    expect(reason({ aim: 0, hold: 0, taps: [], why: '' }, 6)).toBe('version');
    expect(reason({ aim: 0, hold: 0, taps: [], why: '' }, BLAST_VERSION, ['gpt-5'])).toBe('cast');
    expect(reason({ aim: 0, hold: 0, taps: [] })).toBe('ok');
    expect(reason({ aim: 0, hold: 0, taps: [], why: 7 })).toBe('why');
    expect(reason({ aim: 0, hold: 0, taps: [], why: 'x'.repeat(281) })).toBe('why');
    expect(reason({ aim: 0, hold: 0, taps: [5, 3], why: '' })).toBe('inputs');
    expect(reason({ aim: 144, hold: 0, taps: [], why: '' })).toBe('inputs');
    expect(reason({ aim: 0, hold: 0, taps: [], pilot: 'nobody', why: '' })).toBe('inputs');
    expect(reason([1, 2, 3])).toBe('inputs');
    expect(reason({ aim: 0, hold: 0, taps: [], why: '', pad: 'x'.repeat(40_000) })).toBe('too_big');
    // Extra fields are dropped, and a score the answer claims for itself is never read.
    const claimed = rescore(play, BLAST_VERSION, 1, blastLooks, { aim: 36, hold: 50, taps: [], score: 9e14, why: '' });
    const plain = rescore(play, BLAST_VERSION, 1, blastLooks, { aim: 36, hold: 50, taps: [], why: '' });
    expect(claimed.ok && plain.ok && claimed.result.score === plain.result.score).toBe(true);
  });
});
