# Y2K Card Hunt: optional cloud collection experiment

This is a **local branch experiment**, not a release or a change to the agreed
browser-local production experience. It is based on the production merge
`2cea6b0b`. Existing card URLs, private mappings, access gate and time windows
are unchanged. No Firebase project settings, production rules, attendee records,
or deployed services were changed to build or test it.
The first local browser runs inherited the site's existing production Firebase
fallback, so they may have emitted synthetic performance telemetry. The Hunt
sync client itself used demo emulators; later browser tests block external
requests except Google's public sign-in script and override the default app with
a demo project.

## Experience and data

- People can play without signing in. Finds and reveals continue to be stored in
  the existing browser-local keys. Existing local cards are not deleted.
- On My Collection, a person can choose Google sign-in. This copies the current
  browser's finds to a private Firestore document and combines them with cards
  already synced to that Google account. Sign-in on another device shows the
  combined collection. A reveal always takes precedence over an unopened find.
  Mini-game perfect-run stamps stay in the browser; they are not synced.
- The dedicated Firebase app has a tab-scoped sign-in session, separate from the
  website's other client-side sign-in session. The underlying Firebase Auth
  account belongs to the same project. Its Firestore cache is memory-only;
  the existing local browser collection remains separately stored on the device.
- Choosing another Google account and opting in imports the current browser's
  cards to that account. Do not use a shared browser for a private collection.
  Stopping sync hides cloud-only cards on that device, but keeps both the cloud
  copy and browser-local cards. Sign in again to restore the cloud copy.
- Delete synced cards atomically removes the Firestore collection document and
  rotates a session marker. Rules reject stale writes from other devices even
  after a later opt-in re-enables sync. Devices stop sync when they reconnect.
  This was tested in Firebase emulators, including a stale offline write; real
  Firebase and physical devices remain unverified. Browser cards and the shared
  Firebase Auth account are not deleted. A minimal marker containing the UID,
  a random epoch and disabled state remains in Firestore to reject stale writes;
  its retention and eventual deletion need an approved policy. The client reports
  uncertainty if it cannot confirm deletion.
- The cloud document contains the Firebase UID as its document ID, card IDs,
  titles, group, reveal text and game flag where applicable, plus client-clock
  found/reveal timestamps. Firebase Authentication also processes Google
  identity details. The sync schema has no ticket-number, email or name field,
  rejects arbitrary extra fields, and allows at most 64 card-state entries in
  Firestore. It cannot prevent someone from putting personal data in a text field.
  Restrict administrator access; do not log individual collections or publish
  private physical card IDs.
- Cloud sync needs a connection. A local reveal still needs the existing Hunt
  API, and the existing access gate can fail closed offline. This does not turn
  Card Hunt into a fully offline experience. Offline writes queued while the tab
  stays open can sync later; the local copy is the fallback if the tab closes.

## Reading activity counts

`scripts/summarize-hunt-collections.mjs` is an internal, read-only operator tool.
It reads collection documents with Firebase Admin access, counts each account
at most once per card, and prints no UID, title, reveal text or timestamps. It
suppresses numerical cells below five, but small-cell suppression alone is not
an anonymization guarantee. Its output still contains private card IDs and must
not be published. Run only after a human authorizes access and agrees retention,
privacy and intended use. A future authorized operator can run:

```sh
node scripts/summarize-hunt-collections.mjs --project EXPLICIT_PROJECT_ID --acknowledge-internal-data
```

These are opt-in **accounts**, not all players or verified people. Clients can
write their own souvenir records; counts, timestamps and card ownership can be
fabricated. They must not determine attendance, eligibility, prizes or ticket
validity. A live streamed count may also change during the read. A name or
ticket number would not verify a ticket; that would need a
separately designed and approved integration with the ticketing authority.

## Local verification

Use a separate local worktree and a demo project, never the live project. This
configuration targets only the Auth and Firestore emulators on ports 19099 and 18080. Java 21 and a locally installed Playwright/Chrome are needed. `npm run
build` is required before the browser test. The test uses fake `example.test`
accounts, not a real Google account or event data.

```sh
npm run build
JAVA_HOME=/path/to/jdk-21 firebase emulators:exec \
  --config firebase.hunt-emulator.json --project demo-devfest-y2k \
  --only auth,firestore 'node scripts/verify-hunt-cloud-rules.mjs'
JAVA_HOME=/path/to/jdk-21 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
  firebase emulators:exec --config firebase.hunt-emulator.json \
  --project demo-devfest-y2k --only auth,firestore \
  'node scripts/verify-hunt-cloud-browser.mjs'
node --test scripts/summarize-hunt-collections.test.mjs
```

