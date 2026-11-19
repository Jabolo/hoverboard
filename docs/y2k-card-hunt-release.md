# Y2K Card Hunt: release handoff

This is a preparation, not release approval. Do not merge or push this change to
`main` until the organizer explicitly approves production: the existing main
workflow automatically deploys Hosting. QR printing and NFC programming remain
on hold until their separate physical-production gate is lifted.

## Inputs and prerequisites

- Confirm the project, Hosting site, operator identity and currently live
  Hosting release and function revisions. Record the previous Hosting release
  for rollback. Preserve `cloudCredit` and the existing preview function.
- Review the private organizer plan and its existing 12-card catalog; retain
  every ID and approve the event-day windows. Do not put catalog content,
  physical IDs or secret values in Git, public assets, logs or this runbook.
- Provision a production Secret Manager secret named
  `HUNT_PHYSICAL_CARDS_PRODUCTION` containing that validated catalog, with
  access restricted to the production function's runtime identity. Use an
  approved private input and avoid command-line arguments, logs and shell
  history for its value. Secret creation, IAM changes and versioning are
  production changes requiring separate approval. This task has not performed
  them.
- Production and preview use distinct configuration. The dedicated preview
  deliberately does not route Cloud credit requests to the live backend.
  Generic PR previews omit the production Hunt API rewrite; their Hunt UI
  therefore cannot validate production card behavior.

## Release, only after approval

1. Run `npm ci --prefix hunt-functions --ignore-scripts`,
   `npm test --prefix hunt-functions`, `npm run lint`, `npm test`, and
   `npm run build` against the exact release commit. Resolve failures before
   proceeding.
2. Deploy only the production Hunt function from that reviewed commit, with
   the approved project explicitly selected:

   ```sh
   npx firebase deploy --only functions:hunt-preview:y2kCardHunt --project gdg-warsaw-devfest26-web
   ```

   Verify the deployment and runtime secret access before releasing Hosting.
   Do not deploy all functions: the preview and existing functions have their
   own configuration and lifecycle.

3. After approval and successful function verification, publish the reviewed
   frontend and Hosting configuration using the existing main release workflow.
   Pushing to main triggers production Hosting; it does not deploy Functions.
4. Verify `/y2k/`, `/hunt/`, direct card links with and without trailing slash,
   API catalog and card responses, preview-only IDs being rejected, and the
   existing `/api/cloud-credit` route. Test the approved time windows at both
   boundaries and verify all 12 private mappings without publishing the list.
   Use appropriate authorized test data and do not claim or consume any
   attendee benefit. Test actual iPhone and Android flows separately.
5. Only after a separate physical-production go-ahead and successful live
   checks, produce and decode a real-size QR proof and write one NFC sample;
   validate both phones before a batch. The preview URL expires and must not
   be encoded for the event.

## Rollback

Restore the recorded prior Firebase Hosting release first, then verify the
existing landing, programme and Cloud credit route. Assess the production Hunt
function and secret separately; roll back or remove only those resources if
explicitly authorized, after checking that no deployed site depends on them.
Do not delete the shared preview function, Cloud credit function or their
configuration. Record the restored release and verification results.

Links are shareable and browser progress stays on the same browser and origin;
the server time check is not an authentication or anti-sharing mechanism.
