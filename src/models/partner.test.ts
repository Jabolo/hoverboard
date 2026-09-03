import { describe, expect, it } from '@jest/globals';
import { PartnerData } from './partner';
import { defaultPartnerGroups } from './test-fixtures';
import { allKeys } from './utils';

describe('partner', () => {
  it('matches the shape of the default data', () => {
    const posts: PartnerData[] = defaultPartnerGroups[1]!.items;
    const keys: Array<keyof PartnerData> = ['logoUrl', 'name', 'order', 'url'];

    expect(posts).toHaveLength(11);
    expect(allKeys(posts)).toStrictEqual(keys);
  });
});
