# Y2K cloud collection: privacy and operations review

**Status: owner decisions settled; public privacy notice updated in
`public/data/privacy.md`.** Optional cloud sync and the upgraded AI Concierge
remain staged on `integration/y2k-concierge-20261120` pending pre-release checks
and separate production deployments of Firestore rules, Cloud Functions, and
Hosting.

## Settled owner decisions & operational controls

- **Public organizer & privacy contact (Settled):** **GDG Warszawa** (informal
  community organizer / **GDG Warsaw organizers team**) and
  `hello@gdgwarsaw.pl` remain the sole public organizer and privacy contact for
  the website, optional Card Hunt cloud sync, and AI Concierge. No corporate
  entity is invented, and **KOL.SKI sp. z o.o.** is strictly scoped to paid
  Evenea ticket sales and is not assigned to Card Hunt sync or AI Concierge.
- **Purpose & attendee disclosure (Settled):** Card Hunt works locally in the
  browser without an account. Optional Google Sign-In in _My Collection_
  synchronizes found/revealed card state across devices via Cloud Firestore
  (`europe-central2`). Organizers may compute aggregate opt-in card statistics,
  which are indicative only and do not verify event attendance or ticket
  entitlement. Sign-in is separate from newsletter marketing consent.
- **Retention & organizer cleanup (Settled):** Remaining cloud-synced card
  collections (`huntCollections`) and revocation markers (`huntCollectionSessions`)
  are retained for at most **30 days after the event**, with organizer cleanup
  scheduled by **21 December 2026 (`2026-12-21`)**. Attendees can delete their
  synced cloud collection immediately in _My Collection_ (**Delete synced
  cards**) or request deletion at any time via `hello@gdgwarsaw.pl`. Browser-local
  cards remain on the device, and provider logs/backups follow Google/Firebase
  terms.
- **Authentication provider, shared Auth account & security sign-off (Settled):**
  **Google Sign-In is the ONLY enabled authentication provider** in production
  Firebase Authentication (`email/password` is disabled). Deleting synced cards
  does not delete the shared Firebase Authentication account so other site
  features are not disrupted; full Auth account removal can be requested via
  `hello@gdgwarsaw.pl`. Regarding the earlier CLI tool-output exposure of Auth
  password-hash config parameters, the owner security assessment (documented in
  `y2k-concierge-privacy-security-20261120.md`) confirms that because
  `email/password` is disabled and only Google OAuth is used, no attendee
  password hashes exist.
- **Audience age (18+) & AI Concierge disclosure (Settled):** All DevFest Warsaw
  2026 attendees are **18+ adults**. Both `public/data/privacy.md` and the
  Concierge interface state that the event and AI Concierge are intended for
  adult attendees (18+) and advise attendees not to submit personal or sensitive
  data.
- **Processors & infrastructure:** Cloud Firestore stores `huntCollections` and
  `huntCollectionSessions` in `europe-central2`. Firebase Authentication and Google
  Gemini APIs (`gemini-3.5-flash-lite`, `gemini-3.6-flash`, and
  `gemini-3.5-transcribe-live` over ephemeral WebSocket tokens, with
  `store: false` on Gemini Interactions requests) process technical and security
  data under Google and Firebase terms, as disclosed in `public/data/privacy.md`.
- **Deletion across devices:** **Delete synced cards** atomically removes
  `huntCollections/{uid}` and rotates a minimal UID-keyed revocation marker in
  `huntCollectionSessions/{uid}`, blocking stale-device writes (verified in Firebase
  emulators and controlled two-session Chrome tests). Revocation markers are
  included in the 30-day post-event organizer cleanup by **21 December 2026
  (`2026-12-21`)**. Browser-saved cards are separate and cleared in browser
  settings.
- **Security, venue Wi-Fi rate limits & Gen2 scaling caps (Settled):**
  Firestore rules isolate personal sync documents by UID and enforce the
  64-entry cap. To support 300+ attendees on shared Campus Warsaw NAT Wi-Fi
  (15,000 chats + 15,000 voice calls) while bounding abuse and cost:
  - Chat global 30h pool (`concierge-global-30h`): **`15000`** / 30h (`108000s`)
  - Voice global 30h pool (`concierge-voice-global-30h`, `live-token` +
    `transcribe`): **`15000`** / 30h (`108000s`)
  - Per-IP 15m ceiling (`concierge-ip`): **`3000`** / 15m (`900s`) across all 3
    modes
  - Per-browser-tab/client 15m limit (`concierge-client`, via in-memory
    `X-Concierge-Client` header): **`80`** / 15m (`900s`)
  - Cloud Run Gen2 `maxInstances`: `concierge` = **`5`** (`timeoutSeconds: 45`),
    `cloudCredit` = **`3`** (`timeoutSeconds: 15`).

## Published attendee privacy notice

The finalized public disclosures are in `public/data/privacy.md` under:

- `## Y2K Card Hunt and optional cloud sync`
- `## AI Concierge and voice input`

Cross-reference `y2k-concierge-privacy-security-20261120.md` for the detailed
data-flow and security owner sign-off record, and
`y2k-concierge-integration-20261120.md` for integration verification and
deployment sequencing.

## Verification sources

- Event Source of Truth: https://docs.google.com/document/d/1-L1DovdZVSOnbUBS37HYgYleQBrcKZvp9uDbULqh2lM/edit
- Firebase Auth limits: https://firebase.google.com/docs/auth/limits
- Firebase Auth account deletion: https://firebase.google.com/docs/auth/web/manage-users
- Firestore TTL behavior: https://firebase.google.com/docs/firestore/ttl
- EDPB transparency guidance: https://www.edpb.europa.eu/system/files/2023-09/wp260rev01_en.pdf
