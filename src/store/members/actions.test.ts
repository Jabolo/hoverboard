import { describe, expect, it, jest } from '@jest/globals';
import { Success } from '@abraham/remotedata';
import { Dispatch } from 'redux';
import { Member } from '../../models/member';
import { subscribeToCollection, subscribeToCollectionGroup } from '../../utils/firestore';
import { fetchMembers } from './actions';
import {
  FETCH_MEMBERS,
  FETCH_MEMBERS_FAILURE,
  FETCH_MEMBERS_SUCCESS,
  MembersActions,
} from './types';

jest.mock('../../utils/firestore');

describe('event team member subscription', () => {
  it('uses the publicly permitted team subcollection and retains its parent identity', async () => {
    jest.mocked(subscribeToCollection).mockReturnValue(new Success(jest.fn()));
    const dispatched: MembersActions[] = [];
    const dispatch: Dispatch<MembersActions> = (action) => {
      dispatched.push(action);
      return action;
    };
    await fetchMembers(dispatch);

    expect(subscribeToCollectionGroup).not.toHaveBeenCalled();
    expect(subscribeToCollection).toHaveBeenCalledWith(
      'team/0/members',
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    );

    const [, onStart, onNext, onError] = jest.mocked(subscribeToCollection).mock.calls[0]!;
    onStart();
    expect(dispatched[dispatched.length - 1]).toEqual({ type: FETCH_MEMBERS });

    const member = { id: '4', name: 'Maryna Kamienieva' } as Member;
    onNext([member]);
    expect(dispatched[dispatched.length - 1]).toEqual({
      type: FETCH_MEMBERS_SUCCESS,
      payload: [{ ...member, parentId: '0' }],
    });

    const error = new Error('Network unavailable');
    onError(error);
    expect(dispatched[dispatched.length - 1]).toEqual({
      type: FETCH_MEMBERS_FAILURE,
      payload: error,
    });
  });
});
