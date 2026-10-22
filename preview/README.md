# Confirmed speakers local preview

Run `npm run preview:speakers` from the repository root. This builds `dist-preview/`
and serves it on loopback at `http://localhost:5002/speakers`. If that port is busy,
the command tries the next port through 5012 and prints the chosen URL. Stop with
Ctrl+C. Nothing is uploaded, deployed, or written to Firebase.

The source is `confirmed-speakers-2026/data.json` with maps named `speakers` and
`sessions`. Portrait files live in `confirmed-speakers-2026/photos/`; records refer
to `/preview/speakers/<filename>`. Source/provenance records are maintained beside
the data. Only data.json, portraits and company logos are copied to the preview build.

The 19 October LinkedIn review of the original 12 speakers is recorded in
`confirmed-speakers-2026/linkedin-profile-sources.json`. Cards show the current
public professional role, company and an editorial highlight; profiles show a
source-backed third-person biography and a verified LinkedIn link. On 20 October, the organiser selected Stealth Startup for Yonatan, using his
current LinkedIn identity. A distinct verified company logo is unavailable.

The adapter requires 14 speakers and 10 sessions, validates references and local
portrait URLs, embeds speakers on sessions, and links sessions back to speakers.
It copies only public profile/session fields. Timetable fields are omitted and
the generated schedule is empty. Missing or malformed data shows an alert and
never falls back to the production programme.

Safety boundaries:

- The build sets `SPEAKERS_PREVIEW=1`; the browser also requires a loopback hostname.
- Preview SDK operations use the isolated `demo-devfest-speakers-preview` project
  and local emulator endpoints. Write actions fail before invoking an SDK.
- Unrelated public content (partners, previous speakers, tickets, etc.) uses the
  existing production Firestore read subscriptions through a separate app.
- Account, bookmark, newsletter, feedback and notification actions are disabled;
  analytics and Firebase Performance are disabled. No service worker is built or
  registered. The server permits GET/HEAD only and rejects non-loopback Host headers.
- The preview remains separate from `dist/`. Normal `npm run build` does not copy
  the preview records or portraits, and its existing publication settings remain.

For a build without serving: `npm run preview:speakers -- --build-only`.
To serve an already-built preview: `npm run preview:speakers -- --serve-only`.
The server is a local static preview server and must not be deployed.

## Shareable speaker review

The organiser authorised a separate Hosting review channel on 19 October 2026.
The branch includes the latest CFP review wording, homepage section order and
seven-person event team from origin/main, alongside the confirmed speaker fixtures.

Run `npm run build:speakers-review` to create `dist-review/`. This uses the explicit
`review` build mode, which permits only the Firebase `speakers-review-2026` channel
hostname. Local mode still requires loopback. Production hosts are rejected by
review builds, and normal builds exclude preview records and portraits.

Only use the following command after the build and checks pass:

```sh
node_modules/.bin/firebase hosting:channel:deploy speakers-review-2026 --config firebase.speakers-review.json --project gdg-warsaw-devfest26-web --expires 7d --no-authorized-domains
```

This config contains Hosting only and serves `dist-review/`. The command does not
deploy to the live channel or change Firebase Auth authorised domains. Do not use
`firebase deploy` or `hosting:clone` for this review. No Git push is required.

The URL is accessible to anyone who has it, expires after seven days, and is marked
noindex. It keeps local speaker/session fixtures, an empty schedule, disabled
analytics, and blocked account/bookmark/newsletter writes. Other public event
content uses existing read subscriptions. No production programme data is imported.

## Speaker card comparison (20 October 2026)

`npm run build:speakers-comparison` creates `dist-review-v2/`, gated to the
`cards-v2-2026` channel hostname. It keeps the original review channel intact.
After all implementation and verification are complete, deploy only with:

```sh
node_modules/.bin/firebase hosting:channel:deploy cards-v2-2026 --config firebase.speakers-comparison.json --project gdg-warsaw-devfest26-web --expires 7d --no-authorized-domains
```

The comparison adds linked session titles on cards, panel participation roles,
short highlights, 800×800 LinkedIn portraits for Ivan and Çalgan, Yonatan’s
selected current company, and a stable featured homepage selection. Source
portrait files are retained; current provenance is in `portrait-v2-sources.json`.
No schedule or production publication is authorised by this comparison.

## Confirmed Tomasz addition (20 October 2026)

The organiser confirmed Tomasz Porożyński and approved one selected session,
CFP-028. Current local/new preview roster is 13 speakers and 9 sessions.
Source details: `confirmed-speakers-2026/tomek-source.json`; original portrait
and company logo provenance: `tomek-asset-sources.json`. Timetable stays unpublished.
The yellow preview banner is removed; failure alerts and safeguards are retained.

`npm run build:speakers-tomek` builds `dist-review-tomek/` with mode `tomek`,
which permits only the `speakers-tomek-2026` Hosting channel hostname. Deploy only
this new channel after verification, using `firebase.speakers-tomek.json` and
`--no-authorized-domains`; preserve both earlier hosted previews. Original review
and comparison build modes retain their 12/8 roster guards and require the
original fixture revision. No Git push or production publication is authorised.

## Michał Tajchert confirmed (22 October 2026)

Current hosted/local roster: 14 speakers and 10 sessions. Selected CFP-043 only;
CFP row43 is Confirmed, while his other proposal in row42 remains pending.
See `confirmed-speakers-2026/tajchert-source.json` and `tajchert-assets.json`.
Use the existing `build:speakers-tomek` and Hosting configuration to refresh only
`speakers-tomek-2026`; production and earlier previews stay unchanged.

## Merge-ready programme candidate (22 October 2026)

The current candidate uses the normal production build and public snapshot, not
legacy fixtures. See [programme publication](../docs/programme-publication.md) for
source ownership, validation, exact preview-only deployment and rollback. Legacy
preview descriptions above are historical; their existing hosted releases remain
unchanged. Production merge/publication still requires an explicit human decision.
