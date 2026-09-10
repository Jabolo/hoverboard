import * as functions from 'firebase-functions/v1';

// Kept as a no-op export so an existing deployed function can be retired safely
// on a later deployment without creating a second Mailchimp subscription path.
export const mailchimpSubscribe = functions.firestore
  .document('/subscribers/{id}')
  .onCreate(async () => {
    functions.logger.warn(
      'Legacy Mailchimp sync is disabled. New newsletter registrations use registerNewsletterConsent.',
    );
    return null;
  });
