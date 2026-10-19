import { RemoteData, Success } from '@abraham/remotedata';
import {
  collection,
  collectionGroup,
  doc,
  DocumentData,
  DocumentSnapshot,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { readOnlyDb as db } from '../firebase';
import { loadPreviewData, previewCollection, speakersPreview } from './speakers-preview';
import { Id, ParentId } from '../models/types';

export const mergeDataAndId = <T>(
  snapshot: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): T & Id => {
  return {
    ...(snapshot.data() as T),
    id: snapshot.id,
  };
};

export const dataWithParentId = <T>(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): T & ParentId => {
  return {
    ...(snapshot.data() as T),
    parentId: (snapshot.ref.parent.parent as Id).id,
    id: snapshot.id,
  };
};

export type Subscription = RemoteData<Error, Unsubscribe>;

export const subscribeToDocument = <T>(
  path: string,
  onStart: () => void,
  onNext: (payload: T | undefined) => void,
  onError: (error: Error) => void,
): Subscription => {
  const localCollection = speakersPreview && previewCollection(path);
  if (localCollection) {
    let active = true;
    onStart();
    loadPreviewData().then(
      (data) => {
        if (active)
          onNext(
            data[localCollection].find((entry) => entry.id === path.split('/')[1]) as T | undefined,
          );
      },
      (error: Error) => {
        if (active) onError(error);
      },
    );
    return new Success(() => {
      active = false;
    });
  }
  const unsubscribe = onSnapshot(
    doc(db, path),
    (snapshot) => onNext(snapshot.exists() ? mergeDataAndId(snapshot) : undefined),
    (payload) => onError(payload),
  );

  onStart();
  return new Success(unsubscribe);
};

export const subscribeToCollection = <T>(
  path: string,
  onStart: () => void,
  onNext: (payload: T[]) => void,
  onError: (error: Error) => void,
  order = orderBy('name'),
): Subscription => {
  const localCollection = speakersPreview && previewCollection(path);
  if (localCollection) {
    let active = true;
    onStart();
    loadPreviewData().then(
      (data) => {
        if (active) onNext(data[localCollection] as T[]);
      },
      (error: Error) => {
        if (active) onError(error);
      },
    );
    return new Success(() => {
      active = false;
    });
  }
  const unsubscribe = onSnapshot(
    query(collection(db, path), order),
    (snapshot) => onNext(snapshot.docs.map<T>(mergeDataAndId)),
    (payload) => onError(payload),
  );

  onStart();
  return new Success(unsubscribe);
};

export const subscribeToCollectionGroup = <T>(
  path: string,
  onStart: () => void,
  onNext: (payload: T[]) => void,
  onError: (error: Error) => void,
  order = orderBy('name'),
): Subscription => {
  const localCollection = speakersPreview && previewCollection(path);
  if (localCollection) {
    let active = true;
    onStart();
    loadPreviewData().then(
      (data) => {
        if (active) onNext(data[localCollection] as T[]);
      },
      (error: Error) => {
        if (active) onError(error);
      },
    );
    return new Success(() => {
      active = false;
    });
  }
  const unsubscribe = onSnapshot(
    query(collectionGroup(db, path), order),
    (snapshot) => onNext(snapshot.docs.map<T>(dataWithParentId)),
    (payload) => onError(payload),
  );

  onStart();
  return new Success(unsubscribe);
};
