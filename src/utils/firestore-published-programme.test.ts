import { describe, expect, it, jest } from '@jest/globals';
import { onSnapshot } from 'firebase/firestore';
import { loadPublishedProgramme } from './published-programme';
import {
  subscribeToCollection,
  subscribeToDocument,
  subscribeToCollectionGroup,
} from './firestore';

jest.mock('../firebase', () => ({ readOnlyDb: {} }));
jest.mock('firebase/firestore', () => ({ onSnapshot: jest.fn(), orderBy: jest.fn() }));
jest.mock('./speakers-preview', () => ({
  legacyProgrammePreview: false,
  previewCollection: (path: string) =>
    ['generatedSpeakers', 'generatedSessions', 'generatedSchedule'].includes(path.split('/')[0]!)
      ? path.split('/')[0]
      : undefined,
}));
jest.mock('./published-programme', () => ({ loadPublishedProgramme: jest.fn() }));

describe('production programme subscriptions', () => {
  it('delivers programme documents, collections and groups before creating database listeners', async () => {
    jest.mocked(loadPublishedProgramme).mockResolvedValue({
      generatedSpeakers: [],
      generatedSessions: [],
      generatedSchedule: [],
    });
    const next = jest.fn();
    const start = jest.fn();
    subscribeToCollection('generatedSpeakers', start, next, jest.fn());
    subscribeToDocument('generatedSessions/CFP-014', start, next, jest.fn());
    subscribeToCollectionGroup('generatedSchedule', start, next, jest.fn());
    await Promise.resolve();
    expect(start).toHaveBeenCalledTimes(3);
    expect(next).toHaveBeenCalledWith([]);
    expect(next).toHaveBeenCalledWith(undefined);
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it('propagates errors and respects unsubscribe without a database fallback', async () => {
    const error = new Error('Invalid programme');
    jest.mocked(loadPublishedProgramme).mockRejectedValue(error);
    const failed = jest.fn();
    subscribeToCollection('generatedSessions', jest.fn(), jest.fn(), failed);
    await Promise.resolve();
    expect(failed).toHaveBeenCalledWith(error);
    jest.mocked(loadPublishedProgramme).mockResolvedValue({
      generatedSpeakers: [],
      generatedSessions: [],
      generatedSchedule: [],
    });
    const next = jest.fn();
    const subscription = subscribeToCollection('generatedSpeakers', jest.fn(), next, jest.fn());
    if ('data' in subscription) subscription.data();
    await Promise.resolve();
    expect(next).not.toHaveBeenCalled();
    expect(onSnapshot).not.toHaveBeenCalled();
  });
});
