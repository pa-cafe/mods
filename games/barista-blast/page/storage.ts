/** The browser's own storage, for what this browser remembers of the game. Private windows and blocked storage read as empty. */
const area = (): Storage | null => { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } };
export function readStored(key: string): string | null { try { return area()?.getItem(key) ?? null; } catch { return null; } }
export function writeStored(key: string, value: string | null): boolean {
  const storage = area(); if (!storage) return false;
  try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); return true; } catch { return false; }
}
