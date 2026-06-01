import type { ApiEnvelope, ServerStatus } from '../types/api';
import { apiUrl } from './api-base';
import { unwrapPayload } from './api-envelope';

const cache = new Map<string, Promise<unknown>>();

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} for ${url}`);
  }

  return response.json() as Promise<T>;
}

function withCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (cache.has(key)) {
    return cache.get(key) as Promise<T>;
  }

  const value = fetcher().catch((error) => {
    cache.delete(key);
    throw error;
  });

  cache.set(key, value as Promise<unknown>);
  return value;
}

export function getStatus(): Promise<ServerStatus> {
  return withCache('status', async () => {
    return fetchStatus();
  });
}

export async function fetchStatus(): Promise<ServerStatus> {
  const data = await fetchJson<ApiEnvelope<ServerStatus> | ServerStatus>(apiUrl('/status'));
  const payload = unwrapPayload<ServerStatus>(data, {
    status: 'offline',
    playersOnline: 0,
    playersMax: 0,
    uptime: 0,
    javaPing: null,
    bedrockPing: null,
    tps: null,
    mspt: null,
    players: [],
  });

  return {
    status: payload.status ?? 'offline',
    playersOnline: Number(payload.playersOnline ?? 0),
    playersMax: Number(payload.playersMax ?? 0),
    uptime: Number(payload.uptime ?? 0),
    javaPing: Number.isFinite(Number(payload.javaPing)) ? Number(payload.javaPing) : null,
    bedrockPing: Number.isFinite(Number(payload.bedrockPing)) ? Number(payload.bedrockPing) : null,
    tps: Number.isFinite(Number(payload.tps)) ? Number(payload.tps) : null,
    mspt: Number.isFinite(Number(payload.mspt)) ? Number(payload.mspt) : null,
    source: payload.source,
    playerSampleAvailable: Boolean(payload.playerSampleAvailable),
    players: Array.isArray(payload.players) ? payload.players : [],
    version: payload.version,
    software: payload.software,
  };
}

export async function warmHomeCritical(): Promise<void> {
  await Promise.allSettled([
    fetchStatus(),
    fetch(apiUrl('/players'), { headers: { Accept: 'application/json' }, cache: 'no-store' }),
  ]);
}

export function prefetchApiInBackground(): void {
  const requestIdle = (window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  }).requestIdleCallback;

  const prefetch = () => {
    void Promise.allSettled([
      getStatus(),
      fetch(apiUrl('/players'), { headers: { Accept: 'application/json' } }).catch(() => null),
    ]);
  };

  if (requestIdle) {
    requestIdle(prefetch, { timeout: 1800 });
    return;
  }

  window.setTimeout(prefetch, 600);
}
