import * as current from '../rules.ts';

/**
 * What a replay needs from one version of the rules. An older run is drawn as if it were a run of today's rules: the
 * screen ignores what it does not know, and the distance and the bill come from that version's own rules.
 */
export type BlastRules = Pick<typeof current, 'startBlast' | 'stepBlast' | 'replayBlast' | 'blastTokens' | 'blastMeters'> & { BLAST_VERSION: number };

/** Runs from before rules version 8 have no link to watch them by. */
export const REPLAY_FROM = 8;

/** The frozen rules a page can replay, loaded only when someone watches a run played under them. A new frozen version joins here. */
export const pastRules: Record<number, () => Promise<unknown>> = {
  10: () => import('../v10.ts'),
  9: () => import('../v9.ts'),
  8: () => import('../v8.ts'),
};

/** The rules a run was played under, or null for a version this page cannot play: one from before links, or from a newer page. */
export async function rulesFor(version: number): Promise<BlastRules | null> {
  if (version === current.BLAST_VERSION) return current;
  const load = pastRules[version];
  if (!load) return null;
  try { return await load() as BlastRules; } catch { return null; }
}
