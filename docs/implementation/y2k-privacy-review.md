# Y2K cloud collection: privacy and operations review draft

**Status: draft, not a public privacy notice or an approved decision.** The
optional sync must remain off production until the organizer settles the items
below and reviews the notice. The event source of truth says the legal controller
for the website is not yet confirmed. The existing website privacy page describes
newsletter and analytics, but not this cloud collection.

## Decisions needed

- **Controller:** full legal identity and contact address for this processing.
  The organizers' operational contact `hello@gdgwarsaw.pl` is a contact route,
  not by itself a legal controller. Michał named GDG Warszawa as the proposed
  controller, then asked to skip further clarification. The Source of Truth
  describes it as an informal community; the legal identity and capacity to
  handle requests remain unverified, not an approved publication claim.
- **Purpose and legal basis:** choose and document the basis for optional
  cross-device synchronization and for any aggregate usage analysis separately.
  Sign-in is not marketing consent. Verify the basis with the responsible owner.
- **Retention:** proposed starting point for discussion: remove cloud card
  documents 30 days after the event ends, unless a shorter period or deletion
  request applies. This is not implemented, approved, or a public promise.
  Specify backup/log retention and its limits, and whether aggregate counts remain.
- **Authentication account:** Firebase Authentication is shared with other
  website features. Deleting a Firebase user can affect those features, so do not
  automatically delete the shared account. Agree a separate verified request
  process and account-retention policy with the owner.
- **Processors and transfers:** verify the actual Google/Firebase agreement,
  categories of recipients, service locations, transfer mechanisms, and any
  other authorized recipients. Firestore's Warsaw location alone does not prove
  where Authentication, logs, backups, or support are processed.
- **Deletion across devices:** the proposed revision atomically deletes card
  data and rotates a session marker, blocking stale-device writes; emulator
  tests and a controlled real-Firebase test with two Chrome sessions passed.
  Real offline stale writes and physical phones have not been verified.
  The marker retains a Firebase UID and random epoch; agree its retention and
  cleanup. Browser-stored cards are separate and cleared in browser settings.
- **Security and cost:** confirm access to Firebase, log retention, billing
  alerts, abuse response and stop procedure. A 64-entry cap is not a write-rate
  or account-creation cap. Google's published limits include an IP-based new
  account creation limit; shared venue Wi-Fi may make it relevant. Test expected
  concurrency and request quota changes if necessary.

## Draft attendee text for review only

> Card Hunt can be played without an account. If you choose to sync your cards,
> sign in with Google. We store your Firebase account identifier and the cards
> you find or reveal, including their recorded times, to show your collection on
> another device. Firebase Authentication receives account information from
> Google. Organizers may use opted-in collections to count card activity; the
> counts do not verify a ticket or entitlement. We do not ask for your ticket
> number. You can stop syncing, and you can request deletion of your synced
> collection. Stopping sync does not delete the cloud copy. Browser-saved cards
> are separate. Contact hello@gdgwarsaw.pl for privacy requests. [Insert the
> controller's identity, the legal bases, approved retention period, recipients,
> transfers and how to exercise relevant rights after verification.]

This text deliberately does not claim a retention schedule or guaranteed deletion
until the feature and operator process actually provide them. Review final copy
against the actual Google service configuration and data flow before use.

## Verification sources

- Event Source of Truth: https://docs.google.com/document/d/1-L1DovdZVSOnbUBS37HYgYleQBrcKZvp9uDbULqh2lM/edit
- Firebase Auth limits: https://firebase.google.com/docs/auth/limits
- Firebase Auth account deletion: https://firebase.google.com/docs/auth/web/manage-users
- Firestore TTL behavior: https://firebase.google.com/docs/firestore/ttl
- EDPB transparency guidance: https://www.edpb.europa.eu/system/files/2023-09/wp260rev01_en.pdf
