import { describe, expect, it } from '@jest/globals';
import { Ticket } from './ticket';
import { defaultTickets } from './test-fixtures';
import { allKeys } from './utils';

describe('ticket', () => {
  it('matches the shape of the default data', () => {
    const tickets: Ticket[] = defaultTickets;
    const keys: Array<keyof Ticket> = [
      'available',
      'currency',
      'ends',
      'inDemand',
      'info',
      'name',
      'price',
      'primary',
      'regular',
      'soldOut',
      'starts',
      'url',
    ];

    expect(tickets).toHaveLength(5);
    expect(allKeys(tickets)).toStrictEqual(keys);
  });
});
