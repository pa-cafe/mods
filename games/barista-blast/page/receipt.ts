import { blastMeters, blastTokens, type BlastKind, type BlastRun } from '../rules.ts';
import type { TextKey } from './i18n.ts';
import { canvas, hash, houseFont, INK, MONO, RED } from './art';
import { wrap } from './cards';
import { FLOP_METERS, flopLines, pick, verdictFor } from './copy';
import { formatTokens } from './numbers';
import { placeAt, type Reached } from './places';

type Words = (key: TextKey, values?: Record<string, string | number>) => string;
type ReceiptRow = { label: TextKey; count: number };
/** `hits` is every kind of thing the run hit and how often, most often first, residents before props. */
export type Bill = { tokens: number; meters: number; record: boolean; rows: ReceiptRow[]; hits: { kind: BlastKind; count: number }[]; verdict: TextKey; address: string; seed: number; place: Reached };
const ACROSS = 4, CELL = 40;

export function billOf(run: BlastRun, seed: number, record: boolean, address: string): Bill {
  const counts = new Map<BlastKind, number>();
  let residents = 0, boosts = 0;
  for (const hit of run.hits) {
    if (hit.kind !== 'window') residents++;
    if (hit.outcome === 'boost') boosts++;
    counts.set(hit.kind, (counts.get(hit.kind) ?? 0) + 1);
  }
  const person = (kind: BlastKind) => kind === 'window' ? 1 : 0;
  const hits = [...counts].map(([kind, count]) => ({ kind, count })).sort((a, b) => person(a.kind) - person(b.kind) || b.count - a.count);
  const rows: ReceiptRow[] = [...(residents ? [{ label: 'Residents hit' as const, count: residents }] : []), ...(boosts ? [{ label: 'Boosts landed' as const, count: boosts }] : [])];
  const meters = blastMeters(run), tokens = blastTokens(run.x);
  return { tokens, meters, record, rows, hits, verdict: meters < FLOP_METERS ? pick(flopLines) : verdictFor(tokens), address, seed, place: placeAt(run.x) };
}

