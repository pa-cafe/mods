// What a bridge must send to a cafe source, and what the cafe checks. This is Standard Webhooks v1
// (https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md):
//
//   webhook-id         one id per delivery; a retry keeps it
//   webhook-timestamp  seconds since the epoch, as digits
//   webhook-signature  "v1," followed by base64 HMAC-SHA256 of `{id}.{timestamp}.{body}` under the source's secret
//
// The cafe turns away a delivery whose timestamp is too far from its own clock, or that no key it holds signed.

type Bytes = Uint8Array<ArrayBuffer>;

const utf8 = (value: string | Bytes): Bytes => (typeof value === 'string' ? new TextEncoder().encode(value) : value);
const hmacKey = (key: Bytes, usage: 'sign' | 'verify') => crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
function fromBase64(text: string): Bytes | null {
  try {
    return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Whether `timestamp` is whole seconds within `toleranceS` of `now` (milliseconds). */
export const freshTimestamp = (timestamp: string, now: number, toleranceS: number) => /^\d{1,12}$/.test(timestamp) && Math.abs(now / 1000 - Number(timestamp)) <= toleranceS;

/** The bytes that get signed: `{id}.{timestamp}.{body}`. */
export function signedContent(id: string, timestamp: string, body: string | Bytes): Bytes {
  const head = utf8(`${id}.${timestamp}.`), tail = utf8(body);
  const out = new Uint8Array(head.byteLength + tail.byteLength);
  out.set(head);
  out.set(tail, head.byteLength);
  return out;
}

/** The base64 signature for one delivery. Send it as `v1,<signature>`. */
export const signStandardWebhook = async (key: Bytes, id: string, timestamp: string, body: string | Bytes) =>
  base64(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(key, 'sign'), signedContent(id, timestamp, body))));

/** True when any `v1,` entry in the header was made with any of `keys`. Several keys let a secret be rotated. */
export async function verifyStandardWebhook(keys: readonly Bytes[], id: string, timestamp: string, body: string | Bytes, header: string) {
  const content = signedContent(id, timestamp, body);
  const given = header.split(' ').flatMap((part) => {
    const bytes = part.startsWith('v1,') ? fromBase64(part.slice(3)) : null;
    return bytes ? [bytes] : [];
  });
  // WebCrypto's verify compares in constant time.
  for (const key of keys) for (const signature of given) if (await crypto.subtle.verify('HMAC', await hmacKey(key, 'verify'), signature, content)) return true;
  return false;
}
