import { FirebaseError, getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  initializeFirestore,
  memoryLocalCache,
  onSnapshot,
  runTransaction,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { firebaseApp } from '../firebase';
import {
  getHuntProgress,
  HUNT_STORAGE_KEY,
  parseHuntProgressEntry,
  subscribeHuntProgress,
  type HuntProgressEntry,
} from './hunt-store.js';

export type CloudStatus = 'local' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error';
export type CloudState = {
  status: CloudStatus;
  progress: HuntProgressEntry[];
  account: string;
  message: string;
};

const sessionKey = `${HUNT_STORAGE_KEY}:cloud-session`;
const appName = 'y2k-hunt-sync';
const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname);
declare global {
  interface Window {
    /** Set only by the local real-auth test server, never on the public website. */
    huntRealAuthTestConfig?: FirebaseOptions;
  }
}
const testConfig = local ? window.huntRealAuthTestConfig : undefined;
const realTest =
  testConfig?.projectId === 'devfest-y2k-sync-test-1120' &&
  testConfig.authDomain === 'devfest-y2k-sync-test-1120.firebaseapp.com';
if (testConfig && !realTest) throw new Error('Invalid isolated test project');
if (!local && window.location.hostname !== 'warsaw.devfest.pl') {
  throw new Error('Card sync is unavailable on this preview origin');
}
if (
  !local &&
  (firebaseApp.options.projectId !== 'gdg-warsaw-devfest26-web' ||
    firebaseApp.options.authDomain !== 'gdg-warsaw-devfest26-web.firebaseapp.com')
) {
  throw new Error('Card sync is unavailable with this Firebase configuration');
}
// Local previews can never write to the real event database, even if a user signs in.
const options = realTest
  ? testConfig
  : local
    ? { apiKey: 'demo-local', authDomain: 'localhost', projectId: 'demo-devfest-y2k' }
    : firebaseApp.options;
const app = getApps().some((candidate) => candidate.name === appName)
  ? getApp(appName)
  : initializeApp(options, appName);
const auth = getAuth(app);
const db = initializeFirestore(app, { localCache: memoryLocalCache() });
if (local && !realTest) {
  connectAuthEmulator(auth, 'http://127.0.0.1:19099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 18080);
}

type SavedSession = { uid: string; epoch: string };
function savedSession(): SavedSession | null {
  try {
    const raw = window.sessionStorage.getItem(sessionKey);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const session = value as Record<string, unknown>;
    if (
      typeof session['uid'] !== 'string' ||
      typeof session['epoch'] !== 'string' ||
      !/^[a-f0-9]{32}$/.test(session['epoch'])
    )
      return null;
    return { uid: session['uid'], epoch: session['epoch'] };
  } catch {
    return null;
  }
}

function setSession(session: SavedSession | null): void {
  try {
    if (session) window.sessionStorage.setItem(sessionKey, JSON.stringify(session));
    else window.sessionStorage.removeItem(sessionKey);
  } catch {
    // The current tab can still sync; it will need another sign-in after a reload.
  }
}

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer = 0;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error('Request timed out')), 15000);
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

/** Only this dedicated Firebase app signs in: other website sessions are unaffected. */
class HuntCloud {
  private state: CloudState = { status: 'local', progress: [], account: '', message: '' };
  private listeners = new Set<(state: CloudState) => void>();
  private unsubscribe: Unsubscribe | undefined;
  private unsubscribeSession: Unsubscribe | undefined;
  private activeUid = '';
  private epoch = '';
  private sessionVerified = false;
  private generation = 0;
  private writes = new Map<string, string>();
  private failedWrites = new Set<string>();
  private listenerFailed = false;
  private pending = 0;
  private fromCache = true;
  private ready: Promise<void>;

