import { describe, expect, it } from '@jest/globals';
import { Day } from './day';
import { defaultDays } from './test-fixtures';
import { allKeys } from './utils';

describe('day', () => {
  it('matches the shape of the default data', () => {
    const days: Day[] = defaultDays;
    const keys: Array<keyof Day> = ['date', 'dateReadable', 'timeslots', 'tracks'];

    expect(days).toHaveLength(2);
    expect(allKeys(days)).toStrictEqual(keys);
  });
});
