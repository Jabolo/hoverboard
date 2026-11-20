import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-devfest-rules-hardening',
  firestore: { rules: await readFile('firestore.rules', 'utf8') },
});

const guest = env.unauthenticatedContext().firestore();
const alice = env
  .authenticatedContext('alice', { firebase: { sign_in_provider: 'google.com' } })
  .firestore();
const bob = env
  .authenticatedContext('bob', { firebase: { sign_in_provider: 'google.com' } })
  .firestore();
const passwordAlice = env
  .authenticatedContext('alice', { firebase: { sign_in_provider: 'password' } })
  .firestore();

const validFeedback = (userId = 'alice') => ({
  contentRating: 5,
  styleRating: 4,
  comment: 'Great session!',
  userId,
});

try {
  // Seed baseline fixtures with rules disabled
  await env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    await setDoc(doc(admin, 'sessions/CFP-002'), { title: 'Static + Live Session' });
    await setDoc(doc(admin, 'sessions/CFP-002/feedback/alice'), validFeedback('alice'));
    await setDoc(doc(admin, 'sessions/CFP-002/feedback/bob'), validFeedback('bob'));
    await setDoc(doc(admin, 'featuredSessions/alice'), { 'CFP-002': true });
    await setDoc(doc(admin, 'users/alice'), { email: 'alice@example.test' });
    await setDoc(doc(admin, 'partners/gold'), { title: 'Gold', order: 1 });
    await setDoc(doc(admin, 'partners/gold/items/acme'), { name: 'Acme', order: 1 });
    await setDoc(doc(admin, 'team/core'), { title: 'Core', order: 1 });
    await setDoc(doc(admin, 'team/core/members/m1'), { name: 'Member 1' });
    await setDoc(doc(admin, 'tickets/000'), { name: 'Regular' });
    await setDoc(doc(admin, 'config/site'), { secret: true });
    await setDoc(doc(admin, 'functionsRateLimits/ip1'), { count: 1 });
    await setDoc(doc(admin, 'notifications/n1'), { title: 'Push' });
    await setDoc(doc(admin, 'notificationsSubscribers/token1234567890'), {
      value: true,
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(admin, 'notificationsUsers/alice'), { tokens: { t1: true } });
    await setDoc(doc(admin, 'potentialPartners/p1'), {
      email: 'a@b.com',
      fullName: 'A B',
      companyName: 'Co',
    });
    await setDoc(doc(admin, 'subscribers/s1'), { email: 'a@b.com' });
    await setDoc(doc(admin, 'newsletterContacts/c1'), { email: 'a@b.com' });
  });

  // 1. Default deny on unknown collections
  await assertFails(getDocs(collection(guest, 'some-nonexistent-collection')));
  await assertFails(getDocs(collection(alice, 'some-nonexistent-collection')));
  await assertFails(addDoc(collection(guest, 'some-nonexistent-collection'), { x: 1 }));
  await assertFails(addDoc(collection(alice, 'some-nonexistent-collection'), { x: 1 }));

  // 2. Public read-only conference collections (nested partners/items and team/members work; writes denied)
  await assertSucceeds(getDoc(doc(guest, 'sessions/CFP-002')));
  await assertSucceeds(getDoc(doc(guest, 'partners/gold')));
  await assertSucceeds(getDoc(doc(guest, 'partners/gold/items/acme')));
  await assertSucceeds(getDocs(collection(guest, 'partners/gold/items')));
  await assertSucceeds(getDoc(doc(guest, 'team/core')));
  await assertSucceeds(getDoc(doc(guest, 'team/core/members/m1')));
  await assertSucceeds(getDocs(collection(guest, 'team/core/members')));
  await assertSucceeds(getDoc(doc(guest, 'tickets/000')));
  await assertFails(setDoc(doc(alice, 'sessions/CFP-002'), { title: 'Tampered' }));
  await assertFails(setDoc(doc(alice, 'partners/gold/items/acme'), { name: 'Tampered' }));
  await assertFails(setDoc(doc(alice, 'team/core/members/m1'), { name: 'Tampered' }));
  // Dead wildcard collectionGroup rules for items/members are removed
  await assertFails(getDocs(collectionGroup(guest, 'items')));
  await assertFails(getDocs(collectionGroup(guest, 'members')));

  // 3. Feedback: direct /sessions/{sessionId}/feedback/{userId} + collectionGroup list + wildcard escape blocks
  // 3a. Valid operations on existing and non-Firestore (programme-2026.json) session IDs
  await assertSucceeds(getDoc(doc(alice, 'sessions/CFP-002/feedback/alice')));
  await assertSucceeds(
    setDoc(doc(alice, 'sessions/INVITED-001/feedback/alice'), validFeedback('alice')),
  );
  await assertSucceeds(
    updateDoc(doc(alice, 'sessions/CFP-002/feedback/alice'), {
      contentRating: 3,
      styleRating: 5,
      comment: 'Updated review',
    }),
  );
  // CollectionGroup query used by src/store/feedback/index.ts MUST succeed for owner
  const feedbackSnap = await assertSucceeds(
    getDocs(query(collectionGroup(alice, 'feedback'), where('userId', '==', 'alice'))),
  );
  assert.ok(feedbackSnap.size >= 2, `Expected >= 2 alice feedback docs, got ${feedbackSnap.size}`);
  // Unfiltered or cross-user collectionGroup feedback queries MUST fail
  await assertFails(getDocs(collectionGroup(alice, 'feedback')));
  await assertFails(
    getDocs(query(collectionGroup(alice, 'feedback'), where('userId', '==', 'bob'))),
  );
  await assertFails(
    getDocs(query(collectionGroup(guest, 'feedback'), where('userId', '==', 'alice'))),
  );

  // 3b. Cross-user and unauthenticated feedback access denied
  await assertFails(getDoc(doc(guest, 'sessions/CFP-002/feedback/alice')));
  await assertFails(getDoc(doc(bob, 'sessions/CFP-002/feedback/alice')));
  await assertFails(getDocs(collection(alice, 'sessions/CFP-002/feedback')));
  await assertFails(setDoc(doc(bob, 'sessions/CFP-002/feedback/alice'), validFeedback('alice')));
  await assertFails(setDoc(doc(alice, 'sessions/CFP-002/feedback/alice'), validFeedback('bob')));
  await assertFails(deleteDoc(doc(bob, 'sessions/CFP-002/feedback/alice')));
  await assertFails(deleteDoc(doc(guest, 'sessions/CFP-002/feedback/alice')));

  // 3c. CRITICAL wildcard feedback path escape vectors MUST ALL FAIL
  await assertFails(setDoc(doc(alice, 'feedback/alice'), validFeedback('alice')));
  await assertFails(getDoc(doc(alice, 'feedback/alice')));
  await assertFails(setDoc(doc(alice, 'users/x/feedback/alice'), validFeedback('alice')));
  await assertFails(getDoc(doc(alice, 'users/x/feedback/alice')));
  await assertFails(setDoc(doc(alice, 'sessions/s1/a/b/feedback/alice'), validFeedback('alice')));
  await assertFails(getDoc(doc(alice, 'sessions/s1/a/b/feedback/alice')));
  await assertFails(
    setDoc(doc(alice, `sessions/${'a'.repeat(65)}/feedback/alice`), validFeedback('alice')),
  );
  await assertFails(
    setDoc(doc(alice, 'sessions/bad.session/feedback/alice'), validFeedback('alice')),
  );

  // 3d. Feedback data validation (int-only ratings, bounds, comment size, schema pollution, userId immutability)
  const invalidPayloads = [
    { ...validFeedback('alice'), contentRating: 3.5 },
    { ...validFeedback('alice'), styleRating: 4.25 },
    { ...validFeedback('alice'), contentRating: -1 },
    { ...validFeedback('alice'), contentRating: 6 },
    { ...validFeedback('alice'), styleRating: -1 },
    { ...validFeedback('alice'), styleRating: 6 },
    { ...validFeedback('alice'), contentRating: '5' },
    { ...validFeedback('alice'), comment: null },
    { ...validFeedback('alice'), comment: 'c'.repeat(257) },
    { ...validFeedback('alice'), extra: 'pollution' },
    { contentRating: 5, styleRating: 5, comment: '' }, // missing userId
  ];
  for (const bad of invalidPayloads) {
    await assertFails(setDoc(doc(alice, 'sessions/CFP-014/feedback/alice'), bad));
    await assertFails(setDoc(doc(alice, 'sessions/CFP-002/feedback/alice'), bad));
  }
  await assertSucceeds(deleteDoc(doc(alice, 'sessions/INVITED-001/feedback/alice')));

  // 4. Locked collections: notificationsSubscribers, potentialPartners, notificationsUsers, config, etc.
  // notificationsSubscribers
  await assertFails(getDoc(doc(guest, 'notificationsSubscribers/token1234567890')));
  await assertFails(getDoc(doc(alice, 'notificationsSubscribers/token1234567890')));
  await assertFails(
    setDoc(doc(guest, 'notificationsSubscribers/token1234567890'), {
      value: true,
      updatedAt: Timestamp.now(),
    }),
  );
  await assertFails(
    setDoc(doc(alice, 'notificationsSubscribers/token1234567890'), {
      value: true,
      updatedAt: Timestamp.now(),
    }),
  );
  await assertFails(deleteDoc(doc(guest, 'notificationsSubscribers/token1234567890')));
  await assertFails(deleteDoc(doc(alice, 'notificationsSubscribers/token1234567890')));

  // potentialPartners
  await assertFails(getDoc(doc(guest, 'potentialPartners/p1')));
  await assertFails(getDoc(doc(alice, 'potentialPartners/p1')));
  await assertFails(
    setDoc(doc(guest, 'potentialPartners/p2'), {
      email: 'spam@example.com',
      fullName: 'Spam',
      companyName: 'SpamCo',
    }),
  );
  await assertFails(
    setDoc(doc(alice, 'potentialPartners/p2'), {
      email: 'spam@example.com',
      fullName: 'Spam',
      companyName: 'SpamCo',
    }),
  );
  await assertFails(deleteDoc(doc(alice, 'potentialPartners/p1')));

  // notificationsUsers
  await assertFails(getDoc(doc(alice, 'notificationsUsers/alice')));
  await assertFails(setDoc(doc(alice, 'notificationsUsers/alice'), { tokens: { t1: true } }));
  await assertFails(deleteDoc(doc(alice, 'notificationsUsers/alice')));

  // Server-only collections
  for (const lockedPath of [
    'config/site',
    'functionsRateLimits/ip1',
    'notifications/n1',
    'subscribers/s1',
    'newsletterContacts/c1',
  ]) {
    await assertFails(getDoc(doc(guest, lockedPath)));
    await assertFails(getDoc(doc(alice, lockedPath)));
    await assertFails(setDoc(doc(alice, lockedPath), { hacked: true }));
    await assertFails(deleteDoc(doc(alice, lockedPath)));
  }

  // 5. featuredSessions: owner get ONLY; list and all writes denied
  await assertSucceeds(getDoc(doc(alice, 'featuredSessions/alice')));
  await assertFails(getDoc(doc(guest, 'featuredSessions/alice')));
  await assertFails(getDoc(doc(bob, 'featuredSessions/alice')));
  await assertFails(getDocs(collection(alice, 'featuredSessions')));
  await assertFails(setDoc(doc(alice, 'featuredSessions/alice'), { 'CFP-002': true }));
  await assertFails(updateDoc(doc(alice, 'featuredSessions/alice'), { 'CFP-014': true }));
  await assertFails(deleteDoc(doc(alice, 'featuredSessions/alice')));

  // 6. users: owner get ONLY (explicit auth required); list and writes denied
  await assertSucceeds(getDoc(doc(alice, 'users/alice')));
  await assertFails(getDoc(doc(guest, 'users/alice')));
  await assertFails(getDoc(doc(bob, 'users/alice')));
  await assertFails(getDocs(collection(alice, 'users')));
  await assertFails(setDoc(doc(alice, 'users/alice'), { role: 'admin' }));
  await assertFails(deleteDoc(doc(alice, 'users/alice')));

  // 7. huntCollectionSessions & huntCollections tightened timestamp & type checks
  const epoch = 'a'.repeat(32);
  const nextEpoch = 'b'.repeat(32);
  await assertSucceeds(
    setDoc(doc(alice, 'huntCollectionSessions/alice'), { enabled: true, epoch }),
  );
  await assertFails(
    setDoc(doc(passwordAlice, 'huntCollectionSessions/alice'), {
      enabled: false,
      epoch: nextEpoch,
    }),
  );
  const validEarned = {
    state: 'earned',
    card: { id: 'abc1234', title: 'Disc', group: 'preview', text: 'Reveal' },
    foundAt: 1700000000000,
    earnedAt: 1700000005000,
  };
  const writeHunt = (entryId, entry) =>
    setDoc(
      doc(alice, 'huntCollections/alice'),
      { entries: { [entryId]: entry }, changedKey: entryId, epoch },
      { merge: true },
    );
  // Valid write succeeds
  await assertSucceeds(writeHunt('earned_abc1234', validEarned));
  // Float foundAt rejected
  await assertFails(writeHunt('earned_abc1234', { ...validEarned, foundAt: 100.5 }));
  // Float earnedAt rejected
  await assertFails(writeHunt('earned_abc1234', { ...validEarned, earnedAt: 200.5 }));
  // Overflow foundAt (> 4102444800000) rejected
  await assertFails(writeHunt('earned_abc1234', { ...validEarned, foundAt: 4102444800001 }));
  // Overflow earnedAt (> 4102444800000) rejected
  await assertFails(writeHunt('earned_abc1234', { ...validEarned, earnedAt: 4102444800001 }));
  // earnedAt < foundAt rejected
  await assertFails(writeHunt('earned_abc1234', { ...validEarned, foundAt: 500, earnedAt: 499 }));
  // 64-entry cap enforced (65th denied)
  const capped = env
    .authenticatedContext('capped', { firebase: { sign_in_provider: 'google.com' } })
    .firestore();
  await assertSucceeds(
    setDoc(doc(capped, 'huntCollectionSessions/capped'), { enabled: true, epoch }),
  );
  const capRef = doc(capped, 'huntCollections/capped');
  const baseFound = {
    state: 'found',
    card: { id: 't000000', title: 'Disc', group: 'web' },
    foundAt: 100,
  };
  for (let index = 0; index < 64; index++) {
    const id = `t${String(index).padStart(6, '0')}`;
    await assertSucceeds(
      setDoc(
        capRef,
        {
          changedKey: `found_${id}`,
          epoch,
          entries: { [`found_${id}`]: { ...baseFound, card: { ...baseFound.card, id } } },
        },
        { merge: true },
      ),
    );
  }
  await assertFails(
    setDoc(
      capRef,
      {
        changedKey: 'found_t000064',
        epoch,
        entries: { found_t000064: { ...baseFound, card: { ...baseFound.card, id: 't000064' } } },
      },
      { merge: true },
    ),
  );
  // Direct delete denied without session revocation
  await assertFails(deleteDoc(doc(alice, 'huntCollections/alice')));
  // Atomic deletion with session revocation succeeds
  const delBatch = writeBatch(alice);
  delBatch.set(doc(alice, 'huntCollectionSessions/alice'), { enabled: false, epoch: nextEpoch });
  delBatch.delete(doc(alice, 'huntCollections/alice'));
  await assertSucceeds(delBatch.commit());
  // Stale epoch write and same-epoch re-enable rejected
  await assertFails(writeHunt('earned_abc1234', validEarned));
  await assertFails(
    setDoc(doc(alice, 'huntCollectionSessions/alice'), { enabled: true, epoch: nextEpoch }),
  );
  await assertSucceeds(
    setDoc(doc(alice, 'huntCollectionSessions/alice'), { enabled: true, epoch: 'c'.repeat(32) }),
  );
  await assertFails(deleteDoc(doc(alice, 'huntCollectionSessions/alice')));

  console.log('PASS all hardened Firestore security rules assertions');
} finally {
  await env.clearFirestore();
  await env.cleanup();
}
