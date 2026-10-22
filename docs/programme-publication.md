# Confirmed 2026 programme publication

The CFP sheet and Program Doc remain the organiser's authority. The approved public
snapshot is `public/data/programme-2026.json`: 14 confirmed speakers, 10 sessions,
one five-person panel, CFP-043 only for Michał Tajchert, Wild / Head of AI for Yonatan.
No nationality, timetable or private review/contact fields are published.

## Hosting owns the public snapshot

Read-only queries on 22 October found production `speakers`, `sessions`,
`generatedSpeakers`, `generatedSessions`, `generatedSchedule` empty. Earlier preview
records/images persisted in Hosting files. The normal build now includes the public
snapshot and fingerprinted optimized portraits/logos; original sources/provenance
remain under `preview/` and are excluded from normal output.

`src/utils/published-programme.ts` reproduces generated speakers/sessions and empty
schedule before any corresponding Firestore subscription. Unrelated content and
production features retain their existing Firebase behavior. Editing programme
collections in Firestore will **not** change this published lineup: update the
reviewed public snapshot instead. Do not use `firestore:init` for publication.

The build validates approved IDs, counts, reciprocal panel roles, public field
allowlists and content-hashed local assets. Missing/malformed data displays an alert
without database fallback. Deliberately update approval guards for new confirmations.
Keep `disabledSchedule=true`; a timetable release needs an explicit adapter and
validation change, not simply a setting toggle.

## Preview verification and deployment

Run `npm run lint`, `npm test -- --runInBand`, `npm run build`. The ordinary `dist`
is served locally with:

```sh
node_modules/.bin/firebase emulators:start --only hosting --config firebase.programme-ready.json --project gdg-warsaw-devfest26-web
```

After verification, publish the **same** build to the authorised review channel:

```sh
node_modules/.bin/firebase hosting:channel:deploy programme-ready-2026 --config firebase.programme-ready.json --project gdg-warsaw-devfest26-web --expires 7d --no-authorized-domains
```

Loopback and the exact `programme-ready-2026` hostname use isolated operational SDKs
and disable sign-in, newsletter submissions, bookmarks, feedback, analytics and
service-worker registration. The review config adds a noindex header. Its URL is
public to anyone with the link. These guards do not disable normal production
behavior. Legacy build/hostname restrictions remain intact.

## Production gate and rollback

Human approval to merge `main` remains separate. The existing main workflow deploys
Hosting automatically; snapshot/assets publish together with no database, Functions,
rules or Auth-domain change. Verify live speaker/session links and hidden timetable.

Rollback restores the previous Hosting release and reverts the release commit through
the usual reviewed Git workflow. There is no programme database migration to undo.
Preserve unrelated partner, team and ticket data.

## Session discovery and portrait motion

The `/sessions/` route presents searchable confirmed talks and the shared panel
without timetable fields. Links from navigation, the homepage and the unpublished
schedule lead there. Search covers titles, full abstracts, speaker names and company
names; topic filters use existing tags. Filter state is shareable in the URL.

Yonatan’s original eight-second animation is delivered as a 198,458-byte animated
WebP (the original GIF is 1,405,612 bytes), with a separate static poster for
sharing, pausing and reduced-motion preferences. Pause controls are outside card
links. Original source media is preserved; the release has 26 fingerprinted assets.
