import { limits, OverLimit, type AnyTableGame, type Ctx, type Ending, type Seat, type SeatId } from './game.ts';
import { seeded } from './random.ts';

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value) ?? '').length;

interface Playout {
  moves: number;
  ms: number;
  ending: Ending;
  /** Every seat's view after every move, for comparing two runs of the same seed. */
  views: string;
}

/** One match played by computer players alone, held to every limit the cafe enforces at run time. */
export function playout(game: AnyTableGame, seed: number, seatCount: number): Playout {
  const { bot } = game;
  if (!bot) throw new Error(`${game.card.id}: a playout needs bot()`);
  let lines = 0;
  const seats: Seat[] = Array.from({ length: seatCount }, (_, i) => ({ id: `s${i}` as SeatId, name: `P${i}`, kind: 'bot' }));
  const ctx: Ctx = {
    seats,
    now: 0,
    rng: seeded(seed),
    say: (text) => {
      if (text.length > limits.lineChars) throw new OverLimit('lineChars', text.length);
      if (++lines > limits.linesPerMove) throw new OverLimit('linesPerMove', lines);
    },
  };
  const hold = (limit: Exclude<keyof typeof limits, 'msPerMove'>, measured: number) => {
    if (measured > limits[limit]) throw new OverLimit(limit, measured);
  };
  let state = game.start(ctx);
  const views: string[] = [];
  const turns = new Map<SeatId, number>();
  const called = new Map<SeatId, string>();
  let ms = 0;
  for (let moves = 1; ; moves++) {
    hold('movesPerMatch', moves);
    for (const { id } of seats) {
      const actions = game.legal(state, id);
      const call = actions.length ? `${state.stage}:${actions.join(',')}` : '';
      if (call && call !== called.get(id)) {
        turns.set(id, (turns.get(id) ?? 0) + 1);
        hold('turnsPerSeat', turns.get(id)!);
      }
      called.set(id, call);
    }
    const due = seats.find(({ id }) => game.legal(state, id).length > 0);
    if (!due) throw new Error(`${game.card.id}: no seat can move and the match has not ended (stage ${state.stage})`);
    lines = 0;
    const began = performance.now();
    const sent = bot.call(game, state, due.id, ctx);
    hold('moveBytes', bytes(sent));
    const move = game.move.parse(sent);
    if (!game.legal(state, due.id).includes(move.action)) throw new Error(`${game.card.id}: bot played ${move.action}, which is not legal`);
    const ending = game.play(state, due.id, move, ctx);
    const seen = [undefined, ...seats.map(({ id }) => id)].map((id) => game.view(state, id, Boolean(ending)));
    ms += performance.now() - began;
    hold('stateBytes', bytes(state));
    for (const view of seen) hold('viewBytes', bytes(view));
    state = JSON.parse(JSON.stringify(state));
    views.push(JSON.stringify(seen));
    if (!ending) continue;
    const { score } = game.card;
    for (const [seat, value] of Object.entries(ending.scores ?? {})) {
      if (!score) throw new Error(`${game.card.id}: reported a score but its card declares none`);
      if (!Number.isInteger(value) || value! < 0 || value! > score.max) throw new Error(`${game.card.id}: score ${value} for ${seat} is outside 0–${score.max}`);
    }
    return { moves, ms, ending, views: views.join('\n') };
  }
}

/**
 * The admission check for a table game: at every table size it allows, computer players finish every seeded match
 * inside the limits, and the same seed replays to the same views.
 */
export function admit(game: AnyTableGame, seeds = 100) {
  const { min, max } = game.card.players;
  let moves = 0, ms = 0;
  for (let seatCount = min; seatCount <= max; seatCount++) {
    for (let seed = 1; seed <= seeds; seed++) {
      const first = playout(game, seed, seatCount);
      const again = playout(game, seed, seatCount);
      if (first.views !== again.views || first.ending.summary !== again.ending.summary) throw new Error(`${game.card.id}: seed ${seed} with ${seatCount} seats does not replay to the same match`);
      moves += first.moves + again.moves;
      ms += first.ms + again.ms;
    }
  }
  if (ms / moves > limits.msPerMove) throw new OverLimit('msPerMove', ms / moves);
  return { matches: (max - min + 1) * seeds, moves: moves / 2 };
}
