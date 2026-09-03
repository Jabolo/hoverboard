import { describe, expect, it } from '@jest/globals';
import { SpeakerData } from './speaker';
import { defaultSpeakers } from './test-fixtures';
import { allKeys } from './utils';

describe('speaker', () => {
  it('matches the shape of the default data', () => {
    const speakers: SpeakerData[] = defaultSpeakers;
    const keys: Array<keyof SpeakerData> = [
      'badges',
      'bio',
      'company',
      'companyLogo',
      'companyLogoUrl',
      'country',
      'featured',
      'name',
      'order',
      'photo',
      'photoUrl',
      'pronouns',
      'shortBio',
      'socials',
      'title',
    ];

    expect(speakers).toHaveLength(27);
    expect(allKeys(speakers)).toStrictEqual(keys);
  });
});
