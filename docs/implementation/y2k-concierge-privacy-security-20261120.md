# Card sync and Concierge: release review draft

**Draft for organizer and security review. Not a complete public privacy notice
and not authorization to publish.** This documents the integration branch; the
live Concierge function must be updated separately to obtain the logging change.

## Actual data flows

- Card Hunt works locally without an account. Optional Google sign-in permits
  synchronization. The Firestore collection is keyed by Firebase UID and stores
  card IDs, card content, states and client-recorded collection times. Firebase
  Authentication also holds account information received from Google. No ticket
  number is required. Client-created statistics are indicative, not proof that
  someone attended or earned a prize.
- Stopping sync does not delete the cloud copy. Deleting synced cards removes the
  collection and revokes stale devices, leaving a UID-keyed revocation marker.
  The Firebase Authentication account is shared with other site features and is
  not deleted by this action. Browser-stored cards remain on the device.
- A custom Concierge question, recognized speech and saved session identifiers
  can be sent to Gemini; voice may be sent to Google for transcription, while
  browser speech recognition may use the browser's own provider. Requests and
  responses may be cached in process memory. Client caching on this branch is in
  memory, not sessionStorage, but expiry is checked on access; do not present
  the cache TTL as a guaranteed deletion deadline. Google and infrastructure
  providers may retain service and security logs under their own terms.
- This branch removes logging of raw model output, upstream error bodies and
  exception messages. It does not prove that other infrastructure or Google
  service logs cannot contain personal data. Previous logs are not erased.

## Checks and outstanding decisions

- Michał confirmed the intended event audience is adults. The site is public;
  review whether the actual availability complies with the age restrictions in
  [Gemini API terms](https://ai.google.dev/gemini-api/terms).
- The production Firebase project has an active billing account; production
  Google sign-in is enabled and both the event and Firebase Auth domains are
  authorized. This does not prove that the Gemini API key points to that billed
  project, that consent screen details are correct, or that live OAuth works.
  Confirm the key's project and applicable Gemini terms without sharing the key.
- GDG Warszawa is the informal public organizer and hello@gdgwarsaw.pl is the
  operational contact. Michał asked to keep that presentation. The event source
  of truth explicitly leaves the formal legal controller unresolved; do not
  invent a legal entity or assume ticket seller KOL.SKI is the controller for
  these separate flows. A responsible person with authority must settle the
  controller identity and contact address, purpose and lawful bases, processor
  arrangements and transfers, and approve the completed public notice.
- No 30-day retention policy has been approved or implemented. Select a period
  and implement and verify collection and revocation-marker cleanup, addressing
  Auth accounts, backups and logs separately. No promise of timed deletion can
  be made before that operational process exists. If cross-device storage is not
  wanted, leave cloud sync disabled and keep the browser-local hunt instead.
- Firestore rules restrict personal documents to the corresponding signed-in
  Google user and cap collection entries. They do not cap write frequency or
  new-account creation. The Concierge has per-IP and global request limits, not
  a monetary spending cap; a shared venue IP can exhaust its 45 requests per
  15 minutes. A production-project budget with three alert thresholds exists;
  recipients and coverage of these services were not verified. Review costs,
  expected venue traffic, abuse and the stop procedure. Test with representative
  shared-network load.
- Production Auth password-hash signing material was accidentally present in
  prior chat tool output. Do not reproduce it. The security owner must assess
  the exposure and consult Firebase support if necessary about remediation;
  do not claim that it has been rotated or that passwords were exposed. The
  production email/password sign-in provider currently reports disabled, which
  does not establish whether any historical password hashes exist. Firebase
  describes these parameters as sensitive and uses them with password hashes
  during migrations: https://firebase.google.com/docs/cli/auth#password_hash_parameters

## Draft text for review, subject to the missing details above

> You can collect cards on this browser without signing in. If you choose Google
> sign-in to sync your collection, this site stores your Firebase account ID,
> card records and collection times in Firebase so you can see them on another
> device. You can delete the synced collection from My Collection; cards saved in
> your browser and your shared Firebase sign-in account are separate. Contact
> hello@gdgwarsaw.pl for privacy requests.
>
> Concierge can send your question and selected saved-session IDs to Google
> Gemini. If you use voice, audio may also be sent to Google or handled by your
> browser's speech provider. Avoid including personal or sensitive information.
> Google and infrastructure providers process technical and security data under
> their applicable terms. Responses can be inaccurate; check essential event
> details with organizers.
>
> [Add the verified controller, contact address, purposes and lawful bases,
> retention and deletion details, recipients, transfers and individual rights.]

This is a working draft, not a substitute for the organizer's legal review.
