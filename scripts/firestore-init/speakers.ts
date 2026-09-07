import { firestore } from '../firebase-config.js';
import { data } from './data.js';

export const importSpeakers = () => {
  const speakers: { [key: string]: object } = data.speakers;
  if (!Object.keys(speakers).length) {
    return Promise.resolve();
  }
  console.log('Importing', Object.keys(speakers).length, 'speakers...');

  const batch = firestore.batch();

  Object.keys(speakers).forEach((speakerId, order) => {
    batch.set(firestore.collection('speakers').doc(speakerId), {
      ...speakers[speakerId],
      order,
    });
  });

  return batch.commit().then((results) => {
    console.log('Imported data for', results.length, 'speakers');
  });
};
