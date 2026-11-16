// Thinks far longer than the wall time allows.
export default function play() {
  let sum = 0;
  for (let i = 0; i < 4e10; i++) sum += i % 7;
  return { aim: 0, hold: 0, taps: [], why: String(sum) };
}
