import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { handleConcierge } from './concierge-handler.js';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

export const concierge = onRequest(
  { region: 'us-central1', secrets: [geminiApiKey], cors: false, timeoutSeconds: 45 },
  async (req, res) => {
    await handleConcierge(req, res, {
      db: getFirestore(),
      getApiKey: () => geminiApiKey.value(),
    });
  },
);
