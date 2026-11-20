# GCP Security & Billing Hardening Runbook — GDG DevFest Warsaw 2026

**Project:** `gdg-warsaw-devfest26-web` (project number `94592063137`, region `us-central1`, Firestore `(default)` in `europe-central2`)  
**Event Date:** Saturday, 21 November 2026 (09:00–21:30 Europe/Warsaw, ~300 attendees behind shared Google for Startups Campus Warsaw NAT)

> **Important:** Committing code changes to Git deploys **only Firebase Hosting** via GitHub Actions. Firestore rules, Cloud Functions, Monitoring policies, API key restrictions, TTL policies, and Billing Budgets require explicit CLI/Console deployment by an authorized operator (see `AGENTS.md`).

---

## 1. Layered Defense Summary

### Layer 1 — Application & Cloud Functions Guardrails (Code)

- **Anti-spoofing IP rate limiting (`functions/src/rate-limiter.ts`):** Uses the rightmost `X-Forwarded-For` IP (GFE-appended) instead of spoofable leftmost `X-Forwarded-For` / `fastly-client-ip`, writes `ttlAt` for Firestore TTL cleanup, and uses sharded global counters to avoid 1 write/sec single-document contention.
- **Concierge AI caps (`functions/src/concierge.ts`, `functions/src/concierge-handler.ts`):**
  - Gen2 scaling capped at `maxInstances: 3`, `concurrency: 15` (max 45 concurrent requests vs 400 previously), `memory: '512MiB'`, `timeoutSeconds: 35`, `cors: false`.
  - Gemini Live voice tokens (`mode: 'live-token'`) bounded with short `expireTime` (+90s), `newSessionExpireTime` (+30s), `maxOutputTokens: 256`, dedicated tighter rate limits (`60/15m` per IP, `10/15m` per client, `600/24h` global), and `CONCIERGE_LIVE_TOKEN_ENABLED` kill-switch.
  - Chat `max_output_tokens` capped at `1200`; audio transcription payload capped at `180,000` base64 chars; failover restricted to retryable HTTP/network errors (max 2 attempts); in-memory cache checked before global Firestore counters; rate-limiter failures fail closed with `503 { status: 'unavailable', fallback: 'local-a2ui' }`.
  - Request guardrails: `Content-Type: application/json` required (`415`), `Content-Length` bounded (`413`), foreign `Origin` rejected (`403`), `X-Content-Type-Options: nosniff`.
  - Kill-switches: `CONCIERGE_ENABLED=false`, `CONCIERGE_LIVE_TOKEN_ENABLED=false`, and optional `CONCIERGE_SHUTOFF_AT` ISO timestamp.
- **Cloud Credit & Card Hunt (`functions/src/cloud-credit.ts`, `hunt-functions/`):**
  - Gen2 scaling capped at `maxInstances: 2`, `concurrency: 40`, `memory: '128MiB'`, `timeoutSeconds: 5`, `cors: false`.
  - Rightmost-XFF in-memory rate limits on `?claim=1`, `/api/hunt/access` failed attempts, and `/api/hunt/card/:code`, plus `Origin` validation on `POST`, `Referrer-Policy: no-referrer`, and `X-Content-Type-Options: nosniff`.
- **Newsletter & Gen1 Functions (`functions/src/newsletter.ts`, `functions/src/index.ts`):**
  - Dead `prerender`, `mailchimpSubscribe`, and broken `optimizeImages` removed from source exports and deleted from GCP.
  - `registerNewsletterConsent` capped (`maxInstances: 2`, `timeoutSeconds: 15`), global rate limit (`300/hr`), 8s Resend timeout, hashed IP logging.
  - Remaining Gen1 triggers capped at `maxInstances: 1`.

### Layer 2 — Firestore Security Rules & Client Polling

- **Firestore rules (`firestore.rules`):**
  - Unused `potentialPartners` and hidden `notificationsSubscribers` / `notificationsUsers` locked to `allow read, write: if false;` (zero UX impact while `disabledSchedule: true`).
  - `featuredSessions` restricted to owner-only `get` (`allow list, write: if false;`), preserving legacy bookmark import while eliminating unbounded client map writes.
  - Wildcard `/{path=**}/feedback/{userId}` writes removed; direct `get`/`create`/`update`/`delete` scoped strictly to `/sessions/{sessionId}/feedback/{userId}` with `is int` ratings `0..5` and explicit `request.auth != null`.
  - `huntCollections` / `huntCollectionSessions` retain Google-only owner isolation, 64-entry cap, single-key diff validation, and atomic tombstone deletion.
