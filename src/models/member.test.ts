import { describe, expect, it } from '@jest/globals';
import { MemberData } from './member';
import { defaultMembers } from './test-fixtures';
import { allKeys } from './utils';

describe('partner', () => {
  it('matches the shape of the default data', () => {
    const members: MemberData[] = defaultMembers;
    const keys: Array<keyof MemberData> = [
      'name',
      'order',
      'photo',
      'photoUrl',
      'socials',
      'title',
    ];

    expect(members).toHaveLength(8);
    expect(allKeys(members)).toStrictEqual(keys);
  });
});
