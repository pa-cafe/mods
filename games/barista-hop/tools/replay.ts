#!/usr/bin/env node
// Plays a run record again under its own rules version and prints everything that happened on the way up, to see why
// a climb ended where it ended.
// node games/barista-hop/tools/replay.ts run.json
import { readRecord } from '../../barista-blast/tools/record.ts';
import { hopRules, hopVersions } from '../versions.ts';

const record = readRecord(process.argv[2]);
const rules = hopRules[record.version as keyof typeof hopRules], check = hopVersions[record.version];
if (!rules || !check) {
  process.stdout.write(`rules version ${record.version} cannot be replayed: try ${Object.keys(hopRules).join(', ')}\n`);
  process.exit(1);
}
const inputs = check.inputs.parse(record.inputs), run = rules.startHop(record.seed);
let lean: -1 | 0 | 1 = 0, turn = 0, tap = 0;
while (!run.end) {
  while (turn < inputs.steer.length && inputs.steer[turn][0] <= run.step) lean = inputs.steer[turn++][1];
  while (tap < inputs.taps.length && inputs.taps[tap] < run.step) tap++;
  rules.stepHop(run, lean, tap < inputs.taps.length && inputs.taps[tap] === run.step);
  // An ordinary hop is most of a climb: only what changed it is printed.
  if (run.event && run.event !== 'hop') process.stdout.write(`${(run.step / rules.HOP_HZ).toFixed(2).padStart(7)} s  ${run.y.toFixed(1).padStart(7)} m  ${run.event}${run.event === 'cup' ? ` (${run.cups} left)` : ''}\n`);
}
process.stdout.write(`ended ${run.end} after ${(run.step / rules.HOP_HZ).toFixed(2)} s and ${run.hops} hops: ${rules.hopMeters(run)} m\n`);
