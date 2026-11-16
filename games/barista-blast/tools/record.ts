// A BARISTA BLAST!! run as the cafe keeps it: `{ version, seed, cast, inputs }`, from a file or stdin.
import { readFileSync } from 'node:fs';
import { z } from 'zod';

export const recordSchema = z.object({ version: z.number().int(), seed: z.number().int(), cast: z.array(z.string()).max(12), inputs: z.unknown() });
export type BlastRecord = z.infer<typeof recordSchema>;

export function readRecord(path: string | undefined): BlastRecord {
  const text = readFileSync(path && path !== '-' ? path : 0, 'utf8');
  const parsed = recordSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error(`not a run record: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  return parsed.data;
}
