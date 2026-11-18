import type { BlastLook } from '../rules.ts';
import { CREAM, houseFont, INK } from './art';
import { hudRow, hudScale } from './hud';
import { STEP_MS, type BlastPhase } from './phase';

export const TOUR = 'barista-blast-tour';

export type TourStep = 'aim' | 'release' | 'caffeine' | 'boost' | 'refill' | 'dive';
/** What the beat waits for: a press, a finger let go, a tap the run takes, or a tap that only says "go on". */
type Act = 'press' | 'release' | 'tap' | 'look';
type Beat = { step: TourStep; act: Act; /** Nozzle steps for `press`, gauge steps for `release`, the run's steps in flight. */ at: number };

/**
 * The demo run. Seed 1325 with nobody of the cafe's on the street, launched at nozzle step 54 and gauge step 46, was
 * picked by flying the street in the rules of version 10 with scripted taps: a resident who helps at 2.6 s, the caffeine
 * bar full at 4.7 s, the boost at 6.2 s, a fall that wants a cup at 9.5 s and a dive onto a resident who helps at
 * 12.0 s, two to three seconds apart, and the run slides to a stop at 17.6 s with nothing that hurts before the dive.
 * tests/barista-blast-tour.test.ts plays it with the rules to check every beat still lands, so a change to the rules
 * that moves one fails there.
 */
export const TOUR_RUN = {
  seed: 1325, cast: [] as readonly BlastLook[],
  beats: [
    { step: 'aim', act: 'press', at: 54 },
    { step: 'release', act: 'release', at: 46 },
    { step: 'caffeine', act: 'look', at: 558 },
    { step: 'boost', act: 'tap', at: 746 },
    { step: 'refill', act: 'tap', at: 1142 },
    { step: 'dive', act: 'tap', at: 1439 },
  ] as const satisfies readonly Beat[],
};

const LEAD_MS = 300, LEAD_RATE = 0.3;
export const TOUR_WAIT_MS = 4000;

/**
 * `on` while the tour is showing. `beat` is the next beat; `waited` the wall time it has stood still so far; `ready` says
 * the player already did what it asks, and `letGo` that they also let go before the launch beat came.
 */
type Tour = { on: boolean; beat: number; waited: number; ready: boolean; letGo: boolean };
export const startTour = (on: boolean): Tour => ({ on, beat: 0, waited: 0, ready: false, letGo: false });
/** The beat in hand: a `tap` is booked on the run at its step, the others move the phase. */
export const beatOf = (tour: Tour): Beat | null => tour.on ? TOUR_RUN.beats[tour.beat] ?? null : null;

/** The game time the next beat stops the run at, when it is due in this phase. */
export function beatAt(tour: Tour, phase: BlastPhase): number | null {
  const beat = beatOf(tour);
  if (!beat) return null;
  if (beat.act === 'press') return phase.kind === 'aiming' ? phase.since + (beat.at + 0.5) * STEP_MS : null;
  if (beat.act === 'release') return phase.kind === 'charging' ? phase.pressed + (beat.at + 0.5) * STEP_MS : null;
  return phase.kind === 'flying' ? phase.origin + (beat.at - 0.5) * STEP_MS : null;
}

/** The share of its speed the run moves at `now`: full, slowing into a beat, or stopped on it. */
export function tourRate(tour: Tour, phase: BlastPhase, now: number): number {
  const at = beatAt(tour, phase);
  return at === null || now < at - LEAD_MS ? 1 : now < at ? LEAD_RATE : 0;
}

/**
 * What the tour shows at `now`. Launching shows its notes all along; in the air a note goes up once the run stands on
 * its beat, so it never names a moment that has not come yet (a full bar a step before the hit that fills it).
 */
export function tourStep(tour: Tour, phase: BlastPhase, now: number): TourStep | null {
  const beat = beatOf(tour), at = beatAt(tour, phase);
  if (!beat || at === null) return null;
  return beat.act === 'press' || beat.act === 'release' || now >= at - 0.01 ? beat.step : null;
}

