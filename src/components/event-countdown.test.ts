import { describe, expect, it } from '@jest/globals';
import { getCountdownValues } from './event-countdown';

describe('event-countdown', () => {
  it('splits the remaining time into calendar units', () => {
    const target = Date.UTC(2026, 10, 21, 9);
    const now = target - (2 * 24 * 60 * 60 + 3 * 60 * 60 + 4 * 60 + 5) * 1000;

    expect(getCountdownValues(now, target)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
      complete: false,
    });
  });

  it('clamps expired events to zero', () => {
    expect(getCountdownValues(Date.UTC(2026, 10, 22), Date.UTC(2026, 10, 21))).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      complete: true,
    });
  });
});
