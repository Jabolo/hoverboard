import { describe, expect, it } from '@jest/globals';
import { SessionData } from './session';
import { defaultSessions } from './test-fixtures';
import { allKeys } from './utils';

describe('session', () => {
  it('matches the shape of the default data', () => {
    const sessions: SessionData[] = defaultSessions;
    const keys: Array<keyof SessionData> = [
      'complexity',
      'description',
      'extend',
      'icon',
      'image',
      'language',
      'presentation',
      'speakers',
      'tags',
      'title',
      'videoId',
    ];

    expect(sessions).toHaveLength(40);
    expect(allKeys(sessions)).toStrictEqual(keys);
  });
});
