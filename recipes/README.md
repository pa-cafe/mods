# Recipes

Setups you copy into a tool you already use, so it can tell your cafe when something happens.

## Automation templates

[`automation/`](automation) holds one file per tool. The cafe serves each at `/automation-templates/<file>`, and the starter quest links to them.

| File | Tool | Signed |
| --- | --- | --- |
| `zapier-code-step.js` | Zapier, Code by Zapier | Yes |
| `n8n-workflow.json` | n8n, Code node | Yes |
| `apps-script-sheet-row.js`, `apps-script-drive-file.js` | Google Apps Script | Yes |
| `curl.sh` | curl with openssl | Yes |
| `make-scenario.json` | Make | No, uses the private link |
| `ifttt-applet.txt` | IFTTT | No, uses the private link |
| `iphone-shortcut.txt` | iPhone Shortcuts | No, uses the private link |
| `slack-app-manifest.json` | Slack | Slack signs its own way |

A signed template follows the contract in [`../connectors/`](../connectors/README.md). A link-only template is for tools that cannot compute a signature; the barista switches that on per source.

Every file uses placeholders only. Put your source's address and secret in after you copy it, and keep the secret out of anything you share.