- **Hosting & Preview isolation (`scripts/generate-pr-preview-config.mjs`, `firebase.*.json`):**
  - PR preview configs strip all Cloud Function rewrites (`/api/hunt/**`, `/api/concierge`, `/api/cloud-credit`), exclude `**/*.map`, and set `X-Robots-Tag: noindex, nofollow, noarchive`.
  - All 6 standalone `firebase.*.json` preview configs ignore `**/*.map` and enforce `X-Robots-Tag: noindex, nofollow, noarchive`.
- **Client polling reduction (`src/elements/cloud-credit-block.ts`, `src/pages/hunt-access-page.ts`):**
  - `cloud-credit-block` stops polling permanently once `status === 'closed'` and pauses its 30s timer whenever `document.hidden` is true (refreshing once on tab return).
  - `hunt-access-page` pauses its 20s locked-state poll whenever `document.hidden` is true (refreshing once on tab return while still locked).

### Layer 3 — GCP Infrastructure & Billing Guardrails (Operator CLI Actions)

Run these commands explicitly after human approval (none are run automatically by CI):

#### 3.1 Deploy Hardened Rules & Functions

```bash
# Deploy Firestore rules
npx firebase deploy --only firestore:rules --project gdg-warsaw-devfest26-web

# Deploy hardened Functions codebases
npx firebase deploy --only functions --project gdg-warsaw-devfest26-web
```

#### 3.2 Enable Firestore TTL on `functionsRateLimits.ttlAt`

```bash
gcloud firestore fields ttls update ttlAt \
  --collection-group=functionsRateLimits \
  --database="(default)" \
  --enable-ttl \
  --project=gdg-warsaw-devfest26-web \
  --quiet
```

#### 3.3 Restrict Firebase Browser API Key

```bash
gcloud services api-keys update \
  projects/94592063137/locations/global/keys/5037ab41-b596-4e61-91af-abb4a6064946 \
  --project=gdg-warsaw-devfest26-web \
  --allowed-referrers="https://warsaw.devfest.pl/*,https://gdg-warsaw-devfest26-web.web.app/*,https://gdg-warsaw-devfest26-web.firebaseapp.com/*" \
  --api-target=service=firestore.googleapis.com \
  --api-target=service=identitytoolkit.googleapis.com \
  --api-target=service=securetoken.googleapis.com \
  --api-target=service=firebaseinstallations.googleapis.com \
  --api-target=service=fcmregistrations.googleapis.com \
  --api-target=service=firebase.googleapis.com \
  --quiet
```

#### 3.4 Remove Public Access / Dead Legacy Infrastructure

```bash
# Lock down public preview function (or delete it)
gcloud run services remove-iam-policy-binding y2kcardhuntpreview \
  --region=us-central1 --project=gdg-warsaw-devfest26-web \
  --member=allUsers --role=roles/run.invoker --quiet

# Delete confirmed-dead Gen1 functions
gcloud functions delete prerender --region=us-central1 --project=gdg-warsaw-devfest26-web --quiet
gcloud functions delete mailchimpSubscribe --region=us-central1 --project=gdg-warsaw-devfest26-web --quiet
gcloud functions delete optimizeImages --region=us-central1 --project=gdg-warsaw-devfest26-web --quiet

# Pause every-5-min legacy notifications scheduler job
gcloud scheduler jobs pause firebase-schedule-scheduleNotifications-us-central1 \
  --location=us-central1 --project=gdg-warsaw-devfest26-web --quiet
```

#### 3.5 Create Cloud Monitoring Channel & 5 Alert Policies

