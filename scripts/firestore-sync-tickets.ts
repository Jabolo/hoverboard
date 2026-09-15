import { importTickets } from './firestore-init/tickets.js';

importTickets()
  .then(() => {
    console.log('Successfully synced tickets to Firestore.');
    process.exit(0);
  })
  .catch((err: Error) => {
    console.error('Failed to sync tickets:', err);
    process.exit(1);
  });
