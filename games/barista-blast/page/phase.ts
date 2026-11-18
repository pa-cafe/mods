import { BLAST_HZ, blastLooks, startBlast, stepBlast, type BlastInputs, type BlastLook, type BlastPilot, type BlastRun } from '../rules.ts';
import { blastEvents, glance, type BlastEvent } from './events';
import type { BlastRules } from './rules-past';

export const STEP_MS = 1000 / BLAST_HZ;
const CATCH_UP = 30;
type Cast = readonly BlastLook[];

/** `cast` is the cafe's residents as the street draws them, the same for every run on the page. `pilot` is who the player chose to launch: null is the cafe's own barista. */
/** `rules` is the version a replay plays under, when it is not today's. */
/** `tour` marks the first-play tour's demo run, which is never scored or kept. */
export type BlastPhase = { cast: Cast; pilot: BlastPilot; rules?: BlastRules; tour?: true } & (
  /** The nozzle swings; `street` is the run's street drawn from the seed alone, to show what lies ahead before launch. */
  | { kind: 'aiming'; seed: number; since: number; street: BlastRun }
  /** The angle is set; the gauge runs from `pressed`. */
  | { kind: 'charging'; seed: number; since: number; street: BlastRun; aim: number; pressed: number }
  /**
   * Step 0 began at game time `origin`; `queued` are steps a tap is waiting for, `inputs` everything the run has used.
   * `played` marks a shared run playing back: its taps are fixed steps of the run, not moments on this screen.
   */
  | { kind: 'flying'; seed: number; run: BlastRun; origin: number; queued: number[]; played?: true; inputs: { aim: number; hold: number; taps: number[]; pilot?: BlastPilot } }
  | { kind: 'result'; seed: number; run: BlastRun; inputs: BlastInputs; at: number });

const stepsBetween = (from: number, to: number) => Math.max(0, Math.floor((to - from) / STEP_MS));

export const aimingPhase = (seed: number, at: number, cast: Cast = blastLooks, pilot: BlastPilot = null, rules?: BlastRules): BlastPhase => ({ kind: 'aiming', cast, pilot, ...(rules ? { rules } : {}), seed, since: at, street: (rules?.startBlast ?? startBlast)(seed, cast, 0, 0, pilot) });

/** Another pilot, chosen before the launch: the same street is drawn again without her on it. The nozzle keeps swinging from where it was. */
export const pickBlast = (phase: BlastPhase, pilot: BlastPilot): BlastPhase => phase.kind === 'aiming' ? { ...aimingPhase(phase.seed, phase.since, phase.cast, pilot, phase.rules) } : phase;

/** How far the nozzle has swung, in steps, at game time `at`. */
export const aimStep = (phase: BlastPhase, at: number) => phase.kind === 'charging' ? phase.aim : phase.kind === 'aiming' ? stepsBetween(phase.since, at) : 0;
/** How long the gauge has run, in steps. */
export const holdStep = (phase: BlastPhase, at: number) => phase.kind === 'charging' ? stepsBetween(phase.pressed, at) : 0;

/** A finger down or Space down at game time `at`. In flight it books a tap for the first step that starts at or after it. */
export function pressBlast(phase: BlastPhase, at: number): BlastPhase {
  if (phase.kind === 'aiming') return { ...phase, kind: 'charging', aim: aimStep(phase, at), pressed: at };
  if (phase.kind !== 'flying') return phase;
  const last = phase.queued.at(-1) ?? phase.inputs.taps.at(-1) ?? -1;
  phase.queued.push(Math.max(phase.run.step, last + 1, Math.ceil((at - phase.origin) / STEP_MS)));
  return phase;
}

export function releaseBlast(phase: BlastPhase, at: number): BlastPhase {
  if (phase.kind !== 'charging') return phase;
  const hold = holdStep(phase, at);
  return { kind: 'flying', cast: phase.cast, pilot: phase.pilot, ...(phase.rules ? { rules: phase.rules } : {}), ...(phase.tour ? { tour: true } : {}), seed: phase.seed, run: (phase.rules?.startBlast ?? startBlast)(phase.seed, phase.cast, phase.aim, hold, phase.pilot), origin: at, queued: [], inputs: { aim: phase.aim, hold, taps: [], ...(phase.pilot ? { pilot: phase.pilot } : {}) } };
}

/**
 * Runs every step due by game time `now` and reports what happened. A stall longer than CATCH_UP steps moves the
 * origin forward, so the run resumes where it was instead of fast-forwarding.
 */
export function advanceBlast(phase: BlastPhase, now: number, milestones: readonly number[]): { phase: BlastPhase; events: BlastEvent[] } {
  if (phase.kind !== 'flying') return { phase, events: [] };
  const { run, queued, inputs } = phase, events: BlastEvent[] = [], step = phase.rules?.stepBlast ?? stepBlast;
  let due = stepsBetween(phase.origin, now) + 1;
  if (due - run.step > CATCH_UP) {
    const dropped = due - run.step - CATCH_UP;
    phase.origin += dropped * STEP_MS; due = run.step + CATCH_UP;
    if (!phase.played) for (let index = 0; index < queued.length; index++) queued[index] = Math.max(run.step + index, queued[index] - dropped);
  }
  while (run.step < due && !run.end) {
    while (queued.length && queued[0] < run.step) queued.shift();
    const tap = queued[0] === run.step;
    if (tap) inputs.taps.push(queued.shift()!);
    const before = glance(run);
    step(run, tap);
    events.push(...blastEvents(before, run, milestones));
  }
  if (!run.end) return { phase, events };
  return { phase: { kind: 'result', cast: phase.cast, pilot: phase.pilot, ...(phase.rules ? { rules: phase.rules } : {}), ...(phase.tour ? { tour: true } : {}), seed: phase.seed, run, inputs, at: now }, events };
}
