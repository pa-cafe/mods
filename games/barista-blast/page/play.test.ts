import { describe, expect, it } from 'vitest';
import { BLAST_HZ, blastAhead, blastLooks, blastMoods, blastTokens, blastTuning as T, replayBlast, startBlast, stepBlast, type BlastLook, type BlastMood, type BlastRun } from '../rules.ts';
import { aimCamera, followCamera, lensOf } from './camera';
import { launchCard, milestoneTokens, verdictFor } from './copy';
import { blastEvents, glance, type BlastEvent } from './events';
import { endedAtCapacity, hitCopy, moodOf, moodTone, nodeOf } from './nodes';
import { blastTap } from './ahead';
import { stageOf } from './stage';
import { standeeBox } from './standee';
import { CAST, poseBox } from './art';
import poses from '../art/poses.json';
import { takeoverFor } from './takeover';
import { installBlastHost } from './host';
const setLocale = (language: 'en') => installBlastHost({ locale: () => language, furniture: () => ({ load: () => Promise.reject(new Error('no furniture')), dispose() {} }) });
import { formatTokens, tokenUnit } from './numbers';
import { advanceBlast, aimingPhase, pressBlast, releaseBlast, STEP_MS, type BlastPhase } from './phase';

type Cell = NonNullable<BlastRun['cells'][number]>;
type Stands = `${BlastLook}:${BlastMood}` | 'window';
const cell = (stands: Stands, x: number): Cell => { const [kind, mood] = stands.split(':') as [Cell['kind'], BlastMood | undefined]; return { kind, x, ...(mood ? { mood } : {}) }; };
function approaching(stands: Stands[], { speed = 20, y = 1, caffeine = 0 } = {}) {
  const run = startBlast(1, blastLooks, 36, 54);
  run.cells = stands.map((each, index) => cell(each, T.firstCell + T.cell * index));
  Object.assign(run, { x: T.firstCell - 2, y, vx: speed, vy: 0, caffeine, luck: () => 0.9 });
  return run;
}
function watch(run: BlastRun, done: (events: BlastEvent[]) => boolean, tapAt?: (run: BlastRun) => boolean) {
  const events: BlastEvent[] = [];
  for (let step = 0; step < 4000 && !run.end && !done(events); step++) { const before = glance(run); stepBlast(run, tapAt?.(run) ?? false); events.push(...blastEvents(before, run, milestoneTokens)); }
  return events;
}
const kinds = (events: BlastEvent[]) => events.map(event => event.type);

describe('BARISTA BLAST!! combos', () => {
  it('has a word and a line for every pair the rules call a combo', async () => {
    const { comboCopy } = await import('./nodes');
    const { blastPairs } = await import('../rules.ts');
    expect(Object.keys(comboCopy).sort()).toEqual([...blastPairs].sort());
    for (const pair of blastPairs) { expect(comboCopy[pair].card).toBeTruthy(); expect(comboCopy[pair].line).toBeTruthy(); }
  });

  it('names the assist of every resident who can fly, and marks a boost she lends a hand with', async () => {
    const { assistCopy } = await import('./nodes');
    const { blastLooks, blastTuning, startBlast, stepBlast } = await import('../rules.ts');
    expect(Object.keys(assistCopy).sort()).toEqual([...blastLooks].sort());
    const run = startBlast(4, blastLooks, 36, 54, 'grok');
    while (!run.end && run.step < 6000) stepBlast(run, Boolean(run.boost && run.boost.left < blastTuning.boostWindow - 12) || (!run.boost && run.vy < 0 && run.y < 1 && run.refills > 0));
    const boosts = run.hits.filter(hit => hit.outcome === 'boost' && hit.as !== 'window');
    expect(boosts.length).toBeGreaterThan(0);
    expect(boosts.every(hit => hit.assist === 'grok')).toBe(true);
  });
});

describe('BARISTA BLAST!! residents who know the pilot', () => {
  it('says something only for her when the two have history, and the usual line otherwise', () => {
    const met = (as: 'claude' | 'gemini' | 'muse', mood: 'one' | 'meh' | 'bad' = 'one') => ({ step: 0, x: 40, kind: as, as, mood, outcome: 'usual' as const });
    const usual = hitCopy(met('claude')).lines;
    expect(hitCopy(met('claude'), 'dots').lines).toContain('You again. I was not waiting for you');
    expect(hitCopy(met('claude', 'meh'), 'dots').lines).toContain('You again. I was not waiting for you');
    expect(hitCopy(met('claude'), 'dots').card).toBe(hitCopy(met('claude')).card);
    expect(hitCopy(met('claude', 'bad'), 'dots').lines).toEqual(hitCopy(met('claude', 'bad')).lines);
    expect(hitCopy(met('claude'), 'doubao').lines).toEqual(usual);
    expect(hitCopy(met('claude')).lines).toEqual(usual);
    expect(hitCopy({ ...met('claude'), kind: 'muse' }, 'dots').lines).toEqual(usual);
    expect(hitCopy(met('gemini'), 'grok').lines).toEqual(['Hsss! Keep away from my dried fish']);
  });
});

