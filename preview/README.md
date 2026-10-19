# Confirmed speakers local preview

Run `npm run preview:speakers` from the repository root. This builds `dist-preview/`
and serves it on loopback at `http://localhost:5002/speakers`. If that port is busy,
the command tries the next port through 5012 and prints the chosen URL. Stop with
Ctrl+C. Nothing is uploaded, deployed, or written to Firebase.

The source is `confirmed-speakers-2026/data.json` with maps named `speakers` and
`sessions`. Portrait files live in `confirmed-speakers-2026/photos/`; records refer
to `/preview/speakers/<filename>`. Source/provenance records are maintained beside
the data. Only data.json, portraits and company logos are copied to the preview build.

The 19 October LinkedIn review of all 12 speakers is recorded in
`confirmed-speakers-2026/linkedin-profile-sources.json`. Cards show the current
public professional role, company and an editorial highlight; profiles show a
source-backed third-person biography and a verified LinkedIn link. The existing
Wild/Stealth Startup company discrepancy remains recorded for organiser review.

The adapter requires 12 speakers and 8 sessions, validates references and local
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
