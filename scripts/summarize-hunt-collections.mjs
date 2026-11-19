/** Read-only, internal statistics. Raw account IDs and card text are never printed. */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import process from 'node:process';
import { getFirestore } from 'firebase-admin/firestore';
import { pathToFileURL } from 'node:url';

const entryIdPattern = /^(found|earned)_([a-z0-9]{7})$/;

function createSummary(minimum = 5) {
  if (!Number.isSafeInteger(minimum) || minimum < 2) throw new Error('Minimum must be at least 2');
  const counts = new Map();
  let accounts = 0;
  function add(data) {
    if (
      !data ||
      typeof data.entries !== 'object' ||
      data.entries === null ||
      Array.isArray(data.entries)
    )
      return;
    const cards = new Map();
    for (const [key, entry] of Object.entries(data.entries)) {
      const match = entryIdPattern.exec(key);
      if (
        !match ||
        !entry ||
        typeof entry !== 'object' ||
        entry.state !== match[1] ||
        entry.card?.id !== match[2]
      )
        continue;
      const id = match[2];
      const previous = cards.get(id);
      if (!previous || entry.state === 'earned') cards.set(id, entry.state);
    }
    if (!cards.size) return;
    accounts++;
    for (const [id, state] of cards) {
      const count = counts.get(id) ?? { found: 0, earned: 0 };
      count.found++;
      if (state === 'earned') count.earned++;
      counts.set(id, count);
    }
  }
  function result() {
    const suppress = (value) => (value < minimum ? `<${minimum}` : value);
    return {
      note: 'Internal opt-in account counts; not verified people, tickets, or proof of a visit. Card IDs are private.',
      suppressionThreshold: minimum,
      accountsWithAtLeastOneCard: suppress(accounts),
      cards: Object.fromEntries(
        [...counts.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([id, count]) => [
            id,
            { foundOrEarned: suppress(count.found), earned: suppress(count.earned) },
          ]),
      ),
    };
  }
  return { add, result };
}

export function summarizeCollections(documents, minimum = 5) {
  const summary = createSummary(minimum);
  for (const data of documents) summary.add(data);
  return summary.result();
}

async function main() {
  const args = process.argv.slice(2);
  const projectIndex = args.indexOf('--project');
  const projectId = projectIndex < 0 ? '' : args[projectIndex + 1];
  if (!projectId || !args.includes('--acknowledge-internal-data')) {
    throw new Error(
      'Specify --project PROJECT_ID and --acknowledge-internal-data. Read access to participant records requires prior authorization.',
    );
  }
  const app = initializeApp({ credential: applicationDefault(), projectId });
  const summary = createSummary();
  for await (const item of getFirestore(app).collection('huntCollections').stream()) {
    summary.add(item.data());
  }
  process.stdout.write(`${JSON.stringify(summary.result(), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
