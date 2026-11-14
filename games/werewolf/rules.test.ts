import { describe, expect, it } from 'vitest';
import type { Ctx, Ending, Seat, SeatId } from '../kit/game.ts';
import { seeded } from '../kit/random.ts';
import { werewolf } from './rules.ts';

type Role = NonNullable<ReturnType<typeof werewolf.view>['you']>['role'];

/** A table of people, driven the way the cafe drives one: a move is parsed, checked against `legal`, then played. */
function table(seatCount: number, seed = 1) {
  const log: string[] = [];
  const seats: Seat[] = Array.from({ length: seatCount }, (_, i) => ({ id: `s${i}` as SeatId, name: `玩家${i}`, kind: 'human' }));
  const ctx: Ctx = { seats, now: 0, rng: seeded(seed), say: (text) => log.push(text) };
  const state = werewolf.start(ctx);
  const ids = seats.map((s) => s.id);
  let ending: Ending | undefined;
  const view = (id: SeatId) => werewolf.view(state, id, Boolean(ending));
  const mine = (id: SeatId) => view(id).you!;
  const withRole = (role: Role) => ids.filter((id) => mine(id).role === role);
  const alive = () => view(ids[0]).alive;
  const watching = () => werewolf.view(state, undefined, Boolean(ending));
  const play = (id: SeatId, input: unknown) => {
    const move = werewolf.move.parse(input);
    if (!werewolf.legal(state, id).includes(move.action)) throw new Error(`${move.action} is not legal for ${id}`);
    return (ending = werewolf.play(state, id, move, ctx));
  };
  const first = <T>(items: T[]) => items[0];
  /** One night: the wolves kill `kill`, the doctor saves `save`, the seer inspects `inspect`. Whoever is dead stays quiet. */
  const night = ({ kill, save, inspect }: { kill: SeatId; save?: SeatId; inspect?: SeatId }) => {
    for (const id of alive()) {
      const role = mine(id).role;
      if (role === 'wolf') play(id, { action: 'kill', target: kill });
      if (role === 'doctor') play(id, { action: 'save', target: save ?? id });
      if (role === 'seer') play(id, { action: 'inspect', target: inspect ?? first(alive().filter((x) => x !== id)) });
      if (ending) return ending;
    }
    return ending;
  };
  /** One day: everyone alive speaks in turn, then votes as `ballot` says. */
  const day = (ballot: (voter: SeatId) => SeatId) => {
    for (const id of alive()) play(id, { action: 'speak', text: `${id} 發言` });
    for (const id of alive()) if (!ending) play(id, { action: 'vote', target: ballot(id) });
    return ending;
  };
  return { ids, log, view, mine, watching, withRole, alive, play, night, day, legal: (id: SeatId) => werewolf.legal(state, id), ending: () => ending };
}

