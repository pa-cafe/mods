// Thinks far longer than any budget.
export default function play() {
  let sum = 0;
  for (let i = 0; i < 4e9; i++) sum += i % 7;
  return { aim: 0, hold: 0, taps: [], why: String(sum) };
}
