import { test } from 'node:test';
import assert from 'node:assert/strict';
import { earlyBirdStatus } from './verify-live-status.mjs';

test('rejects inaccessible or unrecognized Evenea responses', () => {
  assert.equal(earlyBirdStatus(403, '<tr id="ticketRow452215">Wyprzedane</tr>'), 'unknown');
  assert.equal(earlyBirdStatus(200, '<tr id="other">Wyprzedane</tr>'), 'unknown');
  assert.equal(
    earlyBirdStatus(200, '<tr id="ticketRow452215">Tickets</tr><tr>Wyprzedane</tr>'),
    'unknown',
  );
});

test('recognizes sold out only within the selected ticket row', () => {
  assert.equal(
    earlyBirdStatus(200, '<tr id="ticketRow452215"><td>Wyprzedane</td></tr>'),
    'sold-out',
  );
});
