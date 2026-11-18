import { blastTokens, blastTuning } from '../rules.ts';
import type { TextKey } from './i18n.ts';
import { scenes } from './scenes';

const names = ['Taipei', 'Hsinchu Science Park', 'San Francisco', 'Orbit', 'Divine Realm', 'Void'] as const satisfies readonly TextKey[];

/** `area` counts from 1. `next` is the following place and the metres left to it from where the run stopped, or null past the last. */
export type Reached = { area: number; name: TextKey; next: { name: TextKey; meters: number } | null };

function metersFor(tokens: number) {
  const { tokenBase, tokenScale, tokenPower } = blastTuning;
  return tokens <= tokenBase ? 0 : tokenScale * ((tokens / tokenBase) ** (1 / tokenPower) - 1);
}

/** The place a run that stopped `x` metres down the street reached. */
export function placeAt(x: number): Reached {
  const tokens = blastTokens(x), at = Math.max(0, scenes.findLastIndex(scene => tokens >= scene.from)), following = scenes[at + 1];
  return {
    area: at + 1, name: names[at],
    next: following ? { name: names[at + 1], meters: Math.max(1, Math.ceil(metersFor(following.from) - x)) } : null,
  };
}
