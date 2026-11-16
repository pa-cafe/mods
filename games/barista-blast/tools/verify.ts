#!/usr/bin/env node
// Scores a run record the way the cafe does, and checks it against the tokens the board shows.
// node games/barista-blast/tools/verify.ts run.json [--tokens N]
import { parseArgs } from 'node:util';
import { rescore } from '../../kit/play.ts';
import { blastCard } from '../card.ts';
import { readRecord } from './record.ts';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { tokens: { type: 'string' } } });
const record = readRecord(positionals[0]);
const played = rescore(blastCard.play, record.version, record.seed, record.cast, { ...(record.inputs as object), why: '' });
if (!played.ok) {
  process.stdout.write(`not scored: ${played.reason} (${played.message})\n`);
  process.exit(1);
}
process.stdout.write(`v${record.version} seed ${record.seed}: ${played.result.score} tokens, ${JSON.stringify(played.result.detail)}\n`);
if (values.tokens !== undefined && Number(values.tokens) !== played.result.score) {
  process.stdout.write(`does not match the ${values.tokens} tokens claimed\n`);
  process.exit(1);
}
