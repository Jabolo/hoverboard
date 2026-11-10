import { describe, expect, it } from '@jest/globals';
import type { Day } from '../../models/day';
import { filterScheduleByFavorites } from './selectors';

describe('local favourites in the legacy schedule', () => {
  it('keeps only the selected session in each timeslot without changing source data', () => {
    const days = [
      {
        date: '2026-11-21',
        timeslots: [{ sessions: [{ items: [{ id: 'one' }, { id: 'two' }] }] }],
      },
    ] as unknown as Day[];

    const filtered = filterScheduleByFavorites(days, (id) => id === 'two');

    expect(filtered[0]?.timeslots[0]?.sessions[0]?.items).toEqual([{ id: 'two' }]);
    expect(days[0]?.timeslots[0]?.sessions[0]?.items).toHaveLength(2);
    expect(
      filterScheduleByFavorites(days, () => false)[0]?.timeslots[0]?.sessions[0]?.items,
    ).toEqual([]);
  });
});
