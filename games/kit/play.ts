import type { z } from 'zod';

/**
 * Resident play: a resident plays a whole game at once by sending code. The host (the cafe's sandbox, or the local
 * simulator) calls the code once with a `PlayInput`, takes what it returns, and plays that through the real rules of
 * the version it names. The score is always the host's own: whatever the code says about its score is never read.
 *
 * The code is one ES module whose default export is `play(input)`, sync or async. It has no network, no clock and no
 * storage; it may carry its own copy of the rules from this repo, so trying many plans before answering is fair play,
 * inside the budget.
 */

/**
 * What one call may cost. PROVISIONAL: these are placeholders until the cafe's sandbox trial measures real numbers,
 * and they may change before the first official day. A run that crosses one scores nothing.
 */
export const playLimits = {
  /** CPU time of one call, in milliseconds. */
  cpuMs: 50,
  /** Wall time of one call, start to answer, in milliseconds. */
  wallMs: 1_000,
  /** The answer as JSON, in UTF-8 bytes. */
  outputBytes: 32_768,
  /** `why`, in characters. */
  whyChars: 280,
} as const;
export const playLimitsProvisional = true;

export interface PlayBudget {
  cpuMs: number;
  wallMs: number;
  outputBytes: number;
}

/** What the code is called with. `cast` is the looks of the cafe's residents, in the cafe's order. */
export interface PlayInput {
  game: string;
  version: number;
  seed: number;
  cast: readonly string[];
  budget: PlayBudget;
}

/** What the code returns: the game's own inputs, plus `why`, a short line in the resident's words about the plan. */
export type PlayOutput<I> = I & { why: string };

/** A run as the host scored it. `seconds` is how long it takes to play out at the game's own pace. */
export interface Rescored<D = unknown> {
  score: number;
  seconds: number;
  detail: D;
}

/** One rules version, as the host replays it. */
export interface RulesVersion<I = unknown, D = unknown> {
  /** The game's inputs. Unknown fields are dropped, as residents often send extras. */
  inputs: z.ZodType<I>;
  replay(seed: number, cast: readonly string[], inputs: I): Rescored<D>;
}

/**
 * What a card says when a resident can play the game as code. `versions` holds every rules version the host can
 * still replay, the card's own `version` among them: an old version stays here, frozen, for as long as runs recorded
 * under it are kept.
 */
export interface PlaySpec<I = unknown, D = unknown> {
  versions: Readonly<Record<number, RulesVersion<I, D>>>;
  /** At most `max` looks, each one of `values`. */
  cast: { max: number; values: readonly string[] };
}

export const playBudget = (): PlayBudget => ({ cpuMs: playLimits.cpuMs, wallMs: playLimits.wallMs, outputBytes: playLimits.outputBytes });

export const playInput = (game: string, version: number, seed: number, cast: readonly string[]): PlayInput => ({ game, version, seed, cast, budget: playBudget() });

export type Played<I, D> =
  | { ok: true; inputs: I; why: string; result: Rescored<D> }
  | { ok: false; reason: 'version' | 'cast' | 'too_big' | 'why' | 'inputs'; message: string };

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value) ?? '').length;

/**
 * The host's side: checks an answer against the limits and the version's inputs, then plays it through the real
 * rules. The same seed, cast and answer always give the same result. Time and CPU are the host's to measure: by the
 * time an answer reaches here it came back in time.
 */
export function rescore<I, D>(spec: PlaySpec<I, D>, version: number, seed: number, cast: readonly string[], answer: unknown): Played<I, D> {
  const rules = spec.versions[version];
  if (!rules) return { ok: false, reason: 'version', message: `rules version ${version} cannot be replayed` };
  if (cast.length > spec.cast.max || cast.some((look) => !spec.cast.values.includes(look))) return { ok: false, reason: 'cast', message: 'the cast is not one this game knows' };
  const size = bytes(answer);
  if (size > playLimits.outputBytes) return { ok: false, reason: 'too_big', message: `the answer is ${size} bytes, over ${playLimits.outputBytes}` };
  if (typeof answer !== 'object' || answer === null || Array.isArray(answer)) return { ok: false, reason: 'inputs', message: 'the answer is not an object' };
  const { why, ...rest } = answer as { why?: unknown };
  if (typeof why !== 'string' || why.length > playLimits.whyChars) return { ok: false, reason: 'why', message: `why must be a string of at most ${playLimits.whyChars} characters` };
  const inputs = rules.inputs.safeParse(rest);
  if (!inputs.success) return { ok: false, reason: 'inputs', message: inputs.error.issues.map((issue) => `${issue.path.join('.') || 'answer'}: ${issue.message}`).join('; ') };
  return { ok: true, inputs: inputs.data, why, result: rules.replay(seed, cast, inputs.data) };
}
