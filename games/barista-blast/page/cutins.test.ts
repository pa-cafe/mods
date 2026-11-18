// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { chooseCutins, cutinPolicy, storedCutins } from './cutin-policy';
/** Midnight in Taipei, where the cafe's day starts. */
const settlementDayStart = (day: string) => Date.parse(`${day}T00:00:00+08:00`);

beforeEach(() => { localStorage.clear(); });
afterEach(() => { localStorage.clear(); });

it('plays each kind of big moment in full the first time on a day of the cafe’s clock, then as its small card', () => {
  const morning = settlementDayStart('2026-11-16') + 3_600_000;
  expect(storedCutins()).toBe('daily');
  expect([cutinPolicy('boost:claude', morning), cutinPolicy('boost:claude', morning + 1000), cutinPolicy('boost:dots', morning), cutinPolicy('combo:a', morning)]).toEqual(['full', 'badge', 'full', 'full']);
  expect(cutinPolicy('boost:claude', settlementDayStart('2026-11-17') + 1)).toBe('full');
});

it('every time, or never, as the viewer chose, and the choice is remembered', () => {
  chooseCutins('always');
  expect([cutinPolicy('boost:claude'), cutinPolicy('boost:claude')]).toEqual(['full', 'full']);
  expect(localStorage.getItem('pa-cafe-blast-cutins')).toBe('always');
  chooseCutins('never');
  expect(cutinPolicy('takeover:capacity')).toBe('badge');
});
