export const cardLooks = ['full', 'chibi'] as const;
export type CardLook = typeof cardLooks[number];
const KEY = 'pa-cafe-blast-card-look';
let kept: CardLook | null = null;

export function storedCardLook(): CardLook {
  try { return cardLooks.find(known => known === localStorage.getItem(KEY)) ?? 'full'; } catch { return kept ?? 'full'; }
}
export function chooseCardLook(next: CardLook) { try { localStorage.setItem(KEY, next); } catch { kept = next; } }
