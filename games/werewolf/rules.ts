import { z } from 'zod';
import type { Ctx, Ending, SeatId, TableGame } from '../kit/game.ts';
import { chance, pick, shuffle } from '../kit/random.ts';

const MAX_DAYS = 8;
type Role = 'wolf' | 'seer' | 'doctor' | 'villager';
interface Finding {
  target: SeatId;
  wolf: boolean;
}
interface State {
  stage: 'night' | 'discussion' | 'vote';
  order: SeatId[];
  roles: Record<SeatId, Role>;
  dead: SeatId[];
  findings: Record<SeatId, Finding[]>;
  night: Record<SeatId, { kind: 'kill' | 'save' | 'inspect'; target: SeatId }>;
  /** What was said since the last dawn. Computer players read it through the following night. */
  said: { seat: SeatId; text: string }[];
  spoken: SeatId[];
  votes: Record<SeatId, SeatId>;
  turn?: SeatId;
  days: number;
  over: boolean;
}

const seat = z.custom<SeatId>((value) => typeof value === 'string' && /^s\d+$/.test(value), 'Invalid living target');
const speechRule = 'Speech must be 1–280 characters';
const move = z.discriminatedUnion('action', [
  z.object({ action: z.literal('kill'), target: seat }),
  z.object({ action: z.literal('save'), target: seat }),
  z.object({ action: z.literal('inspect'), target: seat }),
  z.object({ action: z.literal('speak'), text: z.string(speechRule).max(280, speechRule).refine((text) => text.trim().length > 0, speechRule) }),
  z.object({ action: z.literal('vote'), target: seat }),
]);
type Move = z.infer<typeof move>;

interface View {
  stage: State['stage'];
  turn?: SeatId;
  alive: SeatId[];
  /** Everyone's role, once the match is over. */
  roles?: Record<SeatId, Role>;
  /** Absent for someone who was not dealt in. */
  you?: { role: Role; findings: Finding[]; wolfTeam?: SeatId[] };
}

const nightAction = { wolf: 'kill', seer: 'inspect', doctor: 'save' } as const;
const alive = (s: State) => s.order.filter((id) => !s.dead.includes(id));
const nameOf = (ctx: Ctx, id: SeatId) => ctx.seats.find((x) => x.id === id)?.name ?? id;

function winner(s: State): Ending | undefined {
  const living = alive(s);
  const wolves = living.filter((id) => s.roles[id] === 'wolf').length;
  if (wolves === 0) return { summary: '村民陣營', counted: true };
  if (wolves >= living.length - wolves) return { summary: '狼人陣營', counted: true };
}

function dawn(s: State, ctx: Ctx): Ending | undefined {
  const counts: Record<string, number> = {};
  for (const action of Object.values(s.night)) if (action.kind === 'kill') counts[action.target] = (counts[action.target] ?? 0) + 1;
  const target = (Object.keys(counts) as SeatId[]).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))[0];
  const saved = Object.values(s.night).find((action) => action.kind === 'save')?.target;
  if (target && target !== saved) {
    s.dead.push(target);
    ctx.say(`${nameOf(ctx, target)} 夜間出局（角色不公開）`);
  } else ctx.say('平安夜');
  s.said = [];
  const ending = winner(s);
  if (ending) return ending;
  s.stage = 'discussion';
  s.spoken = [];
  s.turn = alive(s)[0];
}

function tally(s: State, ctx: Ctx): Ending | undefined {
  const counts: Record<string, number> = {};
  for (const target of Object.values(s.votes)) counts[target] = (counts[target] ?? 0) + 1;
  const ranked = (Object.keys(counts) as SeatId[]).sort((a, b) => counts[b] - counts[a]);
  if (ranked.length === 1 || counts[ranked[0]] !== counts[ranked[1]]) {
    s.dead.push(ranked[0]);
    ctx.say(`${nameOf(ctx, ranked[0])} 投票出局（角色不公開）`);
  } else ctx.say('同票，無人出局');
  const ending = winner(s);
  if (ending) return ending;
  if (++s.days >= MAX_DAYS) return { summary: '八天過去仍未分出勝負，平局', counted: true };
  s.stage = 'night';
  s.night = {};
  s.turn = undefined;
}

