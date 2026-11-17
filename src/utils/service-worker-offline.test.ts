import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, jest } from '@jest/globals';

type EventLike = {
  request: { method: string; mode: string; url: string };
  respondWith: (response: Promise<unknown>) => void;
};

function makeWorker(networkFails: boolean) {
  const callbacks = new Map<string, (event: EventLike) => void>();
  const saved = { text: 'saved offline programme' };
  const cache = { match: jest.fn(async (_path: string) => saved) };
  const fetch = jest.fn(async () => {
    if (networkFails) throw new Error('offline');
    return { text: 'live page' };
  });
  const self = {
    location: { origin: 'https://warsaw.devfest.pl' },
    addEventListener: (name: string, callback: (event: EventLike) => void) =>
      callbacks.set(name, callback),
  };
  runInNewContext(readFileSync('public/service-worker.js', 'utf8'), {
    self,
    URL,
    fetch,
    caches: { open: async () => cache },
    Response: { error: () => ({ error: true }) },
  });
  return { callbacks, fetch, cache, saved };
}

function request(worker: ReturnType<typeof makeWorker>, url: string, mode = 'navigate') {
  let result: Promise<unknown> | undefined;
  worker.callbacks.get('fetch')!({
    request: { method: 'GET', mode, url },
    respondWith: (promise) => (result = promise),
  });
  return result;
}

describe('offline programme service worker', () => {
  it('uses the network for navigation when available', async () => {
    const worker = makeWorker(false);
    await expect(request(worker, 'https://warsaw.devfest.pl/schedule')).resolves.toEqual({
      text: 'live page',
    });
    expect(worker.cache.match).not.toHaveBeenCalled();
  });

  it('offers the saved programme only when navigation fails offline', async () => {
    const worker = makeWorker(true);
    await expect(request(worker, 'https://warsaw.devfest.pl/schedule')).resolves.toBe(worker.saved);
    expect(worker.cache.match).toHaveBeenCalledWith('/offline.html');
  });

  it('does not intercept data requests or other origins', () => {
    const worker = makeWorker(true);
    expect(request(worker, 'https://warsaw.devfest.pl/api/cloud-credit', 'cors')).toBeUndefined();
    expect(request(worker, 'https://warsaw.devfest.pl/api/cloud-credit?claim=1')).toBeUndefined();
    expect(request(worker, 'https://other.example/', 'navigate')).toBeUndefined();
    expect(worker.fetch).not.toHaveBeenCalled();
  });
});
