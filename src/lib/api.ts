import type { ApiEnvelope, ServerStatus, UptimeStats } from '../types/api';
import { apiUrl } from './api-base';
import { unwrapPayload } from './api-envelope';

const cache = new Map<string, Promise<unknown>>();

type UptimeApiResponse = {
  stats?: {
    uptimePercent?: number | string | null;
  };
  current?: {
    status?: string | null;
    label?: string | null;
  };
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} for ${url}`);
  }

  const data = await response.json() as T;
  console.log('API Response:', data);
  return data;
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
    const data = await fetchJson<ApiEnvelope<ServerStatus> | ServerStatus>(apiUrl('/status'));
    const payload = unwrapPayload<ServerStatus>(data, {
      status: 'offline',
      playersOnline: 0,
      playersMax: 0,
      uptime: 0,
      javaPing: null,
      bedrockPing: null,
    });

    return {
      status: payload.status ?? 'offline',
      playersOnline: Number(payload.playersOnline ?? 0),
      playersMax: Number(payload.playersMax ?? 0),
      uptime: Number(payload.uptime ?? 0),
      javaPing: Number.isFinite(Number(payload.javaPing)) ? Number(payload.javaPing) : null,
      bedrockPing: Number.isFinite(Number(payload.bedrockPing)) ? Number(payload.bedrockPing) : null,
      version: payload.version,
      software: payload.software,
    };
  });
}

export function getUptime(): Promise<UptimeStats> {
  return withCache('uptime', async () => {
    const data = await fetchJson<ApiEnvelope<UptimeApiResponse> | UptimeApiResponse>(apiUrl('/uptime?range=1d'));
    const payload = unwrapPayload<UptimeApiResponse>(data, {
      stats: { uptimePercent: null },
      current: { status: 'unknown', label: 'Unknown' },
    });
    const uptimePercent = payload.stats?.uptimePercent;

    return {
      uptimePercent: Number.isFinite(Number(uptimePercent))
        ? Number(uptimePercent)
        : null,
      currentStatus: String(payload?.current?.status ?? 'unknown'),
      currentLabel: String(payload?.current?.label ?? 'Unknown'),
    };
  });
}

export async function warmHomeCritical(): Promise<void> {
  await Promise.allSettled([getStatus(), getUptime()]);
}

export function prefetchApiInBackground(): void {
  const requestIdle = (window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  }).requestIdleCallback;

  const prefetch = () => {
    void Promise.allSettled([
      getStatus(),
      getUptime(),
      fetch(apiUrl('/players'), { headers: { Accept: 'application/json' } }).catch(() => null),
    ]);
  };

  if (requestIdle) {
    requestIdle(prefetch, { timeout: 1800 });
    return;
  }

  window.setTimeout(prefetch, 600);
}
