import { BLAST_HZ, BLAST_VERSION, blastLooks, blastPower, blastTokens, blastTuning, replayBlast, type BlastHit, type BlastInputs, type BlastKind, type BlastPilot, type BlastRun } from '../rules.ts';
import { blastProofSchema, type BlastProof, type BlastRunReport, type TicketBook } from './contract.ts';
import { readStored as read, writeStored as write } from './storage.ts';
import { t } from './i18n.ts';
import { loadAtlas } from './art';
import { flatStreet, storedGraphics, storeGraphics, type BlastGraphics } from './graphics';
import { milestoneTokens } from './copy';
import { advanceBlast, aimingPhase, holdStep, pickBlast, pressBlast, releaseBlast, STEP_MS, type BlastPhase } from './phase';
import type { BlastReplay } from './replay';
import type { BlastRules } from './rules-past';
import { sceneAt } from './scenes';
import { skipsSlow, SLOW_MS, slowSkip, slowsDown } from './slow';
import { BlastAudio, sceneTrack } from './sound';
import type { BlastStage } from './stage';
import { beatAt, beatOf, nextBeat, startTour, TOUR, TOUR_RUN, tourHand, tourRate, tourStep, tourWait } from './tour';
import { BlastScene, INTRO_MS, type Keep } from './view';

const PILOT = 'barista-blast-pilot';
const RUNS = 'barista-blast-runs', BEST = 'barista-blast-best', HINTS = 'barista-blast-hints', MET = 'barista-blast-met';

/**
 * `proof` is the run as the Worker can check it, or null for a run played without a ticket: that one stays in this browser.
 * `replay` is the run as a link can carry it, `run` how it ended, and `watched` says it was somebody's shared run played back.
 */
export type BlastResult = { tokens: number; record: boolean; report: BlastRunReport; proof: BlastProof | null; replay: BlastReplay; run: BlastRun; watched: boolean; /** The player's own run from before they signed in, shown again: it was counted when it was played. */ returned?: boolean; /** The first-play tour's demo run: never scored, kept or sent. */ tour?: true };
/** A shared run to play back as the page opens, and the rules it was played under. Without them the page opens on the run's street for the viewer to fly at once. */
export type BlastWatch = { replay: BlastReplay; rules: BlastRules | null };

const WATCH_LEAD_MS = 900;
/** `tour` says when the first-play tour starts or ends, so the page can offer to skip it. */
type BlastShell = { phase(kind: BlastPhase['kind'], result: BlastResult | null): void; tour?(on: boolean): void };

const inLap = (inputs: BlastInputs): BlastInputs => ({ aim: inputs.aim % blastTuning.aimSteps, hold: inputs.hold % blastTuning.gaugeSteps, taps: [...inputs.taps], ...(inputs.pilot ? { pilot: inputs.pilot } : {}) });
function proofOf(token: string | null, inputs: BlastInputs): BlastProof | null {
  const proof = token ? blastProofSchema.safeParse({ token, inputs: inLap(inputs) }) : null;
  return proof?.success ? proof.data : null;
}
const residents: readonly BlastKind[] = blastLooks;
export type BlastGame = {
  again(): void;
  /** The page's language changed: the canvas draws its words again in it. */
  relabel(): void;
  /** A picture of one kind of thing on the street, as an image address. Null where the page cannot draw one yet. */
  picture(kind: BlastKind): string | null;
  /** Holds the run still while the page asks something, and lets it go on after. */
  pause(on: boolean): void;
  /** How much of the screen's bottom the page's buttons take, in CSS pixels, so the receipt can rest above them. */
  foot(pixels: number): void;
  /** Who is launched from the next launch on: null is the cafe's own barista. Only before a launch; the browser remembers the choice. */
  pick(pilot: BlastPilot): void;

  pilot(): BlastPilot;
  /** Whether the first-play tour is showing, and the way out of it: either way this device does not see it again. */
  touring(): boolean; skipTour(): void;
  /** Plays the tour's demo run again, from the launch. Only before a launch. */
  replayTour(): void;
   recast(stage: BlastStage): void;
  /** Puts a run the player made before signing in back on screen as its bill, for the place it took on the board. Only before a launch: says whether it did. */
  reveal(replay: BlastReplay): boolean;
  /** How the street is drawn from now on; the browser remembers the choice. */
  graphics(mode: BlastGraphics): void;
  destroy(): void };



