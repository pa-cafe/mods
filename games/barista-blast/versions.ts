// Every BARISTA BLAST!! rules version a run can still be replayed under. A new version: copy rules.ts to v<old>.ts
// with the FROZEN header, add it here, then change rules.ts and raise BLAST_VERSION.
import { z } from 'zod';
import type { RulesVersion } from '../kit/play.ts';
import * as live from './rules.ts';
import * as v7 from './v7.ts';

type Look = live.BlastLook;
/** What every version takes. Each version checks the numbers against its own tuning. */
export type BlastAnswer = { aim: number; hold: number; taps: readonly number[]; pilot?: Look | null };
/** What the cafe keeps of a replayed run besides its score, the tokens it burned. */
export type BlastDetail = { meters: number; steps: number; end: 'stopped' | 'banned' | 'timeout' | null; pilot: Look | null; hits: number; boosts: number };

/** A run takes at most this many taps; a longer one still plays on a screen, and is not scored. */
export const BLAST_TAPS_MAX = 4000;
const rising = (taps: readonly number[]) => taps.every((tap, index) => index === 0 || tap > taps[index - 1]);

interface Rules<R> {
  BLAST_HZ: number;
  blastTuning: { aimSteps: number; gaugeSteps: number; maxSteps: number };
  blastLooks: readonly Look[];
  replayBlast(seed: number, cast: readonly Look[], inputs: BlastAnswer): R;
  blastMeters(run: R): number;
  blastTokens(meters: number): number;
}
type Run = { x: number; step: number; end: BlastDetail['end']; pilot: Look | null; hits: readonly { outcome: string }[] };

function version<R extends Run>(rules: Rules<R>): RulesVersion<BlastAnswer, BlastDetail> {
  const { aimSteps, gaugeSteps, maxSteps } = rules.blastTuning;
  return {
    inputs: z.object({
      aim: z.number().int().min(0).max(aimSteps - 1),
      hold: z.number().int().min(0).max(gaugeSteps - 1),
      taps: z.array(z.number().int().min(0).max(maxSteps)).max(BLAST_TAPS_MAX).refine(rising, 'taps must be whole steps in rising order'),
      pilot: z.enum(rules.blastLooks as [Look, ...Look[]]).nullable().optional(),
    }),
    replay(seed, cast, inputs) {
      const run = rules.replayBlast(seed, cast.filter((look): look is Look => rules.blastLooks.includes(look as Look)), inputs);
      return {
        // As the cafe has always scored it: the tokens of the unrounded distance.
        score: rules.blastTokens(run.x),
        seconds: run.step / rules.BLAST_HZ,
        detail: { meters: rules.blastMeters(run), steps: run.step, end: run.end, pilot: run.pilot, hits: run.hits.length, boosts: run.hits.filter((hit) => hit.outcome === 'boost').length },
      };
    },
  };
}

/** The file of each version's rules, under games/: what resident code is handed as `rules`. */
export const blastRuleFiles = { [v7.BLAST_VERSION]: 'barista-blast/v7.ts', [live.BLAST_VERSION]: 'barista-blast/rules.ts' } as const;

/** Each version's whole rules module, for tools and hosts that need more than the score. */
export const blastRules = { [v7.BLAST_VERSION]: v7, [live.BLAST_VERSION]: live } as const;

export const blastVersions: Readonly<Record<number, RulesVersion<BlastAnswer, BlastDetail>>> = {
  [v7.BLAST_VERSION]: version(v7),
  [live.BLAST_VERSION]: version(live),
};
