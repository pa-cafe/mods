import { describe, expect, it } from 'vitest';
import { BLAST_VERSION, blastLooks, blastTuning, replayBlast, type BlastHit, type BlastInputs } from '../rules.ts';
import { advanceBlast, aimingPhase, aimStep, holdStep, pressBlast, releaseBlast, STEP_MS, type BlastPhase } from './phase';
import { decodeReplay, encodeReplay, replayIn, replayLink, type BlastReplay } from './replay';
import { pastRules, REPLAY_FROM, rulesFor } from './rules-past';
import { bestBoost } from './share-card';

const sample: BlastReplay = { version: BLAST_VERSION, seed: 0xdeadbeef, cast: ['claude', 'dots', 'qwen'], inputs: { aim: 41, hold: 77, taps: [12, 13, 400, 2210], pilot: 'gemini' } };

describe('BARISTA BLAST!! replay links', () => {
  it('carries a run through a link unchanged', () => {
    for (const replay of [sample, { ...sample, cast: [], inputs: { aim: 0, hold: 0, taps: [] } }, { ...sample, seed: 0, cast: [...blastLooks, ...blastLooks.slice(0, 4)], inputs: { ...sample.inputs, taps: Array.from({ length: 300 }, (_, i) => i * 7 + 3) } }]) {
      const code = encodeReplay(replay);
      expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(decodeReplay(code)).toEqual(replay);
    }
    const link = replayLink('https://cafe.test', 'some.cafe', sample);
    expect(link.startsWith('https://cafe.test/@some.cafe?game=barista-blast&replay=')).toBe(true);
    expect(replayIn(new URL(link).search)).toEqual(sample);
  });

  it('keeps a run of a hundred taps short enough to paste anywhere', () => {
    const taps = Array.from({ length: 100 }, (_, i) => 30 + i * 41);
    expect(encodeReplay({ ...sample, inputs: { ...sample.inputs, taps } }).length).toBeLessThan(260);
  });

  it('turns away a code that was cut short, altered or padded', () => {
    const code = encodeReplay(sample);
    expect(decodeReplay(code.slice(0, -3))).toBeNull();
    expect(decodeReplay(`${code}AA`)).toBeNull();
    expect(decodeReplay('not a code!')).toBeNull();
    expect(decodeReplay('')).toBeNull();
    expect(replayIn('?game=barista-blast')).toBeNull();
    expect(decodeReplay(encodeReplay(sample).replace(/^./, 'C'))).toBeNull();
    expect(decodeReplay(encodeReplay({ ...sample, cast: Array.from({ length: 13 }, () => 'dots' as const) }))).toBeNull();
  });
});

describe('BARISTA BLAST!! playing a shared run back', () => {
  function playBack(replay: BlastReplay, stall = 0) {
    const since = 900;
    let phase: BlastPhase = aimingPhase(replay.seed, since, replay.cast, replay.inputs.pilot ?? null);
    const pressAt = since + (replay.inputs.aim + 0.5) * STEP_MS;
    phase = pressBlast(phase, pressAt);
    expect(aimStep(phase, pressAt)).toBe(replay.inputs.aim);
    const releaseAt = pressAt + (replay.inputs.hold + 0.5) * STEP_MS;
    expect(holdStep(phase, releaseAt)).toBe(replay.inputs.hold);
    phase = releaseBlast(phase, releaseAt);
    if (phase.kind !== 'flying') throw new Error('not flying');
    phase.queued.push(...replay.inputs.taps); phase.played = true;
    for (let now = releaseAt, frame = 0; phase.kind === 'flying'; now += ++frame === 20 ? stall : 50) phase = advanceBlast(phase, now, []).phase;
    if (phase.kind !== 'result') throw new Error('no result');
    return phase;
  }

  it('flies exactly the run the Worker would replay from the same inputs', () => {
    for (const seed of [1, 77, 4242, 0xffffffff]) {
      const inputs: BlastInputs = { aim: seed % blastTuning.aimSteps, hold: (seed * 7) % blastTuning.gaugeSteps, taps: [200, 420, 900, 1500], ...(seed % 2 ? { pilot: 'grok' as const } : {}) };
      const replay = decodeReplay(encodeReplay({ version: BLAST_VERSION, seed, cast: ['claude', 'muse'], inputs }))!;
      const shown = playBack(replay), checked = replayBlast(replay.seed, replay.cast, replay.inputs);
      expect(shown.run.x).toBe(checked.x);
      expect(shown.run.hits).toEqual(checked.hits);
    }
  });

  it('flies the same run when the screen stalls partway: the shared run’s taps stay on their steps', () => {
    const taps = Array.from({ length: 90 }, (_, i) => 120 + i * 37);
    const replay = { version: BLAST_VERSION, seed: 597262378, cast: ['dots', 'muse', 'grok'] as BlastReplay['cast'], inputs: { aim: 39, hold: 54, taps } };
    const checked = replayBlast(replay.seed, replay.cast, replay.inputs);
    for (const stall of [400, 2000]) expect(playBack(replay, stall).run.x).toBe(checked.x);
  });
});

describe('BARISTA BLAST!! rules kept for replays', () => {
  it('keeps every version links were made under, each its own version', async () => {
    for (let version = REPLAY_FROM; version < BLAST_VERSION; version++) {
      expect(pastRules[version], `rules version ${version} cannot be replayed: list ../v${version}.ts in pastRules (rules-past.ts)`).toBeTypeOf('function');
      expect((await rulesFor(version))?.BLAST_VERSION).toBe(version);
    }
    expect((await rulesFor(BLAST_VERSION))?.BLAST_VERSION).toBe(BLAST_VERSION);
    expect(await rulesFor(REPLAY_FROM - 1)).toBeNull();
    expect(await rulesFor(BLAST_VERSION + 1)).toBeNull();
  });
});

describe('BARISTA BLAST!! share card', () => {
  const hit = (as: BlastHit['as'], x: number, outcome: BlastHit['outcome'] = 'usual'): BlastHit => ({ step: 0, x, kind: as, as, outcome });
  it('shows the boost that came furthest, else the resident hit most', () => {
    expect(bestBoost({ hits: [hit('claude', 10, 'boost'), hit('qwen', 90, 'boost'), hit('window', 200, 'boost'), hit('dots', 300)] })?.as).toBe('qwen');
    expect(bestBoost({ hits: [hit('claude', 10), hit('dots', 20), hit('dots', 30), hit('window', 40)] })?.as).toBe('dots');
    expect(bestBoost({ hits: [hit('window', 40)] })).toBeNull();
  });
});

it('opens the game at the address of its own card', async () => {
  const [{ BLAST_GAME, blastPagePath }, { blastCard }] = await Promise.all([import('./contract'), import('../card.ts')]);
  expect(BLAST_GAME).toBe(blastCard.id);
  expect(blastPagePath('dylan')).toBe('/@dylan?game=barista-blast');
});
