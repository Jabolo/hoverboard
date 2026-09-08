import { register } from 'register-service-worker';
import { store } from './store';
import { queueComplexSnackbar, queueSnackbar } from './store/snackbars';
import { CONFIG, getConfig } from './utils/config';
import { refresh, serviceWorkerAvailable, serviceWorkerError } from './utils/data';

let isRefreshing = false;
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (!isRefreshing) {
    isRefreshing = true;
    window.location.reload();
  }
});

register('service-worker.js', {
  registrationOptions: { scope: getConfig(CONFIG.BASEPATH) },
  updated(registration) {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    store.dispatch(
      queueComplexSnackbar({
        label: serviceWorkerAvailable,
        action: {
          title: refresh,
          callback: () => window.location.reload(),
        },
      }),
    );
  },
  error(e) {
    console.error('Service worker registration failed:', e);
    store.dispatch(queueSnackbar(serviceWorkerError));
  },
});
