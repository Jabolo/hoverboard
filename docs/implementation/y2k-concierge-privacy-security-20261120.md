# Card sync and Concierge: privacy and security review (20 November 2026)

**Status: owner privacy, security, retention, audience-age, and venue-capacity
decisions settled on `integration/y2k-concierge-20261120`.** Public attendee
disclosures are updated in `public/data/privacy.md`. Production deployment of
Firestore rules, Cloud Functions (`concierge`, `cloudCredit`), and Hosting
remains a separate operational step; the live Concierge function must be
redeployed to activate the logging minimization, upgraded venue Wi-Fi rate
limits, and Gen2 `maxInstances` caps.

## Actual data flows

- **Y2K Card Hunt & optional cloud sync:** Card Hunt works locally without an
  account. Optional Google Sign-In in _My Collection_ permits cross-device
  synchronization. Cloud Firestore (`europe-central2`) stores `huntCollections`
  keyed by Firebase UID with found/revealed card IDs, card metadata/states, and
  client-recorded timestamps. Firebase Authentication processes the Google
  sign-in. No ticket number is required. Aggregate opt-in statistics are
  indicative only and do not verify attendance, ticket entitlement, or prize
  eligibility.
- **Stop sync & self-service deletion:** Stopping sync hides cloud-only cards on
  that device without deleting the cloud copy. Choosing **Delete synced cards**
  in _My Collection_ atomically deletes the `huntCollections/{uid}` document and
  writes/rotates a minimal UID-keyed revocation marker in `huntCollectionSessions`
  to reject stale writes from other devices. Browser-stored cards and the shared
  Firebase Authentication sign-in record remain separate and are not deleted by
  this action.
- **AI Concierge & voice input:** Preset chips run locally in the browser.
  Custom questions, voice input (when the microphone is activated), and
  saved-session IDs (used to check schedule conflicts) are sent to Google Gemini
  APIs (`gemini-3.5-flash-lite`, `gemini-3.6-flash`, and
  `gemini-3.5-transcribe-live` over ephemeral WebSocket tokens) or handled by
  the browser's speech recognition provider. Requests use `store: false` on
  Gemini Interactions API calls. Short-lived response caches and the
  per-page-load `X-Concierge-Client` rate-limit token exist only in memory
  (never persisted to `localStorage` or `sessionStorage`). Google and Firebase
  infrastructure process technical and security logs under their applicable
  terms.
- **Logging minimization:** This branch removes logging of raw model output,
  upstream error bodies, and exception messages from the Concierge function.
  Other infrastructure or Google service logs remain governed by provider terms,
  and historical logs are not retroactively erased.

## Settled owner decisions & security sign-off

1. **Public organizer & privacy contact (Settled):**
   - **GDG Warszawa** (informal community organizer / **GDG Warsaw organizers
     team**) and [hello@gdgwarsaw.pl](mailto:hello@gdgwarsaw.pl) remain the
     sole public organizer and privacy contact for the website, Card Hunt sync,
     and AI Concierge.
   - No corporate entity is invented, and **KOL.SKI sp. z o.o.** is NOT assigned
     to Card Hunt sync or AI Concierge (KOL.SKI sp. z o.o. is strictly for paid
     Evenea ticket sales).
   - Public notice updated in `public/data/privacy.md`.

2. **Retention period for optional Y2K cloud sync (Settled):**
   - Cloud-synced card collections (`huntCollections`) and revocation markers
     (`huntCollectionSessions`) are retained for at most **30 days after the event**,
     with organizer cleanup scheduled by **21 December 2026 (`2026-12-21`)**.
   - Attendees can also delete their synced cloud collection immediately via
     **Delete synced cards** in _My Collection_ or request deletion at any time
     via `hello@gdgwarsaw.pl`.
   - Browser-local cards, shared Firebase Auth sign-in accounts, and provider
     infrastructure logs/backups are handled separately as disclosed in
     `public/data/privacy.md`.

3. **Authentication & Security Owner Assessment — Password-Hash Parameters Exposure (Settled / Signed Off):**
   - **Google Sign-In is the ONLY enabled authentication provider** in
     production Firebase Authentication (`email/password` sign-in is disabled).
   - **Owner Security Sign-Off:** Regarding the earlier CLI tool-output exposure
     of Firebase Auth password-hash configuration parameters
     (`https://firebase.google.com/docs/cli/auth#password_hash_parameters`):
     because `email/password` sign-in is disabled and only Google OAuth is used,
     **no attendee password hashes exist**. The security owner has explicitly
     assessed and accepted this finding as carrying zero attendee password
     exposure. The raw parameters remain excluded from repository files and
     documentation.

4. **Audience age (18+) & Gemini API terms (Settled):**
   - All DevFest Warsaw 2026 attendees are **18+ adults**.
   - `public/data/privacy.md` and the Concierge inline notice explicitly state
     that the event and AI Concierge are intended for adult attendees (18+) and
     advise attendees not to submit personal or sensitive information, aligning
     attendee guidance with the
     [Gemini API terms](https://ai.google.dev/gemini-api/terms).

5. **Venue Wi-Fi NAT rate limits & Gen2 Cloud Run scaling caps (Settled):**
   - Upgraded for 300+ attendees sharing Campus Warsaw NAT Wi-Fi (budgeted for
     15,000 chats + 15,000 voice calls):
     - Chat global 30-hour pool (`concierge-global-30h`): **`15000`** requests /
       30h (`108000s`)
     - Voice global 30-hour pool (`concierge-voice-global-30h`, covering
       `live-token` and `transcribe`): **`15000`** requests / 30h (`108000s`)
     - Per-IP 15-minute ceiling (`concierge-ip`): **`3000`** requests / 15m
       (`900s`) across all three modes (`query`, `live-token`, `transcribe`)
     - Per-browser-tab/client 15-minute limit (`concierge-client`, via in-memory
       `X-Concierge-Client` header): **`80`** requests / 15m (`900s`)
     - Cloud Run Gen2 `maxInstances`: `concierge` = **`5`**
       (`timeoutSeconds: 45`), `cloudCredit` = **`3`** (`timeoutSeconds: 15`)
   - Firestore rules isolate `huntCollections` and `huntCollectionSessions` to the
     authenticated Google UID and enforce the 64-entry cap.
   - Cloud Billing budgets/alerts remain governed separately under owner
     approval.

## Public privacy notice reference

The finalized attendee-facing disclosures for both **Y2K Card Hunt and optional
cloud sync** and **AI Concierge and voice input** are published in
`public/data/privacy.md` (served at `/privacy`). See also
`y2k-privacy-review.md` and `y2k-concierge-integration-20261120.md` for
cross-referenced operational checks and deployment sequence.
