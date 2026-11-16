// The local simulator: plays a resident's bot module against a game's real rules, the way the cafe's sandbox does,
// and scores each run with the same `rescore` the cafe uses. The score it prints is the score the cafe would record.
// Time and CPU are measured on this machine, so they are a guide to the cafe's limits, not a promise.
import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { gameCards } from '../games/index.ts';
import type { GameCard } from '../games/kit/game.ts';
import { playInput, playLimits, rescore } from '../games/kit/play.ts';

export interface SimOptions {
  game: string;
  /** Path to the bot module. */
  bot: string;
  /** The first seed; run n plays seed + n. */
  seed?: number;
  runs?: number;
  /** Rules version, the card's own when left out. */
  version?: number;
  /** Looks of the cafe's residents, every look the game knows when left out. */
  cast?: readonly string[];
  /** False skips the CPU and time limits, for tuning with slow bots. The answer size is checked either way. */
  limits?: boolean;
}

export interface SimRun {
  seed: number;
  /** The score the cafe would record: 0 for a run it would not score. */
  score: number;
  ok: boolean;
  reason?: string;
  message?: string;
  why?: string;
  seconds?: number;
  detail?: unknown;
  /** Loading the module plus the call, as the sandbox counts a fresh start. */
  cpuMs: number;
  wallMs: number;
}

type Reply = { ready?: true; answer?: unknown; error?: string; cpuMs?: number; wallMs?: number; load: { cpuMs: number; wallMs: number } };

export function playableCard(game: string): GameCard & Required<Pick<GameCard, 'play'>> {
  const card = (gameCards as Record<string, GameCard>)[game];
  if (!card) throw new Error(`no game "${game}": try ${Object.keys(gameCards).join(', ')}`);
  if (!card.play) throw new Error(`${game} cannot be played as code`);
  return card as GameCard & Required<Pick<GameCard, 'play'>>;
}

/** One thread for the bot, loaded once. A call that runs past the wall time ends the thread, and the next call starts a new one. */
function botThread(bot: string) {
  let worker: Worker | null = null, ready: Promise<Reply> | null = null;
  const start = () => {
    worker = new Worker(new URL('./play-worker.ts', import.meta.url), { workerData: { bot: resolve(bot) } });
    ready = new Promise((done, fail) => { worker!.once('message', done); worker!.once('error', fail); });
  };
  return {
    async call(input: unknown, wallMs: number): Promise<Reply | 'timeout'> {
      if (!worker) start();
      const { load } = await ready!;
      const answer = new Promise<Reply>((done, fail) => { worker!.once('message', done); worker!.once('error', fail); });
      worker!.postMessage(input);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const late = new Promise<'timeout'>((done) => { timer = setTimeout(() => done('timeout'), Math.max(1, wallMs - load.wallMs)); });
      const reply = await Promise.race([answer, late]);
      clearTimeout(timer);
      if (reply === 'timeout') { await worker!.terminate(); worker = null; }
      return reply;
    },
    close: () => worker?.terminate(),
  };
}

export async function simulate(options: SimOptions, onRun?: (run: SimRun) => void): Promise<SimRun[]> {
  const card = playableCard(options.game), play = card.play;
  const version = options.version ?? card.version, cast = options.cast ?? play.cast.values.slice(0, play.cast.max);
  const limited = options.limits !== false, firstSeed = options.seed ?? 1, runs = options.runs ?? 1;
  if (!play.versions[version]) throw new Error(`${card.id} has no rules version ${version}: try ${Object.keys(play.versions).join(', ')}`);
  const thread = botThread(options.bot), played: SimRun[] = [];
  try {
    for (let index = 0; index < runs; index++) {
      const seed = firstSeed + index, input = playInput(card.id, version, seed, cast);
      const reply = await thread.call(input, limited ? playLimits.wallMs : 60_000);
      let run: SimRun;
      if (reply === 'timeout') run = { seed, score: 0, ok: false, reason: 'wall', message: `no answer within ${limited ? playLimits.wallMs : 60_000} ms`, cpuMs: NaN, wallMs: NaN };
      else {
        const cpuMs = reply.load.cpuMs + (reply.cpuMs ?? 0), wallMs = reply.load.wallMs + (reply.wallMs ?? 0);
        if (reply.error) run = { seed, score: 0, ok: false, reason: 'error', message: reply.error, cpuMs, wallMs };
        else if (limited && cpuMs > playLimits.cpuMs) run = { seed, score: 0, ok: false, reason: 'cpu', message: `${cpuMs.toFixed(1)} ms of CPU, over ${playLimits.cpuMs}`, cpuMs, wallMs };
        else if (limited && wallMs > playLimits.wallMs) run = { seed, score: 0, ok: false, reason: 'wall', message: `${wallMs.toFixed(0)} ms, over ${playLimits.wallMs}`, cpuMs, wallMs };
        else {
          const scored = rescore(play, version, seed, cast, reply.answer);
          run = scored.ok
            ? { seed, score: scored.result.score, ok: true, why: scored.why, seconds: scored.result.seconds, detail: scored.result.detail, cpuMs, wallMs }
            : { seed, score: 0, ok: false, reason: scored.reason, message: scored.message, cpuMs, wallMs };
        }
      }
      played.push(run);
      onRun?.(run);
    }
  } finally {
    await thread.close();
  }
  return played;
}

/** Scores across runs, failed runs counted as 0. */
export function summarize(runs: readonly SimRun[]) {
  const scores = runs.map((run) => run.score).sort((a, b) => a - b), at = (share: number) => scores[Math.min(scores.length - 1, Math.floor(scores.length * share))];
  return {
    runs: runs.length,
    failed: runs.filter((run) => !run.ok).length,
    mean: scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length),
    median: at(0.5), p95: at(0.95), best: scores.at(-1) ?? 0,
    cpuMs: Math.max(0, ...runs.map((run) => run.cpuMs).filter(Number.isFinite)),
  };
}
