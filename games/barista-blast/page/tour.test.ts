import { describe, expect, it } from 'vitest';
import { BLAST_HZ, replayBlast, startBlast, stepBlast, type BlastRun } from '../rules.ts';
import { blastTap } from './ahead';
import { aimingPhase, pressBlast, releaseBlast, STEP_MS, type BlastPhase } from './phase';
import { beatAt, beatOf, nextBeat, startTour, TOUR_RUN, TOUR_WAIT_MS, tourHand, tourRate, tourStep, tourWait } from './tour';

const [aim, hold, ...flight] = TOUR_RUN.beats;
const taps: number[] = flight.filter(beat => beat.act === 'tap').map(beat => beat.at);
const demo = (): BlastPhase => ({ ...aimingPhase(TOUR_RUN.seed, 0, TOUR_RUN.cast, null), tour: true });

describe('BARISTA BLAST!! first-play tour: the demo run', () => {
  it('launches, then fills the caffeine, boosts, wants a cup and dives, in that order, about two seconds apart', () => {
    expect([aim.step, hold.step, ...flight.map(beat => beat.step)]).toEqual(['aim', 'release', 'caffeine', 'boost', 'refill', 'dive']);
    const run = startBlast(TOUR_RUN.seed, TOUR_RUN.cast, aim.at, hold.at, null), seen: Record<string, BlastRun> = {};
    let next = 0;
    while (!run.end) {
      const beat = flight[next];
      if (beat && run.step === beat.at) { seen[beat.step] = structuredClone({ ...run, street: undefined, luck: undefined }) as unknown as BlastRun; next++; }
      stepBlast(run, taps.includes(run.step));
    }
    expect(next).toBe(flight.length);
    expect(seen.caffeine.caffeine).toBe(3);
    expect(seen.boost.boost).not.toBeNull();
    expect(blastTap(seen.refill)).toBe('refill');
    expect(blastTap(seen.dive)).toBe('dive');
    expect(run.hits.filter(hit => hit.outcome === 'boost')).toHaveLength(1);
    expect(run.hits.some(hit => hit.dive)).toBe(true);
    expect(run.hits.filter(hit => hit.mood === 'bad' && !hit.waived && hit.step < flight.at(-1)!.at)).toEqual([]);
    expect(run.end).toBe('stopped');
    const gaps = flight.map((beat, index) => (beat.at - (flight[index - 1]?.at ?? 0)) / BLAST_HZ);
    for (const gap of gaps.slice(1)) { expect(gap).toBeGreaterThan(1.2); expect(gap).toBeLessThan(4); }
    expect(run.step / BLAST_HZ).toBeLessThan(20);
    expect(replayBlast(TOUR_RUN.seed, TOUR_RUN.cast, { aim: aim.at, hold: hold.at, taps }).x).toBe(run.x);
  });
});

describe('BARISTA BLAST!! first-play tour: the beats', () => {
  it('shows nothing on a device that has finished or skipped it', () => {
    const tour = startTour(false);
    expect(beatOf(tour)).toBeNull();
    expect(tourStep(tour, demo(), 0)).toBeNull();
    expect(tourRate(tour, demo(), 10_000)).toBe(1);
  });

  it('stops the nozzle on the beat’s angle and waits there for a press', () => {
    const tour = startTour(true), phase = demo(), at = beatAt(tour, phase)!;
    expect(at).toBeCloseTo((aim.at + 0.5) * STEP_MS);
    expect(tourStep(tour, phase, 0)).toBe('aim');
    expect(tourRate(tour, phase, at - 1000)).toBe(1);
    expect(tourRate(tour, phase, at - 100)).toBeGreaterThan(0);
    expect(tourRate(tour, phase, at - 100)).toBeLessThan(1);
    expect(tourRate(tour, phase, at)).toBe(0);
    expect(tourWait(tour, 1000)).toBe(false);
    tourHand(tour, phase, at, true);
    expect(tourWait(tour, 16)).toBe(true);

    expect(pressBlast(phase, at)).toMatchObject({ kind: 'charging', aim: aim.at });
  });

  it('does a beat for the player who does nothing, after a short wait', () => {
    const tour = startTour(true);
    expect(tourWait(tour, TOUR_WAIT_MS - 1)).toBe(false);
    expect(tourWait(tour, 1)).toBe(true);
    nextBeat(tour);
    expect(beatOf(tour)).toBe(hold);
    expect(tour.waited).toBe(0);
  });

  it('keeps a finger let go before the launch beat came, and launches on the gauge’s beat', () => {
    const tour = startTour(true), aiming = demo();
    tourHand(tour, aiming, 10, true); tourHand(tour, aiming, 20, false);
    nextBeat(tour);
    const charging = pressBlast(aiming, beatAt(startTour(true), aiming)!), at = beatAt(tour, charging)!;
    expect(tourStep(tour, charging, at)).toBe('release');
    expect(tourWait(tour, 0)).toBe(true);
    expect(releaseBlast(charging, at)).toMatchObject({ kind: 'flying', tour: true, inputs: { aim: aim.at, hold: hold.at } });
  });

  it('in flight, counts a tap only while the beat’s note is up, and stops the run with the beat’s step still to run', () => {
    const tour = startTour(true);
    nextBeat(tour); nextBeat(tour);
    const flying = releaseBlast(pressBlast(demo(), 0), 0), at = beatAt(tour, flying)!;
    expect(at).toBeCloseTo((flight[0].at - 0.5) * STEP_MS);
    tourHand(tour, flying, at - 2000, true);
    expect(tour.ready).toBe(false);
    expect(tourStep(tour, flying, at - 2000)).toBeNull();
    expect(tourStep(tour, flying, at - 10)).toBeNull();
    expect(tourStep(tour, flying, at)).toBe('caffeine');
    tourHand(tour, flying, at, true);
    expect(tour.ready).toBe(true);
    nextBeat(tour);
    expect(beatOf(tour)).toBe(flight[1]);
    expect(tour.ready).toBe(false);
  });
});