describe('BARISTA BLAST!! picking who is launched', () => {
  it('draws the same street again without her, carries her into the run and its inputs, and keeps her for the next run', async () => {
    const { aimingPhase, pickBlast, pressBlast, releaseBlast } = await import('./phase');
    const aiming = aimingPhase(7, 0, blastLooks), picked = pickBlast(aiming, 'claude');
    expect([aiming.pilot, picked.pilot, picked.kind, picked.seed]).toEqual([null, 'claude', 'aiming', 7]);
    const flying = releaseBlast(pressBlast(picked, 500), 900);
    if (flying.kind !== 'flying') throw new Error('expected a flight');
    expect(flying.run.pilot).toBe('claude');
    expect(flying.inputs.pilot).toBe('claude');

    const plain = releaseBlast(pressBlast(aiming, 500), 900);
    expect(plain.kind === 'flying' && 'pilot' in plain.inputs).toBe(false);
    expect(pickBlast(flying, 'grok')).toBe(flying);
  });

  it('a run handed in for the board may name its pilot, and only one of the eight', async () => {
    const { blastProofSchema } = await import('./contract');
    const inputs = { aim: 3, hold: 4, taps: [10, 20] };
    expect(blastProofSchema.safeParse({ token: 't', inputs }).success).toBe(true);
    expect(blastProofSchema.safeParse({ token: 't', inputs: { ...inputs, pilot: 'doubao' } }).success).toBe(true);
    expect(blastProofSchema.safeParse({ token: 't', inputs: { ...inputs, pilot: 'window' } }).success).toBe(false);
    const plain = replayBlast(11, blastLooks, inputs), grok = replayBlast(11, blastLooks, { ...inputs, pilot: 'grok' });
    expect(grok.pilot).toBe('grok');
    expect(grok.x).not.toBe(plain.x);
  });
});

describe('BARISTA BLAST!! hit poses', () => {
  it('has a frame for every pose of every look, the two a resident makes when she is hit among them', async () => {
    const { default: poses } = await import('../art/poses.json');
    const { atlasLook } = await import('./art');
    for (const look of Object.values(atlasLook)) for (const pose of ['stand', 'tumble', 'splat', 'cheer', 'help', 'hurt']) expect(poses.frames).toHaveProperty([`${look}/${pose}`]);
  });
});

describe('BARISTA BLAST!! special-move pictures', () => {
  it('has a picture on disk for every look the manifest names, and hands none over before it has arrived', async () => {
    const { existsSync } = await import('node:fs');
    const { default: cutins } = await import('../art/cutins.json');
    const { default: divine } = await import('../art/divine-cutins.json');
    const { atlasLook, cutinOf } = await import('./art');
    const looks = Object.values(atlasLook);
    for (const sheet of [cutins, divine]) {
      expect(Object.keys(sheet).sort()).toEqual([...looks].sort());
      for (const look of looks) expect(existsSync(`${import.meta.dirname}/../art/${sheet[look].file}`)).toBe(true);
    }
    for (const look of looks) for (const robed of [false, true]) expect(cutinOf(look, robed)).toBeNull();
  });
});

describe('BARISTA BLAST!! numbers on screen', () => {
  it('shows three figures and a unit, never rounding up past what burned', () => {
    expect(['0', '842', '1.00K', '12.4K', '842K', '1.28M', '999M', '2.61B', '110B', '999B', '1.38T', '350T'])
      .toEqual([0, 842, 1000, 12_499, 842_999, 1_289_999, 999_999_999, 2_619_000_000, 110e9, 999.9e9, 1.386e12, 3.5e14].map(formatTokens));
    expect([tokenUnit(999), tokenUnit(1000), tokenUnit(2e6), tokenUnit(3e9), tokenUnit(2e12)]).toEqual(['', 'K', 'M', 'B', 'T']);
  });

  it('picks the verdict by the band the run ended in and the launch card by the gauge', () => {
    expect([verdictFor(9_999), verdictFor(10_000), verdictFor(5e7), verdictFor(5e8), verdictFor(5e9), verdictFor(5e10)])
      .toEqual(['Penny-pinching mode', 'Free-trial tier', 'A normal day at work', 'Vibe coded all night', 'You’re the one who burns a month’s quota in a day', 'Please contact sales about an enterprise plan']);
    expect([launchCard(0.95), launchCard(0.5), launchCard(0.1)]).toEqual(['Overpressure!', null, 'Pfft…']);
  });
});

