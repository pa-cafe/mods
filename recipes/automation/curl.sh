#!/bin/sh
# PA Cafe · send one notice from a terminal.
# Signed (default): needs the Inbound URL and Signing secret of a Generic webhook source.
INBOUND_URL='https://YOUR-CAFE/api/inbound/HOUSE/SOURCE'
SIGNING_SECRET='whsec_PASTE_YOUR_SIGNING_SECRET'
BODY='{"title":"Hello from curl","body":"The cafe heard this."}'

ID="curl-$(date +%s)-$$"
TS=$(date +%s)
KEY_HEX=$(printf '%s' "${SIGNING_SECRET#whsec_}" | openssl base64 -d -A | od -An -tx1 | tr -d ' \n')
SIG=$(printf '%s' "$ID.$TS.$BODY" | openssl dgst -sha256 -mac HMAC -macopt "hexkey:$KEY_HEX" -binary | openssl base64 -A)
curl -sS -X POST "$INBOUND_URL" -H 'content-type: application/json' -H "webhook-id: $ID" -H "webhook-timestamp: $TS" -H "webhook-signature: v1,$SIG" --data-binary "$BODY"

# Link-only (less safe, only if you turned it on for this source): the private link is the key, no signature.
# curl -sS -X POST 'PASTE_YOUR_PRIVATE_LINK' -H 'content-type: application/json' --data-binary "$BODY"
