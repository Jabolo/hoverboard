# AGENTS.md — Hoverboard & GDG DevFest Warsaw System Operating Guidelines

This repository hosts the web application for **GDG DevFest Warsaw 2026** (built on Hoverboard).
All AI agents and developers operating in this codebase **MUST** follow these guidelines to prevent silent deployment failures, unsynced databases, and stale production data.

---

## 1. Architectural Model & Decoupled Layers

The production environment consists of **four decoupled layers**. Modifying code in Git does **NOT** automatically update all layers!

| Layer                        | Files / Source                                                                            | How It Deploys                                                                                 | Common Pitfall / Trap                                                                                                          |
| :--------------------------- | :---------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| **Frontend / Hosting**       | `src/`, `public/`, `dist/`, `scripts/generate-static-seo-pages.mjs`                       | Automatic via GitHub Actions on push to `main` (`firebase deploy --only hosting`)              | Thinking a git push deploys Firestore or Functions. It only deploys static web files!                                          |
| **Cloud Firestore (DB)**     | `docs/default-firebase-data.json`, live collections (`tickets`, `team`, `partners`, etc.) | **MANUAL / CLI ONLY**. <br>`GCLOUD_PROJECT=gdg-warsaw-devfest26-web npm run firestore:tickets` | **CRITICAL:** `default-firebase-data.json` is merely a local seed file. Editing it does NOT alter the live Firestore database! |
| **Cloud Functions**          | `functions/` (TypeScript backend, rate limiters, webhooks)                                | **MANUAL / CLI ONLY** via `firebase deploy --only functions`                                   | Committing changes to `functions/` does not deploy them. GitHub Actions skips functions!                                       |
| **Security Rules & Indexes** | `firestore.rules`, `firestore.indexes.json`                                               | **MANUAL / CLI ONLY** via `firebase deploy --only firestore:rules`                             | Writing a rule does not protect production until deployed to Firebase.                                                         |
| **External Integrations**    | Evenea (tickets/sales), Advocu (C4P), Google Docs (SSoT)                                  | Manual organizer panels / REST                                                                 | Sold-out tickets or closed C4P in external tools must be synced into Firestore manually.                                       |

---

## 2. Component-Specific Procedures

### A. Tickets & Pricing Updates (Evenea ⟷ Firestore)

1. Evenea is the financial authority. If a ticket pool sells out in Evenea:
   - Update `docs/default-firebase-data.json` with `available: false, soldOut: true, inDemand: false`.
   - **Immediately sync Firestore:**
     ```bash
     GCLOUD_PROJECT=gdg-warsaw-devfest26-web npm run firestore:tickets
     ```
   - Verify via REST API:
     ```bash
     curl -s "https://firestore.googleapis.com/v1/projects/gdg-warsaw-devfest26-web/databases/(default)/documents/tickets/000"
     ```
   - Never run `npm run firestore:init` in production unless you explicitly want to re-seed all collections (it can overwrite live speaker/schedule data).

### B. Cloud Functions Updates

1. Test locally: `npm --prefix functions test` or `npm run lint:types:functions`.
2. To deploy:
   ```bash
   npx firebase deploy --only functions --project gdg-warsaw-devfest26-web
   ```
3. Verify function health via Google Cloud / Firebase console or execution logs.

### C. Frontend / SEO / Pre-rendered Pages

1. Test build and lint: `npm run lint && npm test && npm run build`.
2. Push to `main` to trigger GitHub Actions, or manually deploy:
   ```bash
   npx firebase deploy --only hosting:gdg-warsaw-devfest26-web --project gdg-warsaw-devfest26-web
   ```

---

## 3. Mandatory "Definition of Done" & 3-Way Verification Protocol

**NEVER** declare a task completed simply because:

- A local file was edited,
- `git commit` / `git push` succeeded, or
- CI/CD passed.

For any change that alters user-facing or operational behavior, the agent **MUST** perform a **3-Way Verification**:

1. **Source / Platform Verification:** Verify the external dependency (Evenea status, C4P link, Google Doc).
2. **Infrastructure / DB Verification:** Inspect the live Firestore document via REST/CLI or verify the deployed Cloud Function.
3. **Live User Experience (E2E):** Test the actual production URL (`https://warsaw.devfest.pl/`) via Playwright, curl, or DOM evaluation to prove the end user sees the expected state.

If an action cannot be performed automatically (e.g. credentials missing, human approval needed), the agent **MUST** explicitly state:

> ⚠️ **PENDING ACTION:** The code is committed, but [Firestore / Cloud Functions / Deployment] has NOT been updated yet. Run `[command]` to apply changes.
