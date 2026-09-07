import { describe, expect, it } from '@jest/globals';
import { Timeslot } from './timeslot';
import { defaultTimeslots } from './test-fixtures';
import { allKeys } from './utils';

describe('timeslot', () => {
  it('matches the shape of the default data', () => {
    const days: Timeslot[] = defaultTimeslots;
    const keys: Array<keyof Timeslot> = ['endTime', 'sessions', 'startTime'];

    expect(days).toHaveLength(13);
    expect(allKeys(days)).toStrictEqual(keys);
  });
});
