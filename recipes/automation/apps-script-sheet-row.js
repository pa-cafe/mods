/**
 * PA Cafe · new Google Sheet row → a notice in your cafe (signed delivery).
 * 1. In the sheet: Extensions → Apps Script, replace the code with this file.
 * 2. Paste your source's Inbound URL and Signing secret below.
 * 3. Run setup() once and allow access. New rows are sent from then on.
 */
const INBOUND_URL = 'https://YOUR-CAFE/api/inbound/HOUSE/SOURCE';
const SIGNING_SECRET = 'whsec_PASTE_YOUR_SIGNING_SECRET';
const SHEET_NAME = ''; // Leave empty for the first sheet.

function setup() {
  ScriptApp.getProjectTriggers().filter(trigger => trigger.getHandlerFunction() === 'sendNewRows').forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('sendNewRows').forSpreadsheet(SpreadsheetApp.getActive()).onChange().create();
  PropertiesService.getScriptProperties().setProperty('lastRow', String(sheet_().getLastRow()));
}

function sendNewRows() {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sheet = sheet_(); const props = PropertiesService.getScriptProperties();
    const last = Number(props.getProperty('lastRow') || sheet.getLastRow()); const now = sheet.getLastRow();
    if (now > last) {
      const width = sheet.getLastColumn();
      const header = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
      const rows = sheet.getRange(last + 1, 1, now - last, width).getDisplayValues();
      rows.forEach(row => sendToCafe_(`New row in ${sheet.getName()}`, header.map((name, column) => `${name || `Column ${column + 1}`}: ${row[column]}`).join('\n')));
    }
    props.setProperty('lastRow', String(now));
  } finally { lock.releaseLock(); }
}

function sheet_() {
  const book = SpreadsheetApp.getActive();
  return SHEET_NAME ? book.getSheetByName(SHEET_NAME) : book.getSheets()[0];
}

// Standard Webhooks signature: HMAC-SHA256 over "id.timestamp.body" with the secret's bytes.
function sendToCafe_(title, body) {
  const id = `sheets-${Utilities.getUuid()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payload = Utilities.newBlob(JSON.stringify({ title, body })).getBytes();
  const content = Utilities.newBlob(`${id}.${timestamp}.`).getBytes().concat(payload);
  const key = Utilities.base64Decode(SIGNING_SECRET.replace(/^whsec_/, ''));
  const signature = Utilities.base64Encode(Utilities.computeHmacSha256Signature(content, key));
  return UrlFetchApp.fetch(INBOUND_URL, { method: 'post', contentType: 'application/json', payload, muteHttpExceptions: true, headers: { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` } });
}
