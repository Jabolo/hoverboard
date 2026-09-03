// https://github.com/import-js/eslint-plugin-import/issues/1810

import { applicationDefault, initializeApp } from 'firebase-admin/app';
// https://github.com/import-js/eslint-plugin-import/issues/1810

import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env['GCLOUD_PROJECT'];

if (!projectId) {
  throw new Error('GCLOUD_PROJECT must be set before running the Firestore import.');
}

initializeApp({
  credential: applicationDefault(),
  projectId,
});

const firestore = getFirestore();

export { firestore };
