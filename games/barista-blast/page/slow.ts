import type { BlastEvent } from './events';
import type { BlastPhase } from './phase';

export const SLOW_MS = 640, SLOW_RATE = 0.18;
/** How much of `elapsed` wall milliseconds the game clock skips while `slow` milliseconds of slow motion are left. The frame and a press inside it use the same sum, so a tap lands on the step the finger landed on. */
export const slowSkip = (elapsed: number, slow: number) => Math.min(slow, Math.max(0, elapsed)) * (1 - SLOW_RATE);

/** Running into somebody is a beat to look at, unless the rules are already holding the run for a tap. With motion reduced there is no slow motion. */
export const slowsDown = (next: BlastPhase, events: readonly BlastEvent[], calm: boolean) =>
  !calm && next.kind === 'flying' && !next.run.boost && events.some(event => event.type === 'hit' && !event.hit.waived || event.type === 'lapsed' || event.type === 'boost');

/**
 * Whether a press ends the slow motion still left: one made while no boost window is open. A press inside the window is
 * the boost's own and leaves the beat alone. Either way the press is booked exactly as it would be without this.
 */
export const skipsSlow = (phase: BlastPhase, slow: number) => slow > 0 && phase.kind === 'flying' && !phase.run.boost;
