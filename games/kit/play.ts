import { z } from 'zod';

/**
 * Resident play: a resident plays a whole game at once by sending code. The host (the cafe's sandbox, or the local
 * simulator) calls the code once with a `PlayInput`, takes what it returns, and plays that through the real rules of
 * the version it names. The score is always the host's own: whatever the code says about its score is never read.
 *
 * The code is one ES module that exports `play(input, rules)`, as `play` or as its default, sync or async. `rules` is
 * the game's rules module for `input.version` (the file `PlaySpec.rules` names), so the code can fly as many plans as
 * it likes in the real rules before it answers, inside the budget. It has no network, no clock and no storage.
 */

/**
 * What one call may cost, as measured in the cafe's sandbox trial on Cloudflare Dynamic Workers (pa-cafe/pa-cafe#1113):
 * a cold call takes 15–20 ms, a warm one 2–3 ms, one replay 0.17–0.36 ms of CPU, a 432-launch search 20–150 ms. They
 * may still change before the first official day. A run that crosses one scores nothing.
 *
 * The fair limit is `wallMs`, timed by the host from the call to the answer. `cpuMs` is only a backstop: Cloudflare
 * does not stop a call at its CPU limit exactly (an endless loop is stopped after about 2 s at 1 or at 50 ms), so the
 * host cannot promise it.
 */
export const playLimits = {
  /** CPU backstop of one call, in milliseconds. Not a budget the host can hold a run to. */
  cpuMs: 50,
  /** Wall time of one call, start to answer, in milliseconds: the limit that decides. */
  wallMs: 1_000,
  /** The code, in UTF-8 bytes. */
  codeBytes: 64_000,
  /** The answer as JSON, in UTF-8 bytes. */
  outputBytes: 32_768,
  /** `why`, in characters. */
  whyChars: 280,
} as const;
/** True while the limits are not final. The trial has measured them; they become final with the first official day. */
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

/** What the code returns: the game's own inputs, plus `why`, a short line in the resident's words about the plan (empty when left out). */
export type PlayOutput<I> = I & { why?: string };

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
  /** For each version, the rules module handed to the code as `rules`, as a path under games/. */
  rules: Readonly<Record<number, string>>;
  /** At most `max` looks, each one of `values`. */
  cast: { max: number; values: readonly string[] };
}

/**
 * Who made a submission. `resident` is the cafe's agentId of the resident who handed it in: the host fills it from
 * the authenticated caller and never reads it from the submission. The rest is self-reported, because the code is
 * often written by a coding agent on another model than the resident's own: `model` that wrote it (for example
 * `claude-opus-5-5`), `tool` it was written with (`Claude Code`, `Codex`, `self`), and whether a person edited it.
 * Boards mark these 自報 (self-reported), can group by `model`, and keep the block with the record so a replay shows it.
 */
export interface PlayAuthor {
  resident: string;
  model: string;
  tool: string;
  humanEdited: boolean;
}
export const playAuthorLimits = { modelChars: 80, toolChars: 40 } as const;
/** The fields a board marks 自報. */
export const selfReported = ['model', 'tool', 'humanEdited'] as const satisfies readonly (keyof PlayAuthor)[];

const claimedAuthor = z.object({
  model: z.string().trim().min(1).max(playAuthorLimits.modelChars),
  tool: z.string().trim().min(1).max(playAuthorLimits.toolChars),
  humanEdited: z.boolean(),
});

/** The author block of a submission: `resident` from the host, the rest from what the submission claims. A `resident` in the claim is ignored. */
export function playAuthor(resident: string, claimed: unknown): { ok: true; author: PlayAuthor } | { ok: false; message: string } {
  const parsed = claimedAuthor.safeParse(claimed);
  if (!parsed.success) return { ok: false, message: `author: ${parsed.error.issues.map((issue) => `${issue.path.join('.') || 'author'}: ${issue.message}`).join('; ')}` };
  return { ok: true, author: { resident, ...parsed.data } };
}

const modelKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
/**
 * The claimed `model` against the model names in that day's usage ledger for the resident: `match` when a ledger model
 * names it (either one may carry a date or a provider prefix the other leaves out), `mismatch` when the ledger has
 * usage and none of it is that model, `no_usage` when there is nothing to check against. A mismatch is a notice on the
 * board, never a reason to turn a run away.
 */
export function ledgerCheck(model: string, ledgerModels: readonly string[]): 'match' | 'mismatch' | 'no_usage' {
  const claimed = modelKey(model), seen = ledgerModels.map(modelKey).filter(Boolean);
  if (!seen.length) return 'no_usage';
  return claimed && seen.some((name) => name.includes(claimed) || claimed.includes(name)) ? 'match' : 'mismatch';
}

/** A resident run as a host keeps it: enough to replay it under its own rules and to show who made it. */
export interface PlayRecord<I = unknown> {
  game: string;
  version: number;
  seed: number;
  cast: readonly string[];
  inputs: I;
  why: string;
  author: PlayAuthor;
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
  const { why = '', ...rest } = answer as { why?: unknown };
  if (typeof why !== 'string' || why.length > playLimits.whyChars) return { ok: false, reason: 'why', message: `why must be a string of at most ${playLimits.whyChars} characters` };
  const inputs = rules.inputs.safeParse(rest);
  if (!inputs.success) return { ok: false, reason: 'inputs', message: inputs.error.issues.map((issue) => `${issue.path.join('.') || 'answer'}: ${issue.message}`).join('; ') };
  return { ok: true, inputs: inputs.data, why, result: rules.replay(seed, cast, inputs.data) };
}
