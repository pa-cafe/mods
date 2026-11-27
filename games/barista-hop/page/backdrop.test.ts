import { expect, it, vi } from 'vitest';
import { attachBackdrop } from './backdrop.ts';

it.each(['context lost', 'disposed'])('keeps flat rendering when initialization finishes after %s', async (reason) => {
  const canvas = new EventTarget();
  const renderer = { dispose: vi.fn() };
  let finish!: (ready: typeof renderer) => void;
  const show = vi.fn(), failed = vi.fn();
  const dispose = attachBackdrop(canvas, () => new Promise(resolve => { finish = resolve; }), show, failed);
  if (reason === 'context lost') canvas.dispatchEvent(new Event('webglcontextlost'));
  else dispose();
  finish(renderer);
  await Promise.resolve();
  expect(show.mock.calls).toEqual([[null]]);
  expect(renderer.dispose).toHaveBeenCalledOnce();
  expect(failed).not.toHaveBeenCalled();
  dispose();
  expect(renderer.dispose).toHaveBeenCalledOnce();
});

it('uses the ready renderer until context loss, then restores flat rendering', async () => {
  const canvas = new EventTarget(), renderer = { dispose: vi.fn() }, show = vi.fn();
  const dispose = attachBackdrop(canvas, async () => renderer, show, vi.fn());
  await Promise.resolve();
  canvas.dispatchEvent(new Event('webglcontextlost'));
  expect(show.mock.calls).toEqual([[renderer], [null]]);
  dispose();
  expect(renderer.dispose).toHaveBeenCalledOnce();
});
