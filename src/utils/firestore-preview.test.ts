import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { onSnapshot } from 'firebase/firestore';
import { loadPreviewData } from './speakers-preview';
import { subscribeToCollection, subscribeToDocument } from './firestore';

jest.mock('../firebase', () => ({ readOnlyDb: {} }));
jest.mock('firebase/firestore', () => ({
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
}));
jest.mock('./speakers-preview', () => ({
  legacyProgrammePreview: true,
  previewCollection: (path: string) => path.split('/')[0],
  loadPreviewData: jest.fn(),
}));

describe('preview subscription boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delivers local collections and documents without constructing a Firestore subscription', async () => {
    jest.mocked(loadPreviewData).mockResolvedValue({
      generatedSpeakers: [],
      generatedSessions: [],
      generatedSchedule: [],
    });
    const next = jest.fn();
    const start = jest.fn();
    subscribeToCollection('generatedSpeakers', start, next, jest.fn());
    subscribeToDocument('generatedSessions/absent', start, next, jest.fn());
    await Promise.resolve();
    expect(start).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledWith([]);
    expect(next).toHaveBeenCalledWith(undefined);
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it('reports failed fixture loading and never falls back to Firestore', async () => {
    const error = new Error('missing fixture');
    jest.mocked(loadPreviewData).mockRejectedValue(error);
    const failed = jest.fn();
    const next = jest.fn();
    subscribeToCollection('generatedSessions', jest.fn(), next, failed);
    await Promise.resolve();
    expect(failed).toHaveBeenCalledWith(error);
    expect(next).not.toHaveBeenCalled();
    expect(onSnapshot).not.toHaveBeenCalled();
  });
});
