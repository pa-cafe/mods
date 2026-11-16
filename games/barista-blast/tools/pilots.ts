// How each pilot does against the field: many runs per pilot, by two made-up players, and the median
// score (the tokens the screen shows) of each. Run: node games/barista-blast/tools/pilots.ts [runs] [--rules path] [--only own,look,…]
// [--from seed]. The same seeds and the same player's dice for every pilot, so the pilots differ only in who flies.
import { availableParallelism } from 'node:os';
import { pathToFileURL } from 'node:url';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import type * as Live from '../rules.ts';

type Rules = typeof Live;
type Run = Live.BlastRun;
type Pilot = Live.BlastPilot;
type Player = 'careful' | 'mashing';
type Job = { rules: string; pilot: Pilot; player: Player; from: number; runs: number };

function dice(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0; return state / 4_294_967_296; };
}

/**
 * `careful` plays well: launches near full, never misses a boost, hops a ban when a refill clears it, keeps away from
 * whoever would hurt with an empty bar, and refills on landings with nobody to land on. `mashing` presses at random,
 * about once a second, without looking.
 */
function players(rules: Rules) {
  const T = rules.blastTuning;
  const holdFor = (power: number) => { let step = 0; while (rules.blastPower(step) < power) step++; return step; };
  const good = (node: Live.BlastNode | undefined) => Boolean(node) && (node!.kind === 'window' || node!.mood === 'one' || node!.mood === 'two');
  const careful = (run: Run) => {
    if (run.boost) return run.boost.left < T.boostWindow - 12;
    const ahead = rules.blastAhead(run, 40)[0], gap = ahead ? ahead.x - run.x : Infinity, near = gap < 12;
    if (ahead?.kind === 'claude' && ahead.mood === 'bad' && run.caffeine < T.caffeine && !run.shield) {
      const height = (vx: number, vy: number) => { const time = gap / Math.max(vx, 1); return run.y + vy * time - T.gravity / 2 * time * time; };
      return run.vy <= 0 && run.refills > 0 && height(run.vx, run.vy) < T.gate + 0.3 && height(Math.max(run.vx * (1 + T.refillShare), T.kick), T.refillUp) > T.gate + 0.3;
    }
    if (near && ahead!.mood === 'bad' && run.caffeine < T.caffeine && !run.shield) return false;
    if (run.vy > 0) return near && (good(ahead) || run.caffeine >= T.caffeine) && run.y > 4;
    return run.y < 1.5 && run.vy < -3 && !near && run.refills > 0;
  };
  return {
    careful: { launch: (roll: () => number) => [Math.floor(T.aimSteps * (0.2 + 0.05 * roll())), holdFor(0.9 + 0.1 * roll())], tap: careful },
    mashing: { launch: (roll: () => number) => [Math.floor(roll() * T.aimSteps), Math.floor(roll() * T.gaugeSteps)], tap: (_run: Run, roll: () => number) => roll() < 1 / rules.BLAST_HZ },
  } satisfies Record<Player, { launch(roll: () => number): number[]; tap(run: Run, roll: () => number): boolean }>;
}

async function play(job: Job) {
  const rules: Rules = await import(pathToFileURL(job.rules).href), player = players(rules)[job.player], scores: number[] = [];
  for (let seed = job.from; seed < job.from + job.runs; seed++) {
    const roll = dice(seed * 7919 + job.player.length), [aim, hold] = player.launch(roll);
    const run = rules.startBlast(seed, rules.blastLooks, aim, hold, job.pilot);
    while (!run.end) rules.stepBlast(run, player.tap(run, roll));
    scores.push(rules.blastTokens(run.x));
  }
  return scores;
}

if (!isMainThread) parentPort!.postMessage(await play(workerData as Job));
else {
  const argv = process.argv.slice(2), flag = (name: string) => { const at = argv.indexOf(name); return at < 0 ? undefined : argv.splice(at, 2)[1]; };
  const given = flag('--rules'), rulesPath = given ? new URL(given, pathToFileURL(`${process.cwd()}/`)).pathname : new URL('../rules.ts', import.meta.url).pathname, only = flag('--only')?.split(','), first = Number(flag('--from') ?? 1);
  const runs = Number(argv[0] ?? 3000), rules: Rules = await import(pathToFileURL(rulesPath).href);
  const pilots: Pilot[] = only ? only.map((name) => name === 'own' ? null : rules.blastLooks.find((look) => look === name)!) : [null, ...rules.blastLooks];
  const chunks = availableParallelism(), size = Math.ceil(runs / chunks), jobs: Job[] = [];
  for (const pilot of pilots) for (const player of ['careful', 'mashing'] as const) for (let at = 0; at < runs; at += size) jobs.push({ rules: rulesPath, pilot, player, from: first + at, runs: Math.min(size, runs - at) });
  const results = new Map<string, number[]>(), queue = [...jobs];
  const lane = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const scores = await new Promise<number[]>((resolve, reject) => { const worker = new Worker(new URL(import.meta.url), { workerData: job }); worker.once('message', resolve); worker.once('error', reject); });
      const key = `${job.pilot}/${job.player}`;
      results.set(key, [...(results.get(key) ?? []), ...scores]);
    }
  };
  await Promise.all(Array.from({ length: chunks }, lane));
  const median = (key: string) => { const sorted = [...results.get(key)!].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; };
  const short = (value: number) => value >= 1e12 ? `${(value / 1e12).toFixed(2)}T` : value >= 1e9 ? `${(value / 1e9).toFixed(2)}B` : value >= 1e6 ? `${(value / 1e6).toFixed(2)}M` : `${(value / 1e3).toFixed(1)}K`;
  // The field: the median of the pilots who are meant to fly alike. The others are measured against it.
  const field = ['grok', 'deepseek', 'qwen', 'doubao', 'muse'] as const;
  const middle = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const baseline = (player: Player) => { const known = field.filter((look) => results.has(`${look}/${player}`)); return known.length ? middle(known.map((look) => median(`${look}/${player}`))) : 0; };
  const against = (mine: number, base: number) => base ? `${mine >= base ? '+' : ''}${Math.round((mine / base - 1) * 100)}%` : '—';
  console.log(`BARISTA BLAST!! v${rules.BLAST_VERSION}, ${runs} runs per pilot and player. Median score, and against the field (the median of ${field.join(', ')}).`);
  console.log('| Pilot | careful | vs field | mashing | vs field |\n| --- | --- | --- | --- | --- |');
  for (const pilot of pilots) {
    const cells = (['careful', 'mashing'] as const).map((player) => { const mine = median(`${pilot}/${player}`); return `${short(mine)} | ${against(mine, baseline(player))}`; });
    console.log(`| ${pilot ?? 'own barista'} | ${cells.join(' | ')} |`);
  }
}
