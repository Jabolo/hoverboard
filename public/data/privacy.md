## Privacy and newsletter communications

GDG DevFest Warsaw 2026 is a community-led event organized by Google Developer Groups Warsaw. This page explains the data handled directly through this event website.

## Who to contact

The public/community organizer and operational contact for this website and its newsletter registration is **GDG Warsaw organizers team**. GDG Warszawa is the independent, informal community behind the event. For privacy requests, consent questions, or community communication matters, contact [hello@gdgwarsaw.pl](mailto:hello@gdgwarsaw.pl).

Paid ticketing is a separate operational layer. KOL.SKI sp. z o.o. handles ticket sales and settlement, including payment processing, invoices, refunds, and ticket-related complaints. KOL.SKI is not the public/community organizer; the event is publicly organized by GDG Warszawa. Ticket-specific legal details are shown in the Evenea registration flow.

## Newsletter registration

Newsletter registration is separate from Google sign-in, event registration, ticketing, and platform membership. We collect the email address and optional name fields only after the newsletter checkbox is actively selected.

The checkbox covers community communications from GDG Warsaw and GDG Poland about DevFest, meetups, workshops, hackathons, CFPs, and related community initiatives. Event-service messages and ticketing confirmations remain separate communications from the relevant event platform.

The current legal basis for this marketing communication is consent. The consent record includes the source, consent wording version, timestamp, and the communication purpose so that the organizers can demonstrate what was accepted.

Subscription records are handled through this website's event infrastructure, which may include Firebase and Resend when newsletter delivery is configured. You can withdraw consent at any time by using the unsubscribe link in a central newsletter or by contacting [hello@gdgwarsaw.pl](mailto:hello@gdgwarsaw.pl).

## Where the data is stored

The website records are kept in the DevFest Firebase project. When newsletter delivery is configured, the consented contact may be synchronized to the Resend audience as the delivery provider. The delivery provider may process unsubscribe and delivery events for the central newsletter.

This website does not automatically subscribe a person to Bevy, Meetup, or Evenea. Those platforms remain separate communication channels with their own subscription and unsubscribe controls. Withdrawal from the central website newsletter applies to that channel; subscription settings on Bevy, Meetup, and Evenea must be changed in those services separately.

## Registration through Evenea

Ticket registration is provided in an embedded Evenea form. The public organizer is GDG Warszawa. KOL.SKI sp. z o.o. is the ticketing/sales entity used for paid registrations and handles payment, invoice, refund, and ticket-complaint operations. Evenea/EventLabs provides the registration platform and has its own privacy information. Review the seller details, ticket terms, refund/invoice information, and privacy notices shown in Evenea before submitting your registration.

## Analytics and cookies

This website uses Google Analytics 4 to understand visits, page usage, and the effectiveness of event promotion. Analytics is loaded only after you choose **Allow analytics** in the cookie notice. If you choose **Decline analytics**, the website does not load Google Analytics for your visit.

When enabled, Google Analytics may use first-party cookies such as `_ga` and `_ga_*` and process technical and usage information about your visit. We do not send names, email addresses, or ticket-registration details to Google Analytics. You can change your choice at any time with the **Cookie settings** control.

The event registration flow is provided by Evenea and has its own privacy information. The same Google Analytics property may be used on the Evenea event page; review the consent information shown there before completing registration.

## Y2K Card Hunt and optional cloud sync

You can play the Y2K Card Hunt locally in your browser without signing in. Found and revealed cards stay in local browser storage on your device.

If you optionally use Google Sign-In in **My Collection** to synchronize your cards across devices, Firebase Authentication processes your Google sign-in and Cloud Firestore (`europe-central2`) stores your Firebase account UID, found and revealed card IDs, card states, and timestamps (`huntCollections`), plus a revocation marker (`huntCollectionSessions`) if you delete your synced collection so stale devices cannot re-upload deleted cards. GDG Warszawa is the public organizer and [hello@gdgwarsaw.pl](mailto:hello@gdgwarsaw.pl) is the privacy contact for this feature; KOL.SKI sp. z o.o. handles paid Evenea ticketing only and is not involved in Card Hunt sync.

Organizers may compute aggregate statistics from opted-in collections to understand card activity. These counts are indicative only and do not verify event attendance, ticket entitlement, or prize eligibility.

You can stop syncing at any time in **My Collection** (which keeps your existing cloud copy and local browser cards), or delete your synced cloud collection immediately using **Delete synced cards** in **My Collection**. Deleting synced cards removes your cloud collection and records a revocation marker while keeping your browser-saved cards and your shared Firebase Authentication sign-in record separate. You can also request deletion at any time by contacting [hello@gdgwarsaw.pl](mailto:hello@gdgwarsaw.pl).

Any remaining cloud-synced card collections (`huntCollections`) and revocation markers (`huntCollectionSessions`) are scheduled for organizer deletion within **30 days after the event (by 21 December 2026)**.

## AI Concierge and voice input

Preset prompt chips in the AI Concierge run locally in your browser.

When you ask a custom question, activate voice input with your microphone, or check schedule conflicts, your question, voice input (when the microphone is activated), and saved-session IDs (used to check schedule conflicts) are sent to Google Gemini APIs (`gemini-3.5-flash-lite`, `gemini-3.6-flash`, and `gemini-3.5-transcribe-live` over ephemeral WebSocket tokens) or processed by your browser's speech recognition provider. Responses are generated by AI and may be inaccurate; verify essential event details with the organizers.

GDG DevFest Warsaw 2026 and the AI Concierge are intended for **adult attendees (18+)**. Please do not submit personal or sensitive information.

Short-lived caches exist only in memory (`store: false` is set on Gemini Interactions requests). Google and Firebase infrastructure process technical and security logs under their applicable terms.

## Community standards

DevFest is a community-led developer event hosted by Google Developer Groups. Our [Code of Conduct](/coc) applies to this event. We also follow the relevant Google Developer community guidance, including the [Google community and event resources](https://developers.google.com/community) and [Google Privacy Policy](https://policies.google.com/privacy).

Google's policies apply to Google services. This notice covers the event website, direct newsletter workflow, optional Card Hunt cloud sync, and AI Concierge described above; it does not replace the privacy notices of third-party services such as Evenea.