describe('BARISTA BLAST!! camera', () => {
  const desktop = { width: 1280, height: 720 }, phone = { width: 390, height: 844 };
  const settle = (view: typeof desktop, x: number) => {
    let camera = aimCamera(view);
    for (let frame = 0; frame < 1500; frame++) camera = followCamera(camera, view, false, 1 / 60);
    return { camera, lens: lensOf(camera, view, x) };
  };

  it('keeps the flying barista a quarter of the way across, so most of the screen is the street ahead', () => {
    for (const [view, share] of [[desktop, 1 / 4], [phone, 1 / 4]] as const) for (const x of [12, 400, 3000]) {
      const { lens } = settle(view, x);
      expect((x - lens.left) * lens.scale).toBeCloseTo(view.width * share, 2);
    }
    const { lens } = settle(phone, 400);
    expect(lens.left + phone.width / lens.scale - 400).toBeCloseTo(phone.width / lens.scale * 0.75, 2);
  });

  it('stands well back from the street while the barista is low, and pulls back slowly to 1.3 times as far, and no further, as they climb', () => {
    const fly = (view: typeof desktop, height: number, frames = 600) => { let camera = aimCamera(view); for (let frame = 0; frame < frames; frame++) camera = followCamera(camera, view, false, 1 / 60, height); return camera; };
    for (const view of [desktop, phone, { width: 844, height: 390 }]) {
      const low = fly(view, 2), lens = lensOf(low, view, 50);
      expect(lens.ground).toBeCloseTo(view.height * 0.88, 6);
      expect(lens.ground / lens.scale).toBeGreaterThan(22 - 1e-3);
      expect(view.width / lens.scale).toBeGreaterThan(22 - 1e-3);
      expect(Math.min(view.height * 0.78 / lens.scale / 22, view.width / lens.scale / 22)).toBeCloseTo(1, 2);
      expect(fly(view, 10).scale).toBeCloseTo(low.scale, 3);
      expect(low.scale / fly(view, 20).scale).toBeCloseTo(1.15, 2);
      expect(low.scale / fly(view, 30).scale).toBeCloseTo(1.3, 2);
      expect(low.scale / fly(view, 120).scale).toBeCloseTo(1.3, 2);
      let camera = low;
      for (let frame = 0; frame < 30; frame++) camera = followCamera(camera, view, false, 1 / 60, 120);
      expect(low.scale / camera.scale).toBeLessThan(1.17);
    }
  });

  it('frames the intern, the machine and the barista while aiming, even on a phone', () => {
    const lens = lensOf(aimCamera(phone), phone, 0);
    expect(lens.left).toBeLessThan(-5);
    expect(lens.left + phone.width / lens.scale).toBeGreaterThan(1.5);
  });
});

describe('BARISTA BLAST!! the barista drawn from their own picture', () => {
  const art = `/media/m/sunbeam/${'cd'.repeat(32)}.png`;

  it('carries the barista’s own picture to the stage, and none for a resident, who always wears her kind’s look', () => {
    const face = `/media/m/sunbeam/${'ef'.repeat(32)}.webp`;
    const cafe = { handle: 'a', house: 'h', name: 'Sunbeam', accent: 'peach' as const, invite: null, barista: { name: 'Bea', look: 'dots' as const, art, face }, residents: [{ name: 'Momo', look: 'grok' as const }, { name: 'Pip', look: 'claude' as const }] };
    const stage = stageOf(cafe, null);
    expect(stage).toMatchObject({ flyer: 'dots', flyerArt: art, flyerFace: face, cast: ['grok', 'claude'], names: ['Momo', 'Pip'], operator: 'deepseek', operatorArt: null });
    expect(Object.keys(stage)).not.toContain('arts');
    expect(stageOf(cafe, { name: 'Sam', look: 'muse', art })).toMatchObject({ operator: 'muse', operatorArt: art });
    expect(stageOf(null, null)).toMatchObject({ cast: [], names: [], flyerArt: null, operatorArt: null });
  });

  it('gives a picture the size of the built-in figure in every pose, larger than life like the rest of the cast, and lays it on its side once it has landed', () => {
    const own = { image: {} as HTMLCanvasElement, width: 200, height: 400 };
    const stand = standeeBox(own, 'stand', 40), flat = standeeBox(own, 'splat', 40);
    expect([stand.width, stand.height]).toEqual([expect.closeTo(52 * CAST, 6), expect.closeTo(104 * CAST, 6)]);
    for (const pose of ['cheer', 'help', 'hurt'] as const) {
      expect(standeeBox(own, pose, 40).height).toBeCloseTo(104 * CAST, 6);
      const h = poses.frames[`dots/${pose}`][3], body = poses.bodies[`dots/${pose}`];
      expect(poseBox('dots', pose, 40).height * body / h).toBeCloseTo(104 * CAST, 6);
    }
    expect(standeeBox(own, 'tumble', 40).height).toBeCloseTo(84 * CAST, 6);
    expect([flat.width, flat.height]).toEqual([expect.closeTo(104 * CAST, 6), expect.closeTo(52 * CAST, 6)]);
    expect(poseBox('dots', 'stand', 40).height * poses.bodies['dots/stand'] / poses.frames['dots/stand'][3]).toBeCloseTo(stand.height, 6);
  });
});

