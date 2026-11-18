import type { BlastHit } from '../rules.ts';
import { hash, houseFont, INK, MONO } from './art';
import type { Drawn } from './cards';
import type { BlastEvent } from './events';

export type Actor = (ctx: CanvasRenderingContext2D, x: number, y: number, tall: number) => void;

const BAD_MS = 900;
export const PRELUDE_MS = { banned: 1100, appealed: 1300, capacity: 1450 } as const;
type Prelude = keyof typeof PRELUDE_MS;
/** What the HUD held just before GPT took it, so each piece can fly to her. */
export type Lost = { cups: number; caffeine: number };

const BAND = '#5A1645', DEEP = '#2E0A2A', EDGE = '#FF7FB0', BAN_INK = '#C62B45', GOLD_INK = '#E8A21B';
const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * The trouble that landed in this step, if any, other than the two that take the screen. A hit waiting on a tap has not
 * landed yet: it does when the window closes untapped.
 */
export function troubleOf(events: readonly BlastEvent[]): BlastHit | null {
  for (const event of events) {
    if (!(event.type === 'lapsed' || event.type === 'hit' && !event.held)) continue;
    const { hit } = event;
    if (hit.mood === 'bad' && !hit.waived && hit.as !== 'window' && hit.as !== 'dots' && hit.as !== 'claude') return hit;
  }
  return null;
}

function band(ctx: CanvasRenderingContext2D, width: number, tall: number, lean: number, age: number, calm: boolean) {
  ctx.rotate(lean);
  const fill = ctx.createLinearGradient(0, -tall / 2, 0, tall / 2); fill.addColorStop(0, BAND); fill.addColorStop(1, DEEP);
  ctx.fillStyle = fill; ctx.fillRect(-width, -tall / 2, width * 2, tall);
  ctx.fillStyle = EDGE; ctx.fillRect(-width, -tall / 2 - 5, width * 2, 5); ctx.fillRect(-width, tall / 2, width * 2, 5);
  if (calm) return;
  ctx.fillStyle = 'rgba(255,127,176,.18)';
  for (let i = 0; i < 10; i++) { const x = width - ((hash(i, 4) * width * 2 + age * (0.8 + hash(i, 6))) % (width * 2)); ctx.fillRect(x, (hash(i, 8) - 0.5) * tall * 0.84, 60 + hash(i, 10) * 120, 3); }
}

export type BadCut = { at: number; actor: Actor; card: Drawn };

export function drawBadCut(ctx: CanvasRenderingContext2D, view: { width: number; height: number }, cut: BadCut, now: number, calm: boolean) {
  const t = now - cut.at;
  if (t > BAD_MS) return false;
  const { width: w, height: h } = view, enter = calm ? 1 : easeOut(clamp(t / 150)), tall = clamp(h * 0.2, 96, 176), middle = h * 0.4, wide = w >= 560;
  ctx.save(); ctx.globalAlpha = clamp((BAD_MS - t) / 160);
  ctx.translate((1 - enter) * w, 0);
  ctx.save(); ctx.translate(w / 2, middle); band(ctx, w, tall, 0.05, t, calm);
  const jolt = calm ? 0 : Math.sin(t / 30) * 4 * clamp(1 - t / 300);
  ctx.save(); ctx.beginPath(); ctx.rect(-w, -h, w * 2, h + tall / 2); ctx.clip();
  cut.actor(ctx, (wide ? -w * 0.3 : -w * 0.28) + jolt, tall / 2 + 2, tall * 1.7);
  ctx.restore();
  ctx.restore();
  const room = wide ? w * 0.5 : w * 0.56, fit = Math.min(1, room / cut.card.width) * (calm ? 1 : 1 + 0.5 * clamp(1 - t / 180) ** 2);
  ctx.drawImage(cut.card.image, w * (wide ? 0.62 : 0.66) - cut.card.width * fit / 2, middle - cut.card.height * fit / 2, cut.card.width * fit, cut.card.height * fit);
  ctx.restore();
  return true;
}

