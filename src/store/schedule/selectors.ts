import { Initialized, Success } from '@abraham/remotedata';
import { createSelector } from '@reduxjs/toolkit';
import { RootState, store } from '..';
import { Day } from '../../models/day';
import { Session } from '../../models/session';
import { Time } from '../../models/time';
import { Timeslot } from '../../models/timeslot';
import { TempAny } from '../../temp-any';
import { selectFeaturedSessions } from '../featured-sessions/selectors';
import { FeaturedSessions } from '../featured-sessions/state';
import { fetchSchedule } from './actions';

const selectSchedule = (state: RootState): Day[] => {
  if (state.schedule instanceof Success) {
    return state.schedule.data;
  } else if (state.schedule instanceof Initialized) {
    store.dispatch(fetchSchedule);
  }
  return [];
};

export const selectFeaturedSchedule = createSelector(
  selectSchedule,
  selectFeaturedSessions,
  (schedule: Day[], featuredSessions: FeaturedSessions): Day[] => {
    return filterScheduleByFavorites(schedule, (id) => Boolean(featuredSessions[id]));
  },
);

/** Filter a schedule using its actual session IDs, independent of where favourites are stored. */
export function filterScheduleByFavorites(
  schedule: Day[],
  isFavorite: (id: string) => boolean,
): Day[] {
  return schedule.map((day: Day) => {
    return {
      ...day,
      timeslots: day.timeslots.map((timeslot: Timeslot) => {
        return {
          ...timeslot,
          sessions: timeslot.sessions.map((sessionBlock: Time) => {
            const items = (sessionBlock.items as TempAny as Session[]).filter(
              (session: Session): boolean => isFavorite(session.id),
            );
            return {
              ...sessionBlock,
              items,
            };
          }),
        };
      }),
    };
  });
}

export function selectLocalFavoritesSchedule(
  state: RootState,
  isFavorite: (id: string) => boolean,
): Day[] {
  return filterScheduleByFavorites(selectSchedule(state), isFavorite);
}