  constructor() {
    this.ready = setPersistence(auth, browserSessionPersistence).then(() => auth.authStateReady());
    onAuthStateChanged(auth, (user) => {
      if (this.activeUid && user?.uid !== this.activeUid) this.stopListening();
      const saved = savedSession();
      if (user && !this.activeUid && saved?.uid === user.uid)
        this.startListening(user, saved.epoch);
    });
    subscribeHuntProgress(() => this.uploadLocal());
    window.addEventListener('storage', (event) => {
      if (event.key === null || event.key.startsWith(`${HUNT_STORAGE_KEY}:`)) this.uploadLocal();
    });
    window.addEventListener('online', () => {
      if (this.activeUid) {
        this.uploadLocal();
        this.setConnectionStatus();
      }
    });
    window.addEventListener('offline', () => {
      if (this.activeUid) this.setConnectionStatus();
    });
  }

  subscribe(listener: (state: CloudState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  private update(patch: Partial<CloudState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  async connect(): Promise<void> {
    this.update({ status: 'connecting', message: '' });
    try {
      await this.ready;
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const { user } = await signInWithPopup(auth, provider);
      const sessionRef = doc(db, 'huntCollectionSessions', user.uid);
      const epoch = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(sessionRef);
        const current = snapshot.data();
        if (current?.['enabled'] === true && typeof current['epoch'] === 'string')
          return current['epoch'];
        const next = crypto.randomUUID().replaceAll('-', '');
        transaction.set(sessionRef, { epoch: next, enabled: true });
        return next;
      });
      setSession({ uid: user.uid, epoch });
      this.startListening(user, epoch);
    } catch (error) {
      const code = error instanceof FirebaseError ? error.code : '';
      const message =
        code === 'auth/popup-blocked'
          ? 'Your browser blocked the sign-in window. Allow pop-ups and try again.'
          : code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
            ? 'Sign-in was closed. You can keep collecting in this browser.'
            : 'Could not connect. Your browser collection is still here.';
      this.update({ status: 'error', message });
    }
  }

  retry(): void {
    const user = auth.currentUser;
    if (!user || user.uid !== this.activeUid) return;
    const epoch = this.epoch;
    this.stopListening();
    setSession({ uid: user.uid, epoch });
    this.startListening(user, epoch);
  }

  private startListening(user: User, epoch: string): void {
    if (this.activeUid === user.uid) return;
    this.stopListening();
    this.activeUid = user.uid;
    this.epoch = epoch;
    const generation = ++this.generation;
    this.update({ status: 'syncing', account: user.email ?? 'Google account', message: '' });
    this.unsubscribeSession = onSnapshot(
      doc(db, 'huntCollectionSessions', user.uid),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (generation !== this.generation || snapshot.metadata.fromCache) return;
        const session = snapshot.data();
        if (session?.['enabled'] !== true || session['epoch'] !== epoch) {
          setSession(null);
          this.stopListening();
          this.update({
            status: 'local',
            message:
              'Sync stopped because this collection was deleted or restarted on another device.',
          });
          void signOut(auth).catch(() => undefined);
          return;
        }
        this.sessionVerified = true;
        this.uploadLocal();
        this.setConnectionStatus();
      },
      () => {
        if (generation === this.generation) {
          this.listenerFailed = true;
          this.setConnectionStatus();
        }
      },
    );
    this.unsubscribe = onSnapshot(
      doc(db, 'huntCollections', user.uid),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (generation !== this.generation) return;
        const entries: HuntProgressEntry[] = [];
        const raw: unknown = snapshot.data()?.['entries'];
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          for (const [id, value] of Object.entries(raw)) {
            const entry = parseHuntProgressEntry(value);
            if (entry && id === `${entry.state}_${entry.card.id}`) entries.push(entry);
          }
        }
        this.fromCache = snapshot.metadata.fromCache;
        this.update({ progress: entries });
        this.setConnectionStatus(snapshot.metadata.hasPendingWrites);
      },
      () => {
        if (generation === this.generation) {
          this.listenerFailed = true;
          this.setConnectionStatus();
        }
      },
    );
  }

  private setConnectionStatus(hasPendingWrites = false): void {
    if (this.listenerFailed || this.failedWrites.size) {
      this.update({
        status: 'error',
        message: 'Some cards could not sync. Your browser collection is still here.',
      });
      return;
    }
    const status =
      !navigator.onLine || this.fromCache || !this.sessionVerified
        ? 'offline'
        : this.pending || hasPendingWrites
          ? 'syncing'
          : 'synced';
    this.update({ status, message: '' });
  }

  private uploadLocal(): void {
    if (!this.activeUid || !this.sessionVerified) return;
    const uid = this.activeUid;
    const epoch = this.epoch;
    const generation = this.generation;
    for (const entry of getHuntProgress()) {
      const id = `${entry.state}_${entry.card.id}`;
      const value = JSON.stringify(entry);
      if (this.writes.get(id) === value) continue;
      this.writes.set(id, value);
      this.failedWrites.delete(id);
      this.pending++;
      this.setConnectionStatus(true);
      void Promise.resolve()
        .then(() => {
          if (generation !== this.generation || this.activeUid !== uid) return;
          return setDoc(
            doc(db, 'huntCollections', uid),
            { entries: { [id]: entry }, changedKey: id, epoch },
            { merge: true },
          );
        })
        .then(() => {
          if (generation !== this.generation) return;
          this.pending--;
          this.setConnectionStatus();
        })
        .catch(() => {
          if (generation !== this.generation) return;
          this.pending--;
          this.writes.delete(id);
          this.failedWrites.add(id);
          this.setConnectionStatus();
        });
    }
  }

  private stopListening(): void {
    this.generation++;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.unsubscribeSession?.();
    this.unsubscribeSession = undefined;
    this.activeUid = '';
    this.epoch = '';
    this.sessionVerified = false;
    this.writes.clear();
    this.failedWrites.clear();
    this.listenerFailed = false;
    this.pending = 0;
    this.fromCache = true;
    this.update({ status: 'local', progress: [], account: '', message: '' });
  }

  async disconnect(): Promise<void> {
    setSession(null);
    this.stopListening();
    this.update({ status: 'connecting', message: 'Stopping sync…' });
    try {
      await signOut(auth);
      this.update({ status: 'local', message: '' });
    } catch (error) {
      this.update({ status: 'error', message: 'Could not sign out. Try signing in again.' });
      throw error;
    }
  }

  async deleteCloudCollection(): Promise<void> {
    const uid = this.activeUid;
    if (!uid || auth.currentUser?.uid !== uid) throw new Error('No active account');
    const epoch = this.epoch;
    // Stop uploads first so a local copy is not immediately re-created in the cloud.
    setSession(null);
    this.stopListening();
    this.update({ status: 'connecting', message: 'Deleting synced cards…' });
    try {
      if (!navigator.onLine) throw new Error('Offline');
      const sessionRef = doc(db, 'huntCollectionSessions', uid);
      const collectionRef = doc(db, 'huntCollections', uid);
      await bounded(
        runTransaction(db, async (transaction) => {
          const session = (await transaction.get(sessionRef)).data();
          if (
            auth.currentUser?.uid !== uid ||
            session?.['enabled'] !== true ||
            session['epoch'] !== epoch
          )
            throw new Error('Session changed');
          transaction.set(sessionRef, {
            enabled: false,
            epoch: crypto.randomUUID().replaceAll('-', ''),
          });
          transaction.delete(collectionRef);
        }),
      );
      await signOut(auth);
      this.update({
        status: 'local',
        message: 'Synced cards deleted. Browser-saved cards remain here.',
      });
    } catch (error) {
      this.update({
        status: 'error',
        message: 'Could not confirm deletion. It may still finish; reconnect and check.',
      });
      throw error;
    }
  }
}

export const huntCloud = new HuntCloud();
