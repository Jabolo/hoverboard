import { describe, expect, it } from '@jest/globals';
import { Track } from './track';
import { defaultTracks } from './test-fixtures';
import { allKeys } from './utils';

describe('track', () => {
  it('matches the shape of the default data', () => {
    const days: Track[] = defaultTracks;
    const keys: Array<keyof Track> = ['title'];

    expect(days).toHaveLength(3);
    expect(allKeys(days)).toStrictEqual(keys);
  });
});
