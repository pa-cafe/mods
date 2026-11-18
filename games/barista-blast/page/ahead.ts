import { BLAST_HZ, blastAhead, blastHitSpan, blastTuning as T, type BlastNode, type BlastRun } from '../rules.ts';
import { moodTone } from './nodes';

const REACH_SECONDS = 2.5, REACH_LEAST = 80, DANGER_SECONDS = 1.5, DANGER_LEAST = 40;
type Tone = ReturnType<typeof moodTone>;
const target = (node: BlastNode) => moodTone(node) === 'good';
const grave = (node: BlastNode) => node.mood === 'bad' && (node.kind === 'claude' || node.kind === 'dots');

type Flight = Pick<BlastRun, 'x' | 'y' | 'vx' | 'vy' | 'sliding'>;
function fly(run: Flight, steps: number, each: (x: number, y: number) => boolean) {
  let { x, y, vx, vy, sliding } = run;
  const dt = 1 / BLAST_HZ;
  for (let step = 0; step < steps; step++) {
    if (sliding) { vx -= T.friction * dt; if (vx < T.stopBelow) return; x += vx * dt; }
    else {
      vy -= T.gravity * dt; vx -= vx * T.drag * dt;
      const square = vx * vx + vy * vy;
      if (square > T.maxSpeed * T.maxSpeed) { const slow = T.maxSpeed / Math.sqrt(square); vx *= slow; vy *= slow; }
      x += vx * dt; y += vy * dt;
      if (y <= 0 && vy < 0) {
        y = 0; vy *= -T.bounceUp; vx *= T.bounceAlong;
        if (vy < T.slideBelow) { vy = 0; sliding = true; }
      }
    }
    if (each(x, y)) return;
  }
}

/** How many metres ahead this arc first meets the street if nothing is hit on the way, or null once the barista is on it. */
export function landingAhead(run: Flight): number | null {
  if (run.sliding || (run.y <= 0 && run.vy <= 0)) return null;
  let landed: number | null = null;
  fly(run, BLAST_HZ * 30, (x, y) => { if (y <= 0) landed = x - run.x; return y <= 0; });
  return landed;
}

/** The first thing this flight will hit if the player does nothing, out of `nodes` (nearest first). Only the first is knowable: a hit changes everything after it. */
export function firstHit(run: Flight, nodes: readonly BlastNode[], reach: number): BlastNode | null {
  let next = 0, hit: BlastNode | null = null;
  fly(run, BLAST_HZ * 6, (x, y) => {
    while (next < nodes.length && x > nodes[next].x + T.reach) next++;
    const node = nodes[next];
    if (!node || x > run.x + reach) return true;
    const [from, to] = blastHitSpan(node);
    if (x >= node.x - T.reach && y >= from && y <= to) { hit = node; return true; }
    return false;
  });
  return hit;
}

type Row = { node: BlastNode; ahead: number; tone: Tone; /** This flight hits it if nothing is pressed. */ hit: boolean; /** A ban or a model at capacity close enough to warn about. */ urgent: boolean };
export type Ahead = {
  /** Metres scanned right now: a row's bar is full at this distance. */
  reach: number;
  /** The next things on the street, nearest first, at most `rows` of them. An urgent one always has a row. */
  next: readonly Row[];
  /** What this flight hits first if nothing is pressed; it may be something the barista is already on top of. */
  hit: BlastNode | null;
  landing: number | null;
  /** The caffeine is full: a tap on anything that is hit turns it into a boost, a ban included. */
  charged: boolean;
  /** Pressing now would pay off: a dive that lands on a resident or the window, or a refill with nothing ahead to bounce off. */
  cue: { dive: boolean; refill: boolean };
};

/** What a press would do this moment: the rules take one on the way down for a refill, and one on the way up, with air under it, for a dive. Nothing while a boost window is open, the run is held, or a glide is on. */
export const blastTap = (run: BlastRun): 'refill' | 'dive' | null => run.end || run.boost || run.frozen || run.glide ? null : run.vy <= 0 ? (run.refills > 0 ? 'refill' : null) : run.step >= run.diveAt && run.y >= T.diveFloor ? 'dive' : null;

/** Everything the HUD shows about the street ahead. Reading ahead does not change the run. A told fortune shows three rows more. */
export function aheadOf(run: BlastRun, rows = 3): Ahead {
  if (run.sight) rows += 3;
  const reach = Math.max(REACH_LEAST, run.vx * REACH_SECONDS), near = blastAhead(run, reach, T.reach), nodes = near.filter(node => node.x > run.x);
  const within = Math.max(DANGER_LEAST, run.vx * DANGER_SECONDS), urgent = (node: BlastNode) => grave(node) && node.x - run.x <= within;
  const idle = !run.boost && !run.frozen && !run.end && !run.glide, hit = run.boost || run.glide ? null : firstHit(run, near, reach);
  const dived = idle && run.vy > 0 && run.step >= run.diveAt && run.y >= T.diveFloor && !(hit && target(hit))
    ? firstHit({ x: run.x, y: run.y, vx: run.vx + T.diveAlong, vy: -T.diveDown, sliding: false }, near, reach) : null;
  const clear = Math.max(2, run.vx * 0.12);
  const refill = idle && run.vy <= 0 && run.y < 1.2 && run.refills > 0 && !nodes.some(node => target(node) && node.x - run.x <= clear);
  const picked = nodes.slice(0, rows), danger = nodes.find(urgent);
  if (danger && !picked.includes(danger)) picked[picked.length - 1] = danger;
  return {
    reach, hit, next: picked.map(node => ({ node, ahead: node.x - run.x, tone: moodTone(node), hit: node === hit, urgent: urgent(node) })),
    landing: landingAhead(run), charged: run.caffeine >= T.caffeine, cue: { dive: dived !== null && target(dived), refill },
  };
}
