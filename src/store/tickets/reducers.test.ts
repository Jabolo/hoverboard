import { describe, expect, it } from '@jest/globals';
import { Success } from '@abraham/remotedata';
import { initialConferenceTickets } from '../../data/default-tickets';
import { ticketsReducer } from './reducers';
import { FETCH_TICKETS_SUCCESS } from './types';

describe('ticket availability', () => {
  it('only displays selectable ticket tiers from Firestore', () => {
    const result = ticketsReducer(undefined, {
      type: FETCH_TICKETS_SUCCESS,
      payload: initialConferenceTickets,
    });
    expect(result).toBeInstanceOf(Success);
    if (result instanceof Success) {
      expect(result.data.map((ticket) => ticket.name)).toEqual(['LastBird', 'Supporter', 'Patron']);
      expect(result.data.find((ticket) => ticket.name === 'LastBird')?.eveneaTicketId).toBe(
        '452402',
      );
    }
  });
  it('hides a sold-out tier even when available is stale', () => {
    const soldOutLastBird = initialConferenceTickets.map((ticket) =>
      ticket.name === 'LastBird' ? { ...ticket, soldOut: true } : ticket,
    );
    const result = ticketsReducer(undefined, {
      type: FETCH_TICKETS_SUCCESS,
      payload: soldOutLastBird,
    });
    expect(result).toBeInstanceOf(Success);
    if (result instanceof Success) {
      expect(result.data.map((ticket) => ticket.name)).not.toContain('LastBird');
    }
  });
});