/** The player pressed (`down`) or let go: the beat counts as done once it stops. A press before its beat is kept for it. */
export function tourHand(tour: Tour, phase: BlastPhase, now: number, down: boolean) {
  const beat = beatOf(tour);
  if (!beat) return;
  if (!down) { if (beat.act === 'release') tour.ready = true; else if (beat.act === 'press' && tour.ready) tour.letGo = true; return; }
  if (beat.act !== 'release' && tourStep(tour, phase, now) === beat.step) tour.ready = true;
}

/** Wall time standing on the beat. True once the beat should be done: the player did it, or waited too long. */
export function tourWait(tour: Tour, ms: number) {
  tour.waited += ms;
  return tour.ready || tour.waited >= TOUR_WAIT_MS;
}

/** The beat is done: on to the next. A finger let go before the launch beat came lets the barista go at once. */
export function nextBeat(tour: Tour) {
  const letGo = tour.letGo && beatOf(tour)?.act === 'press';
  tour.beat++; tour.waited = 0; tour.ready = letGo; tour.letGo = false;
}

type TourWords = Record<TourStep, string> & { go: string };
/** Where the screen's parts are this frame: the machine's nozzle while aiming, the barista in flight. Null where unknown. */
type TourSpots = { machine: { x: number; y: number; r: number } | null; flyer: { x: number; y: number; r: number } | null };
type Place = { width: number; height: number; calm: boolean; mouse: boolean };
type Hole = { x: number; y: number; w: number; h: number; r: number };

function spotlight(ctx: CanvasRenderingContext2D, width: number, height: number, hole: Hole, calm: boolean, now: number) {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.roundRect(hole.x, hole.y, hole.w, hole.h, hole.r);
  ctx.fillStyle = 'rgba(28,16,38,.58)'; ctx.fill('evenodd');
  const beat = calm ? 0.5 : 0.5 + 0.5 * Math.sin(now / 220);
  ctx.beginPath(); ctx.roundRect(hole.x, hole.y, hole.w, hole.h, hole.r); ctx.lineWidth = 4 + 2 * beat; ctx.strokeStyle = '#FFC83D'; ctx.stroke();
  ctx.restore();
}
const around = (x: number, y: number, r: number): Hole => ({ x: x - r, y: y - r, w: r * 2, h: r * 2, r });

