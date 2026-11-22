// A sample resident bot for BARISTA HOP!!. It climbs once in the rules the cafe hands it: after each hop it picks the
// best saucer it can still reach, leans toward it, and drinks a cup when it has missed or has nowhere to go. Copy it and make it yours.
//
// It imports nothing, so this one file is what you send. Try it first:
// npm run play -- barista-hop --bot games/barista-hop/examples/bot.js --runs 20

/** The answer may hold this many changes of lean; the bot stops leaning a little before that. */
const TURNS = 1900;

export function play({ seed }, rules) {
  const { hopAcross, hopAhead, hopSpotX, hopTuning: T, startHop, stepHop } = rules;
  const run = startHop(seed), steer = [], taps = [];
  let lean = 0, aim = null, from = 0;

  /** How good a landing is: a rocket, a toss and a counter first, then the highest thing that holds. */
  const worth = (sight) => (sight.deed === 'rocket' ? 60 : sight.deed === 'toss' ? 8 : sight.deed === 'weak' ? -6 : 0) + (sight.kind === 'counter' ? 3 : sight.kind === 'foam' ? -0.5 : 0) + sight.up;

  /** The best thing to land on next, out of what this hop can still reach. */
  function choose() {
    const peak = run.vy > 0 ? run.vy * run.vy / (2 * T.gravity) : 0;
    let best = null;
    for (const sight of hopAhead(run, peak)) {
      if (sight.kind === 'cloud' || sight.up > peak - 0.25) continue;
      // Steps until the feet come back down to its height, by the same sums the rules do.
      let y = 0, vy = run.vy, steps = 0;
      while (vy > 0 || y > sight.up) { vy -= T.gravity / 60; y += vy / 60; steps++; }
      if (Math.abs(sight.across) > T.run * steps / 60 * 0.8 + sight.width / 2) continue;
      if (!best || worth(sight) > worth(best)) best = sight;
    }
    return best;
  }

  /** Where the thing aimed at is now: a cart has moved since it was chosen. */
  function across() {
    for (const row of run.rows) {
      if (row.y !== aim.y) continue;
      for (const spot of row.spots) if (!spot.gone && spot.kind === aim.kind && Math.abs(hopAcross(hopSpotX(spot, run.step), aim.x)) < 3) return hopAcross(hopSpotX(spot, run.step), run.x);
    }
    return null;
  }

  /** The nearest thing that holds below the feet, other than the saucer just left: where to come down after a miss or a dead end. */
  function below() {
    let best = null;
    for (const row of run.rows) {
      if (row.y >= run.y || row.y < run.top - T.drop + 1) continue;
      for (const spot of row.spots) {
        if (spot.gone || spot.who?.deed === 'weak' || row.y === from) continue;
        const x = hopSpotX(spot, run.step), gap = Math.abs(hopAcross(x, run.x)) - (run.y - row.y) * 0.5;
        if (!best || gap < best.gap) best = { x, y: row.y, kind: spot.kind, gap };
      }
    }
    return best;
  }

  while (!run.end) {
    if (run.event) { aim = choose(); from = run.y; }
    // Nothing in reach from here, or the saucer aimed at is now overhead: a cup if there is one, else the way back down.
    const lost = run.vy <= 0 && run.rocket === 0 && (!aim || aim.y > run.y);
    const tap = lost && run.cups > 0;
    if (lost && !tap) aim = below();
    let want = 0;
    const gap = aim ? across() : null;
    // Lean until the saucer is under the feet, allowing for the slide after letting go. Once still, stay still for a
    // small drift: every change of lean is two numbers of the answer.
    if (gap !== null) { const short = gap - run.vx * 0.1; const slack = lean === 0 ? 0.5 : 0.2; want = short > slack ? 1 : short < -slack ? -1 : 0; }
    if (steer.length >= TURNS) want = 0;
    if (want !== lean) { lean = want; steer.push([run.step, lean]); }
    if (tap) taps.push(run.step);
    stepHop(run, lean, tap);
  }
  return { steer, taps, why: `Leaned toward the best saucer in reach after every hop; climbed ${Math.floor(run.top)} m before ${run.end}.` };
}
