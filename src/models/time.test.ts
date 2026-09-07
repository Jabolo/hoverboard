import { describe, expect, it } from '@jest/globals';
import { Time } from './time';
import { defaultTimes } from './test-fixtures';
import { allKeys } from './utils';

describe('time', () => {
  it('matches the shape of the default data', () => {
    const times: Time[] = defaultTimes;
    const keys: Array<keyof Time> = ['extend', 'items'];

    expect(times).toHaveLength(3);
    expect(allKeys(times)).toStrictEqual(keys);
  });
});
