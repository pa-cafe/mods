import { canvas, CREAM, goldFill, houseFont, INK, pinkFill, RED } from './art';

export type Drawn = { image: HTMLCanvasElement; width: number; height: number };
type Fill = 'gold' | 'pink';

export function wordCard(text: string, size: number, ratio: number, fill: Fill = 'gold', slant = -8): Drawn {
  const font = `italic 900 ${size}px ${houseFont()}`;
  const measure = canvas(1, 1).getContext('2d')!;
  measure.font = font;
  const textWidth = measure.measureText(text).width + size * 0.2, pad = size * 0.45;
  const width = textWidth + pad * 2, height = size * 1.25 + pad * 2;
  const image = canvas(width * ratio, height * ratio), ctx = image.getContext('2d')!;
  ctx.scale(ratio, ratio); ctx.translate(width / 2, height / 2); ctx.rotate(slant * Math.PI / 180); ctx.transform(1, 0, -0.14, 1, 0, 0);
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const write = (style: string | CanvasGradient, stroke: number, dx = 0, dy = 0) => {
    if (stroke) { ctx.lineWidth = stroke; ctx.strokeStyle = style; ctx.strokeText(text, dx, dy); } else { ctx.fillStyle = style; ctx.fillText(text, dx, dy); }
  };
  write('rgba(42,27,58,.3)', size * 0.34, size * 0.04, size * 0.07);
  write('#fff', size * 0.34);
  write(INK, size * 0.2);
  write(fill === 'gold' ? goldFill(ctx, -size / 2, size / 2) : pinkFill(ctx, -size / 2, size / 2), 0);
  ctx.save(); ctx.beginPath(); ctx.rect(-width, -height, width * 2, height - size * 0.08); ctx.clip(); ctx.globalAlpha = 0.5; write('#fff', 0); ctx.restore();
  return { image, width, height };
}

/** Splits text into lines no wider than `max`: at spaces where the language has them, anywhere otherwise. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const pieces = /\s/.test(text) ? text.split(/(?<=\s)/) : [...text];
  const lines: string[] = [];
  let line = '';
  for (const piece of pieces) {
    if (line && ctx.measureText(line + piece).width > max) { lines.push(line.trimEnd()); line = piece.trimStart(); } else line += piece;
  }
  if (line) lines.push(line.trimEnd());
  return lines;
}

/**
 * The dialogue panel of the HUD: who spoke and what they said, on a cream card that stays put while the street rushes by.
 * `slot` pixels are left empty on the left for the speaker's portrait, which the scene draws on top.
 */
export function talkCard(name: string, text: string, size: number, width: number, slot: number, ratio: number): Drawn {
  const font = `800 ${size}px ${houseFont()}`, small = `800 ${size * 0.72}px ${houseFont()}`, measure = canvas(1, 1).getContext('2d')!;
  measure.font = font;
  const pad = size * 0.8, left = pad + (slot ? slot + pad * 0.7 : 0), lines = wrap(measure, text, width - left - pad - 8).slice(0, 3), line = size * 1.32;
  const head = name ? size * 1.15 : 0, height = Math.max(slot + pad * 1.2, head + lines.length * line + pad * 1.5) + 8;
  const image = canvas(width * ratio, height * ratio), ctx = image.getContext('2d')!;
  ctx.scale(ratio, ratio); ctx.translate(4, 4);
  const w = width - 8, h = height - 8;
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, 18); ctx.fillStyle = CREAM; ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  const top = (h - head - lines.length * line) / 2;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  if (name) { ctx.font = small; ctx.fillStyle = RED; ctx.fillText(name, left, top + head * 0.45); }
  ctx.font = font; ctx.fillStyle = INK;
  lines.forEach((each, index) => ctx.fillText(each, left, top + head + line * (index + 0.5)));
  return { image, width, height };
}