const busy = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('a, button, input, textarea, select, [contenteditable="true"]'));

/**
 * Runs the game on a canvas: input, the fixed-step loop and the scene. Game time is the page clock minus time spent
 * hidden, so a tab in the background pauses the run instead of skipping it.
 */
export function playBlast(canvas: HTMLCanvasElement, shell: BlastShell, stage: BlastStage, streetCanvas: HTMLCanvasElement | null = null, book: TicketBook | null = null, watch: BlastWatch | null = null): BlastGame {
  const ctx = canvas.getContext('2d')!;

  let watching = watch?.rules ? watch : null;

  let sawShared = false;

  const seed = () => {
    return book?.next()?.seed ?? crypto.getRandomValues(new Uint32Array(1))[0];
  };
  const castNow = () => stage.cast;
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const scene = new BlastScene(ctx, t, calm, stage);

  const sound = new BlastAudio();
  scene.said = line => sound.say(line);
  sound.scene('theme');
  const hints = (() => { try { return JSON.parse(read(HINTS) ?? '{}') as Partial<Keep>; } catch { return {}; } })();
  const keep: Keep = { best: Number(read(BEST)) || 0, aimHint: hints.aimHint === true, flyHint: hints.flyHint === true, runs: Number(read(RUNS)) || 0 };
  let street: import('./street3d').Street3d | null = null;

  const met = new Set<string>((() => { try { const kinds: unknown = JSON.parse(read(MET) ?? '[]'); return Array.isArray(kinds) ? kinds.filter(kind => typeof kind === 'string') : []; } catch { return []; } })());

  let held = 0, paused = false;

  let slow = 0;

  let tour = startTour(read(TOUR) !== 'done' && !watch);

  const endTour = () => {
    if (!tour.on) return;
    tour = startTour(false); write(TOUR, 'done'); shell.tour?.(false);
    if (phase.tour && phase.kind !== 'result') { held = 0; slow = 0; owed = null; settle(aimingPhase(seed(), game(performance.now()), castNow(), chosen())); }
  };

  const tourPhase = (at: number): BlastPhase => ({ ...aimingPhase(TOUR_RUN.seed, at, TOUR_RUN.cast, null), tour: true });

  let owed: (() => void) | null = null;
  let hidden = 0, hiddenAt: number | null = null, frame = 0, last = performance.now(), alive = true;
  const game = (wall: number) => wall - hidden;

  const stamp = (event: Event) => {
    const now = performance.now(), at = event.timeStamp > now - 1000 && event.timeStamp <= now ? event.timeStamp : now;

    return game(at) - (held || paused ? 0 : slow ? slowSkip(at - last, slow) : 0);
  };

  const remembered = (): BlastPilot => { const kept = read(PILOT); return blastLooks.find(look => look === kept) ?? null; };
  let picked: BlastPilot = remembered();
  const chosen = (): BlastPilot => picked;
  let phase: BlastPhase = watching ? aimingPhase(watching.replay.seed, game(last) + WATCH_LEAD_MS, watching.replay.cast, watching.replay.inputs.pilot ?? null, watching.rules ?? undefined)
    : tour.on ? tourPhase(game(last)) : aimingPhase(seed(), game(last), castNow(), chosen());
  scene.flying = phase.pilot;


  let returning = false;
  const settle = (next: BlastPhase) => {
    const was = phase;
    phase = next;
    scene.flying = next.pilot;
    if (next.kind === was.kind) return;
    if (next.kind === 'charging') sound.cue('press');
    else sound.charge(null);
    if (next.kind === 'flying') {
      scene.launched(next, game(performance.now()));
      sound.cue('launch', blastPower(next.inputs.hold));

      if (!keep.aimHint && !next.tour) { keep.aimHint = true; write(HINTS, JSON.stringify({ aimHint: true, flyHint: keep.flyHint })); }
    }
    if (next.kind === 'result' && next.tour) {

      endTour();
      keep.aimHint = true; keep.flyHint = true; write(HINTS, JSON.stringify({ aimHint: true, flyHint: true }));
      const { run } = next, tokens = blastTokens(run.x);
      const tell = () => shell.phase('result', { tokens, record: false, report: { tokens, ms: Math.round(run.step / BLAST_HZ * 1000), residents: 0, boosts: 0, end: run.end ?? 'stopped', record: false },
        proof: null, run, watched: false, tour: true, replay: { version: BLAST_VERSION, seed: next.seed, cast: [...next.cast], inputs: inLap(next.inputs) } });
      if (held) owed = tell; else tell();
      sound.scene(null);
      return;
    }
    if (next.kind === 'result') {

      const watched = Boolean(watching), tokens = (next.rules?.blastTokens ?? blastTokens)(next.run.x), record = !watched && keep.best > 0 && tokens > keep.best;
      sawShared = watched;
      if (watched) watching = null;
      else if (tokens > keep.best) write(BEST, String(tokens));
      if (!keep.flyHint) { keep.flyHint = true; write(HINTS, JSON.stringify({ aimHint: true, flyHint: true })); }
      const { run } = next, hits = run.hits;
      const tell = () => shell.phase('result', { tokens, record, report: {
        tokens, ms: Math.round(run.step / BLAST_HZ * 1000), residents: hits.filter(hit => residents.includes(hit.kind)).length,
        boosts: hits.filter(hit => hit.outcome === 'boost').length, end: run.end ?? 'stopped', record,
      }, proof: watched ? null : proofOf(book?.tokenOf(next.seed) ?? null, next.inputs), run, watched, ...(returning ? { returned: true } : {}),
      replay: { version: next.rules?.BLAST_VERSION ?? BLAST_VERSION, seed: next.seed, cast: [...next.cast], inputs: inLap(next.inputs) } });
      if (held) owed = tell; else tell();
      sound.scene(null);

      if (!returning) sound.receipt(5 + (hits.some(hit => residents.includes(hit.kind)) ? 1 : 0) + (hits.some(hit => hit.outcome === 'boost') ? 1 : 0) + Math.ceil(new Set(hits.map(hit => hit.kind)).size / 4), record);
      return;
    }
    owed = null;
    if (next.kind === 'aiming' && was.kind === 'result' && !was.tour) write(RUNS, String(++keep.runs));
    if (next.kind === 'aiming') sound.scene('theme');
    if (next.kind === 'aiming') keep.best = Math.max(keep.best, Number(read(BEST)) || 0, was.kind === 'result' && !sawShared && !was.tour ? blastTokens(was.run.x) : 0);
    shell.phase(next.kind, null);
  };

  const demo = () => tour.on && Boolean(phase.tour) && phase.kind !== 'result';
  const press = (at: number) => {
    if (held) { held = 0; scene.hurry(); if (demo()) return; }
    if (demo()) { tourHand(tour, phase, game(performance.now()), true); return; }


    else if (!paused && skipsSlow(phase, slow)) { hidden += slowSkip(performance.now() - last, slow); slow = 0; scene.skipBeat(at); }
    // The bill of someone else's run is left by its button, which starts the viewer's own street and barista; a tap
    // would restart with the shared run's residents on a ticket drawn for this cafe's.
    if (!watching && !(phase.kind === 'result' && sawShared)) settle(pressBlast(phase, at));
  };
  const release = (at: number) => { if (demo()) tourHand(tour, phase, game(performance.now()), false); else if (!watching) settle(releaseBlast(phase, at)); };

  const play = (at: number) => {
    const beat = beatOf(tour);
    if (!beat) return;
    if (beat.act === 'press') settle(pressBlast(phase, at));
    else if (beat.act === 'release') settle(releaseBlast(phase, at));
    else if (beat.act === 'tap' && phase.kind === 'flying') phase.queued.push(beat.at);
    nextBeat(tour);
  };

  const tick = (wall: number) => {
    if (!alive) return;
    frame = requestAnimationFrame(tick);
    const rate = demo() ? tourRate(tour, phase, game(wall)) : 1;
    if (paused) hidden += Math.max(0, wall - last);
    else if (held) { const stay = Math.min(held, Math.max(0, wall - last)); hidden += stay; held -= stay; }
    else if (rate < 1) {

      hidden += Math.max(0, wall - last) * (1 - rate);
      const at = beatAt(tour, phase)!, over = game(wall) - at;
      if (rate === 0 || over >= 0) { hidden += over; slow = 0; if (tourWait(tour, Math.max(0, wall - last))) play(at); }
    }
    else if (slow) { hidden += slowSkip(wall - last, slow); slow -= Math.min(slow, Math.max(0, wall - last)); }
    const now = game(wall), seconds = Math.min(0.1, Math.max(0, (wall - last) / 1000));
    last = wall;

    if (watching && phase.kind === 'aiming' && now >= phase.since + (watching.replay.inputs.aim + 0.5) * STEP_MS) settle(pressBlast(phase, phase.since + (watching.replay.inputs.aim + 0.5) * STEP_MS));
    if (watching && phase.kind === 'charging' && now >= phase.pressed + (watching.replay.inputs.hold + 0.5) * STEP_MS) {
      const flying = releaseBlast(phase, phase.pressed + (watching.replay.inputs.hold + 0.5) * STEP_MS);
      if (flying.kind === 'flying') { flying.queued.push(...watching.replay.inputs.taps); flying.played = true; }
      settle(flying);
    }
    const sipped = phase.kind === 'flying' ? phase.run.caffeine : null;
    const { phase: next, events } = advanceBlast(phase, now, milestoneTokens);
    sound.heard(events);
    if (sipped !== null && sipped < blastTuning.caffeine && (next.kind === 'flying' || next.kind === 'result') && next.run.caffeine >= blastTuning.caffeine) sound.cue('full');

    const big = events.length && (next.kind === 'flying' || next.kind === 'result') ? scene.react(events, next.run, now) : 0;


    const firstOf = (hit: BlastHit) => hit.as === 'window' ? 'window' : hit.mood === 'bad' && !hit.waived ? `${hit.as}:bad` : null;
    const fresh = next.kind === 'flying' || next.kind === 'result' ? events.flatMap(event => { const key = event.type === 'hit' ? firstOf(event.hit) : null; return event.type === 'hit' && key && !met.has(key) ? [{ hit: event.hit, key }] : []; })[0] : undefined;
    if (fresh) { met.add(fresh.key); write(MET, JSON.stringify([...met])); if (!big) { scene.introduce({ kind: fresh.hit.as, mood: fresh.hit.mood }); held = INTRO_MS; } }
    if (big) held = big;

    if (slowsDown(next, events, calm)) slow = SLOW_MS;
    if (next.kind !== 'flying') slow = 0;
    settle(next);

    if (phase.kind === 'charging') sound.charge(Math.sqrt(blastPower(holdStep(phase, now))));
    if (phase.kind === 'flying') sound.scene(sceneTrack(sceneAt(blastTokens(phase.run.x))));
    scene.tour = demo() && !held ? tourStep(tour, phase, now) : null; scene.touring = demo();
    if (owed && !held) { owed(); owed = null; }

    scene.draw(phase, now, seconds, watching ? { ...keep, aimHint: true, flyHint: true } : keep);
    if (street && scene.seen) street.draw(scene.seen);
  };

  const fit = () => {
    const box = canvas.getBoundingClientRect();
    scene.resize(Math.max(1, box.width), Math.max(1, box.height), Math.min(2, window.devicePixelRatio || 1));
    street?.resize(Math.max(1, box.width), Math.max(1, box.height), Math.min(2, window.devicePixelRatio || 1));
  };
  const down = (event: PointerEvent) => {
    if (!event.isPrimary || event.button > 0) return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    sound.wake();
    press(stamp(event));
  };
  const up = (event: PointerEvent) => { if (event.isPrimary) release(stamp(event)); };
  const key = (event: KeyboardEvent) => {
    if (event.code !== 'Space' || busy(event.target)) return;
    event.preventDefault();
    if (event.type === 'keyup') release(stamp(event));
    else if (!event.repeat) { sound.wake(); press(stamp(event)); }
  };
  const visibility = () => {
    const wall = performance.now();
    sound.hush(document.hidden);
    if (document.hidden) { hiddenAt = wall; cancelAnimationFrame(frame); return; }
    if (hiddenAt !== null) hidden += wall - hiddenAt;
    hiddenAt = null; last = wall;
    cancelAnimationFrame(frame); frame = requestAnimationFrame(tick);
  };
  const resized = new ResizeObserver(fit);
  resized.observe(canvas);
  fit();
  canvas.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  window.addEventListener('keydown', key);
  window.addEventListener('keyup', key);
  document.addEventListener('visibilitychange', visibility);
  // The 3D street is its own download: the game plays on the 2D one until it arrives, and keeps it where there is no WebGL or the link says `&2d`.
  // If the browser takes the 3D street's graphics away mid-run (a busy phone, a driver reset), the 2D street comes back for the rest of the visit.
  let lost = false;
  streetCanvas?.addEventListener('webglcontextlost', () => { lost = true; street?.dispose(); street = null; scene.bare = false; }, { once: true });

  let graphics = storedGraphics(), opening = 0;
  const flat = () => { opening++; street?.dispose(); street = null; scene.bare = false; };
  const stand = () => {
    if (!streetCanvas || lost || graphics === 'saver' || flatStreet()) return;
    if (street) { street.hold(graphics === 'sharp'); return; }
    const mine = ++opening;
    void import('./street3d').then(({ Street3d }) => Street3d.open(streetCanvas, graphics === 'sharp')).then(made => { if (!alive || lost || mine !== opening || graphics === 'saver') { made.dispose(); return; } street = made; scene.bare = true; fit(); }).catch(error => console.warn(error));
  };
  stand();
  loadAtlas().then(atlas => { scene.atlas = atlas; }, error => console.warn(error));
  frame = requestAnimationFrame(tick);

  return {

    reveal: replay => {
      if (watching || phase.kind !== 'aiming' || replay.version !== BLAST_VERSION) return false;

      if (tour.on) { tour = startTour(false); shell.tour?.(false); }
      const inputs = { ...replay.inputs, taps: [...replay.inputs.taps] }, run = replayBlast(replay.seed, replay.cast, inputs);
      returning = true;
      settle({ kind: 'result', cast: replay.cast, pilot: replay.inputs.pilot ?? null, seed: replay.seed, run, inputs, at: game(performance.now()) });
      returning = false;
      return true;
    },
    // "Start over" in the middle of the demo run starts the demo again. Either way a card or a takeover that was holding
    // the clock is gone with the run it belonged to, so the hold is let go too.
    again: () => {
      if (watch) picked = remembered();
      const was = phase.kind, cut = watching !== null;
      watching = null; held = 0; slow = 0;
      if (demo()) { tour = startTour(true); owed = null; settle(tourPhase(game(performance.now()))); return; }
      settle(aimingPhase(seed(), game(performance.now()), castNow(), chosen()));
      // A playback cut short before it launched was already aiming, so the page is told the street is the viewer's now.
      if (cut && was === 'aiming') shell.phase('aiming', null);
    },
    replayTour: () => {
      if (watching || tour.on || (phase.kind !== 'aiming' && phase.kind !== 'result')) return;
      tour = startTour(true); shell.tour?.(true); settle(tourPhase(game(performance.now())));
    },

    pick: pilot => { if (watching) return; picked = pilot; write(PILOT, pilot ?? ''); if (phase.kind === 'aiming' && !phase.tour) { phase = pickBlast(phase, pilot); scene.flying = pilot; } },
    pilot: chosen,
    touring: () => tour.on,
    skipTour: endTour,
    pause: on => { paused = on; },
    graphics: mode => { if (mode === graphics) return; graphics = mode; storeGraphics(mode); if (mode === 'saver') flat(); else stand(); },
    foot: pixels => { scene.foot = pixels; },
    picture: kind => { try { return scene.picture(kind)?.toDataURL() ?? null; } catch { return null; } },
    recast: next => { scene.stage = next; },
    relabel: () => scene.relabel(),
    destroy: () => {
      alive = false; cancelAnimationFrame(frame); resized.disconnect(); street?.dispose(); sound.close();
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', key);
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
