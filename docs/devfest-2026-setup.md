# GDG DevFest Warsaw 2026 setup

This project is based on the current `gdg-x/hoverboard` `main` branch. The previous DevFest Warsaw 2023 implementation is preserved separately in Git:

- branch: `archive/devfest-2023`
- tag: `devfest-2023-baseline`
- 2026 working branch: `devfest-2026`
- upstream remote: `https://github.com/gdg-x/hoverboard.git`

## Event

- Name: GDG DevFest Warsaw 2026
- Date: November 21, 2026
- Venue: Google for Startups Campus Warsaw, Plac Konesera 10, 03-736 Warszawa
- Organizer: GDG Warsaw
- Event lead: Michał Jabłoński
- Planned capacity: 300 attendees

The public copy intentionally marks speakers, programme, ticket types, and pricing as pending until the organizing team confirms them.

## Firebase

The application uses the Firebase project `gdg-warsaw-devfest26-web` under the Michał Tomasz Jabłoński account.

- Firestore database: `(default)`
- Firestore region: `europe-central2`
- Hosting preview: `https://gdg-warsaw-devfest26-web.web.app/`
- Firebase Web App ID: `1:94592063137:web:e2f2bfa581d0222a6b82e0`

The local `.firebaserc` is intentionally ignored by Git and points to the 2026 project. Do not commit Firebase credentials, service-account JSON files, or API tokens.

Firestore seed data is kept in `docs/default-firebase-data.json`. The import uses Application Default Credentials and requires the target project to be explicit:

```bash
GCLOUD_PROJECT=gdg-warsaw-devfest26-web npm run firestore:init
```

## Evenea

The private Evenea draft was created for integration testing:

- Event ID: `376576`
- Draft URL: `https://app.evenea.pl/event/devfestwarsaw2026/`
- Embed source: `https://app.evenea.pl/event/devfestwarsaw2026/?out=1&source=event_iframe`

The event remains a draft and is not published. The website uses the official Evenea iframe source and resizer script generated in the organizer panel. Before publication, replace the preview ticket with the final ticket types and confirm the public event state.

## Deployment

As of September 3, 2026, the static Hosting preview and Firestore rules/indexes are deployed and verified. The preview is available at:

- `https://gdg-warsaw-devfest26-web.web.app/`

Deploy the static preview and Firestore configuration to the 2026 Firebase project:

```bash
npm run build
npm exec -- firebase deploy --project=gdg-warsaw-devfest26-web --only hosting,firestore
```

The repository also contains the upstream `prerender` Cloud Function configuration. Deploying Functions currently requires upgrading the Firebase project to the Blaze (pay-as-you-go) plan; no billing upgrade was performed. Once that approval is available, deploy the complete configuration with:

```bash
npm exec -- firebase deploy --project=gdg-warsaw-devfest26-web --only hosting,firestore,functions
```

Publishing the Evenea event is a separate, human-approved action and must not be performed by the deployment command.
