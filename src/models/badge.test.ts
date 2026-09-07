import { describe, expect, it } from '@jest/globals';
import { Badge } from './badge';
import { defaultBadges } from './test-fixtures';
import { allKeys } from './utils';

describe('badge', () => {
  it('matches the shape of the default data', () => {
    const badges: Badge[] = defaultBadges;
    const keys: Array<keyof Badge> = ['description', 'link', 'name'];

    expect(badges).toHaveLength(2);
    expect(allKeys(badges)).toStrictEqual(keys);
  });
});
