// Runs one bot module in its own thread for the simulator: loads it once, then answers one PlayInput per message
// with what it returned and what the call cost. Each call is handed the rules module of its version, as the cafe does.
import { pathToFileURL } from 'node:url';
import { parentPort, workerData } from 'node:worker_threads';

const cpuMs = (since?: NodeJS.CpuUsage) => { const used = process.threadCpuUsage(since); return (used.user + used.system) / 1000; };
const started = process.threadCpuUsage(), startedAt = performance.now();
const loaded = await import(pathToFileURL(workerData.bot as string).href) as { default?: unknown; play?: unknown };
const play = (loaded.play ?? loaded.default) as ((input: unknown, rules: unknown) => unknown) | undefined;
const load = { cpuMs: cpuMs(started), wallMs: performance.now() - startedAt };

const rulesBy = new Map<string, unknown>();

parentPort!.on('message', async ({ input, rules: file }: { input: unknown; rules: string }) => {
  if (typeof play !== 'function') return parentPort!.postMessage({ error: 'the bot module exports no play function', load });
  if (!rulesBy.has(file)) rulesBy.set(file, await import(pathToFileURL(file).href));
  const before = process.threadCpuUsage(), at = performance.now();
  try {
    const answer = await play(input, rulesBy.get(file));
    // The cafe's sandbox hands the answer back as JSON, so the simulator does too.
    parentPort!.postMessage({ answer: answer === undefined ? null : JSON.parse(JSON.stringify(answer)), cpuMs: cpuMs(before), wallMs: performance.now() - at, load });
  } catch (error) {
    parentPort!.postMessage({ error: error instanceof Error ? error.message : String(error), cpuMs: cpuMs(before), wallMs: performance.now() - at, load });
  }
});
parentPort!.postMessage({ ready: true, load });
