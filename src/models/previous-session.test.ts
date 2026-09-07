import { describe, expect, it } from '@jest/globals';
import { PreviousSession } from './previous-session';
import { defaultPreviousSessions } from './test-fixtures';
import { allKeys } from './utils';

describe('speaker', () => {
  it('matches the shape of the default data', () => {
    const sessions: PreviousSession[] = defaultPreviousSessions;
    const keys: Array<keyof PreviousSession> = ['presentation', 'tags', 'title', 'videoId'];

    expect(sessions).toHaveLength(1);
    expect(allKeys(sessions)).toStrictEqual(keys);
  });
});
