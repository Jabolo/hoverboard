// https://github.com/import-js/eslint-plugin-import/issues/1810

import { initializeApp } from 'firebase-admin/app';
import { cloudCredit } from './cloud-credit.js';
import { concierge } from './concierge.js';
import {
  scheduleWrite,
  sessionsWrite,
  speakersWrite,
} from './generate-sessions-speakers-schedule.js';
import { registerNewsletterConsent } from './newsletter.js';
import { sendGeneralNotification } from './notifications.js';
import { scheduleNotifications } from './schedule-notifications.js';

// TODO: Update `tsconfig.json`
// - "noImplicitReturns": true,
// - "strict": true,

initializeApp();

export {
  cloudCredit,
  concierge,
  sendGeneralNotification,
  scheduleNotifications,
  registerNewsletterConsent,
  scheduleWrite,
  sessionsWrite,
  speakersWrite,
};
