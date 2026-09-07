import { firestore } from '../firebase-config.js';
import { data } from './data.js';

export const importSessions = () => {
  const docs: { [key: string]: object } = data.sessions;
  if (!Object.keys(docs).length) {
    return Promise.resolve();
  }
  console.log('Importing sessions...');

  const batch = firestore.batch();

  Object.keys(docs).forEach((docId) => {
    batch.set(firestore.collection('sessions').doc(docId), docs[docId]);
  });

  return batch.commit().then((results) => {
    console.log('Imported data for', results.length, 'sessions');
  });
};
