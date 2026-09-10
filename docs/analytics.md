# DevFest analytics and consent model

This document is the implementation contract for the DevFest Warsaw 2026 website. The public-facing explanation is [Privacy & newsletter](../public/data/privacy.md).

## Collection model

- The website uses one consent-aware GA4 implementation in `src/utils/analytics.ts`.
- The website stream is `G-6H09QP1YCQ`.
- Firebase Analytics is not used. `src/firebase.ts` initializes Firebase services required by the site, but does not call `getAnalytics`.
- The page does not send an automatic GA4 page view. After **Allow analytics**, the code sends one explicit `page_view`; subsequent custom events are sent only while consent is granted.
- The Evenea page has its own GA4 integration. Keep the Evenea stream separate from the website stream when comparing traffic sources.

## Website event contract

| Event                | Trigger                                                  | Important parameters                                                                  |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `page_view`          | Initial page view after analytics consent                | `page_location`, `page_path`, `page_title`                                            |
| `registration_start` | Opening the registration form or selecting a ticket card | `entry_point`; ticket fields when available                                           |
| `ticket_selected`    | Selecting an available ticket card                       | `ticket_id`, `ticket_name`, `ticket_tier`, `ticket_price`, `ticket_currency`, `items` |

The website intentionally does not emit a fake `purchase` event. Completed purchases are handled by Evenea. Compare website intent (`registration_start`, `ticket_selected`) with Evenea registrations and revenue using the UTM/source records.

## Attribution

The website reads UTM parameters and preserves them for the session in `src/utils/attribution.ts`. Campaign links should point to `https://warsaw.devfest.pl/` and use the campaign registry maintained for DevFest 2026. Do not add personal data to UTM values.

## Newsletter consent

The footer checkbox is required before the callable `registerNewsletterConsent` can persist a contact. The server validates:

- `consentGiven === true`;
- `consentSource === "devfest_website"`;
- `consentVersion === "2026-09-10"`.

The consent record is written to Firestore and then synchronized to Resend when the provider secret is configured. Existing Resend global unsubscribes remain suppressed. The local test suite covers the validation contract; it deliberately does not submit a real address to the provider.

## Verification

Run from the repository root:

```sh
npm test -- --runInBand
npm run lint:types:web
npm run lint:types:functions
npm run lint:prettier
npm run build
```

For a live smoke test, open a fresh browser session, accept analytics, click the registration CTA, open the Evenea embed, and confirm in GA4 Realtime that `page_view` and `registration_start` are present. Do not submit a ticket or newsletter address during the smoke test.
