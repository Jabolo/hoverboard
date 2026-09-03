import { firestore } from '../firebase-config.js';
import { data } from './data.js';

export const importGallery = () => {
  const gallery: string[] = data.gallery;
  if (!Object.keys(gallery).length) {
    return undefined;
  }
  console.log('Importing gallery...');

  const batch = firestore.batch();

  Object.keys(gallery).forEach((docId: string) => {
    batch.set(firestore.collection('gallery').doc(docId.padStart(3, '0')), {
      url: gallery[Number(docId)],
      order: docId,
    });
  });

  return batch.commit().then((results) => {
    console.log('Imported data for', results.length, 'images');
  });
};
