// Every BARISTA HOP!! rules version a run can still be replayed under. A new version: copy rules.ts to v<old>.ts with
// the FROZEN header, add it here, then change rules.ts and raise HOP_VERSION.
import { z } from 'zod';
import type { RulesVersion } from '../kit/play.ts';
import * as live from './rules.ts';

export type HopAnswer = { steer: [number, live.HopSteer][]; taps: number[] };
/** What the cafe keeps of a replayed climb besides its score, the metres climbed. */
export type HopDetail = { meters: number; steps: number; end: live.HopEnd | null; hops: number; tosses: number; rockets: number; cups: number };

/** A climb takes at most this many changes of lean and this many cups' worth of taps: both fit the answer's size limit together. */
export const HOP_STEER_MAX = 2000, HOP_TAPS_MAX = 600;
const rising = (steps: readonly number[]) => steps.every((step, index) => index === 0 || step > steps[index - 1]);

function version(rules: typeof live): RulesVersion<HopAnswer, HopDetail> {
  const step = z.number().int().min(0).max(rules.hopTuning.maxSteps);
  return {
    inputs: z.object({
      steer: z.array(z.tuple([step, z.union([z.literal(-1), z.literal(0), z.literal(1)])])).max(HOP_STEER_MAX).refine(turns => rising(turns.map(turn => turn[0])), 'steer must be [step, -1 | 0 | 1] with steps in rising order'),
      taps: z.array(step).max(HOP_TAPS_MAX).refine(rising, 'taps must be whole steps in rising order'),
    }),
    replay(seed, _cast, inputs) {
      const run = rules.replayHop(seed, inputs);
      return {
        score: rules.hopMeters(run),
        seconds: run.step / rules.HOP_HZ,
        detail: { meters: Math.round(run.top * 100) / 100, steps: run.step, end: run.end, hops: run.hops, tosses: run.tosses, rockets: run.rockets, cups: run.cupsDrunk },
      };
    },
  };
}

/** The file of each version's rules, under games/: what resident code is handed as `rules`. */
export const hopRuleFiles = { [live.HOP_VERSION]: 'barista-hop/rules.ts' } as const;

/** Each version's whole rules module, for tools and hosts that need more than the score. */
export const hopRules = { [live.HOP_VERSION]: live } as const;

export const hopVersions: Readonly<Record<number, RulesVersion<HopAnswer, HopDetail>>> = { [live.HOP_VERSION]: version(live) };