```bash
# 1. Create email notification channel and copy returned channel name
gcloud beta monitoring channels create \
  --project=gdg-warsaw-devfest26-web \
  --display-name="DevFest26 Ops Email" \
  --description="Billing and function spike alerts" \
  --type=email \
  --channel-labels=email_address=<OPS_EMAIL> \
  --quiet

# 2. Deploy all 5 version-controlled alert policies
CHANNEL="projects/gdg-warsaw-devfest26-web/notificationChannels/<CHANNEL_ID>"
for f in infra/monitoring/alert-*.json; do
  gcloud monitoring policies create \
    --project=gdg-warsaw-devfest26-web \
    --policy-from-file="$f" \
    --notification-channels="$CHANNEL" \
    --quiet
done
```

#### 3.6 Billing Budgets (50% / 100% / 200% + External Gemini Project Check)

> **CRITICAL BLIND SPOT:** `generativelanguage.googleapis.com` is **not enabled** on `gdg-warsaw-devfest26-web`. The mounted `GEMINI_API_KEY` secret is almost certainly an AI Studio key owned by an external project (prime candidate under the owner account: `gen-lang-client-0096486553` `"Gemini API"`, which has `generativelanguage.googleapis.com` enabled). A budget filtered solely to `gdg-warsaw-devfest26-web` **will not alert on Gemini API spend**!

1. Verify in Google AI Studio / Cloud Console which `gen-lang-client-*` project owns the key stored in Secret Manager `GEMINI_API_KEY`, and check its Gemini API RPM/RPD quotas and spend cap.
2. Create billing budgets (at `50%`, `100%`, and `200%` of the planned event budget — e.g. `$50` / `$100` / `$200` thresholds or `percent=0.5, 1.0, 2.0` on a `$100` budget) covering **both** `gdg-warsaw-devfest26-web` and the Gemini API project (or the entire billing account):

```bash
# Inspect linked billing account
gcloud billing projects describe gdg-warsaw-devfest26-web --quiet

# Create budget linked to the monitoring notification channel
gcloud billing budgets create \
  --billing-account=<BILLING_ACCOUNT_ID> \
  --display-name="DevFest26 Event Guardrail (incl. Gemini)" \
  --budget-amount=100USD \
  --calendar-period=month \
  --filter-projects=projects/gdg-warsaw-devfest26-web,projects/<GEMINI_PROJECT_ID> \
  --threshold-rule=percent=0.5,basis=current-spend \
  --threshold-rule=percent=1.0,basis=current-spend \
  --threshold-rule=percent=1.0,basis=forecasted-spend \
  --threshold-rule=percent=2.0,basis=current-spend \
  --notifications-rule-monitoring-notification-channels="$CHANNEL" \
  --quiet
```

---

## 2. Event-Day Emergency Kill-Switches (21 November 2026)

### Tier 1 — Graceful Degrade (Zero Broken UI)

The Concierge widget automatically falls back to its built-in zero-cost local A2UI programme engine on `503`.

```bash
# 1A. Stop ONLY Gemini Live voice token minting (keeps text concierge + transcription working)
gcloud run services update concierge \
  --region=us-central1 --project=gdg-warsaw-devfest26-web \
  --update-env-vars="CONCIERGE_LIVE_TOKEN_ENABLED=false" --quiet

# 1B. Stop ALL Gemini AI calls (all queries fall back cleanly to local programme A2UI)
gcloud run services update concierge \
  --region=us-central1 --project=gdg-warsaw-devfest26-web \
  --update-env-vars="CONCIERGE_ENABLED=false" --quiet

# 1C. Re-enable after incident subsides
gcloud run services update concierge \
  --region=us-central1 --project=gdg-warsaw-devfest26-web \
  --update-env-vars="CONCIERGE_ENABLED=true,CONCIERGE_LIVE_TOKEN_ENABLED=true" --quiet
```

### Tier 2 — Hard Cutoff (Active Volumetric DDoS / Key Compromise)

```bash
# Revoke public invocation on any abused Gen2 Cloud Run service (concierge | cloudcredit | y2kcardhunt)
gcloud run services remove-iam-policy-binding <SERVICE_NAME> \
  --region=us-central1 --project=gdg-warsaw-devfest26-web \
  --member=allUsers --role=roles/run.invoker --quiet

# Revoke public invocation on Gen1 registerNewsletterConsent if flooded
gcloud functions remove-iam-policy-binding registerNewsletterConsent \
  --region=us-central1 --project=gdg-warsaw-devfest26-web \
  --member=allUsers --role=roles/cloudfunctions.invoker --quiet
```

