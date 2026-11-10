import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, jest } from '@jest/globals';

const source = readFileSync('public/service-worker.js', 'utf8');

async function activate(cacheNames: string[]) {
  const callbacks = new Map<
    string,
    (event: { waitUntil: (promise: Promise<void>) => void }) => void
  >();
  const navigate = jest.fn(async (_url: string) => undefined);
  const foreignNavigate = jest.fn(async (_url: string) => undefined);
  const claim = jest.fn(async () => undefined);
  const remove = jest.fn(async (_name: string) => true);
  const self = {
    addEventListener: (
      name: string,
      callback: (event: { waitUntil: (promise: Promise<void>) => void }) => void,
    ) => callbacks.set(name, callback),
    skipWaiting: async () => undefined,
    location: { origin: 'https://warsaw.devfest.pl' },
    clients: {
      claim,
      matchAll: async () => [
        { url: 'https://warsaw.devfest.pl/schedule', navigate },
        { url: 'https://other.example/', navigate: foreignNavigate },
      ],
    },
  };
  runInNewContext(source, {
    self,
    URL,
    caches: { keys: async () => cacheNames, delete: remove },
  });
  let pending: Promise<void> | undefined;
  callbacks.get('activate')!({ waitUntil: (promise) => (pending = promise) });
  await pending;
  return { claim, navigate, foreignNavigate, remove };
}

describe('service worker cache recovery', () => {
  it('refreshes old event pages and removes only legacy precaches', async () => {
    const result = await activate(['workbox-precache-v2-site', 'images-cache']);
    expect(result.claim).toHaveBeenCalledTimes(1);
    expect(result.navigate).toHaveBeenCalledWith('https://warsaw.devfest.pl/schedule');
    expect(result.foreignNavigate).not.toHaveBeenCalled();
    expect(result.remove).toHaveBeenCalledTimes(1);
    expect(result.remove).toHaveBeenCalledWith('workbox-precache-v2-site');
  });

  it('does not reload a fresh visitor', async () => {
    const result = await activate([]);
    expect(result.claim).toHaveBeenCalledTimes(1);
    expect(result.navigate).not.toHaveBeenCalled();
    expect(result.remove).not.toHaveBeenCalled();
  });
});
