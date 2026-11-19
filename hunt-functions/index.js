import process from 'node:process';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { readPhysicalCards } from './catalog.js';
import { createHuntHandler } from './handler.js';
import { createAccessGate } from './access.js';

let handler;

export const y2kCardHuntPreview = onRequest(
  { region: 'us-central1', maxInstances: 3, timeoutSeconds: 10 },
  (request, response) => {
    if (!handler) {
      try {
        const physicalCards = readPhysicalCards(process.env.HUNT_PHYSICAL_CARDS);
        const hunt = createHuntHandler({ includePreview: true, physicalCards });
        const access = createAccessGate({ mode: 'open' });
        handler = (req, res) => access(req, res, hunt);
      } catch {
        console.error('Y2K Card Hunt configuration is missing or invalid');
        response.setHeader('Cache-Control', 'private, no-store, max-age=0');
        response.status(503).json({ status: 'unavailable' });
        return;
      }
    }
    handler(request, response);
  },
);

// Production has its own secret; the preview dotenv configuration stays isolated.
const physicalCatalog = defineSecret('HUNT_PHYSICAL_CARDS_PRODUCTION');
const accessCode = defineSecret('HUNT_ACCESS_CODE_PRODUCTION');
let productionHandler;

export const y2kCardHunt = onRequest(
  {
    region: 'us-central1',
    maxInstances: 3,
    timeoutSeconds: 10,
    secrets: [physicalCatalog, accessCode],
  },
  (request, response) => {
    if (!productionHandler) {
      try {
        const physicalCards = readPhysicalCards(physicalCatalog.value());
        const hunt = createHuntHandler({ physicalCards, includePreview: false });
        const access = createAccessGate({
          mode: process.env.HUNT_ACCESS_MODE || 'locked',
          code: accessCode.value(),
        });
        productionHandler = (req, res) => access(req, res, hunt);
      } catch {
        console.error('Y2K Card Hunt configuration is missing or invalid');
        response.setHeader('Cache-Control', 'private, no-store, max-age=0');
        response.status(503).json({ status: 'unavailable' });
        return;
      }
    }
    productionHandler(request, response);
  },
);
