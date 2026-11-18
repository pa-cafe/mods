const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as const;
type TokenUnit = '' | typeof units[number][1];

export function tokenUnit(tokens: number): TokenUnit {
  return units.find(([size]) => tokens >= size)?.[1] ?? '';
}

/** Three figures and a unit, rounded down so the counter never shows more than has burned: 842, 12.4K, 1.28M, 2.61B, 1.38T. */
export function formatTokens(tokens: number) {
  const whole = Math.max(0, Math.floor(tokens));
  const unit = units.find(([size]) => whole >= size);
  if (!unit) return String(whole);
  const value = whole / unit[0], decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2, step = 10 ** decimals;
  return `${(Math.floor(value * step) / step).toFixed(decimals)}${unit[1]}`;
}