/** Living seats other than `self`, most accused first: one point per mention today, five when a seer claim names them a wolf. */
function suspects(s: State, ctx: Ctx, self: SeatId): SeatId[] {
  const score = new Map<SeatId, number>();
  for (const { seat: speaker, text } of s.said) {
    for (const id of alive(s)) {
      const name = nameOf(ctx, id);
      if (id === speaker || id === self || !text.includes(name)) continue;
      const named = text.includes('預言家') && text.includes(`${name}，他是狼人`);
      score.set(id, (score.get(id) ?? 0) + (named ? 5 : 1));
    }
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

function speech(s: State, ctx: Ctx, self: SeatId, others: SeatId[], caught: Finding | undefined): string {
  const role = s.roles[self];
  if (role === 'seer' && caught) return `我是預言家。昨晚查了 ${nameOf(ctx, caught.target)}，他是狼人！今天請大家投他。`;
  const last = s.findings[self].at(-1);
  if (role === 'seer' && last && !last.wolf && chance(ctx.rng, 60)) return `我是預言家，查過 ${nameOf(ctx, last.target)}，是好人。狼還藏在其他人裡面。`;
  if (role === 'wolf') {
    const accuser = s.said.find(({ text }) => text.includes(nameOf(ctx, self)));
    if (accuser) return `我是好人，${nameOf(ctx, accuser.seat)} 一直把矛頭指向我，反而很可疑。`;
    const mark = nameOf(ctx, pick(ctx.rng, others.filter((id) => s.roles[id] !== 'wolf')));
    return pick(ctx.rng, [`我覺得 ${mark} 太安靜了，有點可疑。`, `${mark} 剛剛的說法前後對不起來，我先記一筆。`]);
  }
  const [accused] = suspects(s, ctx, self);
  if (accused) return pick(ctx.rng, [`我同意，${nameOf(ctx, accused)} 的反應很奇怪。`, `目前我最懷疑 ${nameOf(ctx, accused)}，先聽他怎麼解釋。`]);
  const mark = nameOf(ctx, pick(ctx.rng, others));
  return pick(ctx.rng, ['昨晚沒什麼線索，我先聽聽大家的想法。', `我想聽 ${mark} 多說一點，現在資訊太少了。`, '大家都有點保守，狼人一定在偷笑。']);
}

export const werewolf: TableGame<State, Move, View> = {
  card: {
    id: 'werewolf',
    title: { 'zh-TW': '狼人殺', 'zh-CN': '狼人杀', ja: '人狼', ko: '마피아', en: 'Werewolf' },
    version: 1,
    players: { min: 5, max: 6 },
    residents: { brief: 'Night actions (kill, save, inspect) are private and take a target seat id. Speak once when called, then vote once with a target seat id.' },
  },
  move,
  simultaneous: ['kill', 'save', 'inspect', 'vote'],
  start(ctx) {
    const order = ctx.seats.map((x) => x.id);
    const roles = shuffle<Role>(ctx.rng, order.length === 5 ? ['wolf', 'seer', 'doctor', 'villager', 'villager'] : ['wolf', 'wolf', 'seer', 'doctor', 'villager', 'villager']);
    return {
      stage: 'night',
      order,
      roles: Object.fromEntries(order.map((id, i) => [id, roles[i]])),
      dead: [],
      findings: Object.fromEntries(order.map((id) => [id, []])),
      night: {},
      said: [],
      spoken: [],
      votes: {},
      days: 0,
      over: false,
    };
  },
  legal(s, id) {
    if (s.over || !alive(s).includes(id)) return [];
    const role = s.roles[id];
    if (s.stage === 'night') return role !== 'villager' && !s.night[id] ? [nightAction[role]] : [];
    if (s.stage === 'discussion') return s.turn === id ? ['speak'] : [];
    return s.votes[id] ? [] : ['vote'];
  },
  play(s, id, m, ctx) {
    if (m.action === 'speak') {
      ctx.say(`${nameOf(ctx, id)}：${m.text}`);
      s.said.push({ seat: id, text: m.text });
      s.spoken.push(id);
      const next = alive(s).find((x) => !s.spoken.includes(x));
      if (next) s.turn = next;
      else Object.assign(s, { stage: 'vote', turn: undefined, votes: {} });
      return;
    }
    if (!alive(s).includes(m.target)) throw new Error('Invalid living target');
    let ending: Ending | undefined;
    if (m.action === 'vote') {
      s.votes[id] = m.target;
      if (alive(s).every((x) => s.votes[x])) ending = tally(s, ctx);
    } else {
      if (m.action === 'kill' && s.roles[m.target] === 'wolf') throw new Error('Cannot target wolf team');
      if (m.action === 'inspect') s.findings[id].push({ target: m.target, wolf: s.roles[m.target] === 'wolf' });
      s.night[id] = { kind: m.action, target: m.target };
      if (alive(s).every((x) => s.roles[x] === 'villager' || s.night[x])) ending = dawn(s, ctx);
    }
    if (ending) s.over = true;
    return ending;
  },
  view(s, id, ended) {
    const role = id && s.roles[id];
    return {
      stage: s.stage,
      turn: s.turn,
      alive: alive(s),
      roles: ended ? s.roles : undefined,
      you: role ? { role, findings: s.findings[id], wolfTeam: role === 'wolf' ? s.order.filter((x) => s.roles[x] === 'wolf') : undefined } : undefined,
    };
  },
  bot(s, id, ctx) {
    const living = alive(s);
    const others = living.filter((x) => x !== id);
    const good = living.filter((x) => s.roles[x] !== 'wolf');
    const role = s.roles[id];
    const caught = s.findings[id].find((f) => f.wolf && living.includes(f.target));
    const claimedSeer = s.said.find(({ text }) => text.startsWith('我是預言家'))?.seat;
    if (s.stage === 'night') {
      if (role === 'wolf') {
        const agreed = Object.values(s.night).find((action) => action.kind === 'kill')?.target;
        return { action: 'kill', target: agreed ?? good.find((x) => x === claimedSeer) ?? pick(ctx.rng, good) };
      }
      if (role === 'seer') {
        const unknown = others.filter((x) => !s.findings[id].some((f) => f.target === x));
        return { action: 'inspect', target: pick(ctx.rng, unknown.length ? unknown : others) };
      }
      const seer = living.find((x) => x === claimedSeer);
      return { action: 'save', target: seer && chance(ctx.rng, 60) ? seer : chance(ctx.rng, 35) ? id : pick(ctx.rng, living) };
    }
    if (s.stage === 'discussion') return { action: 'speak', text: speech(s, ctx, id, others, caught) };
    const accused = suspects(s, ctx, id);
    return { action: 'vote', target: caught?.target ?? (role === 'wolf' ? (accused.find((x) => s.roles[x] !== 'wolf') ?? pick(ctx.rng, good)) : accused[0]) ?? pick(ctx.rng, others) };
  },
};
