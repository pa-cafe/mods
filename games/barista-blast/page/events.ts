import { blastTokens, type BlastHit, type BlastRun } from '../rules.ts';

type BlastGlance = Readonly<{ hits: number; refills: number; diveAt: number; boost: BlastHit | null; held: boolean; x: number; y: number; vy: number; speed: number; ended: boolean }>;

export type BlastEvent =
  /** `held`: the bar was full and what the hit does is waiting for the boost window to close. */
  | { type: 'hit'; hit: BlastHit; from: number; to: number; held?: true }
  | { type: 'boost'; hit: BlastHit }
  /** The window closed with no tap, and what a held hit does has just happened. */
  | { type: 'lapsed'; hit: BlastHit; from: number; to: number }
  | { type: 'refill' }
  | { type: 'refilled' }
  | { type: 'dive' }
  | { type: 'land'; x: number; impact: number }
  | { type: 'milestone'; tokens: number }
  | { type: 'end'; end: NonNullable<BlastRun['end']> };

const speedOf = (run: BlastRun) => Math.sqrt(run.vx * run.vx + run.vy * run.vy);

export const glance = (run: BlastRun): BlastGlance => ({
  hits: run.hits.length, refills: run.refills, diveAt: run.diveAt, boost: run.boost?.hit ?? null, held: run.boost?.held !== undefined, x: run.x, y: run.y, vy: run.vy, speed: speedOf(run), ended: run.end !== null,
});

/** What one step did, read off the run before and after it. `milestones` are token counts in rising order. */
export function blastEvents(before: BlastGlance, run: BlastRun, milestones: readonly number[]): BlastEvent[] {
  const events: BlastEvent[] = [];
  if (before.boost && before.boost.outcome === 'boost' && run.boost?.hit !== before.boost) events.push({ type: 'boost', hit: before.boost });
  const lapsed = before.boost && before.held && before.boost.outcome !== 'boost' && run.boost?.hit !== before.boost ? before.boost : null;
  if (lapsed) events.push({ type: 'lapsed', hit: lapsed, from: before.speed, to: speedOf(run) });
  const fresh = run.hits.slice(before.hits);
  for (const hit of fresh) events.push({ type: 'hit', hit, from: before.speed, to: speedOf(run), ...(run.boost?.hit === hit && run.boost.held ? { held: true as const } : {}) });
  const taken = lapsed?.mood === 'bad' || fresh.some(hit => hit.mood === 'bad');
  if (run.refills === before.refills - 1 && !taken) events.push({ type: 'refill' });
  else if (run.refills > before.refills) events.push({ type: 'refilled' });
  if (run.diveAt !== before.diveAt) events.push({ type: 'dive' });
  if (before.y > 0 && run.y === 0) events.push({ type: 'land', x: run.x, impact: -before.vy });
  const was = blastTokens(before.x), now = blastTokens(run.x);
  for (const tokens of milestones) if (was < tokens && now >= tokens) events.push({ type: 'milestone', tokens });
  if (!before.ended && run.end) events.push({ type: 'end', end: run.end });
  return events;
}
