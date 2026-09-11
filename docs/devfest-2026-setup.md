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
- Public organizer: GDG Warsaw / GDG Warszawa
- Ticketing and settlement: KOL.SKI sp. z o.o. (ticket sales, payments, invoices, refunds, and ticket-related complaints only)
- Event lead: Michał Jabłoński
- Planned capacity: 300 attendees

The public copy marks speakers and programme details as pending until the organizing team confirms them. Ticket types and current prices are mirrored from the live Evenea event into Firestore for the website cards.

The team seed uses the current organizer cards from the [GDG Warszawa community page](https://gdg.community.dev/gdg-warszawa/), checked on September 3, 2026. Their public Cloudinary avatars are stored locally under `public/images/team/` and displayed as square, cropped cards so the page does not depend on a third-party image request at runtime.

Campaign links are maintained in the shared [DevFest 2026 — UTM Campaign Links sheet](https://docs.google.com/spreadsheets/d/1rMFm3rLuqhTXvtpie_DsxE4Y2eJcJvRr8HQvh0qsUoA/edit?gid=0#gid=0). Use its ready-made links for LinkedIn, Instagram, newsletters, Bevy, and partner placements; do not create parallel UTM conventions in source code.

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

The Evenea event is published and public:

- Event ID: `376576`
- Draft URL: `https://app.evenea.pl/event/devfestwarsaw2026/`
- Embed source: `https://app.evenea.pl/event/devfestwarsaw2026/?out=1&source=event_iframe`

The website uses the official Evenea iframe source and resizer script generated in the organizer panel. The ticket cards remain visible as the catalogue, but their links stay on the website and scroll to the embedded registration form instead of opening a separate Evenea page. The public event page and the registration form were checked end-to-end on September 8, 2026. The existing 100% one-time Early Bird promotional code was accepted and reduced one Early Bird ticket from 49,00 zł to 0,00 zł in Evenea.

Public role split: GDG Warszawa is the public/community organizer of DevFest Warsaw 2026. KOL.SKI sp. z o.o. is used for ticketing and settlement only; keep it in the ticket-sales, payment, invoice, refund, complaint, and seller-information context, not in the public organizer or community description.

When a visitor clicks an available ticket card, the website passes Evenea's official `ticket[ID]=1` query parameter into the iframe. This opens the buyer-details step with the selected ticket and quantity 1 already prepared, while keeping the visitor on the DevFest page. The Evenea ticket IDs are mirrored in `docs/default-firebase-data.json` and the live Firestore `tickets` documents as `eveneaTicketId`. If an ID is missing, the embed falls back to the normal ticket selector and displays the manual next-step instructions. Later checkout and payment navigation remain controlled by Evenea.

The current sale-window handoff is deliberately non-overlapping: Regular tickets are sold through 6 November 2026 at 23:59, and LastBird tickets open on 7 November 2026 at 00:00 and run through the event start on 21 November 2026 at 09:00. This makes LastBird the final two calendar weeks before DevFest. Early Bird remains unchanged and ends on 30 September 2026 at 23:59.

`eveneaEmbed.published` is `true`, so the website loads the public Evenea registration iframe. Do not place organizer credentials or private access details in source control or public copy.

## Deployment

As of September 3, 2026, the static Hosting preview and Firestore rules/indexes are deployed and verified. The preview is available at:

- `https://gdg-warsaw-devfest26-web.web.app/`

Deploy the static preview and Firestore configuration to the 2026 Firebase project:

```bash
npm run build
npm exec -- firebase deploy --config firebase.preview.json --project=gdg-warsaw-devfest26-web --only hosting
npm exec -- firebase deploy --project=gdg-warsaw-devfest26-web --only firestore
```

The repository also contains the upstream `prerender` Cloud Function configuration. Deploying Functions currently requires upgrading the Firebase project to the Blaze (pay-as-you-go) plan; no billing upgrade was performed. Once that approval is available, deploy the complete configuration with:

```bash
npm exec -- firebase deploy --project=gdg-warsaw-devfest26-web --only hosting,firestore,functions
```

Publishing the Evenea event is a separate, human-approved action and must not be performed by the deployment command.
