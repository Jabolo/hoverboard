# Y2K Arcade hub

Side-branch addition to the existing Y2K Card Hunt preview. No production, API, Firestore or timed-card configuration changes.

## Entry points

- `/y2k/`: dedicated hub, with highlighted desktop navigation and mobile drawer item.
- Home activity section and My Collection activity link point to the hub.
- The three already-public starter cards retain their original routes. The 19-card hunt, mystery slots, private physical finds and collection persistence remain unchanged.

## Activities

- Signal Catch, reused as a standalone demo. A perfect run shows a bonus transmission without writing a card stamp; card-route instances still preserve their stamps.
- Cache Memory: four pairs, keyboard/touch controls, turn count and restart. No identity collection, server score or prize entry.
- A rotating idea cartridge and source-backed game-building instructions. Playground scores and Card Hunt are explicitly separate from challenge submissions and the Quest draw.

## Content source and release limits

Activities document: https://docs.google.com/document/d/17E0FzzIl3OnFJU2VR_05NA9Ujz2Wl8BYROKpOIoON0k/edit

The document establishes browser-playable public links, clear controls, any coding tools including AI, GDG Warsaw LinkedIn community judging, closing-presentation results and swag. It does not provide a submission URL or operational voting instructions. The hub says those are pending rather than creating a fake form or vote button.

Before production: confirm submission URL, detailed voting process and deadlines; complete the existing physical QR/NFC and timed-card acceptance checklist. Production rollout remains a separate approval.

## Verification

- `npm run lint` (existing warnings may remain).
- `npm test -- --runInBand`.
- `node --test hunt-functions/handler.test.js`.
- `npm run build`.
- `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/verify-y2k-ui.mjs [preview-origin]` (Chrome installed; local hunt configuration in `hunt-functions/.env`). Exercises 1440, 390 and 320 px layouts, reduced motion, games and reset races, prompt rotation, real card reveal, back/reload, and mobile navigation. Saves screenshots in `/tmp`.

Use only the existing `node scripts/deploy-hunt-preview.mjs hosting` channel flow for review. Do not run `npm run deploy` or push `main` for preview work.
