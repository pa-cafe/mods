// PA Cafe · Zapier "Code by Zapier → Run JavaScript" step (signed delivery).
// Input Data: add "title" and "body" and map them from your trigger.
// Paste your source's Inbound URL and Signing secret below. Anyone who can read this Zap can post into your cafe, so keep it private.
const INBOUND_URL = 'https://YOUR-CAFE/api/inbound/HOUSE/SOURCE';
const SIGNING_SECRET = 'whsec_PASTE_YOUR_SIGNING_SECRET';

const crypto = require('crypto');
const id = `zapier-${crypto.randomUUID()}`;
const timestamp = String(Math.floor(Date.now() / 1000));
const payload = JSON.stringify({ title: inputData.title || 'New event from Zapier', body: inputData.body || '' });
const key = Buffer.from(SIGNING_SECRET.replace(/^whsec_/, ''), 'base64');
const signature = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64');
const response = await fetch(INBOUND_URL, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` },
  body: payload,
});
return { status: response.status, reply: await response.text() };
