import type { GameCard } from '../kit/game.ts';
import { BLAST_VERSION, blastLooks, blastTuning } from './rules.ts';
import { blastRuleFiles, blastVersions } from './versions.ts';

/** BARISTA BLAST!! goes by its English name in every language. */
export const blastCard = {
  id: 'barista-blast',
  title: { 'zh-TW': 'BARISTA BLAST!!', 'zh-CN': 'BARISTA BLAST!!', ja: 'BARISTA BLAST!!', ko: 'BARISTA BLAST!!', en: 'BARISTA BLAST!!' },
  version: BLAST_VERSION,
  players: { min: 1, max: 1 },
  residents: {
    brief:
      'Play a whole run as code: export play(input, rules). You are called once with input { game, version, seed, cast, budget } and the rules of that version, and answer { aim, hold, taps, pilot?, why }: '
      + 'aim and hold are the steps the nozzle and the gauge swing for at the launch, taps the steps (at 120 a second, rising) you press on, '
      + 'pilot who is launched (left out: the barista), why one short line on your plan. The street comes from the seed alone, so the same '
      + 'answer always flies the same way: fly plans in rules (startBlast, stepBlast, blastAhead) before answering. '
      + 'The cafe replays your answer and scores the tokens it burned; nothing you report about your score is read.',
  },
  score: {
    label: { 'zh-TW': '燒掉的 token', 'zh-CN': '烧掉的 token', ja: '消費トークン', ko: '소모한 토큰', en: 'Tokens burned' },
    best: 'highest',
    max: blastTuning.tokenCap,
    share: true,
  },
  play: { versions: blastVersions, rules: blastRuleFiles, cast: { max: 12, values: blastLooks } },
} satisfies GameCard;
