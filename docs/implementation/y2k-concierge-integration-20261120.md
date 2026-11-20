# Y2K and Concierge integration review — 20 November 2026

Status: **owner privacy, security, retention, audience-age, and venue-capacity
decisions settled on `integration/y2k-concierge-20261120`; ready for final
pre-release verification and staged production deployment.** This document
records the integration state and release sequence; production deployment
requires separate Firebase operations for Firestore rules, Cloud Functions, and
Hosting.

## Scope and source

The integration starts with local Concierge `55e44dce`, which contains production
GitHub main `2cea6b0b`, and merges scratch refinement `9e54de8d` and cloud
collection `69f6457b`. The `firebase.json` conflict was resolved by retaining
both the Firebase Auth frame origin and the Concierge WebSocket connection
policy, as well as the routes for both features. The floating Concierge dialog
needed its pointer events restored; otherwise its controls could not be clicked.
Subsequent hardening on this branch adds upgraded venue Wi-Fi rate limits,
in-memory `X-Concierge-Client` per-tab throttling, Gen2 `maxInstances` caps, and
updated public privacy disclosures. The integration worktree does not modify the
other checkouts.

## Evidence and limits

- Baseline integration build, full Jest suite (65 suites, 290 tests passed, five
  skipped) and lint passed (re-run required on the final release commit after
  rate-limit, scaling-cap, and privacy updates).
- Scratch interaction verification passed at 320, 390 and 1440 pixels, including
  touch, keyboard, reduced motion, persistence and simulated server failure.
- A combined browser check verifies card reveal, collection and floating
  Concierge controls at those widths with external network calls blocked.
- Firestore/Auth emulator checks passed for isolation, rules, counts, device
  synchronization, revocation and stale offline writes. Real Google sign-in,
  synchronization across two Chrome sessions and controlled deletion passed
  against the dedicated test project. A physical phone and real offline stale
  writes were not tested.
- At initial baseline inspection, production Firestore rules matched unmodified
  `main`, production Hosting did not route `/api/concierge`, and the active
  Concierge function predated the logging minimization, rate-limit upgrades, and
  Gen2 scaling caps on this branch. Live voice, production OAuth, and end-to-end
  production behavior must be verified immediately after staged deployment.
- The test project retains the authorized test Auth user and a disabled
  revocation marker. Regarding the earlier CLI tool-output exposure of
  production Auth password-hash config parameters noted in
  `y2k-cloud-collection.md`, the security owner assessment is now settled and
  signed off in `y2k-concierge-privacy-security-20261120.md` (Google Sign-In is
  the only enabled Auth provider; `email/password` is disabled, so no attendee
  password hashes exist).

## Settled owner decisions (pre-release gates satisfied)

All privacy, security, retention, audience-age, and venue-capacity decisions
have been finalized by the owner and reflected across `public/data/privacy.md`,
`y2k-concierge-privacy-security-20261120.md`, and `y2k-privacy-review.md`:

1. **Public organizer & privacy contact:** **GDG Warszawa** (informal community
   organizer / **GDG Warsaw organizers team**) and `hello@gdgwarsaw.pl` remain
   the sole public organizer and privacy contact. No corporate entity is
   invented, and **KOL.SKI sp. z o.o.** remains strictly scoped to paid Evenea
   ticket sales.
2. **Retention period for optional Y2K cloud sync:** Cloud-synced collections
   (`huntCollections`) and revocation markers (`huntCollectionSessions`) are
   retained for **30 days after the event**, with organizer cleanup scheduled by
   **21 December 2026 (`2026-12-21`)**, plus immediate self-service deletion in
   _My Collection_ (**Delete synced cards**) and deletion on request via
   `hello@gdgwarsaw.pl`.
3. **Authentication & security owner sign-off:** **Google Sign-In is the ONLY
   enabled authentication provider** in Firebase Auth (`email/password` is
   disabled). Because `email/password` is disabled, no attendee password hashes
   exist; the earlier CLI tool-output exposure of Auth password-hash config
   parameters is signed off by the owner in
   `y2k-concierge-privacy-security-20261120.md`.
4. **Audience age (18+) & Gemini API terms:** All DevFest Warsaw 2026 attendees
   are **18+ adults**. Both `public/data/privacy.md` and the Concierge UI state
   that the event and AI Concierge are intended for adult attendees (18+) and
   advise attendees not to submit personal or sensitive data.
5. **Venue Wi-Fi NAT rate limits & Gen2 scaling caps:** Upgraded for 300+
   attendees on shared Campus Warsaw NAT Wi-Fi (15,000 chats + 15,000 voice
   calls):
   - Chat global 30h pool (`concierge-global-30h`): `15000` / 30h (`108000s`)
   - Voice global 30h pool (`concierge-voice-global-30h`, `live-token` +
     `transcribe`): `15000` / 30h (`108000s`)
   - Per-IP 15m limit (`concierge-ip`): `3000` / 15m (`900s`) across all 3 modes
   - Per-browser-tab/client 15m limit (`concierge-client`, via in-memory
     `X-Concierge-Client` header): `80` / 15m (`900s`)
   - Cloud Run Gen2 `maxInstances`: `concierge` = `5` (`timeoutSeconds: 45`),
     `cloudCredit` = `3` (`timeoutSeconds: 15`).

## Deployment and rollback sequence

1. Re-fetch `gdg/main` and verify lint, tests, and production build on the exact
   release commit.
2. Record the rollback baseline: current active Firebase Hosting release
   version, `firestore.rules` SHA-256 hash, and live Cloud Run `maxScale` /
   concurrency settings.
3. Deploy decoupled Firebase layers separately (the `main`-branch GitHub Actions
   workflow deploys Hosting only):
   - Deploy reviewed `firestore.rules` (`firebase deploy --only firestore:rules`).
   - Deploy reviewed Cloud Functions (`concierge` and `cloudCredit`) so logging
     minimization, upgraded venue Wi-Fi rate limits, and Gen2 `maxInstances`
     caps are live.
   - Deploy Hosting (`firebase deploy --only hosting:gdg-warsaw-devfest26-web`
     or via `main` workflow) to publish `/privacy`, Y2K Card Hunt cloud sync,
     and the AI Concierge UI/routes.
4. Execute 3-way post-release live verification on `https://warsaw.devfest.pl/`
   (updated `/privacy`, Concierge API & rate-limit headers, OAuth/sync behavior
   with authorized test accounts, and live Cloud Run scaling caps) and monitor
   errors and cost.
5. **Post-event cleanup obligation:** Schedule and verify organizer cleanup of
   remaining `huntCollections` and `huntCollectionSessions` documents by **21
   December 2026 (`2026-12-21`)**.
6. **Rollback procedure:** Restore the previous Hosting release first and
   evaluate rules, functions, and any participant data separately with the
   owner; do not delete attendee data as a rollback shortcut.
