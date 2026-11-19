import { readFile } from 'node:fs/promises';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-devfest-y2k',
  firestore: { rules: await readFile('firestore.rules', 'utf8') },
});
const google = (uid) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } }).firestore();
const alice = google('alice');
const bob = google('bob');
const guest = env.unauthenticatedContext().firestore();
const password = env
  .authenticatedContext('alice', { firebase: { sign_in_provider: 'password' } })
  .firestore();
const path = 'huntCollections/alice';
const earned = {
  state: 'earned',
  card: { id: 'test001', title: 'Disc', group: 'web', text: 'A reveal.' },
  foundAt: 100,
  earnedAt: 200,
};
const found = {
  state: 'found',
  card: { id: 'test001', title: 'Disc', group: 'web' },
  foundAt: 100,
};
const write = (db, id, entry) =>
  setDoc(doc(db, path), { entries: { [id]: entry }, changedKey: id }, { merge: true });
try {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'sessions/public-fixture'), { title: 'Session' });
    await setDoc(doc(context.firestore(), 'newsletterContacts/private-fixture'), {
      email: 'example@example.test',
    });
  });
  await assertSucceeds(getDoc(doc(guest, 'sessions/public-fixture')));
  await assertFails(setDoc(doc(guest, 'sessions/public-fixture'), { title: 'Changed' }));
  await assertFails(getDoc(doc(guest, 'newsletterContacts/private-fixture')));
  await assertSucceeds(setDoc(doc(alice, 'featuredSessions/alice'), { sample: true }));
  await assertFails(getDoc(doc(bob, 'featuredSessions/alice')));
  await assertSucceeds(write(alice, 'earned_test001', earned));
  await assertSucceeds(getDoc(doc(alice, path)));
  await assertFails(getDoc(doc(bob, path)));
  await assertFails(write(bob, 'earned_test001', earned));
  await assertFails(deleteDoc(doc(bob, path)));
  await assertFails(getDoc(doc(guest, path)));
  await assertFails(write(guest, 'earned_test001', earned));
  await assertFails(getDoc(doc(password, path)));
  await assertFails(write(alice, 'earned_test002', earned));
  await assertFails(write(alice, 'earned_test001', { ...earned, ticketNumber: '123' }));
  await assertFails(
    write(alice, 'earned_test001', {
      ...earned,
      card: { ...earned.card, email: 'person@example.com' },
    }),
  );
  await assertFails(
    write(alice, 'earned_test001', { ...earned, card: { ...earned.card, text: 'x'.repeat(4001) } }),
  );
  await assertFails(write(alice, 'earned_test001', { ...earned, earnedAt: -1 }));
  await assertFails(write(alice, 'earned_test001', { ...earned, state: 'found' }));
  await assertSucceeds(write(alice, 'found_test001', found));
  await assertSucceeds(write(alice, 'earned_test001', earned));
  await assertFails(
    setDoc(doc(alice, path), {
      changedKey: 'found_test002',
      entries: {
        found_test001: found,
        earned_test001: earned,
        found_test002: { ...found, card: { ...found.card, id: 'test002' } },
        found_test003: { ...found, card: { ...found.card, id: 'test003' } },
      },
    }),
  );
  const capped = google('capped');
  const capRef = doc(capped, 'huntCollections/capped');
  for (let index = 0; index < 64; index++) {
    const id = `t${String(index).padStart(6, '0')}`;
    await assertSucceeds(
      setDoc(
        capRef,
        {
          changedKey: `found_${id}`,
          entries: { [`found_${id}`]: { ...found, card: { ...found.card, id } } },
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
        entries: { found_t000064: { ...found, card: { ...found.card, id: 't000064' } } },
      },
      { merge: true },
    ),
  );
  await assertFails(getDocs(collection(alice, 'huntCollections')));
  await assertSucceeds(deleteDoc(doc(alice, path)));
  console.log(
    'PASS owner isolation, Google-only access, bounded schema, deletion and existing-rule regressions',
  );
} finally {
  await env.clearFirestore();
  await env.cleanup();
}
