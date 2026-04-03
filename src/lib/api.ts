import type { ApiEnvelope, ServerStatus, UptimeStats } from '../types/api';

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
    const data = await fetchJson<ApiEnvelope<ServerStatus> | ServerStatus>('/api/status');
    const payload = ((data as ApiEnvelope<ServerStatus>).payload ?? data) as ServerStatus;

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
    const data = await fetchJson<any>('/api/uptime?range=1d');
    return {
      uptimePercent: Number.isFinite(Number(data?.stats?.uptimePercent))
        ? Number(data.stats.uptimePercent)
        : null,
      currentStatus: String(data?.current?.status ?? 'unknown'),
      currentLabel: String(data?.current?.label ?? 'Unknown'),
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
      fetch('/api/players', { headers: { Accept: 'application/json' } }).catch(() => null),
    ]);
  };

  if (requestIdle) {
    requestIdle(prefetch, { timeout: 1800 });
    return;
  }

  window.setTimeout(prefetch, 600);
}
