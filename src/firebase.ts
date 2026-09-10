import { FirebaseOptions, initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { Firestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { getPerformance, initializePerformance } from 'firebase/performance';

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

const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const firebaseConfig =
  window.firebaseConfig ??
  (isLocalPreview
    ? {
        apiKey: 'local-preview',
        authDomain: 'local-preview.firebaseapp.com',
        projectId: 'local-preview',
        storageBucket: 'local-preview.appspot.com',
        messagingSenderId: 'local-preview',
        appId: 'local-preview',
        measurementId: 'G-LOCALPREVIEW',
      }
    : undefined);

if (!firebaseConfig) {
  throw new Error('window.firebaseConfig is not defined');
}

export const firebaseApp = initializeApp(firebaseConfig);
export const db: Firestore = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache(),
});
export const firebaseFunctions: Functions = getFunctions(firebaseApp);
export const performance = getPerformance(firebaseApp);
export const analytics = getAnalytics(firebaseApp);

initializePerformance(firebaseApp);