describe('werewolf', () => {
  it('deals one wolf to five seats and two to six, always with one seer and one doctor', () => {
    for (const [seats, wolves] of [[5, 1], [6, 2]] as const) {
      const t = table(seats);
      expect(t.withRole('wolf')).toHaveLength(wolves);
      expect(t.withRole('seer')).toHaveLength(1);
      expect(t.withRole('doctor')).toHaveLength(1);
      expect(t.withRole('villager')).toHaveLength(2);
    }
  });

  it('gives each role its own night action and villagers none', () => {
    const t = table(5);
    expect(t.legal(t.withRole('wolf')[0])).toEqual(['kill']);
    expect(t.legal(t.withRole('seer')[0])).toEqual(['inspect']);
    expect(t.legal(t.withRole('doctor')[0])).toEqual(['save']);
    for (const id of t.withRole('villager')) expect(t.legal(id)).toEqual([]);
  });

  it('does not let a wolf kill a wolf or anyone act twice in one night', () => {
    const t = table(6);
    const [wolf, partner] = t.withRole('wolf');
    expect(() => t.play(wolf, { action: 'kill', target: partner })).toThrow('Cannot target wolf team');
    t.play(wolf, { action: 'kill', target: t.withRole('villager')[0] });
    expect(() => t.play(wolf, { action: 'kill', target: t.withRole('villager')[1] })).toThrow('not legal');
  });

  it('takes the wolves’ target out at dawn without saying what they were', () => {
    const t = table(5);
    const victim = t.withRole('villager')[0];
    t.night({ kill: victim });
    expect(t.alive()).not.toContain(victim);
    expect(t.log).toEqual([`玩家${victim.slice(1)} 夜間出局（角色不公開）`]);
    expect(t.view(t.ids[0]).stage).toBe('discussion');
  });

  it('takes the lower seat when two wolves pick different targets', () => {
    const t = table(6);
    const [first, second] = t.withRole('wolf'), [low, high] = t.withRole('villager'), [doctor] = t.withRole('doctor'), [seer] = t.withRole('seer');
    t.play(first, { action: 'kill', target: high });
    t.play(second, { action: 'kill', target: low });
    t.play(doctor, { action: 'save', target: doctor });
    t.play(seer, { action: 'inspect', target: doctor });
    expect(t.alive()).not.toContain(low);
    expect(t.alive()).toContain(high);
  });

  it('keeps a seat that is out silent for the rest of the match', () => {
    const t = table(5);
    const victim = t.withRole('villager')[0];
    t.night({ kill: victim });
    expect(t.legal(victim)).toEqual([]);
    for (const id of t.alive()) t.play(id, { action: 'speak', text: '我是好人' });
    expect(t.alive().map(t.legal)).toEqual(t.alive().map(() => ['vote']));
    expect(t.legal(victim)).toEqual([]);
    expect(() => t.play(victim, { action: 'vote', target: t.alive()[0] })).toThrow('not legal');
  });

  it('spares the target the doctor saved', () => {
    const t = table(5);
    const victim = t.withRole('villager')[0];
    t.night({ kill: victim, save: victim });
    expect(t.alive()).toHaveLength(5);
    expect(t.log).toEqual(['平安夜']);
  });

  it('shows the seer’s finding to the seer alone', () => {
    const t = table(5);
    const [seer] = t.withRole('seer'), [wolf] = t.withRole('wolf'), [villager] = t.withRole('villager');
    t.night({ kill: villager, save: villager, inspect: wolf });
    expect(t.mine(seer).findings).toEqual([{ target: wolf, wolf: true }]);
    for (const id of t.ids.filter((x) => x !== seer)) expect(t.mine(id).findings).toEqual([]);
  });

  it('tells wolves who their partners are and tells nobody else', () => {
    const t = table(6);
    const wolves = t.withRole('wolf');
    for (const id of t.ids) expect(t.mine(id).wolfTeam).toEqual(wolves.includes(id) ? wolves : undefined);
  });

  it('calls on each living seat to speak once, in seat order, then opens the vote', () => {
    const t = table(5);
    const victim = t.withRole('villager')[0];
    t.night({ kill: victim, save: victim });
    for (const id of t.ids) {
      expect(t.view(id).turn).toBe(id);
      expect(t.ids.filter((x) => t.legal(x).includes('speak'))).toEqual([id]);
      t.play(id, { action: 'speak', text: '我是好人' });
    }
    expect(t.log.slice(1)).toEqual(t.ids.map((id) => `玩家${id.slice(1)}：我是好人`));
    expect(t.view(t.ids[0]).stage).toBe('vote');
    for (const id of t.ids) expect(t.legal(id)).toEqual(['vote']);
  });

  it('turns away speech that is blank or longer than 280 characters, and says why in words', () => {
    for (const text of ['   ', 'x'.repeat(281), undefined]) expect(werewolf.move.safeParse({ action: 'speak', text }).error?.issues[0].message).toBe('Speech must be 1–280 characters');
    expect(werewolf.move.parse({ action: 'speak', text: ' 我是好人 ' })).toEqual({ action: 'speak', text: ' 我是好人 ' });
    expect(werewolf.move.safeParse({ action: 'vote', target: 'nobody' }).error?.issues[0].message).toBe('Invalid living target');
  });

  it('ignores fields a move does not use', () => {
    expect(werewolf.move.parse({ action: 'vote', target: 's1', text: '我覺得是他', amount: 5 })).toEqual({ action: 'vote', target: 's1' });
  });

  it('shows someone who was not dealt in only what is public', () => {
    const t = table(5);
    const victim = t.withRole('villager')[0];
    t.night({ kill: victim });
    expect(t.watching()).toEqual({ stage: 'discussion', turn: t.alive()[0], alive: t.alive() });
  });

  it('votes out whoever has the most votes and lets each seat vote once', () => {
    const t = table(5);
    const [villager, other] = t.withRole('villager');
    t.night({ kill: villager, save: villager });
    t.day(() => other);
    expect(t.alive()).not.toContain(other);
    expect(t.log.at(-1)).toBe(`玩家${other.slice(1)} 投票出局（角色不公開）`);
    expect(t.view(t.ids[0]).stage).toBe('night');
  });

  it('sends nobody out on a tied vote', () => {
    const t = table(5);
    const [a, b] = t.withRole('villager');
    t.night({ kill: a, save: a });
    const ballots = [a, a, b, b, t.withRole('wolf')[0]];
    t.day((voter) => ballots[t.ids.indexOf(voter)]);
    expect(t.alive()).toHaveLength(5);
    expect(t.log.at(-1)).toBe('同票，無人出局');
  });

  it('ends for the village when the last wolf is voted out, and only then shows every role', () => {
    const t = table(5);
    const [wolf] = t.withRole('wolf'), [villager] = t.withRole('villager');
    t.night({ kill: villager, save: villager });
    for (const id of t.ids) expect(t.view(id).roles).toBeUndefined();
    expect(t.day(() => wolf)).toEqual({ summary: '村民陣營', counted: true });
    for (const id of t.ids) {
      expect(Object.values(t.view(id).roles!).sort()).toEqual(['doctor', 'seer', 'villager', 'villager', 'wolf']);
      expect(t.legal(id)).toEqual([]);
    }
  });

  it('ends for the wolves once they are no fewer than everyone else', () => {
    const t = table(5);
    const [wolf] = t.withRole('wolf'), [seer] = t.withRole('seer'), [doctor] = t.withRole('doctor'), [a, b] = t.withRole('villager');
    t.night({ kill: a, save: doctor });
    expect(t.day(() => b)).toBeUndefined();
    expect(t.night({ kill: seer, save: doctor })).toEqual({ summary: '狼人陣營', counted: true });
    expect(t.alive().sort()).toEqual([wolf, doctor].sort());
  });

  it('calls a draw after eight days with no winner', () => {
    const t = table(5);
    const [a, b] = t.withRole('villager');
    const ballots = [a, a, b, b, t.withRole('wolf')[0]];
    for (let d = 1; d <= 8; d++) {
      expect(t.ending()).toBeUndefined();
      t.night({ kill: a, save: a });
      t.day((voter) => ballots[t.ids.indexOf(voter)]);
    }
    expect(t.ending()).toEqual({ summary: '八天過去仍未分出勝負，平局', counted: true });
  });
});