If `GEMINI_API_KEY` compromise is suspected, immediately **restrict or delete/rotate the key in Google AI Studio / the owning `gen-lang-client-*` project**.

---

## 3. Post-Event Teardown Checklist

### Day After Event — Sunday, 22 November 2026

- [ ] **Disable Concierge AI backend** (or set `CONCIERGE_SHUTOFF_AT` / `CONCIERGE_ENABLED=false`, or revoke `allUsers` invoker on `concierge`) once live event Q&A is no longer required.
- [ ] **Retire `cloudCredit`:** Claim window closes 21 Nov 19:00 Warsaw time; revoke `allUsers` or delete the `cloudCredit` function after verifying static status/cleanup.
- [ ] **Delete remaining preview & legacy functions:** Confirm `y2kCardHuntPreview`, `prerender`, `mailchimpSubscribe`, `optimizeImages`, `sendGeneralNotification`, and `scheduleNotifications` (+ its Cloud Scheduler job) are deleted.
- [ ] **Verify Firestore TTL cleanup:** Confirm `functionsRateLimits` documents are expiring via `ttlAt`.
- [ ] **Review final billing & Gemini spend:** Check Cloud Billing for `gdg-warsaw-devfest26-web` **and** the external `GEMINI_API_KEY` AI Studio project; confirm zero unexpected residual charges.
- [ ] **Clean up temporary Hosting preview channels** (`firebase hosting:channel:list --project gdg-warsaw-devfest26-web`).

### Within 30 Days — By Monday, 21 December 2026 (Privacy Policy Commitment)

- [ ] Per `public/data/privacy.md`, with explicit human organizer authorization, delete remaining cloud-synced `huntCollections` and `huntCollectionSessions` documents.
- [ ] Optional follow-up before next edition: migrate Gen2/Gen1 functions off overprivileged default `roles/editor` service accounts onto per-function least-privilege SAs, and roll out Firebase App Check (CSP + client first, then server enforcement).

---

## 4. Live Applied GCP Guardrails Inventory (Verified 2026-11-20)

| Layer                            | Resource / ID                                                                                                     | Applied State                                                                                                                                                             |
| :------------------------------- | :---------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Billing Budget**               | `billingAccounts/0133C6-DF1C58-7A3274/budgets/a1d5f7ae-19a8-4bee-a2fe-b3338fa5d801`                               | `200 PLN/month` whole billing account; thresholds at `25%` (50), `30%` (60), `40%` (80), `50%` (100), `60%` (120), `80%` (160), `100%` (200) current + `100%` forecasted  |
| **Notification Channel**         | `projects/gdg-warsaw-devfest26-web/notificationChannels/17598715562944147331`                                     | Email (`michal.tomasz.jablonski@gmail.com`)                                                                                                                               |
| **Monitoring Policies**          | `6788716998235085192`, `2259271360548288357`, `1611316083678709545`, `2259271360548288832`, `5653499031331064681` | All 5 active (`Cloud Run >300/min`, `Cloud Run 5xx >15/5m`, `Gen1 exec >150/5m`, `Firestore writes >5000/5m`, `Firestore reads >50000/5m`)                                |
| **Cloud Quotas (`us-central1`)** | `c3996534-...`, `396002af-...`, `f2b89f84-...`, `22b0a55c-...`                                                    | Granted: Cloud Run & Cloud Functions capped at `20 vCPU` (`20000` millicores) and `10 GiB` memory                                                                         |
| **Browser API Key**              | `projects/94592063137/locations/global/keys/5037ab41-b596-4e61-91af-abb4a6064946`                                 | Restricted to 4 Hosting referrers + 6 Firebase client APIs                                                                                                                |
| **Firestore Rules & TTL**        | `firestore.rules` + `functionsRateLimits.ttlAt`                                                                   | Released live; TTL state `ACTIVE`                                                                                                                                         |
| **Cloud Functions & Scheduler**  | `concierge`, `cloudCredit`, `y2kCardHunt`, `registerNewsletterConsent`, Gen1 triggers                             | Hardened code deployed live; `prerender`/`mailchimpSubscribe`/`optimizeImages` deleted; `y2kcardhuntpreview` `allUsers` revoked; `scheduleNotifications` scheduler paused |
