import process from 'node:process';
import { onRequest } from 'firebase-functions/v2/https';
import { readPhysicalCards } from './catalog.js';
import { createHuntHandler } from './handler.js';

let handler;

export const y2kCardHuntPreview = onRequest(
  { region: 'us-central1', maxInstances: 3, timeoutSeconds: 10 },
  (request, response) => {
    if (!handler) {
      try {
        const physicalCards = readPhysicalCards(process.env.HUNT_PHYSICAL_CARDS);
        handler = createHuntHandler({ includePreview: true, physicalCards });
      } catch {
        console.error('Y2K Card Hunt catalog configuration is missing or invalid');
        response.setHeader('Cache-Control', 'private, no-store, max-age=0');
        response.status(503).json({ status: 'unavailable' });
        return;
      }
    }
    handler(request, response);
  },
);
