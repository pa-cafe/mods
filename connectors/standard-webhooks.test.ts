import { describe, expect, it } from 'vitest';
import { signDelivery } from './herdr/link.mjs';
import { freshTimestamp, signStandardWebhook, signedContent, verifyStandardWebhook } from './standard-webhooks.ts';

const bytes = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

describe('Standard Webhooks deliveries', () => {
  it('signs the way the published Standard Webhooks example does', async () => {
    const key = bytes('MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw');
    expect(await signStandardWebhook(key, 'msg_p5jXN8AQM9LWM0D4loKWxJek', '1614265330', '{"test": 2432232314}')).toBe('g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=');
  });

  it('signs id, timestamp and body joined by dots, as bytes', () => {
    expect(new TextDecoder().decode(signedContent('msg_1', '100', new TextEncoder().encode('{"a":1}')))).toBe('msg_1.100.{"a":1}');
  });

  it('accepts any matching v1 entry under any key, so a secret can be rotated', async () => {
    const key = new Uint8Array(32).fill(7), old = new Uint8Array(32).fill(9);
    const signature = await signStandardWebhook(key, 'msg_1', '100', 'body');
    expect(await verifyStandardWebhook([old, key], 'msg_1', '100', 'body', `v1,bad v1,${signature}`)).toBe(true);
    expect(await verifyStandardWebhook([old], 'msg_1', '100', 'body', `v1,${signature}`)).toBe(false);
  });

  it('turns away a delivery whose id, timestamp or body was changed after signing', async () => {
    const key = new Uint8Array(32).fill(7);
    const signature = `v1,${await signStandardWebhook(key, 'msg_1', '100', 'body')}`;
    expect(await verifyStandardWebhook([key], 'msg_1', '100', 'body', signature)).toBe(true);
    expect(await verifyStandardWebhook([key], 'msg_2', '100', 'body', signature)).toBe(false);
    expect(await verifyStandardWebhook([key], 'msg_1', '101', 'body', signature)).toBe(false);
    expect(await verifyStandardWebhook([key], 'msg_1', '100', 'body!', signature)).toBe(false);
  });

  it('ignores signature entries that are not v1 or not base64', async () => {
    const key = new Uint8Array(32).fill(7);
    const signature = await signStandardWebhook(key, 'msg_1', '100', 'body');
    for (const header of ['', signature, `v2,${signature}`, 'v1,***']) expect(await verifyStandardWebhook([key], 'msg_1', '100', 'body', header)).toBe(false);
  });

  it('bounds timestamps by the tolerance and takes only whole seconds', () => {
    expect(freshTimestamp('1000', 1_300_000, 300)).toBe(true);
    expect(freshTimestamp('1600', 1_300_000, 300)).toBe(true);
    for (const [timestamp, now] of [['1000', 1_301_000], ['1601', 1_300_000], ['10.5', 10_500], ['', 0], ['-5', 0]] as const) expect(freshTimestamp(timestamp, now, 300)).toBe(false);
  });

  it('accepts what the Herdr bridge signs', async () => {
    const secret = `whsec_${btoa(String.fromCharCode(...new Uint8Array(32).fill(3)))}`;
    const signature = signDelivery(secret, 'delivery-1', '1700000000', '{"type":"pane.agent_status_changed"}');
    expect(await verifyStandardWebhook([new Uint8Array(32).fill(3)], 'delivery-1', '1700000000', '{"type":"pane.agent_status_changed"}', `v1,${signature}`)).toBe(true);
  });
});
