# Connectors

A connector brings something that happened elsewhere into a cafe: a build finished, a row was added, an agent in a terminal needs approval. It runs outside the cafe, on your machine or in a tool you already use, and delivers to a source the barista created.

## The contract

A delivery is one HTTPS POST to the source's address, signed as [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md) v1:

| Header | Value |
| --- | --- |
| `webhook-id` | One id per delivery. A retry keeps the same id |
| `webhook-timestamp` | Seconds since the epoch |
| `webhook-signature` | `v1,` then the base64 HMAC-SHA256 of `{id}.{timestamp}.{body}` under the source's secret |

The secret is shown once when the source is created, as `whsec_` followed by base64. The cafe turns away a delivery whose timestamp is far from its own clock or whose signature no key of that source made.

[`standard-webhooks.ts`](standard-webhooks.ts) is the same code the cafe verifies with. Use `signStandardWebhook` to sign and `verifyStandardWebhook` to test your bridge without a cafe.

## What is here

- [`herdr/`](herdr/README.md): the bridge for Herdr, a terminal multiplexer for coding agents. It pairs with a cafe by a short code and reports when an agent in a pane changes state. It is the reference for writing your own. People install it from [pa-cafe/herdr-mod](https://github.com/pa-cafe/herdr-mod).

Copy-and-paste senders for Zapier, n8n, Apps Script, curl and others are in [`../recipes/`](../recipes/README.md).
