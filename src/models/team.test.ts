import { describe, expect, it } from '@jest/globals';
import { MemberData } from './member';
import { TeamData } from './team';
import { defaultTeams } from './test-fixtures';
import { allKeys } from './utils';

type Team = TeamData & {
  members: MemberData[];
};

describe('partner', () => {
  it('matches the shape of the default data', () => {
    const teams: Team[] = defaultTeams;
    const keys: Array<keyof Team> = ['members', 'title'];

    expect(teams).toHaveLength(2);
    expect(allKeys(teams)).toStrictEqual(keys);
  });
});
