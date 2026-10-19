import { FirebaseOptions, initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, Functions } from 'firebase/functions';
import { getPerformance, initializePerformance } from 'firebase/performance';
import { speakersPreview } from './utils/speakers-preview';

/**
 * Load Firebase config in index.html with /__/firebase/init.js. It stubs out
 * window.firebase.initializeApp to grab the config and saves it on the window
 * for use here. This is a workaround for the fact that the Firebase SDK v9 is
 * modular and doesn't support init.js and top-level await is not well supported
 * so loading from init.json caused issues with Safari, Jest, Vite, etc.
 *
 * https://github.com/gdg-x/hoverboard/pull/2368
 */

declare global {
  interface Window {
    firebaseConfig?: FirebaseOptions;
  }
}

const isLocalPreview = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(
  window.location.hostname,
);
const firebaseConfig =
  window.firebaseConfig ??
  (isLocalPreview
    ? {
        apiKey: 'AIzaSyBYDCE-M_SS2bXqtLWCYUOpZ38T_RJMEVM',
        authDomain: 'gdg-warsaw-devfest26-web.firebaseapp.com',
        projectId: 'gdg-warsaw-devfest26-web',
        storageBucket: 'gdg-warsaw-devfest26-web.firebasestorage.app',
        messagingSenderId: '94592063137',
        appId: '1:94592063137:web:e2f2bfa581d0222a6b82e0',
      }
    : undefined);

if (!firebaseConfig) {
  throw new Error('window.firebaseConfig is not defined');
}

// All operational SDKs use an isolated demo project in preview. Only the subscription
// helper receives the production read connection; mutations never receive that handle.
export const firebaseApp = initializeApp(
  speakersPreview
    ? {
        apiKey: 'demo-local-preview',
        projectId: 'demo-devfest-speakers-preview',
        appId: 'demo-local-preview',
      }
    : firebaseConfig,
);
export const db: Firestore = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export const firebaseFunctions: Functions = getFunctions(firebaseApp);
if (speakersPreview) {
  connectFirestoreEmulator(db, '127.0.0.1', 8089);
  connectFunctionsEmulator(firebaseFunctions, '127.0.0.1', 5009);
}
export const readOnlyDb = speakersPreview
  ? initializeFirestore(initializeApp(firebaseConfig, 'preview-read-only'), {})
  : db;
export const performance = speakersPreview ? undefined : getPerformance(firebaseApp);
if (!speakersPreview) initializePerformance(firebaseApp);