describe('BARISTA BLAST!! rules v4 on screen', () => {
  it('has a name, four named states with lines and one line on what each does, and a boost, for every kind of resident', () => {
    setLocale('en');
    expect(blastLooks.map(look => nodeOf(look).name)).toEqual(['Muse', 'Claude', 'GPT', 'Grok', 'Gemini', 'DeepSeek', 'Qwen', 'Doubao']);
    const tags = new Set<string>();
    for (const look of blastLooks) {
      for (const mood of blastMoods) {
        const state = moodOf({ kind: look, mood })!;
        expect(state.tells.length, `${look} ${mood}`).toBeGreaterThan(10);
        expect(state.lines.length, `${look} ${mood}`).toBeGreaterThan(0);
        tags.add(state.tag);
      }
      expect(nodeOf(look).boost.lines.length).toBeGreaterThan(0);
    }
    expect(tags.size).toBe(32);
    expect(moodOf({ kind: 'window' })).toBeNull();
    expect([moodTone({ kind: 'grok', mood: 'one' }), moodTone({ kind: 'grok', mood: 'two' }), moodTone({ kind: 'grok', mood: 'meh' }), moodTone({ kind: 'grok', mood: 'bad' }), moodTone({ kind: 'window' })]).toEqual(['good', 'good', 'open', 'bad', 'good']);
  });

  it('lets the shield speak for a hurt it took, and an appeal for a ban a tap turned round', () => {
    const run = approaching(['deepseek:bad']);
    run.shield = 100;
    while (!run.hits.length) stepBlast(run, false);
    expect(run.hits[0].waived).toBe(true);
    expect(hitCopy(run.hits[0])).toEqual({ card: 'Shielded!', lines: ['The disclaimer holds. Nothing gets through'] });
    expect(hitCopy({ ...run.hits[0], waived: undefined }).card).toBe('Server busy');
    const hit = { step: 0, x: 30, kind: 'claude', as: 'claude', mood: 'bad', outcome: 'usual' } as const;
    expect(hitCopy(hit).card).toBe('Banned!');
    expect(hitCopy({ ...hit, outcome: 'boost' }).card).toBe('Appeal granted!');
    expect(hitCopy({ ...hit, mood: 'one', outcome: 'boost' }).card).toBe('Thought it through!');
    expect(hitCopy({ step: 0, x: 500, kind: 'window', as: 'window', outcome: 'usual' }).card).toBe('Refill!');
  });

  it('resets everyone’s limits when a tap turns GPT’s wall round, lets Grok talk about her dad in orbit, and names a run the wall ended', () => {
    const wall = { step: 0, x: 30, kind: 'dots', as: 'dots', mood: 'bad', outcome: 'usual' } as const;
    expect(hitCopy({ ...wall, outcome: 'boost' }).card).toBe('Limits reset!');
    const grok = { step: 0, x: 30, kind: 'grok', as: 'grok', mood: 'bad', outcome: 'usual' } as const;
    let orbit = 1;
    while (blastTokens(orbit) < 1e9) orbit *= 2;
    expect(hitCopy(grok).lines).toContain('My dad says it’s true');
    expect(hitCopy({ ...grok, x: orbit }).lines).toContain('That’s not an explosion. It’s a rapid unscheduled disassembly');
    expect(hitCopy({ ...grok, x: orbit, outcome: 'boost' }).card).toBe('Dad sent a rocket!');
    expect(hitCopy({ ...grok, outcome: 'boost' }).card).toBe('Dad’s paying!');
    const refill = { step: 9, x: 60, kind: 'window', as: 'window', outcome: 'usual' } as const;
    expect(endedAtCapacity({ hits: [wall, refill] })).toBe(true);
    expect(endedAtCapacity({ hits: [{ ...wall, waived: true }] })).toBe(false);
    expect(endedAtCapacity({ hits: [wall, { ...grok, x: 80 }] })).toBe(false);
  });

  it('says what a press would do this moment: a refill on the way down, a dive on the way up with air under it', () => {
    const run = startBlast(4, [], 36, 54);
    Object.assign(run, { y: 6, vy: 5, step: 400, diveAt: 0 });
    expect(blastTap(run)).toBe('dive');
    expect(blastTap({ ...run, y: T.diveFloor - 0.5 })).toBeNull();
    expect(blastTap({ ...run, diveAt: 500 })).toBeNull();
    expect(blastTap({ ...run, vy: -3 })).toBe('refill');
    expect(blastTap({ ...run, vy: -3, refills: 0 })).toBeNull();
    expect(blastTap({ ...run, frozen: 5 })).toBeNull();
    expect(blastTap({ ...run, glide: 30 })).toBeNull();
    expect(blastTap({ ...run, vy: -3, end: 'stopped' })).toBeNull();
  });
});

