import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { summarizeCollections } from './summarize-hunt-collections.mjs';

const entry = (state, id) => ({ state, card: { id, title: 'never print me' } });
test('counts each opted-in account once per card and suppresses small cells', () => {
  const documents = [
    {
      entries: {
        found_test001: entry('found', 'test001'),
        earned_test001: entry('earned', 'test001'),
        found_test002: entry('found', 'test002'),
      },
    },
    {
      entries: {
        earned_test001: entry('earned', 'test001'),
        found_test002: entry('found', 'test002'),
      },
    },
    {
      entries: {
        found_test001: entry('found', 'test001'),
        earned_test002: entry('earned', 'test002'),
      },
    },
    { entries: { earned_test001: entry('earned', 'test001') } },
    { entries: { earned_test001: entry('earned', 'test001') } },
  ];
  const output = summarizeCollections(documents);
  assert.equal(output.accountsWithAtLeastOneCard, 5);
  assert.deepEqual(output.cards.test001, { foundOrEarned: 5, earned: '<5' });
  assert.deepEqual(output.cards.test002, { foundOrEarned: '<5', earned: '<5' });
  assert.ok(!JSON.stringify(output).includes('never print me'));
});
test('ignores malformed records and never exposes a small account count', () => {
  const output = summarizeCollections([
    { entries: { earned_test001: entry('earned', 'test002') } },
    { entries: { found_test001: entry('found', 'test001') } },
  ]);
  assert.equal(output.accountsWithAtLeastOneCard, '<5');
  assert.deepEqual(output.cards, { test001: { foundOrEarned: '<5', earned: '<5' } });
  assert.throws(() => summarizeCollections([], 1));
});
