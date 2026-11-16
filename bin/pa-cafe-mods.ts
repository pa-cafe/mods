#!/usr/bin/env node
// pa-cafe-mods play <game> --bot ./bot.js [--seed N] [--runs N] [--version V] [--cast a,b,c] [--json] [--no-limits]
import { parseArgs } from 'node:util';
import { playLimits, playLimitsProvisional } from '../games/kit/play.ts';
import { playableCard, simulate, summarize, type SimRun } from './simulate.ts';

const usage = `Usage: pa-cafe-mods play <game> --bot <file> [options]

Plays your bot against the game's real rules and prints the score the cafe would record.

  --bot <file>      the bot module; its default export is play(input)
  --seed <n>        the first seed (1); run k plays seed + k
  --runs <n>        how many seeds to play (1)
  --version <v>     rules version (the game's current one)
  --cast <a,b,...>  your cafe's residents' looks (every look the game knows)
  --json            one JSON line per run, then a summary line
  --no-limits       skip the CPU and time limits, for tuning
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    bot: { type: 'string' }, seed: { type: 'string' }, runs: { type: 'string' }, version: { type: 'string' },
    cast: { type: 'string' }, json: { type: 'boolean' }, 'no-limits': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  },
});
const [command, game] = positionals;
if (values.help || command !== 'play' || !game || !values.bot) {
  process.stdout.write(usage);
  process.exit(values.help ? 0 : 2);
}
const whole = (name: string, text: string | undefined) => {
  if (text === undefined) return undefined;
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0) { process.stderr.write(`--${name} must be a whole number\n`); process.exit(2); }
  return value;
};

const card = playableCard(game);
const options = {
  game, bot: values.bot, seed: whole('seed', values.seed), runs: whole('runs', values.runs), version: whole('version', values.version),
  cast: values.cast?.split(',').map((look) => look.trim()).filter(Boolean), limits: !values['no-limits'],
};
const version = options.version ?? card.version;
if (!values.json) {
  process.stdout.write(`${card.title.en} rules v${version}${version === card.version ? ' (current)' : ''}`
    + ` · limits ${playLimits.cpuMs} ms CPU, ${playLimits.wallMs} ms${playLimitsProvisional ? ' (provisional)' : ''}${options.limits ? '' : ' · limits off'}\n`);
}
const line = (run: SimRun) => values.json
  ? JSON.stringify(run)
  : `seed ${run.seed}  ${run.ok ? `score ${run.score}` : `scores nothing: ${run.reason} (${run.message})`}`
    + `  cpu ${run.cpuMs.toFixed(1)} ms${run.detail ? `  ${JSON.stringify(run.detail)}` : ''}${run.why ? `  why: ${run.why}` : ''}`;
const runs = await simulate(options, (run) => process.stdout.write(`${line(run)}\n`));
const summary = summarize(runs);
process.stdout.write(values.json ? `${JSON.stringify({ summary })}\n` : runs.length > 1
  ? `${summary.runs} runs, ${summary.failed} scored nothing · median ${summary.median} · p95 ${summary.p95} · best ${summary.best} · mean ${Math.round(summary.mean)} · most CPU ${summary.cpuMs.toFixed(1)} ms\n`
  : '');
process.exit(summary.failed ? 1 : 0);
