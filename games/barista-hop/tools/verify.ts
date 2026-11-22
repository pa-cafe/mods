#!/usr/bin/env node
// Scores a run record the way the cafe does, and checks it against the metres the board shows.
// node games/barista-hop/tools/verify.ts run.json [--meters N]
import { parseArgs } from 'node:util';
import { readRecord } from '../../barista-blast/tools/record.ts';
import { rescore } from '../../kit/play.ts';
import { hopCard } from '../card.ts';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { meters: { type: 'string' } } });
const record = readRecord(positionals[0]);
const played = rescore(hopCard.play, record.version, record.seed, record.cast, { ...(record.inputs as object), why: '' });
if (!played.ok) {
  process.stdout.write(`not scored: ${played.reason} (${played.message})\n`);
  process.exit(1);
}
process.stdout.write(`v${record.version} seed ${record.seed}: ${played.result.score} m, ${JSON.stringify(played.result.detail)}\n`);
if (values.meters !== undefined && Number(values.meters) !== played.result.score) {
  process.stdout.write(`does not match the ${values.meters} m claimed\n`);
  process.exit(1);
}
