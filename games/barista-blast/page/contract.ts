// What the game takes from the cafe and hands back to it. The cafe's page and Worker read these too, so a field means
// the same on both sides; the cafe keeps its own schemas for what crosses the network and checks they fit these.
import { z } from 'zod';
import { blastLooks, blastTuning, type BlastLook } from '../rules.ts';
import { BLAST_TAPS_MAX } from '../versions.ts';

/** The game's card id, and where the cafe opens it: `/@<handle>?game=barista-blast`, the cafe's share page address. */
export const BLAST_GAME = 'barista-blast';
export const blastPagePath = (handle: string) => `/@${handle}?game=${BLAST_GAME}`;
/** At most this many of a cafe's residents stand on its street. */
export const BLAST_CAST_MAX = 12;

/** One person on the street: `art` is their own full-body picture and `face` their portrait, where they uploaded them; else the game draws `look`. */
export type BlastFigure = { name: string | null; look: BlastLook; art?: string; face?: string };
/** The cafe a street belongs to: its barista flies, and its residents stand along the way. */
export type BlastStageCafe = { barista: BlastFigure; residents: readonly BlastFigure[] };

const rising = (taps: readonly number[]) => taps.every((tap, index) => index === 0 || tap > taps[index - 1]);
/** What the player did in a run. The nozzle and the gauge swing in a loop, so both are sent as steps into their loop. */
export const blastInputsSchema = z.strictObject({
  aim: z.number().int().min(0).max(blastTuning.aimSteps - 1),
  hold: z.number().int().min(0).max(blastTuning.gaugeSteps - 1),
  taps: z.array(z.number().int().min(0).max(blastTuning.maxSteps)).max(BLAST_TAPS_MAX).refine(rising),
  /** Who was launched, when it was not the cafe's own barista: she is missing from that run's street and brings her trait. */
  pilot: z.enum(blastLooks).optional(),
});
/** A run offered for the board: the cafe's ticket for it and what the player did. The cafe plays it again and takes the score from that. */
export const blastProofSchema = z.strictObject({ token: z.string().min(1).max(600), inputs: blastInputsSchema });
export type BlastProof = z.infer<typeof blastProofSchema>;

/** One finished run as the game reports it. `wall` is what a page from before rules version 4 says for a run that ended at the capacity wall. */
export type BlastRunReport = { tokens: number; ms: number; residents: number; boosts: number; end: 'stopped' | 'banned' | 'wall' | 'timeout'; record: boolean };

/** One run the cafe will vouch for: the seed to play on and its signed ticket. The game only carries the ticket. */
export type BlastTicket = { seed: number; token: string };
/** The cafe's tickets for this page: the next seed to play, and the ticket that goes with a seed. */
export type TicketBook = { next(): BlastTicket | null; tokenOf(seed: number): string | null };