/** The receipt as one picture, `width` CSS pixels wide, its torn edge at the bottom. Drawn once when the run ends. */
export function receiptArt(bill: Bill, width: number, ratio: number, words: Words, picture: (kind: BlastKind) => HTMLCanvasElement | null, face: (kind: BlastKind) => HTMLCanvasElement | null) {
  const font = houseFont(), pad = 24, rowHeight = 28, measure = canvas(1, 1).getContext('2d')!;
  measure.font = `700 16px ${font}`;
  const verdict = wrap(measure, words('“{verdict}”', { verdict: words(bill.verdict) }), width - pad * 2);
  const lines = Math.ceil(bill.hits.length / ACROSS);
  const ahead = bill.place.next ? 24 : 0;
  const height = 430 + (bill.rows.length + 2) * rowHeight + ahead + (lines ? lines * CELL + 8 : 0) + verdict.length * 24;
  const image = canvas(width * ratio, (height + 14) * ratio), ctx = image.getContext('2d')!;
  ctx.scale(ratio, ratio);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(width, 0); ctx.lineTo(width, height);
  const teeth = 23;
  for (let i = 1; i <= teeth * 2; i++) ctx.lineTo(width - (width / (teeth * 2)) * i, height + (i % 2 ? 10 : 0));
  ctx.closePath(); ctx.fillStyle = '#FFFDF5'; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(59,36,24,.05)';
  for (let y = 4; y < height + 12; y += 9) for (let x = (y % 18 ? 4.5 : 0); x < width; x += 9) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  const text = (value: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', weight = 800, family = font, spacing = 0, max = width - pad * 2) => {
    ctx.font = `${weight} ${size}px ${family}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (spacing) ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(value, x, y, max); ctx.letterSpacing = '0px';
  };
  const dash = (y: number) => { ctx.beginPath(); ctx.setLineDash([5, 6]); ctx.moveTo(pad - 4, y); ctx.lineTo(width - pad + 4, y); ctx.strokeStyle = '#B9A88C'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); };
  let y = 36;
  text(words('Token bill'), width / 2, y, 20, INK, 'center', 900, font, 6); y += 24;
  text('BARISTA BLAST!!', width / 2, y, 11.5, '#7A6A55', 'center', 600, MONO); y += 18; dash(y); y += 30;
  text(words('You launched the barista and burned'), width / 2, y, 15, '#7A6A55'); y += 50;
  text(formatTokens(bill.tokens), width / 2, y, 62, INK, 'center', 800, MONO); y += 40;
  text(words('TOKENS'), width / 2, y, 17, RED, 'center', 900, font, 3);
  if (bill.record) {
    ctx.save(); ctx.translate(width - 66, y - 2); ctx.rotate(-0.17);
    ctx.font = `900 17px ${font}`;
    const stampWidth = ctx.measureText(words('New record!')).width + 22;
    ctx.beginPath(); ctx.roundRect(-stampWidth / 2, -18, stampWidth, 36, 8); ctx.lineWidth = 4; ctx.strokeStyle = RED; ctx.stroke();
    ctx.fillStyle = RED; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(words('New record!'), 0, 1);
    ctx.restore();
  }
  y += 22; dash(y); y += 26;
  const row = (left: string, right: string) => { text(left, pad, y, 15, INK, 'left', 600); text(right, width - pad, y, 15, INK, 'right', 700, MONO); y += rowHeight; };
  row(words('Distance'), words('{meters} m', { meters: bill.meters.toFixed(1) }));
  measure.font = `600 15px ${font}`;
  const reachedLabel = words('Reached'), room = width - pad * 2 - measure.measureText(reachedLabel).width - 12;
  text(reachedLabel, pad, y, 15, INK, 'left', 600);
  text(words('{place} (area {area})', { place: words(bill.place.name), area: bill.place.area }), width - pad, y, 15, INK, 'right', 800, font, 0, room);
  y += rowHeight;
  if (bill.place.next) {
    text(words('{meters} m more to {place}', { meters: bill.place.next.meters, place: words(bill.place.next.name) }), width - pad, y - 6, 13, RED, 'right', 800);
    y += ahead;
  }
  for (const each of bill.rows) row(words(each.label), `× ${each.count}`);
  const across = (width - pad * 2) / ACROSS;
  bill.hits.forEach((hit, index) => {
    const x = pad + (index % ACROSS) * across, top = y - rowHeight / 2 + 4 + Math.floor(index / ACROSS) * CELL, r = 16, head = face(hit.kind), image = head ?? picture(hit.kind);
    ctx.beginPath(); ctx.arc(x + r, top + r, r, 0, Math.PI * 2); ctx.fillStyle = hit.kind === 'window' ? '#CFEFDC' : '#EFE6D2'; ctx.fill();
    const side = head ? r * 2 : r * 2 - 4;
    if (image) { ctx.save(); ctx.clip(); ctx.drawImage(image, x + r - side / 2, head ? top : top + 2, side, side); ctx.restore(); }
    ctx.beginPath(); ctx.arc(x + r, top + r, r, 0, Math.PI * 2); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
    text(`×${hit.count}`, x + r * 2 + 5, top + r + 1, 14, INK, 'left', 700, MONO);
  });
  if (lines) y += lines * CELL + 8;
  y += 2; dash(y); y += 26;
  text(words('Manager’s verdict'), pad, y, 16, INK, 'left', 900); y += 28;
  for (const line of verdict) { text(line, pad, y, 16, INK, 'left', 700); y += 24; }
  dash(y); y += 24;
  ctx.fillStyle = INK;
  for (let x = pad + 16, i = 0; x < width - pad - 16; i++) { const bar = 1.5 + Math.floor(hash(i, bill.seed) * 4) * 1.4; ctx.fillRect(x, y, bar, 34); x += bar + 2 + hash(i, bill.seed + 1) * 3; }
  y += 50;
  text(bill.address, width / 2, y, 11, '#7A6A55', 'center', 600, MONO);
  return { image, width, height: height + 14 };
}
