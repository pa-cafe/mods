import { expect, it } from 'vitest';
import { drawGiant, GIANT_MS } from './voidGiant';

function recorder() {
  const drawn: { top: number; size: number; clip: number; alpha: number }[] = [];
  let clip = Infinity;
  const ctx = {
    globalAlpha: 1,
    save() {}, restore() {}, beginPath() {}, translate() {}, rotate() {},
    rect(_x: number, _y: number, _w: number, h: number) { clip = h; },
    clip() {},
    drawImage(_p: unknown, _x: number, top: number, size: number) { drawn.push({ top, size, clip, alpha: ctx.globalAlpha }); },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, drawn };
}

it('the void giant rises from the ground to past the top of the screen, and is only drawn above the ground', () => {
  const base = 400, { ctx, drawn } = recorder();
  drawGiant(ctx, {} as CanvasImageSource, 390, base, GIANT_MS / 2, false);
  const [{ top, size, clip, alpha }] = drawn;
  expect(clip).toBe(base);
  expect(top + size * 0.04).toBeLessThan(0);
  expect(top + size * 0.04).toBeGreaterThan(-size * 0.08);
  expect(top + size).toBeGreaterThan(base);
  expect(alpha).toBeCloseTo(0.22);
});

it('the void giant starts and ends its crossing under the ground', () => {
  const base = 400;
  for (const clock of [1, GIANT_MS - 1]) {
    const { ctx, drawn } = recorder();
    drawGiant(ctx, {} as CanvasImageSource, 390, base, clock, false);
    expect(drawn[0].top).toBeGreaterThan(base - drawn[0].size * 0.05);
  }
});