function mark(ctx: CanvasRenderingContext2D, word: string, size: number, ink: string) {
  ctx.font = `800 ${size}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const across = ctx.measureText(word).width + size * 1.4, high = size * 2.1;
  ctx.strokeStyle = ink; ctx.lineWidth = size * 0.2; ctx.beginPath(); ctx.roundRect(-across / 2, -high / 2, across, high, size * 0.35); ctx.stroke();
  ctx.lineWidth = size * 0.07; ctx.beginPath(); ctx.roundRect(-across / 2 + size * 0.3, -high / 2 + size * 0.3, across - size * 0.6, high - size * 0.6, size * 0.2); ctx.stroke();
  ctx.fillStyle = ink; ctx.fillText(word, 0, size * 0.05);
}

function stamp(ctx: CanvasRenderingContext2D, size: number, ink: string) {
  ctx.lineWidth = 3; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.roundRect(-size * 2.4, -size * 0.9, size * 4.8, size * 0.9, size * 0.2); ctx.fillStyle = ink; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-size * 0.5, -size * 2.6, size, size * 1.7, size * 0.3); ctx.fillStyle = '#B07A4F'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -size * 2.9, size * 0.75, 0, Math.PI * 2); ctx.fillStyle = '#C98E5E'; ctx.fill(); ctx.stroke();
}

function slam(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, down: number, word: string, size: number, ink: string, calm: boolean) {
  const fall = calm ? 1 : easeOut(clamp(age / down)), lift = calm ? 1 : clamp((age - down - 160) / 260), landed = calm || age >= down;
  if (landed) { ctx.save(); ctx.translate(x, y); ctx.rotate(-0.12); ctx.globalAlpha *= 0.94; mark(ctx, word, size * (calm ? 1 : 1 + 0.25 * clamp(1 - (age - down) / 120)), ink); ctx.restore(); }
  if (!calm && lift < 1) { ctx.save(); ctx.translate(x, y - (1 - fall) * y * 1.2 - lift * y * 1.2); ctx.rotate(-0.12); stamp(ctx, size, ink); ctx.restore(); }
}
const THUD: Record<Prelude, number> = { banned: 520, appealed: 920, capacity: 420 };

function cup(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.moveTo(x - 11 * s, y - 12 * s); ctx.lineTo(x + 11 * s, y - 12 * s); ctx.lineTo(x + 8 * s, y + 12 * s); ctx.lineTo(x - 8 * s, y + 12 * s); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8A5A3C'; ctx.fillRect(x - 9 * s, y - 9 * s, 18 * s, 4 * s);
}

function hudSpots(width: number, height: number, lost: Lost) {
  const k = Math.min(1, Math.max(0.6, width / 900)), y = height - 43 * k;
  const cups = Array.from({ length: lost.cups }, (_, i) => ({ x: 16 * k + 2 + 38 * k + i * 50 * k, y, cup: true }));
  const cells = Array.from({ length: lost.caffeine }, (_, i) => ({ x: width - 18 * k - 122 * k + i * 41 * k, y, cup: false }));
  return [...cups, ...cells];
}

/** The scene before the letter or the band, `age` milliseconds in. */
export function drawPrelude(ctx: CanvasRenderingContext2D, view: { width: number; height: number }, kind: Prelude, age: number, actor: Actor, words: { banned: string; reinstated: string; capacity: string }, lost: Lost, calm: boolean) {
  const { width: w, height: h } = view, tall = clamp(h * 0.24, 120, 210), middle = h * 0.42, wide = w >= 560, size = clamp(w * 0.04, 16, 30);
  const arrive = calm ? 1 : easeOut(clamp(age / 220)), leave = clamp((PRELUDE_MS[kind] - age) / 160);
  ctx.save(); ctx.globalAlpha = leave;
  ctx.fillStyle = `rgba(46,10,42,${0.78 * Math.min(1, arrive * 1.4)})`; ctx.fillRect(0, 0, w, h);
  const shake = calm || age < THUD[kind] ? 0 : 8 * clamp(1 - (age - THUD[kind]) / 260) ** 2;
  ctx.translate(Math.sin(age * 0.11) * shake, Math.cos(age * 0.13) * shake);
  const scene = () => {
    ctx.save(); ctx.translate(w / 2 + (1 - arrive) * w, middle); band(ctx, w, tall, 0.05, age, calm);
    ctx.save(); ctx.beginPath(); ctx.rect(-w, -h, w * 2, h + tall / 2); ctx.clip();
    actor(ctx, kind === 'capacity' ? w * (wide ? 0.26 : 0.22) : -w * (wide ? 0.26 : 0.24), tall / 2 + 2, tall * 1.6);
    ctx.restore(); ctx.restore();
  };
  ctx.save();
  const at = { x: w * (wide ? 0.62 : 0.6), y: middle - tall * 0.05 };
  if (kind === 'banned') {
    scene();
    slam(ctx, at.x, at.y, age - 260, 260, words.banned, size, BAN_INK, calm);
  } else if (kind === 'appealed') {
    scene();
    const peel = calm ? 1 : easeOut(clamp((age - 260) / 380));
    if (peel < 1) {
      ctx.save(); ctx.translate(at.x - peel * w * 0.45, at.y - peel * h * 0.5); ctx.rotate(-0.12 - peel * 1.6); ctx.globalAlpha *= 0.94 * (1 - peel * 0.7);
      mark(ctx, words.banned, size, BAN_INK); ctx.restore();
    }
    if (!calm) {
      const sweat = clamp(age / 200) * leave, sx = w / 2 - w * (wide ? 0.26 : 0.24) + tall * 0.42, sy = middle - tall * 0.95;
      ctx.save(); ctx.globalAlpha = sweat; ctx.beginPath(); ctx.moveTo(sx, sy - 12); ctx.quadraticCurveTo(sx + 9, sy + 4, sx, sy + 8); ctx.quadraticCurveTo(sx - 9, sy + 4, sx, sy - 12);
      ctx.fillStyle = '#9FD8FF'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
    }
    slam(ctx, at.x, at.y, age - 680, 240, words.reinstated, size, GOLD_INK, calm);
  } else {
    scene();
    const down = calm ? 1 : easeOut(clamp(age / 420)), across = w * (wide ? 0.5 : 0.56), bottom = h * 0.9 * down;
    ctx.save();
    ctx.fillStyle = '#7F8A96'; ctx.fillRect(0, 0, across, bottom);
    ctx.fillStyle = 'rgba(38,63,53,.28)'; for (let y = 14; y < bottom; y += 18) ctx.fillRect(0, y, across, 3);
    ctx.fillStyle = '#4C5560'; ctx.fillRect(0, bottom - 12, across, 12);
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeRect(0, -3, across, bottom + 3);
    if (down > 0.6) { ctx.font = `900 ${size}px ${houseFont()}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#FFF4F5'; ctx.fillText(words.capacity, across / 2, bottom * 0.55, across - 24); }
    ctx.restore();
    const arms = { x: w / 2 + w * (wide ? 0.26 : 0.22), y: middle - tall * 0.2 };
    hudSpots(w, h, lost).forEach((spot, index) => {
      const start = 520 + index * 110, t = calm ? 1 : clamp((age - start) / 380);
      if (t >= 1 && !calm) return;
      const x = spot.x + (arms.x - spot.x) * t, y = spot.y + (arms.y - spot.y) * t - Math.sin(t * Math.PI) * h * 0.18;
      if (calm) return;
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 5);
      if (spot.cup) cup(ctx, 0, 0, 1);
      else { ctx.beginPath(); ctx.roundRect(-14, -10, 28, 20, 7); ctx.fillStyle = '#FFC83D'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); }
      ctx.restore();
    });
  }
  ctx.restore();
  ctx.restore();
}
