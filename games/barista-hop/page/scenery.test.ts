import { describe, expect, it } from 'vitest';
import { scenes } from '../../barista-blast/page/scenes.ts';
import { hopTuning } from '../rules.ts';
import { hopZones, zoneAt } from './scenery.ts';

describe('BARISTA HOP!! scenery', () => {
  it('climbs through every one of BARISTA BLAST!!\'s scenes, in its order', () => {
    expect(hopZones.length).toBe(scenes.length);
    expect(hopZones.map(from => zoneAt(from))).toEqual(scenes.map((_, index) => index));
    expect([zoneAt(0), zoneAt(99.9), zoneAt(399), zoneAt(5000)]).toEqual([0, 0, 2, scenes.length - 1]);
  });

  it('begins each place at a height where a counter stands, so its street has a kerb', () => {
    expect(hopZones.every(from => from % hopTuning.counterEvery === 0)).toBe(true);
  });
});
