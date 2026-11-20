import {
  initializeTestEnvironment,
  RulesTestContext,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, afterEach, beforeAll, describe, it, jest } from '@jest/globals';
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
import fs from 'fs';
import { expect } from './__tests__/helpers';

jest.retryTimes(3, { logErrorsBeforeRetry: true });

// Run only when FIRESTORE_EMULATOR_HOST is configured (e.g. under `firebase emulators:exec`
// with JDK 21+). Skips cleanly during default unit-test runs without a running emulator.
const describeIfEmulator = process.env['FIRESTORE_EMULATOR_HOST'] ? describe : describe.skip;

const parseEmulatorHost = (hostValue: string) => {
  const lastColon = hostValue.lastIndexOf(':');
  return {
    host: hostValue.slice(0, lastColon),
    port: Number(hostValue.slice(lastColon + 1)),
  };
};

describeIfEmulator('firestore security rules', () => {
  let testEnv: RulesTestEnvironment;

  const validFeedback = (userId: string) => ({
    contentRating: 5,
    styleRating: 4,
    comment: 'Great talk!',
    userId,
  });

  const seed = async (data: Record<string, Record<string, unknown>>) => {
    await testEnv.withSecurityRulesDisabled(async (context: RulesTestContext) => {
      for (const [docPath, value] of Object.entries(data)) {
        await setDoc(doc(context.firestore(), docPath), value);
      }
    });
  };

  beforeAll(async () => {
    const emulator = parseEmulatorHost(process.env['FIRESTORE_EMULATOR_HOST'] ?? '127.0.0.1:8080');
    testEnv = await initializeTestEnvironment({
      projectId: `rules-spec-${Date.now()}`,
      firestore: {
        host: emulator.host,
        port: emulator.port,
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  describe('default deny & catch-all', () => {
    it('denies reading and writing unknown collections for unauthenticated and authenticated users', async () => {
      const guest = testEnv.unauthenticatedContext().firestore();
      const alice = testEnv.authenticatedContext('alice').firestore();

      await expect(getDocs(collection(guest, 'some-nonexistent-collection'))).toDeny();
      await expect(addDoc(collection(guest, 'some-nonexistent-collection'), {})).toDeny();
      await expect(getDocs(collection(alice, 'some-nonexistent-collection'))).toDeny();
      await expect(addDoc(collection(alice, 'some-nonexistent-collection'), {})).toDeny();
    });
  });

  describe('public conference content', () => {
    it('allows reading explicit collections and nested subcollections while denying writes and dead wildcard collectionGroups', async () => {
      await seed({
        'sessions/CFP-002': { title: 'Awesome Stuff' },
        'partners/gold': { title: 'Gold', order: 1 },
        'partners/gold/items/acme': { name: 'Acme', order: 1 },
        'team/core': { title: 'Core', order: 1 },
        'team/core/members/m1': { name: 'Organizer' },
        'tickets/000': { name: 'Regular' },
      });

      const guest = testEnv.unauthenticatedContext().firestore();
      const alice = testEnv.authenticatedContext('alice').firestore();

      await expect(getDoc(doc(guest, 'sessions/CFP-002'))).toAllow();
      await expect(getDoc(doc(guest, 'partners/gold/items/acme'))).toAllow();
      await expect(getDocs(collection(guest, 'partners/gold/items'))).toAllow();
      await expect(getDoc(doc(guest, 'team/core/members/m1'))).toAllow();
      await expect(getDocs(collection(guest, 'team/core/members'))).toAllow();
      await expect(getDoc(doc(guest, 'tickets/000'))).toAllow();

      await expect(setDoc(doc(alice, 'sessions/CFP-002'), { title: 'Tampered' })).toDeny();
      await expect(setDoc(doc(alice, 'partners/gold/items/acme'), { name: 'Tampered' })).toDeny();
      await expect(setDoc(doc(alice, 'team/core/members/m1'), { name: 'Tampered' })).toDeny();

      // Dead wildcard /{path=**}/items and /{path=**}/members rules removed
      await expect(getDocs(collectionGroup(guest, 'items'))).toDeny();
      await expect(getDocs(collectionGroup(guest, 'members'))).toDeny();
    });
  });

  describe('feedback rules', () => {
    const seedFeedback = async () => {
      await seed({
        'sessions/1': { title: 'Awesome Stuff' },
        'sessions/1/feedback/1': validFeedback('1'),
        'sessions/1/feedback/2': validFeedback('2'),
      });
    };

    it('denies all operations when unauthenticated', async () => {
      await seedFeedback();
      const guest = testEnv.unauthenticatedContext().firestore();
      const colRef = collection(guest, 'sessions/1/feedback');
      const docRef = doc(guest, 'sessions/1/feedback', '1');

      await expect(getDocs(colRef)).toDeny();
      await expect(addDoc(colRef, validFeedback('1'))).toDeny();
      await expect(getDoc(docRef)).toDeny();
      await expect(updateDoc(docRef, { comment: 'hi' })).toDeny();
      await expect(deleteDoc(docRef)).toDeny();
      await expect(
        getDocs(query(collectionGroup(guest, 'feedback'), where('userId', '==', '1'))),
      ).toDeny();
    });

    it('denies interacting with other users feedback and unfiltered listings', async () => {
      await seedFeedback();
      const user2 = testEnv.authenticatedContext('2').firestore();
      const colRef = collection(user2, 'sessions/1/feedback');
      const otherDocRef = doc(user2, 'sessions/1/feedback', '1');

      await expect(getDocs(colRef)).toDeny();
      await expect(addDoc(colRef, validFeedback('2'))).toDeny();
      await expect(getDoc(otherDocRef)).toDeny();
      await expect(updateDoc(otherDocRef, { comment: 'tampered' })).toDeny();
      await expect(deleteDoc(otherDocRef)).toDeny();
      await expect(getDocs(collectionGroup(user2, 'feedback'))).toDeny();
      await expect(
        getDocs(query(collectionGroup(user2, 'feedback'), where('userId', '==', '1'))),
      ).toDeny();
    });

    it('allows own feedback CRUD on Firestore and static programme-2026 session IDs plus owner collectionGroup query', async () => {
      await seedFeedback();
      const user2 = testEnv.authenticatedContext('2').firestore();
      const ownDocRef = doc(user2, 'sessions/1/feedback', '2');
      const staticSessionDocRef = doc(user2, 'sessions/CFP-014/feedback', '2');

      await expect(getDoc(ownDocRef)).toAllow();
      await expect(setDoc(staticSessionDocRef, validFeedback('2'))).toAllow();
      await expect(
        updateDoc(ownDocRef, { contentRating: 4, styleRating: 3, comment: 'Updated' }),
      ).toAllow();

      const snap = await getDocs(
        query(collectionGroup(user2, 'feedback'), where('userId', '==', '2')),
      );
      expect(snap.size).toBe(2);

      await expect(deleteDoc(ownDocRef)).toAllow();
    });

    it('blocks wildcard feedback path escapes and invalid session IDs', async () => {
      const user2 = testEnv.authenticatedContext('2').firestore();
      const payload = validFeedback('2');

      await expect(setDoc(doc(user2, 'feedback/2'), payload)).toDeny();
      await expect(getDoc(doc(user2, 'feedback/2'))).toDeny();
      await expect(setDoc(doc(user2, 'users/x/feedback/2'), payload)).toDeny();
      await expect(getDoc(doc(user2, 'users/x/feedback/2'))).toDeny();
      await expect(setDoc(doc(user2, 'sessions/s1/a/b/feedback/2'), payload)).toDeny();
      await expect(getDoc(doc(user2, 'sessions/s1/a/b/feedback/2'))).toDeny();
      await expect(setDoc(doc(user2, `sessions/${'a'.repeat(65)}/feedback/2`), payload)).toDeny();
      await expect(setDoc(doc(user2, 'sessions/bad.id/feedback/2'), payload)).toDeny();
    });

    it('validates feedback schema strictly on both create and update (rejecting floats, out-of-range, extra fields, and userId spoofing)', async () => {
      await seedFeedback();
      const user2 = testEnv.authenticatedContext('2').firestore();
      const existingRef = doc(user2, 'sessions/1/feedback', '2');
      const newRef = doc(user2, 'sessions/INVITED-001/feedback', '2');

      const invalidPayloads: Record<string, unknown>[] = [
        { ...validFeedback('2'), contentRating: -1 },
        { ...validFeedback('2'), contentRating: 6 },
        { ...validFeedback('2'), contentRating: 3.5 },
        { ...validFeedback('2'), styleRating: -1 },
        { ...validFeedback('2'), styleRating: 6 },
        { ...validFeedback('2'), styleRating: 4.5 },
        { ...validFeedback('2'), contentRating: '5' },
        { ...validFeedback('2'), comment: null },
        { ...validFeedback('2'), comment: 'c'.repeat(257) },
        { ...validFeedback('2'), userId: '1' },
        { ...validFeedback('2'), extra: 'polluted' },
        { contentRating: 5, styleRating: 5, comment: '' },
      ];

      for (const payload of invalidPayloads) {
        await expect(setDoc(newRef, payload)).toDeny();
        await expect(setDoc(existingRef, payload)).toDeny();
      }
    });
  });

  describe('locked collections', () => {
    it('completely locks potentialPartners, notificationsSubscribers, notificationsUsers, and server-only collections', async () => {
      await seed({
        'potentialPartners/p1': { email: 'a@b.com', fullName: 'A', companyName: 'B' },
        'notificationsSubscribers/token1234567890': {
          value: true,
          updatedAt: Timestamp.now(),
        },
        'notificationsUsers/alice': { tokens: { t1: true } },
        'config/site': { flag: true },
        'functionsRateLimits/ip1': { count: 1 },
        'notifications/n1': { title: 'Push' },
        'subscribers/s1': { email: 'a@b.com' },
        'newsletterContacts/c1': { email: 'a@b.com' },
      });

      const guest = testEnv.unauthenticatedContext().firestore();
      const alice = testEnv.authenticatedContext('alice').firestore();

      for (const target of [
        'potentialPartners/p1',
        'notificationsSubscribers/token1234567890',
        'notificationsUsers/alice',
        'config/site',
        'functionsRateLimits/ip1',
        'notifications/n1',
        'subscribers/s1',
        'newsletterContacts/c1',
      ]) {
        await expect(getDoc(doc(guest, target))).toDeny();
        await expect(getDoc(doc(alice, target))).toDeny();
        await expect(setDoc(doc(guest, target), { a: 1 })).toDeny();
        await expect(setDoc(doc(alice, target), { a: 1 })).toDeny();
        await expect(deleteDoc(doc(guest, target))).toDeny();
        await expect(deleteDoc(doc(alice, target))).toDeny();
      }

      // Verify previously-allowed create payloads on dead collections are now denied
      await expect(
        setDoc(doc(guest, 'potentialPartners/new-spam'), {
          email: 'spam@example.com',
          fullName: 'Spammer',
          companyName: 'Spam Inc',
        }),
      ).toDeny();
      await expect(
        setDoc(doc(guest, 'notificationsSubscribers/newtoken1234567890'), {
          value: true,
          updatedAt: Timestamp.now(),
        }),
      ).toDeny();
    });
  });

  describe('featuredSessions and users rules', () => {
    it('allows owner get only and denies list and all writes', async () => {
      await seed({
        'featuredSessions/alice': { 'CFP-002': true },
        'users/alice': { email: 'alice@example.test' },
      });

      const guest = testEnv.unauthenticatedContext().firestore();
      const alice = testEnv.authenticatedContext('alice').firestore();
      const bob = testEnv.authenticatedContext('bob').firestore();

      for (const col of ['featuredSessions', 'users']) {
        await expect(getDoc(doc(alice, `${col}/alice`))).toAllow();
        await expect(getDoc(doc(guest, `${col}/alice`))).toDeny();
        await expect(getDoc(doc(bob, `${col}/alice`))).toDeny();
        await expect(getDocs(collection(alice, col))).toDeny();
        await expect(setDoc(doc(alice, `${col}/alice`), { 'CFP-002': true })).toDeny();
        await expect(updateDoc(doc(alice, `${col}/alice`), { 'CFP-002': false })).toDeny();
        await expect(deleteDoc(doc(alice, `${col}/alice`))).toDeny();
      }
    });
  });

  describe('huntCollectionSessions and huntCollections rules', () => {
    it('enforces Google provider, bounded integer timestamps, earnedAt >= foundAt, and atomic deletion', async () => {
      const alice = testEnv
        .authenticatedContext('alice', { firebase: { sign_in_provider: 'google.com' } })
        .firestore();
      const bob = testEnv
        .authenticatedContext('bob', { firebase: { sign_in_provider: 'google.com' } })
        .firestore();
      const passwordAlice = testEnv
        .authenticatedContext('alice', { firebase: { sign_in_provider: 'password' } })
        .firestore();

      const epoch = 'a'.repeat(32);
      const nextEpoch = 'b'.repeat(32);
      const earned = {
        state: 'earned',
        card: { id: 'test001', title: 'Disc', group: 'preview', text: 'Reveal.' },
        foundAt: 1700000000000,
        earnedAt: 1700000001000,
      };
      const writeEntry = (
        db: ReturnType<RulesTestContext['firestore']>,
        id: string,
        entry: Record<string, unknown>,
      ) =>
        setDoc(
          doc(db, 'huntCollections/alice'),
          { entries: { [id]: entry }, changedKey: id, epoch },
          { merge: true },
        );

      await expect(
        setDoc(doc(passwordAlice, 'huntCollectionSessions/alice'), { enabled: true, epoch }),
      ).toDeny();
      await expect(
        setDoc(doc(alice, 'huntCollectionSessions/alice'), { enabled: true, epoch }),
      ).toAllow();
      await expect(getDoc(doc(bob, 'huntCollectionSessions/alice'))).toDeny();

      // Valid earned write
      await expect(writeEntry(alice, 'earned_test001', earned)).toAllow();
      await expect(getDoc(doc(alice, 'huntCollections/alice'))).toAllow();
      await expect(getDoc(doc(bob, 'huntCollections/alice'))).toDeny();

      // Tightened timestamp validations
      await expect(writeEntry(alice, 'earned_test001', { ...earned, foundAt: 100.5 })).toDeny();
      await expect(writeEntry(alice, 'earned_test001', { ...earned, earnedAt: 200.5 })).toDeny();
      await expect(
        writeEntry(alice, 'earned_test001', { ...earned, foundAt: 4102444800001 }),
      ).toDeny();
      await expect(
        writeEntry(alice, 'earned_test001', { ...earned, earnedAt: 4102444800001 }),
      ).toDeny();
      await expect(
        writeEntry(alice, 'earned_test001', { ...earned, foundAt: 500, earnedAt: 499 }),
      ).toDeny();

      // Direct delete denied without session revocation
      await expect(deleteDoc(doc(alice, 'huntCollections/alice'))).toDeny();

      // Atomic revocation + delete succeeds
      const batch = writeBatch(alice);
      batch.set(doc(alice, 'huntCollectionSessions/alice'), { enabled: false, epoch: nextEpoch });
      batch.delete(doc(alice, 'huntCollections/alice'));
      await expect(batch.commit()).toAllow();
    });
  });
});
