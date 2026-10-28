# Confirmed 2026 programme publication

The CFP sheet and Program Doc remain the organiser's authority. The approved public
snapshot is `public/data/programme-2026.json`: 16 confirmed speakers, 12 sessions,
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

Yonatan’s verified Google avatar is delivered from its native 800×800 source.
The animated WebP delivers 512×512 pixels and preserves source frame cadence at quality 95,
loops continuously, as requested by the organiser. A sharp final-frame
poster is used for reduced motion, social metadata and static thumbnails. No visible
portrait play/pause control is rendered. Live changes to the system's motion
preference are respected. Original source media is retained locally; source URL,
processing and hashes are recorded in `preview/confirmed-speakers-2026/yonatan-animation.json`.

## Sponsor speaker confirmation — 22 October 2026

Arek Borucki is confirmed for the 30-minute technical talk selected by MongoDB.
His public session URL is `/sessions/scaling-hugging-face-hub/`; the private
coordination ID remains `SPONSOR-001`. Previous preview URLs redirect permanently
to the neutral public URL. He is presented as a regular technical speaker, without
a sponsored-talk label. His professional affiliation is Hugging Face, with the role
ML Platform & Database Engineer. The organiser's complete title and abstract are
preserved. Language, audience level and technical requirements were not supplied.
No timetable allocation was added.

The private CFP sheet records the confirmation and contact; Source of Truth and
Program & Agenda record the programme addition. Public profile, biography, original
LinkedIn portrait and official Hugging Face logo sources are documented in
`preview/confirmed-speakers-2026/arek-source.json`. The older MongoDB Champion
directory's STACKIT role is stale relative to his LinkedIn, personal website and
MongoDB's current interview; those agree on Hugging Face.

This addition is authorised for the `programme-ready-2026` review channel only.
Production publication and merging remain separate decisions.

## Production release approval — 22 October 2026

The organiser explicitly approved merging, pushing and deploying the verified
programme to the public domain. Keep the schedule unpublished. The normal Hosting
release includes all 15 confirmed speakers and 11 sessions; no programme database
import, Functions deployment, rules change or timetable publication is required.

## Speaker prominence — 23 October 2026

The landing-page speaker showcase follows the hero directly, ahead of the event
overview, tickets, partners and schedule. The hero scroll affordance leads to the
speaker section. Yonatan’s portrait loops continuously, with a static portrait for
reduced-motion preferences and no visible play/pause button.

## Panel replacement — 28 October 2026

The organiser confirmed that Sergiy Mokiyenko is unavailable and will not speak.
Igor Kachura, General Manager at Wix, replaces him on PANEL-01. Serhii Kasianchuk
remains a panellist; the roster stays 15 speakers and 11 sessions. Igor's verified
LinkedIn profile and portrait, and the official Wix logo, are recorded in
`preview/confirmed-speakers-2026/igor-source.json`. The timetable remains unpublished.

## Kasper Kulikowski — 28 October 2026

The organiser confirmed Kasper's participation and authorised publication of his
English talk, The Agentic Web. The submitted abstract is retained. His LinkedIn
profile and the portrait used by JS Poland are linked in
`preview/confirmed-speakers-2026/kasper-source.json`; Google's author portrait
confirms the same identity. His exact focus, duration, time and room remain to be
agreed. No timetable or additional unconfirmed workshop is published.
