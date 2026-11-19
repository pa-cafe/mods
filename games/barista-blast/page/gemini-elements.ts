// Gemini 4 names its models after elements: Hydrogen, Carbon, Neon, Argon. Two gags come of it, and both are only what the
// screen draws: Gemini's name tag runs through the table, and a run flown by her happens at night, in neon. Nothing here is
// read by the rules. It looks at who flies, at the seed the street came from and at where a hit landed, never writes to a run,
// and draws the same thing every time the same run is played again.
import type { BlastKind, BlastPilot } from '../rules.ts';
import { hash } from './art';
import type { TextKey } from './i18n.ts';

export type Element = { symbol: string; number: number; name: TextKey; ink: string; fill: string };

/** In the order Google shipped them: H, C, Ne, Ar. Colours follow how each gas looks in a tube. */
export const elements: readonly Element[] = [
  { symbol: 'H', number: 1, name: 'Hydrogen', ink: '#0B2A4A', fill: '#9FE8FF' },
  { symbol: 'C', number: 6, name: 'Carbon', ink: '#F4F1E6', fill: '#4A4F5C' },
  { symbol: 'Ne', number: 10, name: 'Neon', ink: '#3A0A06', fill: '#FF6A45' },
  { symbol: 'Ar', number: 18, name: 'Argon', ink: '#241049', fill: '#C9A8FF' },
];

/** How long one name stays on her tag before the next one flips in. */
export const ELEMENT_MS = 330;
/** The part of a step the old name spends turning away, as the next one turns in. */
export const FLIP = 0.28;

/** Which element a name tag shows `ms` after the run began: each tag starts somewhere of its own, which the seed and its place on the street decide, then steps H, C, Ne, Ar and round again. */
export function elementAt(seed: number, place: number, ms: number) {
  const start = Math.floor(hash(Math.floor(place * 4) ^ seed, 87) * elements.length), steps = Math.floor(Math.max(0, ms) / ELEMENT_MS);
  const index = (start + steps) % elements.length, since = (Math.max(0, ms) % ELEMENT_MS) / ELEMENT_MS;
  return { element: elements[index], index, flip: since < FLIP ? since / FLIP : 1 };
}

/** The night in neon belongs to the run Gemini flies: 1 for her, 0 for anyone else. */
export const neonFor = (pilot: BlastPilot | undefined): 0 | 1 => pilot === 'gemini' ? 1 : 0;

/** Closer to `to` by a share of the way that depends on how much time went by, so the night comes on and goes off over about a second, however fast frames come. */
export const settleNeon = (level: number, to: number, seconds: number) => { const next = level + (to - level) * (1 - Math.exp(-seconds / 0.35)); return Math.abs(next - to) < 0.004 ? to : next; };

/** The neon colours of the street at night, in the order the signs, the lamps and the light on the pavement take them. */
export const neonColors = ['#FF3D9A', '#2EE6FF', '#9B6BFF', '#FF6A45', '#B6FF3B'] as const;
export const neonColorAt = (place: number) => neonColors[Math.floor(hash(Math.floor(place), 93) * neonColors.length)];

/** Her rare entrance: about one street in seven has the table fall for her, on the first Gemini the run meets (or, with her at the controls, on the first boost). */
export const TABLE_SHARE = 1 / 7;
export const tableOnStreet = (seed: number) => hash(seed, 97) < TABLE_SHARE;
/** Whether this hit is where that street's table falls: a Gemini on the street, or the first boost when she flies. */
export const tableFalls = (seed: number, pilot: BlastPilot, hit: { as: BlastKind; outcome: string }) =>
  tableOnStreet(seed) && (pilot === 'gemini' ? hit.outcome === 'boost' : hit.as === 'gemini');

/** The periodic table as it falls: 7 periods of 18 columns, with the places that hold no cell left empty. Each cell is `[period, group]`. */
const SPAN: readonly (readonly [from: number, to: number][])[] = [
  [[1, 1], [18, 18]], [[1, 2], [13, 18]], [[1, 2], [13, 18]], [[1, 18]], [[1, 18]], [[1, 18]], [[1, 18]],
];
export const tableCells = SPAN.flatMap((spans, row) => spans.flatMap(([from, to]) => Array.from({ length: to - from + 1 }, (_, i) => ({ row, column: from + i - 1 }))));
/** The four cells Gemini has taken so far, in the table's own coordinates: H is period 1 group 1, C period 2 group 14, Ne period 2 group 18, Ar period 3 group 18. */
export const takenCells = [{ row: 0, column: 0 }, { row: 1, column: 13 }, { row: 1, column: 17 }, { row: 2, column: 17 }] as const;
