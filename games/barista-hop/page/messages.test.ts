import { describe, expect, it } from 'vitest';
import { locales } from '../../../locales.ts';
import { installHopHost } from './host.ts';
import { t, translate } from './i18n.ts';
import { hopMessages } from './messages.ts';

describe('BARISTA HOP!! lines', () => {
  it('says every line in all five languages, with the same placeholders in each', () => {
    const marks = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join();
    for (const row of hopMessages) {
      expect(row.length).toBe(5);
      for (const text of row) { expect(text.trim().length).toBeGreaterThan(0); expect(marks(text)).toBe(marks(row[0])); }
    }
    expect(new Set(hopMessages.map(row => row[0])).size).toBe(hopMessages.length);
  });

  it('speaks the language of the page that carries it, and fills in the numbers', () => {
    expect(locales.map(locale => translate(locale, '{meters} m', { meters: 42 }))).toEqual(['42 公尺', '42 米', '42 m', '42m', '42 m']);
    expect(t('Refill!')).toBe('Refill!');
    installHopHost({ locale: () => 'zh-TW' });
    expect(t('Refill!')).toBe('續杯！');
    installHopHost({ locale: () => 'en' });
  });
});
