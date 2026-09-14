import { FirebaseOptions, initializeApp } from 'firebase/app';
import {
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
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

export const firebaseApp = initializeApp(firebaseConfig);
export const db: Firestore = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export const firebaseFunctions: Functions = getFunctions(firebaseApp);
export const performance = getPerformance(firebaseApp);

initializePerformance(firebaseApp);
