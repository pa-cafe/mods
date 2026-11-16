import { expect, it } from 'vitest';
import { ledgerCheck, playAuthor, selfReported } from './play.ts';

it('takes the resident from the host and the rest of the author block from the claim', () => {
  expect(playAuthor('agent-1', { resident: 'someone-else', model: ' claude-opus-5-5 ', tool: 'Claude Code', humanEdited: false })).toEqual({
    ok: true, author: { resident: 'agent-1', model: 'claude-opus-5-5', tool: 'Claude Code', humanEdited: false },
  });
  for (const claimed of [undefined, {}, { model: '', tool: 'self', humanEdited: true }, { model: 'm', tool: 'self' }, { model: 'm'.repeat(81), tool: 'self', humanEdited: true }, { model: 'm', tool: 't'.repeat(41), humanEdited: true }, { model: 'm', tool: 'self', humanEdited: 'no' }]) {
    expect(playAuthor('agent-1', claimed).ok, JSON.stringify(claimed)).toBe(false);
  }
  expect(selfReported).toEqual(['model', 'tool', 'humanEdited']);
});

it('checks the claimed model against the day\'s ledger without ever refusing', () => {
  expect(ledgerCheck('claude-opus-5-5', ['claude-opus-5-5-20261101', 'gpt-5.5'])).toBe('match');
  expect(ledgerCheck('Claude Opus 5.5', ['anthropic/claude-opus-5-5'])).toBe('match');
  expect(ledgerCheck('gpt-5.5', ['claude-opus-5-5'])).toBe('mismatch');
  expect(ledgerCheck('gpt-5.5', [])).toBe('no_usage');
});
