
export const GIANT_MS = 14_000;

const TAU = Math.PI * 2;
const SHOWN = 0.86, ABOVE = 0.08;

/** Draws the giant whose crossing `clock` falls in, clipped to the sky above `base`. `calm` holds it still mid-screen. */
export function drawGiant(ctx: CanvasRenderingContext2D, picture: CanvasImageSource, width: number, base: number, clock: number, calm: boolean) {
  const along = clock % GIANT_MS / GIANT_MS;
  const size = base / (SHOWN - ABOVE);
  const x = calm ? (width - size) / 2 : width - along * (width + size);
  const up = calm ? 1 : ease(Math.min(1, along * 6, (1 - along) * 6));
  const top = base - size * SHOWN * up + size * 0.012 * Math.sin(clock / 3300 * TAU);
  const lean = calm ? 0 : (2.6 * Math.sin(clock / 4700 * TAU) + 1.2 * Math.sin(clock / 1900 * TAU + 1)) * Math.PI / 180;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, width, base); ctx.clip();
  ctx.globalAlpha *= 0.22 * (calm ? 1 : Math.min(1, along * 10, (1 - along) * 10));
  ctx.translate(x + size / 2, base); ctx.rotate(lean); ctx.translate(-(x + size / 2), -base);
  ctx.drawImage(picture, x, top, size, size);
  ctx.restore();
}

function ease(t: number) { return t * t * (3 - 2 * t); }
