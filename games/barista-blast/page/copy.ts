import type { TextKey } from './i18n.ts';

export const blastMilestones: readonly { tokens: number; line: TextKey }[] = [
  { tokens: 8_000, line: 'This used to be a whole context window' },
  { tokens: 128_000, line: 'Starting to forget what you said at the start' },
  { tokens: 200_000, line: 'Normally the window would be full by now' },
  { tokens: 1e6, line: 'Welcome to the million-token club' },
  { tokens: 1e7, line: 'The bill went to the manager’s inbox' },
  { tokens: 1e8, line: 'The finance team would like a word' },
  { tokens: 1e9, line: 'This month’s coffee beans went to the API bill' },
  { tokens: 1e10, line: 'You’re keeping a whole data centre busy' },
  { tokens: 5e10, line: 'The power company is on the phone' },
];
export const milestoneTokens = blastMilestones.map(milestone => milestone.tokens);

const verdicts: readonly [below: number, line: TextKey][] = [
  [1e4, 'Penny-pinching mode'],
  [1e6, 'Free-trial tier'],
  [1e8, 'A normal day at work'],
  [1e9, 'Vibe coded all night'],
  [1e10, 'You’re the one who burns a month’s quota in a day'],
  [Infinity, 'Please contact sales about an enterprise plan'],
];
export const verdictFor = (tokens: number) => verdicts.find(([below]) => tokens < below)![1];

export const FLOP_METERS = 20;
export const flopLines: readonly TextKey[] = ['That’s it? Not enough tokens to even say hello', 'Not enough steam. Time to descale the machine', 'Budget mode on', 'That’s all, and you’ve hit your usage limit. Come back in five hours'];
export const timeoutLine: TextKey = 'max_tokens reached. Output cut off';

export const launchCard = (power: number): TextKey | null => power >= 0.9 ? 'Overpressure!' : power < 0.25 ? 'Pfft…' : null;

export const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