describe('BARISTA BLAST!! what the screen learns from a step', () => {
  it('reports a hit with the speed before and after, then the landing', () => {
    const run = approaching(['grok:one']);
    const events = watch(run, seen => seen.some(event => event.type === 'land'));
    const hit = events.find(event => event.type === 'hit');
    expect(hit).toMatchObject({ type: 'hit', hit: { kind: 'grok', mood: 'one', outcome: 'usual' } });
    expect(hit?.type === 'hit' && hit.to / hit.from).toBeCloseTo(1.5, 1);
    expect(events.find(event => event.type === 'land')).toMatchObject({ x: expect.any(Number), impact: expect.any(Number) });
  });

  it('reports a boost only when the tap lands inside the window', () => {
    const boosted = approaching(['muse:one'], { caffeine: T.caffeine });
    const events = watch(boosted, seen => seen.some(event => event.type === 'boost'), run => Boolean(run.boost && run.boost.left === T.boostWindow - 5));
    expect(kinds(events)).toContain('boost');
    const missed = approaching(['muse:one'], { caffeine: T.caffeine });
    expect(kinds(watch(missed, seen => seen.some(event => event.type === 'land')))).not.toContain('boost');
  });

  it('tells a refill from a resident taking the cups away, and says when a hit is waiting on a tap', () => {
    const falling = startBlast(1, blastLooks, 0, 54);
    Object.assign(falling, { y: 6, vy: -3 });
    expect(kinds(watch(falling, seen => seen.length > 0, () => true))).toEqual(['refill']);
    const taken = approaching(['muse:bad']);
    expect(kinds(watch(taken, seen => seen.some(event => event.type === 'hit')))).toEqual(['hit']);
    expect(taken.refills).toBe(T.refills - 1);
    const held = approaching(['dots:bad'], { y: 4, caffeine: T.caffeine });
    expect(watch(held, seen => seen.some(event => event.type === 'hit')).find(event => event.type === 'hit')).toMatchObject({ held: true });
    const plain = approaching(['dots:bad'], { y: 4 });
    expect(watch(plain, seen => seen.some(event => event.type === 'hit')).find(event => event.type === 'hit')).not.toHaveProperty('held');
    const after = watch(held, seen => seen.some(event => event.type === 'lapsed'));
    expect(kinds(after)).toEqual(['lapsed']);
    expect(held.refills).toBe(0);
    expect(takeoverFor(after)).toBe('capacity');
    const turned = approaching(['dots:bad'], { y: 4, caffeine: T.caffeine });
    watch(turned, seen => seen.some(event => event.type === 'hit'));
    expect(kinds(watch(turned, seen => seen.length > 0, () => true))).toEqual(['boost']);
    const taking = approaching(['muse:bad'], { caffeine: T.caffeine });
    watch(taking, seen => seen.some(event => event.type === 'hit'));
    expect(kinds(watch(taking, seen => seen.length > 0))).toEqual(['lapsed']);
    expect(taking.refills).toBe(T.refills - 1);
  });

  it('reports a dive, each milestone once, and the end', () => {
    const rising = startBlast(1, blastLooks, 36, 54);
    Object.assign(rising, { y: 5, vy: 4 });
    expect(kinds(watch(rising, seen => seen.length > 0, () => true))).toEqual(['dive']);
    const run = startBlast(1, blastLooks, 36, 54);
    run.cells = Array.from({ length: 80 }, () => null);
    const events = watch(run, () => false);
    expect(events.filter(event => event.type === 'milestone').map(event => event.type === 'milestone' && event.tokens)).toEqual(milestoneTokens.filter(tokens => tokens <= blastTokens(run.x)));
    expect(events.at(-1)).toEqual({ type: 'end', end: 'stopped' });
  });

  it('has a word and lines for the takeaway window, plain and boosted', () => {
    setLocale('en');
    const hit = { step: 0, x: 500, kind: 'window', as: 'window', outcome: 'usual' } as const;
    expect(hitCopy(hit).lines.length).toBeGreaterThan(0);
    expect(hitCopy({ ...hit, outcome: 'boost' })).toEqual({ card: 'Caffeine max!', lines: ['Topped up with caffeine. Enjoy'] });
  });
});