function finger(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.font = `${Math.round(size * 1.25)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('👆', x + size * 0.05, y);
  ctx.restore();
}

function mouse(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, pressed: boolean) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 40, size / 40);
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(-14, 0, 28, 42, 14); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
  if (pressed) { ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 16); ctx.lineTo(-13, 16); ctx.quadraticCurveTo(-13, 1.5, 0, 1.5); ctx.fillStyle = '#FFC83D'; ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 16); ctx.moveTo(-14, 16); ctx.lineTo(14, 16); ctx.stroke();
  ctx.restore();
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  ctx.save(); ctx.globalAlpha = 1 - t; ctx.beginPath(); ctx.arc(x, y, r * (0.4 + t), 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = '#FFC83D'; ctx.stroke(); ctx.restore();
}

function tapping(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, place: Place, now: number) {
  const beat = place.calm ? 0 : Math.abs(Math.sin(now / 160));
  if (!place.calm) ring(ctx, x, y, 30 * r, (now % 600) / 600);
  if (place.mouse) mouse(ctx, x, y - 4 * r + beat * 4 * r, 40 * r, beat > 0.5);
  else finger(ctx, x, y + beat * 10 * r, 48 * r, 1);
}

function note(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill = CREAM, ink = INK) {
  ctx.font = `900 ${size}px ${houseFont()}`;
  const w = ctx.measureText(text).width + size * 2, h = size * 2.4;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
  return w;
}

function noteBy(ctx: CanvasRenderingContext2D, text: string, hole: Hole, width: number, height: number, size: number, fill = CREAM) {
  ctx.font = `900 ${size}px ${houseFont()}`;
  const half = (ctx.measureText(text).width + size * 2) / 2, tall = size * 2.4, gap = 14;
  const below = hole.y + hole.h + gap + tall / 2, above = hole.y - gap - tall / 2;
  const y = below + tall / 2 < height - 8 && (above - tall / 2 < 8 || hole.y + hole.h / 2 < height * 0.5) ? below : above;
  const x = Math.min(width - 10 - half, Math.max(10 + half, hole.x + hole.w / 2));
  note(ctx, text, x, y, size, fill);
}

export function drawTour(ctx: CanvasRenderingContext2D, step: TourStep | null, place: Place, words: TourWords, now: number, spots: TourSpots) {
  if (!step) return;
  const { width, height, calm } = place, k = hudScale({ width, height }), r = Math.max(k, 0.75), size = 18 * Math.max(k, 0.85);
  ctx.save(); ctx.lineJoin = 'round';
  const row = hudRow({ width, height }), { cups, caffeine } = row;
  if (step === 'aim') {
    const spot = spots.machine ?? { x: width / 2, y: height * 0.62, r: Math.min(width, height) * 0.2 };
    const hole = around(spot.x, spot.y, spot.r);
    spotlight(ctx, width, height, hole, calm, now);
    const t = calm ? 0.5 : (now % 1800) / 1800, down = t > 0.15 && t < 0.75, px = Math.min(width - 40 * r, hole.x + hole.w + 26 * r), py = hole.y + hole.h * 0.62;
    if (down && !calm) ring(ctx, px, py, 26 * r, ((t - 0.15) / 0.6) % 1);
    if (place.mouse) mouse(ctx, px, py - 6 * r + (down ? 3 * r : 0), 40 * r, down);
    else finger(ctx, px + 6 * r, py + (down ? 0 : 12 * r), 44 * r, 0.95);
    noteBy(ctx, words.aim, hole, width, height, size);
  } else if (step === 'release') {
    const w = 50 * r, gx = width - w - 18 * r, gy = height * 0.24, hole = { x: gx - 8 * r, y: gy - 8 * r, w: w + 16 * r, h: 176 * r + 42 * r, r: 30 * r };
    spotlight(ctx, width, height, hole, calm, now);
    ctx.font = `900 ${size}px ${houseFont()}`;
    const half = (ctx.measureText(words.release).width + size * 2) / 2, x = Math.max(12 + half, hole.x - 18 * r - half), y = gy + 88 * r;
    note(ctx, words.release, x, y, size);
    ctx.beginPath(); ctx.moveTo(x + half + 2, y - 9 * r); ctx.lineTo(hole.x - 4 * r, y); ctx.lineTo(x + half + 2, y + 9 * r); ctx.closePath(); ctx.fillStyle = INK; ctx.fill();
  } else if (step === 'boost') {
    const spot = spots.flyer ?? { x: width / 2, y: height * 0.44, r: 70 * r }, hole = around(spot.x, spot.y, spot.r);
    spotlight(ctx, width, height, hole, calm, now);
    tapping(ctx, Math.min(width - 30 * r, hole.x + hole.w + 20 * r), spot.y, r, place, now);
    noteBy(ctx, words.boost, hole, width, height, size * 1.3, '#FFC83D');
  } else {
    const s = row.k, hole = step === 'dive' ? around(cups.x + 204 * s, cups.y + 27 * s, 30 * s)
      : step === 'refill' ? { x: cups.x - 4 * s, y: cups.y - 4 * s, w: 170 * s, h: cups.h + 8 * s, r: 22 * s }
        : { x: caffeine.x - 4 * s, y: caffeine.y - 4 * s, w: caffeine.w + 8 * s, h: caffeine.h + 8 * s, r: 24 * s };
    spotlight(ctx, width, height, hole, calm, now);
    // The note goes under the lit part, so the words and the finger below it stay clear of the top bar.
    const ny = hole.y + hole.h + 14 + size * 1.2;
    noteBy(ctx, words[step], hole, width, height, size, step === 'caffeine' ? CREAM : '#FFC83D');
    if (step === 'caffeine') { ctx.font = `800 ${Math.round(size * 0.8)}px ${houseFont()}`; ctx.textAlign = 'center'; ctx.fillStyle = CREAM; ctx.fillText(words.go, width / 2, ny + size * 2.4); ctx.textAlign = 'left'; }
    else tapping(ctx, width / 2, Math.min(height * 0.7, ny + size * 6), r, place, now);
  }
  ctx.restore();
}
