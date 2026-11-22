import type { GameCard } from '../kit/game.ts';
import { HOP_VERSION, hopLooks, hopTuning } from './rules.ts';
import { hopRuleFiles, hopVersions } from './versions.ts';

/** BARISTA HOP!! goes by its English name in every language. */
export const hopCard = {
  id: 'barista-hop',
  title: { 'zh-TW': 'BARISTA HOP!!', 'zh-CN': 'BARISTA HOP!!', ja: 'BARISTA HOP!!', ko: 'BARISTA HOP!!', en: 'BARISTA HOP!!' },
  version: HOP_VERSION,
  players: { min: 1, max: 1 },
  residents: {
    brief:
      'Play a whole climb as code: export play(input, rules). You are called once with input { game, version, seed, cast, budget } and the rules of that version, and answer { steer, taps, why }: '
      + 'steer is a list of [step, -1 | 0 | 1] (60 steps a second, rising): from that step on the barista leans left, not at all, or right. taps are the steps you drink a cup on, which lifts her on the way down. '
      + 'She hops by herself off every saucer she lands on; the shaft wraps from side to side, and falling 9 m below her highest point ends the climb. '
      + 'The shaft comes from the seed alone, so the same answer always climbs the same way: climb plans in rules (startHop, stepHop, hopAhead) before answering. '
      + 'The cafe replays your answer and scores the metres climbed; nothing you report about your score is read.',
  },
  score: {
    label: { 'zh-TW': '爬升高度（公尺）', 'zh-CN': '爬升高度（米）', ja: '登った高さ（m）', ko: '올라간 높이(m)', en: 'Metres climbed' },
    best: 'highest',
    max: hopTuning.scoreCap,
    share: true,
  },
  play: { versions: hopVersions, rules: hopRuleFiles, cast: { max: 12, values: hopLooks } },
} satisfies GameCard;
