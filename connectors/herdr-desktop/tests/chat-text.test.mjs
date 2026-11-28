import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { agentMessage, validMessage } from '../pacafe-desktop/session.js';

const prefix = ': message JSON: ';

test('accepts ordinary punctuation, Markdown, Unicode and multi-line text after host CRLF normalization', () => {
  const paste = '# 標題\r\n\r\n- **粗體**\r\n\t重點';
  const normalized = paste.replace(/\r\n/g, '\n');
  for (const text of ['/先看看', '@Claude 請看這段', '! 已更新', '# 標題', '  縮排留著\n\t第二行\n', '。繁體中文 🌿', normalized]) {
    assert.equal(validMessage(text), true, JSON.stringify(text));
    assert.equal(JSON.parse(agentMessage(text).slice(prefix.length)), text);
  }
  assert.equal(validMessage(paste), false, 'un-normalized CR must never reach a native terminal');
  assert.equal(validMessage('a'.repeat(1000)), true);
  assert.equal(validMessage('a'.repeat(1001)), false);
});

test('rejects blank input, lone carriage returns and non-benign terminal controls', () => {
  for (const text of [null, 9, '', '\n\t ', '\r', 'CR\rnewline', 'OSC\u009d sequence', 'ESC\u001b text', 'DEL\u007f text',
    'zero\u0000', 'vertical\u000b', 'back\u0008space', 'bell\u0007', 'c1\u0085 control']) {
    assert.equal(validMessage(text), false, JSON.stringify(text));
  }
});

test('rendered prompt is a single physical line and preserves all content on JSON decode', () => {
  const message = '  # 標題\n\t"引號" \'單引號\' \\ $ ` % ! ^ & | < > ( ) { } [ ] ; * ? ~\u2028輸出\u2029🌿';
  const line = agentMessage(message);
  assert.ok(line.startsWith(prefix));
  assert.equal(JSON.parse(line.slice(prefix.length)), message);
  assert.doesNotMatch(line, /[\n\r\t\u2028\u2029]/u);
  assert.doesNotMatch(line.slice(prefix.length + 1, -1), /["'$%!`^&|<>(){}[\];#*?~]/u);
  for (const shell of ['/bin/sh', '/bin/bash', '/bin/zsh'].filter(existsSync)) {
    const executed = spawnSync(shell, ['-c', line], { encoding: 'utf8', timeout: 3000 });
    assert.equal(executed.status, 0, executed.stderr);
    assert.equal(executed.stdout, '');
    assert.equal(executed.stderr, '');
  }
});

test('ordinary project chat adds no service, inbox, or acknowledgement instructions', () => {
  const message = '先看看這個專案現在做到哪裡，再整理下一步。';
  assert.equal(agentMessage(message), `: message JSON: "${message}"`);
});
