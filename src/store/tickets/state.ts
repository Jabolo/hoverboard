import { RemoteData, Success } from '@abraham/remotedata';
import { initialConferenceTickets } from '../../data/default-tickets';
import { Ticket } from '../../models/ticket';

export type TicketsState = RemoteData<Error, Ticket[]>;
export const initialTicketsState: TicketsState = new Success(initialConferenceTickets);
