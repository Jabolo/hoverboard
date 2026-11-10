import { assertPreviewWritesDisabled } from '../../utils/speakers-preview';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Dispatch } from 'redux';
import { store } from '..';
import { db } from '../../firebase';
import { bookmarked } from '../../utils/data';
import { importLegacySessionFavorites } from '../../utils/legacy-session-favorites';
import { queueSnackbar } from '../snackbars';
import { selectUserId } from '../user/selectors';
import { FeaturedSessions } from './state';
import {
  FeaturedSessionsActions,
  FETCH_USER_FEATURED_SESSIONS,
  FETCH_USER_FEATURED_SESSIONS_FAILURE,
  FETCH_USER_FEATURED_SESSIONS_SUCCESS,
  SET_USER_FEATURED_SESSIONS,
  SET_USER_FEATURED_SESSIONS_FAILURE,
  SET_USER_FEATURED_SESSIONS_SUCCESS,
} from './types';

const getFeaturedSessions = async (userId: string): Promise<FeaturedSessions> => {
  const snapshot = await getDoc(doc(db, 'featuredSessions', userId));

  return snapshot.data() || {};
};

let fetchGeneration = 0;

/** Discard requests started under an earlier authentication state. */
export const invalidateFeaturedSessionsRequests = () => {
  fetchGeneration += 1;
};

export const fetchUserFeaturedSessions = async (dispatch: Dispatch<FeaturedSessionsActions>) => {
  const userId = selectUserId(store.getState()) as string;

  if (!userId) return;
  const generation = ++fetchGeneration;

  dispatch({
    type: FETCH_USER_FEATURED_SESSIONS,
  });

  try {
    const featuredSessions = await getFeaturedSessions(userId);
    if (generation !== fetchGeneration || selectUserId(store.getState()) !== userId) return;
    importLegacySessionFavorites(userId, featuredSessions);
    dispatch({
      type: FETCH_USER_FEATURED_SESSIONS_SUCCESS,
      payload: featuredSessions,
    });
  } catch (error) {
    if (generation !== fetchGeneration || selectUserId(store.getState()) !== userId) return;
    dispatch({
      type: FETCH_USER_FEATURED_SESSIONS_FAILURE,
      payload: error as Error,
    });
  }
};

const setFeaturedSessions = async (
  userId: string,
  featuredSessions: FeaturedSessions,
): Promise<void> => {
  assertPreviewWritesDisabled();
  await setDoc(doc(db, 'featuredSessions', userId), featuredSessions);
};

const cleanFeaturedSessions = (object: FeaturedSessions): FeaturedSessions => {
  const hasValue = ([, value]: [string, unknown]) => Boolean(value);
  return Object.fromEntries(Object.entries(object).filter(hasValue));
};

export const setUserFeaturedSessions =
  (userId: string, featuredSessions: FeaturedSessions, isBookmarked: boolean) =>
  async (dispatch: Dispatch<FeaturedSessionsActions>) => {
    dispatch({
      type: SET_USER_FEATURED_SESSIONS,
    });

    try {
      const cleanedFeaturedSessions = cleanFeaturedSessions(featuredSessions);
      await setFeaturedSessions(userId, cleanedFeaturedSessions);
      dispatch({
        type: SET_USER_FEATURED_SESSIONS_SUCCESS,
        payload: cleanedFeaturedSessions,
      });
      store.dispatch(queueSnackbar(isBookmarked ? bookmarked.added : bookmarked.removed));
    } catch (error) {
      dispatch({
        type: SET_USER_FEATURED_SESSIONS_FAILURE,
        payload: error as Error,
      });
    }
  };
