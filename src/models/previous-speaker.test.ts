import { describe, expect, it } from '@jest/globals';
import { PreviousSpeaker } from './previous-speaker';
import { defaultPreviousSpeakers } from './test-fixtures';
import { allKeys } from './utils';

describe('speaker', () => {
  it('matches the shape of the default data', () => {
    const speakers: PreviousSpeaker[] = defaultPreviousSpeakers;
    const keys: Array<keyof PreviousSpeaker> = [
      'bio',
      'company',
      'companyLogo',
      'country',
      'id',
      'name',
      'order',
      'photoUrl',
      'sessions',
      'socials',
      'title',
    ];

    expect(speakers).toHaveLength(22);
    expect(allKeys(speakers)).toStrictEqual(keys);
  });
});
