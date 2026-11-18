/** The cafe's day starts at midnight in Taipei, the time zone the cafe settles its days in. */
const format = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' });
export function settlementDay(at: number): string {
  const part = Object.fromEntries(format.formatToParts(at).map(each => [each.type, each.value]));
  return `${part.year}-${part.month}-${part.day}`;
}
