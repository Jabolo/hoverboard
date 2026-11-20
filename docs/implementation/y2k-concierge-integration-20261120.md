# Y2K and Concierge integration review — 20 November 2026

Status: integrated locally for review; **not released**. This document records a
snapshot, not authorization to release future changes.

## Scope and source

The integration starts with local Concierge `55e44dce`, which contains production
GitHub main `2cea6b0b`, and merges scratch refinement `9e54de8d` and cloud
collection `69f6457b`. The `firebase.json` conflict was resolved by retaining
both the Firebase Auth frame origin and the Concierge WebSocket connection
policy, as well as the routes for both features. The floating Concierge dialog
needed its pointer events restored; otherwise its controls could not be clicked.
The integration worktree does not modify the other checkouts.

## Evidence and limits

- Production build, full Jest suite (65 suites, 289 tests passed, five skipped)
  and lint passed. Lint reports existing warnings.
- Scratch interaction verification passed at 320, 390 and 1440 pixels, including
  touch, keyboard, reduced motion, persistence and simulated server failure.
- A combined browser check verifies card reveal, collection and floating
  Concierge controls at those widths with external network calls blocked.
- Firestore/Auth emulator checks passed for isolation, rules, counts, device
  synchronization, revocation and stale offline writes. Real Google sign-in,
  synchronization across two Chrome sessions and controlled deletion passed
  against the dedicated test project. A physical phone and real offline stale
  writes were not tested.
- Production Firestore rules matched the unmodified main baseline when checked;
  cloud collection rules are not deployed. Production Hosting did not route
  `/api/concierge` when checked. The active Concierge function source matched
  the integration branch, but live voice, production OAuth and end-to-end
  production behavior were not verified.
- The test project retains the authorized test Auth user and a disabled
  revocation marker. See `y2k-cloud-collection.md` for the previous production
  Auth configuration exposure and required security-owner assessment.

## Release gates and sequence

The explicit request to deploy does not settle the outstanding privacy and
security decisions. The public privacy page does not describe these new data
flows; the legal controller, legal basis, retention and request process remain
unresolved. The security and billing owner must review abuse limits, operations
and the previously exposed Auth configuration material. See
`y2k-privacy-review.md` and `y2k-cloud-collection.md` for the concrete draft and
remaining gates. Concierge prompts and voice processing also require appropriate
attendee-facing review. Do not publish the optional sync until these gates are
satisfied.

Once the owner has settled the gates, re-fetch GitHub main and other agreed
branches and repeat verification on the exact release commit. Verify the
production OAuth provider, domains, policy and function configuration; record the
current Hosting release and Firestore rules. Deploy the reviewed Firestore rules
and Hosting as separate operations: the main-branch workflow deploys Hosting
only. Verify both features and authorized test accounts after release, and watch
errors and cost. For rollback, restore the previous Hosting release first and
review rules and any participant data separately; do not delete attendee data as
a rollback shortcut. The already-deployed Concierge function need not be
redeployed if its verified source and configuration still match the release.
