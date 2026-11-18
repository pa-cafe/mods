import { blastTuning, type BlastRun } from '../rules.ts';
import { canvas, CREAM, drawDots, goldFill, houseFont, INK, MINT, PINK } from './art';
import type { Drawn } from './cards';
import { formatTokens } from './numbers';

const LABEL = '#C9A27A', AMBER = '#FFC83D', RECORD = '#FF7FA6';
export type HudWords = { best: string; burned: string; rate: string; caffeine: string; ready: string; record: string };
type Size = { width: number; height: number };

export const squat = ({ width, height }: Size) => height <= 500 && width > height;

export const hudScale = (view: Size) => squat(view) ? Math.min(0.8, Math.max(0.6, view.height / 560)) : Math.min(1, Math.max(0.6, view.width / 900));

const pill = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string | CanvasGradient, line = 3.5) => {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = line; ctx.strokeStyle = INK; ctx.stroke();
};
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', weight = 800) {
  ctx.font = `${weight} ${size}px ${houseFont()}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y);
}


export type BlastTap = 'refill' | 'dive' | null;
const NOW = '#2FA36B';


type TopBar = { x: number; y: number; width: number; height: number; thin: boolean };
export function topBar(view: Size): TopBar {
  const k = hudScale(view);
  if (squat(view)) { const w = Math.min(520, view.width - 150); return { x: (view.width - w) / 2, y: 8, width: w, height: Math.round(60 * k), thin: true }; }
  const w = Math.min(580, view.width - 24);
  return { x: (view.width - w) / 2, y: 14 * k, width: w, height: Math.round(96 * Math.max(k, 0.82)), thin: false };
}

type Box = { x: number; y: number; w: number; h: number };
/**
 * The cups (with the dive button) and the caffeine meter sit side by side right under the top bar, the cups under its
 * left end and the caffeine under its right end; on a narrow screen both shrink until they fit under it.
 */
export function hudRow(view: Size): { k: number; cups: Box; caffeine: Box; bottom: number } {
  // On a phone held upright the page's close button sits under the bar's right end, so the caffeine meter stops short of it.
  const bar = topBar(view), room = view.width <= 660 && !squat(view) ? 50 : 0, k = Math.min(hudScale(view), (bar.width - room - 10) / 452), y = bar.y + bar.height + 8, h = 54 * k;
  return { k, cups: { x: bar.x, y, w: 238 * k, h }, caffeine: { x: bar.x + bar.width - room - 214 * k, y, w: 214 * k, h }, bottom: y + h };
}

/** Only the latest size is kept: a window being dragged narrower asks for a new size at every frame. */
let barBackKept: { key: string; image: HTMLCanvasElement } | null = null;

function barBack(bar: TopBar, ratio: number) {
  const key = `${bar.width}|${bar.height}|${ratio}`;
  if (barBackKept?.key === key) return barBackKept.image;
  const image = canvas((bar.width + 20) * ratio, (bar.height + 20) * ratio), ctx = image.getContext('2d')!;
  ctx.scale(ratio, ratio); ctx.translate(10, 6);
  ctx.save(); ctx.shadowColor = 'rgba(42,27,58,.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
  ctx.beginPath(); ctx.roundRect(0, 0, bar.width, bar.height, bar.height * 0.28); ctx.fillStyle = CREAM; ctx.fill(); ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  const inset = Math.min(8, bar.height * 0.14);
  ctx.beginPath(); ctx.roundRect(inset, inset, bar.width - inset * 2, bar.height - inset * 2, bar.height * 0.2);
  const glass = ctx.createLinearGradient(0, inset, 0, bar.height - inset); glass.addColorStop(0, '#2B1A12'); glass.addColorStop(1, '#140B07');
  ctx.fillStyle = glass; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(59,36,24,.35)';
  for (let y = 10; y < bar.height; y += 7) for (let x = 10 + (y % 14 ? 3.5 : 0); x < bar.width; x += 7) { ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  barBackKept = { key, image };
  return image;
}

type BarNumbers = { tokens: number; best: number; rate: number; record: boolean; pop: number };
/** The cafe number display: best on the left, this run large in the middle, the barista's speed in metres a second on the right. `pop` is 0..1 after a unit change. */
export function drawTopBar(ctx: CanvasRenderingContext2D, bar: TopBar, numbers: BarNumbers, words: HudWords, ratio: number) {
  const back = barBack(bar, ratio);
  ctx.drawImage(back, bar.x - 10, bar.y - 6, back.width / ratio, back.height / ratio);
  if (bar.thin) { thinBar(ctx, bar, numbers, words, ratio); return; }
  const side = bar.width * 0.24, labelSize = Math.max(9, bar.height * 0.13), top = bar.y + bar.height * 0.3;
  label(ctx, words.burned, bar.x + bar.width / 2, top, labelSize, LABEL);
  const text = formatTokens(numbers.tokens), room = bar.width - side * 2 - 16;
  const dot = Math.min(bar.height * 0.48 / 7, room / 34) * (1 + 0.25 * numbers.pop);
  drawDots(ctx, text, bar.x + bar.width / 2, bar.y + bar.height * 0.72 - dot * 3.5, dot, numbers.record ? RECORD : AMBER, ratio);
  if (numbers.pop > 0) { ctx.globalAlpha = numbers.pop * 0.5; drawDots(ctx, text, bar.x + bar.width / 2, bar.y + bar.height * 0.72 - dot * 3.5, dot, '#FFFFFF', ratio); ctx.globalAlpha = 1; }
  const small = Math.min(bar.height * 0.22 / 7, (side - 24) / 26);
  label(ctx, words.best, bar.x + 22, top, labelSize * 0.95, LABEL, 'left');
  drawDots(ctx, formatTokens(numbers.best), bar.x + 22, bar.y + bar.height * 0.66 - small * 3.5, small, '#FFE9B8', ratio, 'left');
  label(ctx, words.rate, bar.x + bar.width - 22, top, labelSize * 0.95, LABEL, 'right');
  drawDots(ctx, formatTokens(numbers.rate), bar.x + bar.width - 22, bar.y + bar.height * 0.66 - small * 3.5, small, MINT, ratio, 'right');
}


function thinBar(ctx: CanvasRenderingContext2D, bar: TopBar, numbers: BarNumbers, words: HudWords, ratio: number) {
  const mid = bar.y + bar.height / 2, side = bar.width * 0.22, room = bar.width - side * 2 - 12, text = formatTokens(numbers.tokens);
  const dot = Math.min(bar.height * 0.7 / 7, room / 34) * (1 + 0.25 * numbers.pop);
  drawDots(ctx, text, bar.x + bar.width / 2, mid - dot * 3.5, dot, numbers.record ? RECORD : AMBER, ratio);
  if (numbers.pop > 0) { ctx.globalAlpha = numbers.pop * 0.5; drawDots(ctx, text, bar.x + bar.width / 2, mid - dot * 3.5, dot, '#FFFFFF', ratio); ctx.globalAlpha = 1; }
  const small = Math.max(9, bar.height * 0.22), value = Math.max(11, bar.height * 0.3), gap = bar.height * 0.17, edge = bar.height * 0.4;
  label(ctx, words.best, bar.x + edge, mid - gap, small, LABEL, 'left');
  label(ctx, formatTokens(numbers.best), bar.x + edge, mid + gap, value, '#FFE9B8', 'left', 900);
  label(ctx, words.rate, bar.x + bar.width - edge, mid - gap, small, LABEL, 'right');
  label(ctx, formatTokens(numbers.rate), bar.x + bar.width - edge, mid + gap, value, MINT, 'right', 900);
}


export function drawToast(ctx: CanvasRenderingContext2D, text: string, lead: string, x: number, y: number, k: number, shown: number, color = INK) {
  if (shown <= 0) return;
  const size = 15 * Math.max(k, 0.85), font = `800 ${size}px ${houseFont()}`;
  ctx.font = font;
  const leadWidth = lead ? ctx.measureText(`${lead}  `).width : 0, width = Math.min(ctx.measureText(text).width + leadWidth + 36, ctx.canvas.width), h = size * 2.1;
  ctx.save(); ctx.globalAlpha = Math.min(1, shown * 1.5); ctx.translate(0, -(1 - shown) * h);
  pill(ctx, x - width / 2, y, width, h, color, 0);
  if (lead) label(ctx, lead, x - width / 2 + 18, y + h / 2, size, AMBER, 'left', 900);
  label(ctx, text, x - width / 2 + 18 + leadWidth, y + h / 2, size, color === INK ? '#FFE9B8' : '#fff', 'left');
  ctx.restore();
  return h;
}

function cup(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, full: boolean) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(4, 6); ctx.lineTo(40, 6); ctx.lineTo(35, 40); ctx.lineTo(9, 40); ctx.closePath(); ctx.fillStyle = full ? '#fff' : 'rgba(255,255,255,.35)'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(40, 12); ctx.quadraticCurveTo(53, 12, 51, 22); ctx.quadraticCurveTo(49, 30, 38, 30); ctx.stroke();
  if (full) {
    ctx.beginPath(); ctx.moveTo(7.5, 14); ctx.lineTo(36.5, 14); ctx.lineTo(33.5, 36); ctx.lineTo(10.5, 36); ctx.closePath(); ctx.fillStyle = '#8A5A3C'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(14, -2); ctx.quadraticCurveTo(10, -8, 14, -13); ctx.moveTo(24, -2); ctx.quadraticCurveTo(20, -8, 24, -13); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
  }
  ctx.restore();
}

/**
 * Under the left end of the top bar: the refills left, then the dive button greyed and refilling while it cools down. `tap` is what a press
 * would do this moment: that half has a green ring, and a dive button that is ready but would not fire is pale. `cue`
 * lights up the half that would pay off if the player pressed now; `beat` (0 to 1) is its pulse.
 */
export function drawRefills(ctx: CanvasRenderingContext2D, run: BlastRun | null, row: ReturnType<typeof hudRow>, flash: number, cue: { dive: boolean; refill: boolean } | null, beat: number, tap: BlastTap = null) {
  const { k } = row, { x, y } = row.cups, refills = run ? run.refills : blastTuning.refills;
  pill(ctx, x, y, 238 * k, 54 * k, CREAM);
  for (let i = 0; i < 3; i++) {
    const bounce = flash > 0 ? Math.sin(flash * Math.PI) * 6 * k : 0;
    cup(ctx, x + 18 * k + i * 50 * k, y + 10 * k - (i < refills ? bounce : 0), 0.82 * k, i < refills);
  }
  if (cue?.refill && refills > 0) {
    ctx.beginPath(); ctx.roundRect(x + 6 * k, y + 5 * k, 160 * k, 44 * k, 16 * k); ctx.lineWidth = (3 + 3 * beat) * k; ctx.strokeStyle = '#FFC83D'; ctx.globalAlpha = 0.55 + 0.45 * beat; ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (tap === 'refill') { ctx.beginPath(); ctx.roundRect(x + 8 * k, y + 7 * k, 156 * k, 40 * k, 14 * k); ctx.lineWidth = 3.5 * k; ctx.strokeStyle = NOW; ctx.stroke(); }
  const cool = run ? Math.max(0, run.diveAt - run.step) / blastTuning.diveCooldown : 0, cx = x + 204 * k, cy = y + 27 * k, r = 18 * k;
  if (cue?.dive) { ctx.beginPath(); ctx.arc(cx, cy, r + (5 + 4 * beat) * k, 0, Math.PI * 2); ctx.fillStyle = '#FFC83D'; ctx.globalAlpha = 0.55 + 0.45 * beat; ctx.fill(); ctx.globalAlpha = 1; }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = cool > 0 ? '#9AA5A0' : tap === 'dive' || !run ? '#3D6BD0' : '#9DB0DE'; ctx.fill();
  if (cool > 0) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (1 - cool) * Math.PI * 2); ctx.closePath(); ctx.fillStyle = '#3D6BD0'; ctx.fill(); }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - 9 * k); ctx.lineTo(cx, cy + 5 * k); ctx.moveTo(cx - 7 * k, cy - 1 * k); ctx.lineTo(cx, cy + 7 * k); ctx.lineTo(cx + 7 * k, cy - 1 * k);
  ctx.lineWidth = 4 * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff'; ctx.stroke();
  if (tap === 'dive') { ctx.beginPath(); ctx.arc(cx, cy, r + 4.5 * k, 0, Math.PI * 2); ctx.lineWidth = 3.5 * k; ctx.strokeStyle = NOW; ctx.stroke(); }
}


export function drawTap(ctx: CanvasRenderingContext2D, tap: BlastTap, x: number, y: number, k: number) {
  if (!tap) return;
  const r = 12 * k;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = tap === 'dive' ? '#3D6BD0' : CREAM; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  if (tap === 'dive') {
    ctx.beginPath(); ctx.moveTo(x, y - 6 * k); ctx.lineTo(x, y + 3 * k); ctx.moveTo(x - 4.5 * k, y - 0.5 * k); ctx.lineTo(x, y + 5 * k); ctx.lineTo(x + 4.5 * k, y - 0.5 * k);
    ctx.lineWidth = 2.6 * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff'; ctx.stroke();
  } else cup(ctx, x - 11 * k, y - 7 * k, 0.42 * k, true);
}


export function drawCaffeine(ctx: CanvasRenderingContext2D, run: BlastRun | null, row: ReturnType<typeof hudRow>, now: number, words: HudWords, glow: HTMLCanvasElement) {
  const caffeine = run?.caffeine ?? 0, full = caffeine >= blastTuning.caffeine, { k } = row, { x, y, w } = row.caffeine;
  if (full) { const pulse = 0.55 + 0.45 * Math.sin(now / 160); ctx.globalAlpha = pulse; ctx.drawImage(glow, x - 30 * k, y - 30 * k, w + 60 * k, 114 * k); ctx.globalAlpha = 1; }
  pill(ctx, x, y, w, 54 * k, CREAM);
  label(ctx, words.caffeine, x + 18 * k, y + 27 * k, 15 * k, INK, 'left', 900);
  ctx.font = `900 ${15 * k}px ${houseFont()}`;

  const cells = blastTuning.caffeine, start = Math.max(x + 18 * k + ctx.measureText(words.caffeine).width + 10 * k, x + w - 136 * k), each = (x + w - 14 * k - start) / cells;
  for (let i = 0; i < cells; i++) {
    ctx.beginPath(); ctx.roundRect(start + i * each, y + 15 * k, each - 6 * k, 24 * k, 8 * k);
    ctx.fillStyle = i < caffeine ? goldFill(ctx, y + 15 * k, y + 39 * k) : '#E7DBC6'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  }
  if (full && !run?.boost) {
    ctx.font = `900 ${14 * k}px ${houseFont()}`;
    const tag = ctx.measureText(words.ready).width + 30 * k;
    pill(ctx, x + w - tag - 6 * k, y + 64 * k, tag, 30 * k, PINK, 3);
    label(ctx, words.ready, x + w - tag / 2 - 6 * k, y + 79 * k, 14 * k, '#fff', 'center', 900);
  }
}


export function drawBoost(ctx: CanvasRenderingContext2D, run: BlastRun, card: Drawn, width: number, height: number, k: number, now: number) {
  if (!run.boost) return;
  const left = run.boost.left / blastTuning.boostWindow, x = width / 2, y = height * 0.44, r = Math.max(k, 0.7);
  ctx.beginPath(); ctx.arc(x, y, 78 * r, 0, Math.PI * 2); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 52 * r + 70 * r * left, 0, Math.PI * 2); ctx.lineWidth = 8; ctx.strokeStyle = AMBER; ctx.stroke();
  const wobble = 1 + 0.06 * Math.sin(now / 50), w = card.width * r * wobble, h = card.height * r * wobble;
  ctx.drawImage(card.image, x - w / 2, y - h / 2, w, h);
}


export function drawPressure(ctx: CanvasRenderingContext2D, power: number, width: number, height: number, k: number, text: string) {
  const r = Math.max(k, 0.75), w = 50 * r, h = 176 * r, x = width - w - 18 * r, y = height * 0.24;
  pill(ctx, x, y, w, h, CREAM);
  const inner = { x: x + 10 * r, y: y + 10 * r, w: w - 20 * r, h: h - 20 * r };
  ctx.beginPath(); ctx.roundRect(inner.x, inner.y, inner.w, inner.h, inner.w / 2); ctx.fillStyle = '#E7DBC6'; ctx.fill();
  ctx.beginPath(); ctx.roundRect(inner.x, inner.y, inner.w, inner.h * 0.1 + inner.w / 2, inner.w / 2); ctx.fillStyle = 'rgba(224,87,47,.85)'; ctx.fill();
  if (power > 0.01) {
    const fill = Math.max(inner.w, inner.h * power);
    ctx.beginPath(); ctx.roundRect(inner.x, inner.y + inner.h - fill, inner.w, fill, inner.w / 2); ctx.fillStyle = goldFill(ctx, inner.y, inner.y + inner.h); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  }
  ctx.font = `900 ${14 * r}px ${houseFont()}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  ctx.strokeText(text, x + w / 2, y + h + 16 * r); ctx.fillStyle = '#fff'; ctx.fillText(text, x + w / 2, y + h + 16 * r);
}


export function drawHint(ctx: CanvasRenderingContext2D, text: string, width: number, y: number, k: number, alpha: number) {
  if (alpha <= 0) return;
  const size = 17 * Math.max(k, 0.85);
  ctx.font = `900 ${size}px ${houseFont()}`;
  const w = Math.min(width - 24, ctx.measureText(text).width + 48), h = size * 2.9;
  ctx.globalAlpha = alpha; pill(ctx, (width - w) / 2, y - h / 2, w, h, CREAM); label(ctx, text, width / 2, y, size, INK, 'center', 900); ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}
