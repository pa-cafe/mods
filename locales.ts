/** The languages the cafe ships. Text a mod shows to people comes in these. */
export const locales = ['zh-TW', 'zh-CN', 'ja', 'ko', 'en'] as const;
export type Locale = (typeof locales)[number];