Localhost sync uses the demo project and these emulator ports even though other
parts of the website may have their own existing preview configuration. The
sync module refuses non-local origins other than the canonical
`warsaw.devfest.pl` host, so a generic preview cannot write to the live sync
collection. It also checks the expected project and auth domain before starting.
Other official hostnames or project migrations need an explicit reviewed decision.
The browser test supplies a local open access response and public fixture cards; it
does not test the production gate, private catalog, Google OAuth setup, mobile
operating systems, or a live Firebase project. It blocks service workers and
external requests other than the Google sign-in bootstrap, and points the site's
default Firebase app at a demo project to avoid sending synthetic data to
production.

## Gates before a production decision

1. A human organizer decides whether Google-account sync and the associated
   statistics are wanted, and reviews the attendee text, legal controller,
   purpose, retention, deletion process and updated privacy notice. The current
   privacy page has not been reviewed for this new data use.
2. Security and billing owners review the schema and rules, abuse/rate exposure,
   Firebase Auth account lifecycle, admin access, costs, retention and deletion
   across devices. A 64-entry cap is not an account-creation or write-rate limit.
3. Verify the exact Firebase project, Google provider, OAuth consent screen,
   authorized domains and popup behavior. The branch adds the configured
   `firebaseapp.com` host to the Hosting frame policy; the existing live policy
   does not contain it. The live public Hosting initialization config returned
   project `gdg-warsaw-devfest26-web` and auth domain
   `gdg-warsaw-devfest26-web.firebaseapp.com` on 19 November 2026; this does not
   establish that the Google provider or domain authorization is configured.
   Actual OAuth, CSP and account recovery must be tested
   in an isolated non-production project, then with authorized test accounts.
   Mobile/in-app-browser popup behavior and iOS/Android devices remain untested.
4. Compare the exact live Firestore rules against the release baseline; the
   rules deployment replaces the full ruleset. Run the emulator, full lint,
   tests and build on the proposed release commit. Confirm existing site rules,
   functions, gate, public links, offline programme, timing and card mappings.
5. Only after explicit production approval, deploy and verify the reviewed
   Firestore rules and Hosting as separate operations. The main-branch Hosting
   workflow does not deploy Firestore rules. Monitor errors and costs; do not
   write production attendee data as part of a dry run.

Record the previous Hosting release and rules before any approved change. If a
release needs rollback, restore Hosting first; evaluate rules and existing cloud
records separately with the owner. Do not delete participant data as a rollback
shortcut. The production event gates and physical QR/NFC checks remain as in the
existing release handoff.

## Test project progress — 20 November 2026

The explicitly selected Google account created the isolated project
`devfest-y2k-sync-test-1120` (project number `870513500592`) without a billing
account. Its native Firestore database is in `europe-central2` with free tier
enabled. The proposed `firestore.rules` was deployed to that project and the
release was read back successfully. A dedicated Web app was created. The live
project's rules release matched the unmodified `gdg/main` baseline exactly at
the time of inspection; its Google provider was enabled and
`warsaw.devfest.pl` was on its authorized-domain list. Neither the live rules nor
the live Auth configuration was modified.

Real sign-in is **not yet verified**. The test project's Authentication has no
configuration: the public Identity Platform initialization API reported
`BILLING_NOT_ENABLED`, and a Google sign-in initiation request returned
`CONFIGURATION_NOT_FOUND`. No billing account was attached. The no-cost Firebase
console initialization path and Google provider still need to be set up, with
`localhost` authorized and the correct test account configured. Do not enable
billing merely to unblock the test without the owner's decision.

`scripts/serve-hunt-real-auth-test.mjs` prepares an isolated, local-only test of
the actual branch using mock card responses and the dedicated test project. It
requires a local Web app configuration file in `HUNT_TEST_FIREBASE_CONFIG`; the
server rejects other project IDs and binds to loopback. The cloud client permits
that exact test project only on localhost; local testing otherwise uses demo
emulators. Do not publish the test server or use actual attendee data.

The first setup command inherited an existing Firebase CLI token; subsequent
commands explicitly excluded that token and selected
`michal.tomasz.jablonski@gmail.com`. The CLI debug log created by this session
was removed. A production Auth configuration response accidentally included
password-hash signing material in this chat's tool output. Do not reproduce it;
ask the Firebase security owner to assess exposure to the chat/tool logs and
appropriate remediation. No production credential was changed.

The [privacy and operations review draft](y2k-privacy-review.md) records the
unresolved controller, legal basis, retention, shared Auth-account lifecycle,
session-marker retention, and abuse controls. These are release blockers, not
decisions made by this branch.