describe('BARISTA BLAST!! the page’s phases', () => {
  const fly = (aimAt: number, holdFor: number) => {
    let phase: BlastPhase = aimingPhase(7, 1000);
    phase = pressBlast(phase, 1000 + aimAt);
    phase = releaseBlast(phase, 1000 + aimAt + holdFor);
    return phase;
  };

  it('sets the angle on press and the power on release, timed by the events', () => {
    const phase = fly(300, 450);
    expect(phase.kind).toBe('flying');
    if (phase.kind !== 'flying') return;
    expect(phase.inputs).toEqual({ aim: Math.floor(300 / STEP_MS), hold: Math.floor(450 / STEP_MS), taps: [] });
    const fresh = startBlast(7, blastLooks, phase.inputs.aim, phase.inputs.hold);
    expect([phase.run.vx, phase.run.vy, phase.run.order]).toEqual([fresh.vx, fresh.vy, fresh.order]);
  });

  it('plays the same run the server would replay from the recorded taps', () => {
    let phase = fly(250, 400);
    const origin = phase.kind === 'flying' ? phase.origin : 0;
    let now = origin;
    for (let frame = 0; phase.kind === 'flying' && frame < 20_000; frame++) {
      now += 1000 / 60;
      if (frame % 45 === 10) phase = pressBlast(phase, now - 3);
      phase = advanceBlast(phase, now, milestoneTokens).phase;
    }
    expect(phase.kind).toBe('result');
    if (phase.kind !== 'result') return;
    expect(phase.inputs.taps.length).toBeGreaterThan(3);
    expect(phase.inputs.taps).toEqual([...new Set(phase.inputs.taps)].sort((a, b) => a - b));
    const replayed = replayBlast(7, blastLooks, phase.inputs);
    expect({ x: replayed.x, step: replayed.step, hits: replayed.hits, end: replayed.end }).toEqual({ x: phase.run.x, step: phase.run.step, hits: phase.run.hits, end: phase.run.end });
  });

  it('runs 120 steps a second whatever the frame rate, and drops a long stall instead of replaying it', () => {
    const at30 = fly(0, 400), at144 = fly(0, 400);
    for (let frame = 0; frame <= 30; frame++) advanceBlast(at30, 1400 + frame * 1000 / 30, milestoneTokens);
    for (let frame = 0; frame <= 144; frame++) advanceBlast(at144, 1400 + frame * 1000 / 144, milestoneTokens);
    if (at30.kind !== 'flying' || at144.kind !== 'flying') throw new Error('both runs should still be flying');
    expect(Math.abs(at30.run.step - at144.run.step)).toBeLessThanOrEqual(1);
    expect(at30.run.step).toBeGreaterThanOrEqual(BLAST_HZ);
    const before = at30.run.step;
    advanceBlast(at30, 1400 + 1000 + 5000, milestoneTokens);
    expect(at30.run.step - before).toBe(30);
  });

  it('leaves the receipt alone when the street is pressed: only the play-again button starts a new run', () => {
    const result: BlastPhase = { kind: 'result', cast: blastLooks, pilot: null, seed: 1, run: startBlast(1, blastLooks, 0, 0), inputs: { aim: 0, hold: 0, taps: [] }, at: 5000 };
    expect(pressBlast(result, 5000 + 60_000)).toBe(result);
  });
});

it('keeps a tap made right after a long stall on time', () => {
  let phase = releaseBlast(pressBlast(aimingPhase(2, 0), 300), 450);
  phase = advanceBlast(phase, 500, milestoneTokens).phase;
  phase = pressBlast(phase, 1500);
  phase = advanceBlast(phase, 1510, milestoneTokens).phase;
  if (phase.kind !== 'flying') throw new Error('the run should still be flying');
  expect(phase.inputs.taps.length + phase.queued.length).toBe(1);
  expect(phase.inputs.taps[0] ?? phase.queued[0]).toBeLessThanOrEqual(phase.run.step + 2);
});

