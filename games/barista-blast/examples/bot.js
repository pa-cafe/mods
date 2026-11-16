// A sample resident bot for BARISTA BLAST!!. It flies each plan in the rules the cafe hands it, tapping by a few plain
// rules of thumb, tries a few pilots, and answers with the plan that went furthest. Copy it and make it yours.
//
// It imports nothing, so this one file is what you send. Try it first:
// npm run play -- barista-blast --bot games/barista-blast/examples/bot.js --runs 20

/** Trying all nine would fly further more often, but a cold start for nine is close to the CPU budget. */
const PILOTS = [null, 'dots', 'deepseek', 'muse'];

export function play({ seed, cast }, rules) {
  const { blastAhead, blastLooks, blastPower, blastTuning: T, startBlast, stepBlast } = rules;
  /** The gauge step, on the way up, where the power first reaches `power`. */
  const holdFor = (power) => { let step = 0; while (blastPower(step) < power) step++; return step; };
  const aim = Math.floor(T.aimSteps * 0.22), hold = holdFor(0.97), gateTop = T.gate + 0.3;
  const helps = (node) => Boolean(node) && (node.kind === 'window' || node.mood === 'one' || node.mood === 'two');

  /** Whether to press on this step. */
  function press(run) {
    // A boost window is open: take it after a short beat, as a person would.
    if (run.boost) return run.boost.left < T.boostWindow - 12;
    // A press does nothing while held or gliding: send none, the answer has a size limit.
    if (run.frozen || run.glide) return false;
    const ahead = blastAhead(run, 40)[0], gap = ahead ? ahead.x - run.x : Infinity, near = gap < 12;
    const charged = run.caffeine >= T.caffeine;
    // A ban or a wall ahead: refill now if that clears its top and the current arc would not.
    if (ahead && ahead.mood === 'bad' && (ahead.kind === 'claude' || ahead.kind === 'dots') && !charged && !run.shield) {
      const height = (vx, vy) => { const time = gap / Math.max(vx, 1); return run.y + vy * time - T.gravity / 2 * time * time; };
      return run.vy <= 0 && run.refills > 0 && height(run.vx, run.vy) < gateTop && height(Math.max(run.vx * (1 + T.refillShare), T.kick), T.refillUp) > gateTop;
    }
    if (near && ahead.mood === 'bad' && !charged && !run.shield) return false;
    // Rising toward someone who helps: dive into them, which pays.
    if (run.vy > 0) return run.step >= run.diveAt && run.y > 4 && near && (helps(ahead) || charged);
    // Coming down with nobody to land on: spend a cup.
    return run.y < 1.5 && run.vy < -3 && !near && run.refills > 0;
  }

  function fly(looks, pilot) {
    const run = startBlast(seed, looks, aim, hold, pilot), taps = [];
    while (!run.end) {
      const tap = press(run);
      if (tap) taps.push(run.step);
      stepBlast(run, tap);
    }
    return { x: run.x, plan: { aim, hold, taps, pilot } };
  }

  const looks = cast.filter((look) => blastLooks.includes(look));
  let best = null;
  for (const pilot of PILOTS) {
    const tried = fly(looks, pilot);
    if (!best || tried.x > best.x) best = tried;
  }
  return { ...best.plan, why: `Flew four pilots in the rules; ${best.plan.pilot ?? 'the barista'} went furthest, ${Math.round(best.x)} m.` };
}
