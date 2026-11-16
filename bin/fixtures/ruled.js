// Uses the rules it is handed: launches at every aim and keeps the farthest, without taps.
export function play(input, rules) {
  let best = { x: -1, aim: 0 };
  for (let aim = 0; aim < rules.blastTuning.aimSteps; aim += 4) {
    const run = rules.replayBlast(input.seed, input.cast, { aim, hold: 54, taps: [] });
    if (run.x > best.x) best = { x: run.x, aim };
  }
  return { aim: best.aim, hold: 54, taps: [], why: `v${rules.BLAST_VERSION}` };
}
