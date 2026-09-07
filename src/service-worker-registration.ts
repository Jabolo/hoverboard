import { register } from 'register-service-worker';
import { store } from './store';
import { queueComplexSnackbar, queueSnackbar } from './store/snackbars';
import { CONFIG, getConfig } from './utils/config';
import { refresh, serviceWorkerAvailable, serviceWorkerError } from './utils/data';

register('service-worker.js', {
  registrationOptions: { scope: getConfig(CONFIG.BASEPATH) },
  updated() {
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
