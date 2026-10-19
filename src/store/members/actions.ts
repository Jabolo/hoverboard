import { Initialized, Success } from '@abraham/remotedata';
import eventTeam from '../../../public/data/event-team.json';
import { Dispatch } from 'redux';
import { Member } from '../../models/member';
import { subscribeToCollection, Subscription } from '../../utils/firestore';
import {
  FETCH_MEMBERS,
  FETCH_MEMBERS_FAILURE,
  FETCH_MEMBERS_SUCCESS,
  MembersActions,
} from './types';

let subscription: Subscription = new Initialized();

export const unsubscribe = () => {
  if (subscription instanceof Success) {
    subscription.data();
  }
};

export const fetchMembers = async (dispatch: Dispatch<MembersActions>) => {
  if (subscription instanceof Initialized) {
    subscription = subscribeToCollection(
      `team/${eventTeam.teamId}/members`,
      () => dispatch({ type: FETCH_MEMBERS }),
      (payload: Member[]) =>
        dispatch({
          type: FETCH_MEMBERS_SUCCESS,
          payload: payload.map((member) => ({ ...member, parentId: eventTeam.teamId })),
        }),
      (payload: Error) => dispatch({ type: FETCH_MEMBERS_FAILURE, payload }),
    );
  }
};
