/**
 * PA Cafe · new file in a Google Drive folder → a notice in your cafe (signed delivery).
 * 1. Open script.google.com → New project, replace the code with this file.
 * 2. Paste your source's Inbound URL and Signing secret, and the folder ID (the last part of the folder's address).
 * 3. Run setup() once and allow access. The folder is checked every 10 minutes.
 */
const INBOUND_URL = 'https://YOUR-CAFE/api/inbound/HOUSE/SOURCE';
const SIGNING_SECRET = 'whsec_PASTE_YOUR_SIGNING_SECRET';
const FOLDER_ID = 'PASTE_THE_FOLDER_ID';

function setup() {
  ScriptApp.getProjectTriggers().filter(trigger => trigger.getHandlerFunction() === 'sendNewFiles').forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('sendNewFiles').timeBased().everyMinutes(10).create();
  PropertiesService.getScriptProperties().setProperty('checkedAt', String(Date.now()));
}

function sendNewFiles() {
  const props = PropertiesService.getScriptProperties();
  const since = Number(props.getProperty('checkedAt') || Date.now()); const now = Date.now();
  const folder = DriveApp.getFolderById(FOLDER_ID); const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next(); const created = file.getDateCreated().getTime();
    if (created > since && created <= now) sendToCafe_(`New file in ${folder.getName()}`, `${file.getName()}\n${file.getUrl()}`);
  }
  props.setProperty('checkedAt', String(now));
}

// Standard Webhooks signature: HMAC-SHA256 over "id.timestamp.body" with the secret's bytes.
function sendToCafe_(title, body) {
  const id = `drive-${Utilities.getUuid()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payload = Utilities.newBlob(JSON.stringify({ title, body })).getBytes();
  const content = Utilities.newBlob(`${id}.${timestamp}.`).getBytes().concat(payload);
  const key = Utilities.base64Decode(SIGNING_SECRET.replace(/^whsec_/, ''));
  const signature = Utilities.base64Encode(Utilities.computeHmacSha256Signature(content, key));
  return UrlFetchApp.fetch(INBOUND_URL, { method: 'post', contentType: 'application/json', payload, muteHttpExceptions: true, headers: { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` } });
}
