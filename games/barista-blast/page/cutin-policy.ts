import { settlementDay } from './day.ts';

/** `daily`: each kind in full the first time it comes on a day of the cafe's clock; `always`: every time; `never`: only the small card. */
export const cutinModes = ['daily', 'always', 'never'] as const;
export type CutinMode = typeof cutinModes[number];
const MODE = 'pa-cafe-blast-cutins', SEEN = 'pa-cafe-blast-cutins-seen';

const memory = new Map<string, string>();
function read(key: string) { try { return localStorage.getItem(key); } catch { return memory.get(key) ?? null; } }
function write(key: string, value: string) { try { localStorage.setItem(key, value); } catch { memory.set(key, value); } }

export const storedCutins = (): CutinMode => cutinModes.find(known => known === read(MODE)) ?? 'daily';
export const chooseCutins = (next: CutinMode) => write(MODE, next);

function seenOn(day: string) {
  try { const kept = JSON.parse(read(SEEN) ?? 'null') as { day?: unknown; kinds?: unknown } | null; if (kept?.day === day && Array.isArray(kept.kinds)) return { day, kinds: kept.kinds.filter(kind => typeof kind === 'string') }; } catch {   }
  return { day, kinds: [] as string[] };
}

/**
 * Whether a cut-in of `kind` plays in full now, or shows only as its small card. `kind` names one kind of moment, such
 * as `boost:claude`, `combo:pair` or `takeover:capacity`. A full one is counted as seen for the day.
 */
export function cutinPolicy(kind: string, now = Date.now()): 'full' | 'badge' {
  const chosen = storedCutins();
  if (chosen !== 'daily') return chosen === 'always' ? 'full' : 'badge';
  const today = seenOn(settlementDay(now));
  if (today.kinds.includes(kind)) return 'badge';
  today.kinds.push(kind); write(SEEN, JSON.stringify(today));
  return 'full';
}
