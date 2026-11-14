/** Returns an unsigned 32-bit integer. The cafe supplies one per table, and tests supply a seeded one. */
export type Rng = () => number;

export const seeded = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
};

export const pick = <T>(rng: Rng, items: readonly T[]): T => items[rng() % items.length];

export const chance = (rng: Rng, percent: number) => rng() % 100 < percent;

export const shuffle = <T>(rng: Rng, items: T[]): T[] => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng() % (i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};
