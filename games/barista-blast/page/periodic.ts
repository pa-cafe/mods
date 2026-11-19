import { CREAM, hash, houseFont, MONO } from './art';
import { wordCard, wrap, type Drawn } from './cards';
import type { TextKey } from './i18n.ts';
import { elements, neonColors, tableCells, takenCells } from './gemini-elements';

type Words = (key: TextKey, values?: Record<string, string | number>) => string;
export type Table = { age: number; head: Drawn; note: string[]; names: string[] };

/** How long the table is on screen. Its cells land in the first second, the four of Gemini's light up one by one, and it leaves in a quarter of one. */
export const TABLE_MS = 2600;
const LEAVE_MS = 260, LAND_MS = 1000, LIGHT_AT = 1000, LIGHT_EVERY = 330;
const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** A ball that lands and hops once: 0 above the floor, 1 on it. */
const bounce = (t: number) => t < 0.72 ? easeOut(t / 0.72) : 1 - 0.07 * Math.sin((t - 0.72) / 0.28 * Math.PI);
const NOTE_SIZE = 17;

export function stageTable(width: number, ratio: number, words: Words): Table {
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `800 ${NOTE_SIZE}px ${houseFont()}`;
  return {
    age: 0, names: elements.map(element => words(element.name)),
    head: wordCard(words('Gemini 4 is speedrunning the table'), clamp(width * 0.055, 24, 58), ratio, 'pink', -4),
    note: wrap(measure, words('Hydrogen, Carbon, Neon, Argon… who is next week?'), Math.min(520, width - 40)),
  };
}

const rounded = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

/**
 * A card that takes the whole screen for a moment, over the street and over the run, which goes on under it: the periodic
 * table falls from the top of the screen, cell by cell, and Gemini's four (H, C, Ne, Ar) light up in turn. `calm` (reduced
 * motion) has it already standing, lit.
 */
export function drawTable(ctx: CanvasRenderingContext2D, view: { width: number; height: number }, table: Table, calm: boolean) {
  const { age } = table, { width: w, height: h } = view, leave = clamp((TABLE_MS - age) / LEAVE_MS), arrive = calm ? 1 : clamp(age / 200);
  // The grid, the card, the four names and the line under them stand as one block in the middle of the screen, above the page's own buttons along the bottom.
  const wide = w >= 560, cell = Math.min((w - 20) / 18, (h * (wide ? 0.4 : 0.3)) / 7), gap = cell * 0.08, size = clamp(w * 0.034, 14, 22);
  const head = table.head, fit = Math.min(1, (w - 28) / head.width), headTall = head.height * fit, noteTall = table.note.length * NOTE_SIZE * 1.45;
  const gridW = cell * 18, gridH = cell * 7, left = (w - gridW) / 2, block = gridH + 14 + headTall + size * 2.2 + noteTall;
  const top = Math.max(14, (h - 64 - block) / 2);
  ctx.save();
  ctx.globalAlpha = arrive * leave;
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, 'rgba(8,6,32,.96)'); wash.addColorStop(1, 'rgba(46,10,72,.94)');
  ctx.fillStyle = wash; ctx.fillRect(0, 0, w, h);

  const taken = new Map(takenCells.map((spot, index) => [spot.row * 18 + spot.column, index]));
  const lit = (index: number) => calm ? 1 : clamp((age - LIGHT_AT - index * LIGHT_EVERY) / 160);
  tableCells.forEach((spot, order) => {
    const key = spot.row * 18 + spot.column, mine = taken.get(key);
    const delay = calm ? 0 : hash(order, 31) * (LAND_MS * 0.45) + spot.row * 18, t = calm ? 1 : clamp((age - delay) / (LAND_MS * 0.55));
    if (t <= 0) return;
    const fall = 1 - bounce(t), x = left + spot.column * cell + gap / 2, y = top + spot.row * cell + gap / 2 - fall * (top + gridH + cell);
    const glow = mine === undefined ? 0 : lit(mine);
    ctx.save();
    ctx.translate(x + (cell - gap) / 2, y + (cell - gap) / 2); ctx.rotate(calm ? 0 : fall * (hash(order, 32) - 0.5) * 1.4);
    if (glow > 0) {
      const element = elements[mine!], pop = calm ? 1 : 1 + 0.5 * clamp(1 - (age - LIGHT_AT - mine! * LIGHT_EVERY) / 220) ** 2;
      ctx.scale(pop, pop);
      ctx.shadowColor = element.fill; ctx.shadowBlur = cell * 0.9 * glow;
      rounded(ctx, -(cell - gap) / 2, -(cell - gap) / 2, cell - gap, cell - gap, cell * 0.16);
      ctx.fillStyle = element.fill; ctx.fill(); ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(1.5, cell * 0.06); ctx.strokeStyle = CREAM; ctx.stroke();
      ctx.fillStyle = element.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${cell * 0.46}px ${MONO}`; ctx.fillText(element.symbol, 0, cell * 0.04);
      ctx.font = `800 ${cell * 0.2}px ${MONO}`; ctx.fillText(String(element.number), 0, -cell * 0.33);
    } else {
      rounded(ctx, -(cell - gap) / 2, -(cell - gap) / 2, cell - gap, cell - gap, cell * 0.16);
      ctx.fillStyle = `rgba(${130 + hash(order, 33) * 60 | 0},${120 + hash(order, 34) * 50 | 0},255,.2)`; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(190,200,255,.35)'; ctx.stroke();
    }
    ctx.restore();
  });

  const pop = calm ? 1 : 1 + 0.8 * clamp(1 - (age - 360) / 220) ** 2, hy = top + gridH + 14 + headTall / 2;
  ctx.globalAlpha = (calm ? 1 : clamp((age - 360) / 180)) * leave;
  ctx.drawImage(head.image, w / 2 - head.width * fit * pop / 2, hy - head.height * fit * pop / 2, head.width * fit * pop, head.height * fit * pop);

  // The four names in a row under the card, each lit as its cell lands.
  const baseline = hy + headTall / 2 + size * 1.2;
  ctx.font = `900 ${size}px ${houseFont()}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  const slot = Math.min(w / 4, 150);
  table.names.forEach((name, index) => {
    const on = calm ? 1 : clamp((age - LIGHT_AT - index * LIGHT_EVERY) / 160);
    ctx.globalAlpha = (0.25 + 0.75 * on) * leave * (calm ? 1 : clamp((age - 360) / 180));
    ctx.shadowColor = elements[index].fill; ctx.shadowBlur = on * 14; ctx.fillStyle = on > 0.5 ? elements[index].fill : CREAM;
    ctx.fillText(`${elements[index].symbol} · ${name}`, w / 2 + (index - 1.5) * slot, baseline);
  });
  ctx.shadowBlur = 0;

  ctx.globalAlpha = (calm ? 1 : clamp((age - 1500) / 200)) * leave;
  ctx.font = `800 ${NOTE_SIZE}px ${houseFont()}`; ctx.fillStyle = neonColors[1]; ctx.shadowColor = neonColors[1]; ctx.shadowBlur = 8;
  table.note.forEach((line, index) => ctx.fillText(line, w / 2, baseline + size * 1.4 + index * NOTE_SIZE * 1.45));
  ctx.restore();
}
