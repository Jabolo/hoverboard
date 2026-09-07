import { describe, expect, it } from '@jest/globals';
import { PartnerGroupData } from './partner-group';
import { defaultPartnerGroups } from './test-fixtures';
import { allKeys } from './utils';

describe('partner', () => {
  it('matches the shape of the default data', () => {
    const partner: PartnerGroupData[] = defaultPartnerGroups;
    const keys: Array<keyof PartnerGroupData> = ['items', 'order', 'title'];

    expect(partner).toHaveLength(2);
    expect(allKeys(partner)).toStrictEqual(keys);
  });
});
