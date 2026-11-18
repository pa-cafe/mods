import { describe, expect, it } from 'vitest';
import { hudScale, squat, topBar } from './hud';

describe('BARISTA BLAST!! HUD on a phone held sideways', () => {
  const sideways = [{ width: 844, height: 390 }, { width: 932, height: 430 }];
  const unchanged = [{ width: 390, height: 844 }, { width: 1280, height: 720 }];

  it('only short, wide screens pack the HUD', () => {
    for (const view of sideways) expect(squat(view)).toBe(true);
    for (const view of unchanged) expect(squat(view)).toBe(false);
    expect(squat({ width: 500, height: 500 })).toBe(false);
  });

  it('a phone held upright and a laptop keep the size and scoreboard they had', () => {
    for (const view of unchanged) {
      const k = Math.min(1, Math.max(0.6, view.width / 900)), w = Math.min(580, view.width - 24);
      expect(hudScale(view)).toBe(k);
      expect(topBar(view)).toEqual({ x: (view.width - w) / 2, y: 14 * k, width: w, height: Math.round(96 * Math.max(k, 0.82)), thin: false });
    }
  });

  it('sideways, the scoreboard is a thin strip clear of the leave button, at most an eighth of the height', () => {
    for (const view of sideways) {
      const bar = topBar(view);
      expect(bar.thin).toBe(true);
      expect(bar.y + bar.height).toBeLessThanOrEqual(view.height / 8 + 8);
      expect(bar.x + bar.width).toBeLessThanOrEqual(view.width - 75);
      expect(hudScale(view)).toBeCloseTo(view.height / 560);
    }
  });
});
