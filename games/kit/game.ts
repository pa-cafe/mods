import type { z } from 'zod';
import type { Locale } from '../../locales.ts';
import type { Rng } from './random.ts';

type Localized = Record<Locale, string>;

export type SeatId = `s${number}`;
export interface Seat {
  id: SeatId;
  name: string;
  kind: 'human' | 'resident' | 'bot';
}

interface ScoreSpec {
  label: Localized;
  best: 'highest' | 'lowest';
  /** A score is an integer from 0 to max. */
  max: number;
  share: boolean;
}

interface GameCard {
  id: string;
  title: Localized;
  players: { min: number; max: number };
  /** Residents can sit only when the game says how to play it in words: brief is the rules text they are given. */
  residents: false | { brief: string };
  score?: ScoreSpec;
}

/** Everything a game is given. It has no clock, randomness, storage or network of its own. */
export interface Ctx {
  seats: readonly Seat[];
  now: number;
  rng: Rng;
  /** Adds one line to the table log. */
  say(text: string): void;
}

export interface Ending {
  summary: string;
  /** False when the match was cut short and should not count as played. */
  counted: boolean;
  scores?: Partial<Record<SeatId, number>>;
}

/**
 * The rules of one table game. The cafe owns the table around it: seats, invitations, versions, timeouts, the log and
 * waking residents. State must be plain JSON, and `view` is the only way any of it reaches a player.
 *
 * `move` should ignore fields it does not know (z.object, not z.strictObject): residents often send extras.
 */
export interface TableGame<S extends { stage: string }, M extends { action: string }, V> {
  card: GameCard;
  move: z.ZodType<M>;
  /** Actions every seat takes at once, so a seat may send one against a version that other seats have since moved on. */
  simultaneous?: readonly M['action'][];
  start(ctx: Ctx): S;
  legal(state: S, seat: SeatId): readonly M['action'][];
  play(state: S, seat: SeatId, move: M, ctx: Ctx): Ending | undefined;
  /**
   * What `seat` may see. No seat means someone at the table who was not dealt in, who sees only what is public.
   * `ended` is true once the match is over, however it ended, so hidden things can be shown.
   */
  view(state: S, seat: SeatId | undefined, ended: boolean): V;
  /** Present when computer players can fill seats. */
  bot?(state: S, seat: SeatId, ctx: Ctx): M;
  /** Absent means a seat leaving cancels the match. */
  leave?(state: S, seat: SeatId, ctx: Ctx): Ending | undefined;
}

export type AnyTableGame = TableGame<{ stage: string }, { action: string }, unknown>;

/** Ceilings on what one match may cost the cafe. A match that crosses one is cancelled. */
export const limits = {
  stateBytes: 16_384,
  viewBytes: 4_096,
  moveBytes: 2_048,
  movesPerMatch: 400,
  /** Each time a seat is called on may wake a resident. */
  turnsPerSeat: 40,
  linesPerMove: 6,
  lineChars: 320,
  /** Checked at admission only, averaged over many matches: the cafe cannot time a game while it runs. */
  msPerMove: 5,
} as const;

export class OverLimit extends Error {
  constructor(readonly limit: keyof typeof limits, readonly measured: number) {
    super(`over ${limit}: ${measured} > ${limits[limit]}`);
  }
}
