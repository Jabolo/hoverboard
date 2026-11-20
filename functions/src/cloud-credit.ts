import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { handleCloudCredit } from './cloud-credit-handler.js';

const claimUrl = defineSecret('CLOUD_CREDIT_CLAIM_URL');

export const cloudCredit = onRequest(
  {
    region: 'us-central1',
    maxInstances: 2,
    concurrency: 40,
    memory: '128MiB',
    timeoutSeconds: 5,
    cors: false,
    secrets: [claimUrl],
  },
  (req, res) => {
    handleCloudCredit(req, res, Date.now(), () => claimUrl.value());
  },
);
