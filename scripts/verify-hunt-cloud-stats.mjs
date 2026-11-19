import assert from 'node:assert/strict';
import process from 'node:process';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error('Only run this fixture test on the Firestore emulator');
const app = initializeApp({ credential: applicationDefault(), projectId: 'demo-devfest-y2k' });
const db = getFirestore(app);
const exec = promisify(execFile);
for (let index = 0; index < 5; index++) {
  await db
    .collection('huntCollections')
    .doc(`fixture-private-${index}`)
    .set({
      entries: {
        earned_test001: {
          state: 'earned',
          card: { id: 'test001', title: 'private canary', text: 'private reveal' },
          foundAt: 1,
          earnedAt: 2,
        },
        found_test001: { state: 'found', card: { id: 'test001' }, foundAt: 1 },
      },
    });
}
const { stdout } = await exec('node', [
  'scripts/summarize-hunt-collections.mjs',
  '--project',
  'demo-devfest-y2k',
  '--acknowledge-internal-data',
]);
const output = JSON.parse(stdout);
assert.equal(output.accountsWithAtLeastOneCard, 5);
assert.deepEqual(output.cards.test001, { foundOrEarned: 5, earned: 5 });
assert.ok(!stdout.includes('fixture-private-'));
assert.ok(!stdout.includes('private canary'));
assert.ok(!stdout.includes('private reveal'));
console.log(
  'PASS admin aggregation against emulator without exposing participant identifiers or card text',
);
