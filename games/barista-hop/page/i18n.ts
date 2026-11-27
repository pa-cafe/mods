import type { Locale } from '../../../locales.ts';
import { hopHost } from './host.ts';
import { hopMessages } from './messages.ts';

/** A line the game shows, by its English text. */
export type TextKey = typeof hopMessages[number][0];
const column: Record<Locale, number> = { en: 0, 'zh-TW': 1, 'zh-CN': 2, ja: 3, ko: 4 };
const rows = new Map<string, readonly string[]>(hopMessages.map(row => [row[0], row]));

/** The line in the page's language, with `{name}` placeholders filled from `values`. */
export function translate(language: Locale, key: TextKey, values: Record<string, string | number> = {}) {
  const text = rows.get(key)?.[column[language]] || key;
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => String(values[name] ?? placeholder));
}
export const t = (key: TextKey, values?: Record<string, string | number>) => translate(hopHost().locale(), key, values);
