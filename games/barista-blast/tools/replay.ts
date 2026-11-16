#!/usr/bin/env node
// Plays a run record again under its own rules version and prints every hit, to see why a run went where it went.
// node games/barista-blast/tools/replay.ts run.json
import { blastRules, blastVersions } from '../versions.ts';
import { readRecord } from './record.ts';

const record = readRecord(process.argv[2]);
const rules = blastRules[record.version as keyof typeof blastRules], check = blastVersions[record.version];
if (!rules || !check) {
  process.stdout.write(`rules version ${record.version} cannot be replayed: try ${Object.keys(blastRules).join(', ')}\n`);
  process.exit(1);
}
const inputs = check.inputs.parse(record.inputs);
const run = rules.replayBlast(record.seed, record.cast.filter((look): look is typeof rules.blastLooks[number] => (rules.blastLooks as readonly string[]).includes(look)), inputs);
for (const hit of run.hits) {
  const as = hit.as === hit.kind ? hit.kind : `${hit.kind} as ${hit.as}`;
  process.stdout.write(`${(hit.step / rules.BLAST_HZ).toFixed(2).padStart(7)} s  ${hit.x.toFixed(0).padStart(6)} m  ${as} ${hit.mood ?? ''} ${hit.outcome}${hit.waived ? ' (shield)' : ''}\n`);
}
// Every version measures a run alike; their run types differ in fields this does not read.
const meters = rules.blastMeters as (run: { x: number }) => number;
process.stdout.write(`ended ${run.end} at ${meters(run)} m after ${(run.step / rules.BLAST_HZ).toFixed(2)} s: ${rules.blastTokens(run.x)} tokens\n`);
