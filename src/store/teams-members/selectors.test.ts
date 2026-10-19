import { describe, expect, it, jest } from '@jest/globals';
import { Failure, Success } from '@abraham/remotedata';
import seed from '../../../docs/default-firebase-data.json';
import { Member } from '../../models/member';
import { selectTeamsAndMembers } from './selectors';

jest.mock('../teams/selectors');
jest.mock('../members/selectors');

describe('DevFest event team', () => {
  it('selects exactly the seven event organizers from the larger chapter roster, in owner order', () => {
    const members: Member[] = seed.team[0]!.members.map((member, index) => ({
      ...member,
      id: String(index),
      parentId: '0',
    }));
    const result = selectTeamsAndMembers.resultFunc(
      new Success([{ id: '0', title: 'GDG Warszawa organizers', members: [] }]),
      new Success([...members].reverse()),
    );
    expect(result).toBeInstanceOf(Success);
    if (!(result instanceof Success)) throw new Error('Team did not load');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.members.map((member) => member.name)).toEqual([
      'Michał Jabłoński',
      'Vatsal Patel',
      'Viktoriia Vinnykova',
      'Oleksandr Katrych',
      'Anhelina Sudenkova',
      'Maryna Kamienieva',
      'Jakub Kołakowski',
    ]);
    expect(
      result.data[0]!.members.every((member) => member.photoUrl && member.socials[0]?.link),
    ).toBe(true);
  });

  it('keeps an actual member read failure visible', () => {
    const error = new Error('Offline');
    const result = selectTeamsAndMembers.resultFunc(new Success([]), new Failure(error));
    expect(result).toEqual(new Failure(error));
  });
});