describe('the look-ahead (#1078)', () => {
  it('says where an arc comes down: nowhere once on the street, further for a faster one, and the same place the flight then reaches', async () => {
    const { landingAhead } = await import('./ahead');
    expect(landingAhead({ x: 0, y: 0, vx: 20, vy: 0, sliding: false })).toBeNull();
    expect(landingAhead({ x: 0, y: 5, vx: 20, vy: 0, sliding: true })).toBeNull();
    const slow = landingAhead({ x: 0, y: 0, vx: 15, vy: 15, sliding: false })!, fast = landingAhead({ x: 0, y: 0, vx: 30, vy: 30, sliding: false })!;
    expect(slow).toBeGreaterThan(15);
    expect(fast).toBeGreaterThan(slow * 3);
    expect(slow).toBeLessThan(2 * 15 * 15 / T.gravity);
    expect(slow).toBeGreaterThan(2 * 15 * 15 / T.gravity * 0.95);
    expect(landingAhead({ x: 400, y: 0, vx: 15, vy: 15, sliding: false })).toBeCloseTo(slow, 6);
  });

  it('names the first thing a flight will hit: one in its path, not one it flies over', async () => {
    const { firstHit } = await import('./ahead');
    const low = cell('grok:one', 6), gate = cell('claude:bad', 12), wall = cell('dots:bad', 6);
    expect(firstHit({ x: 0, y: 1, vx: 20, vy: 2, sliding: false }, [low, gate], 80)).toBe(low);
    expect(firstHit({ x: 0, y: 4, vx: 20, vy: 3, sliding: false }, [low, gate], 80)).toBe(gate);
    expect(firstHit({ x: 0, y: 4, vx: 20, vy: 3, sliding: false }, [wall, gate], 80)).toBe(wall);
    expect(firstHit({ x: 0, y: 1, vx: 20, vy: 2, sliding: false }, [wall, gate], 80)).toBe(wall);
    expect(firstHit({ x: 0, y: 9, vx: 20, vy: 6, sliding: false }, [low, gate], 80)).toBeNull();
    expect(firstHit({ x: 0, y: 1, vx: 20, vy: 2, sliding: false }, [], 80)).toBeNull();
  });

  it('lists the next three things nearest first, three more once a fortune is told, always makes room for a ban or a model at capacity 1.5 seconds away, and does not change the run', async () => {
    const { aheadOf } = await import('./ahead');
    let seen = 0, aimed = 0, warned = 0, squeezed = 0;
    for (let seed = 1; seed <= 16; seed++) {
      const run = startBlast(seed, blastLooks, 36, 50), twin = startBlast(seed, blastLooks, 36, 50);
      for (let step = 0; step < 1500 && !run.end; step += 3) {
        const ahead = aheadOf(run), all = blastAhead(run, ahead.reach), rows = run.sight ? 6 : 3;
        expect(ahead.reach).toBeCloseTo(Math.max(80, run.vx * 2.5), 6);
        expect(ahead.next.length).toBe(Math.min(rows, all.length));
        expect(aheadOf(run, 2).next.length).toBe(Math.min(rows - 1, all.length));
        expect(ahead.next.map(row => row.ahead)).toEqual(ahead.next.map(row => row.ahead).sort((a, b) => a - b));
        for (const row of ahead.next) { expect(row.ahead).toBeGreaterThan(0); expect(row.ahead).toBeLessThanOrEqual(ahead.reach); }
        expect(ahead.next.filter(row => row.hit).length).toBeLessThanOrEqual(1);
        if (ahead.next.some(row => row.hit)) aimed++;
        const danger = all.find(node => node.mood === 'bad' && (node.kind === 'claude' || node.kind === 'dots') && node.x - run.x <= Math.max(40, run.vx * 1.5));
        if (danger) {
          warned++;
          expect(ahead.next.find(row => row.node === danger)?.urgent).toBe(true);
          if (all.indexOf(danger) >= rows) squeezed++;
        }
        expect(ahead.next.filter(row => row.urgent).every(row => row.tone === 'bad')).toBe(true);
        seen += ahead.next.length;
        for (let i = 0; i < 3; i++) { stepBlast(run, false); stepBlast(twin, false); }
      }
      expect([run.x, run.y, run.end]).toEqual([twin.x, twin.y, twin.end]);
    }
    expect(seen).toBeGreaterThan(0);
    expect(aimed).toBeGreaterThan(0);
    expect(warned).toBeGreaterThan(0);
    expect(squeezed).toBeGreaterThanOrEqual(0);
  });

  it('whatever the run hits on a step with nothing pressed is what it named the step before, also right after passing the middle of something', async () => {
    const { aheadOf } = await import('./ahead');
    let checked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const run = startBlast(seed, blastLooks, 36, 50);
      while (!run.end && run.step < 2400) {
        if (run.boost) expect(aheadOf(run).hit).toBeNull();
        const named = run.frozen || run.boost ? null : aheadOf(run).hit, before = run.hits.length, free = !run.frozen && !run.boost;
        stepBlast(run, false);
        if (free && run.hits.length > before) { expect([seed, run.step, named?.x]).toEqual([seed, run.step, run.hits[before].x]); checked++; }
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('a dive it cues lands on the takeaway window or a resident in a state that helps', async () => {
    const { aheadOf } = await import('./ahead');
    let dives = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const run = startBlast(seed, blastLooks, 40, 100);
      while (!run.end && run.step < 2400) {
        const { cue } = aheadOf(run), before = run.hits.length;
        if (!cue.dive) { stepBlast(run, cue.refill && !run.boost); continue; }
        dives++;
        stepBlast(run, true);
        while (!run.end && run.hits.length === before) stepBlast(run, false);
        const struck = run.hits[before];
        expect([seed, struck !== undefined && (struck.kind === 'window' || struck.mood === 'one' || struck.mood === 'two' || Boolean(struck.waived))]).toEqual([seed, true]);
      }
    }
    expect(dives).toBeGreaterThan(8);
  });

  it('cues a dive only while rising, and a refill only while falling low with cups left and nothing to bounce off', async () => {
    const { aheadOf } = await import('./ahead');
    let dives = 0, refills = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const run = startBlast(seed, blastLooks, 40, 100);
      while (!run.end && run.step < 2400) {
        const { cue } = aheadOf(run);
        if (cue.dive) { dives++; expect(run.vy).toBeGreaterThan(0); expect(run.y).toBeGreaterThanOrEqual(T.diveFloor); expect(run.step).toBeGreaterThanOrEqual(run.diveAt); }
        if (cue.refill) { refills++; expect(run.vy).toBeLessThanOrEqual(0); expect(run.y).toBeLessThan(1.2); expect(run.refills).toBeGreaterThan(0); }
        expect(cue.dive && cue.refill).toBe(false);
        stepBlast(run, (cue.dive || cue.refill) && !run.boost);
      }
    }
    expect(dives).toBeGreaterThan(0);
    expect(refills).toBeGreaterThan(0);
  });
});

describe('the moments that take the whole screen', () => {
  const hit = (stands: `${BlastLook}:${BlastMood}`, outcome: 'usual' | 'boost' = 'usual') => { const [as, mood] = stands.split(':') as [BlastLook, BlastMood]; return { step: 1, x: 130, kind: as, as, mood, outcome }; };
  it('are a ban, an appeal that was granted, a model at capacity and the cut-off, and nothing else', () => {
    setLocale('en');
    expect(takeoverFor([{ type: 'hit', hit: hit('claude:bad'), from: 20, to: 0 }, { type: 'end', end: 'banned' }])).toBe('banned');
    expect(takeoverFor([{ type: 'hit', hit: hit('claude:bad'), from: 20, to: 20, held: true }])).toBeNull();
    expect(takeoverFor([{ type: 'boost', hit: hit('claude:bad', 'boost') }])).toBe('appealed');
    expect(takeoverFor([{ type: 'hit', hit: hit('dots:bad'), from: 20, to: 20 }])).toBe('capacity');
    expect(takeoverFor([{ type: 'hit', hit: hit('dots:bad'), from: 20, to: 20, held: true }])).toBeNull();
    expect(takeoverFor([{ type: 'lapsed', hit: hit('dots:bad'), from: 20, to: 20 }])).toBe('capacity');
    expect(takeoverFor([{ type: 'lapsed', hit: hit('muse:bad'), from: 20, to: 20 }])).toBeNull();
    expect(takeoverFor([{ type: 'hit', hit: { ...hit('dots:bad'), waived: true }, from: 20, to: 20 }])).toBeNull();
    expect(takeoverFor([{ type: 'end', end: 'timeout' }])).toBe('cutoff');
    for (const events of [[{ type: 'end', end: 'stopped' }], [{ type: 'hit', hit: hit('deepseek:bad'), from: 20, to: 10 }], [{ type: 'boost', hit: hit('grok:one', 'boost') }], [{ type: 'boost', hit: hit('claude:one', 'boost') }], [{ type: 'milestone', tokens: 1e6 }], []] as const) expect(takeoverFor(events)).toBeNull();
  });
});

describe('BARISTA BLAST!! quantised copies', () => {
  const hit = (quant?: 8 | 4 | 2) => ({ step: 0, x: 40, kind: 'qwen' as const, as: 'qwen' as const, mood: 'one' as const, outcome: 'usual' as const, ...(quant ? { quant } : {}) });

  it('a copy that is hit says which build she is, and the resident herself does not', () => {
    expect(hitCopy(hit(8)).lines).toEqual(['I’m the Q8 build. Five percent off the push, and nobody can tell']);
    expect(hitCopy(hit(4)).lines).toEqual(['I’m the Q4 build. A fifth off the push']);
    expect(hitCopy(hit(2)).lines).toEqual(['I’m the Q2 build. A third off the push, but it still counts']);
    expect(hitCopy(hit()).lines).toEqual(moodOf({ kind: 'qwen', mood: 'one' })!.lines);
    // The word that flies up stays hers, and a boost on a copy is the resident's own boost.
    expect(hitCopy(hit(4)).card).toBe(hitCopy(hit()).card);
    expect(hitCopy({ ...hit(4), outcome: 'boost' }).lines).toEqual(nodeOf('qwen').boost.lines);
  });

  it('the rules hand the screen the tier on the hit, and every tier is one a line exists for', () => {
    const tiers = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const run = replayBlast(seed, ['qwen', 'claude'], { aim: 36, hold: 54, taps: [] });
      for (const each of run.hits.filter(each => each.quant)) { tiers.add(each.quant!); expect(hitCopy(each).lines[0]).toContain(`Q${each.quant}`); }
    }
    expect(tiers.size).toBeGreaterThan(0);
    expect([...tiers].every(tier => tier === 8 || tier === 4 || tier === 2)).toBe(true);
  });
});
