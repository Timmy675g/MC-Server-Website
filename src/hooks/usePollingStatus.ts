import { useEffect, useState } from 'react';
import { fetchStatus } from '../lib/api';
import type { ServerStatus } from '../types/api';

const POLL_INTERVAL_MS = 10000;
const MOBILE_POLL_INTERVAL_MS = 15000;
const STALE_AFTER_MS = 25000;

type PollingStatusState = {
  status: ServerStatus | null;
  isLoading: boolean;
  isError: boolean;
  isStale: boolean;
  lastUpdatedAt: number | null;
  lastError: string | null;
};

const listeners = new Set<() => void>();

let state: PollingStatusState = {
  status: null,
  isLoading: true,
  isError: false,
  isStale: false,
  lastUpdatedAt: null,
  lastError: null,
};

let pollTimer: number | null = null;
let freshnessTimer: number | null = null;
let inFlight = false;

function isConstrainedClient(): boolean {
  if (typeof window === 'undefined') return false;

  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };

  return (
    window.matchMedia('(max-width: 980px)').matches
    || window.matchMedia('(pointer: coarse)').matches
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || Boolean(nav.connection?.saveData)
    || (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4)
    || (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 6)
  );
}

function currentPollIntervalMs() {
  return isConstrainedClient() ? MOBILE_POLL_INTERVAL_MS : POLL_INTERVAL_MS;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function setState(next: Partial<PollingStatusState>) {
  state = { ...state, ...next };
  emit();
}

function computeStale(now = Date.now()) {
  return state.isError || (state.lastUpdatedAt !== null && now - state.lastUpdatedAt > STALE_AFTER_MS);
}

async function pollStatus() {
  if (inFlight) return;
  if (typeof document !== 'undefined' && document.hidden) return;

  inFlight = true;
  if (!state.status) setState({ isLoading: true });

  try {
    const status = await fetchStatus();
    setState({
      status,
      isLoading: false,
      isError: false,
      isStale: false,
      lastUpdatedAt: Date.now(),
      lastError: null,
    });
  } catch (error) {
    setState({
      isLoading: false,
      isError: true,
      isStale: Boolean(state.status),
      lastError: error instanceof Error ? error.message : 'Status polling failed.',
    });
  } finally {
    inFlight = false;
  }
}

function startPolling() {
  void pollStatus();

  if (pollTimer === null) {
    pollTimer = window.setInterval(() => {
      void pollStatus();
    }, currentPollIntervalMs());
  }

  if (freshnessTimer === null) {
    freshnessTimer = window.setInterval(() => {
      const stale = computeStale();
      if (stale !== state.isStale) {
        setState({ isStale: stale });
      } else {
        emit();
      }
    }, 1000);
  }
}

function stopPolling() {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }

  if (freshnessTimer !== null) {
    window.clearInterval(freshnessTimer);
    freshnessTimer = null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  startPolling();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopPolling();
    }
  };
}

export function formatStatusAge(lastUpdatedAt: number | null, now = Date.now()): string {
  if (!lastUpdatedAt) return 'not updated yet';
  const seconds = Math.max(0, Math.floor((now - lastUpdatedAt) / 1000));
  if (seconds < 1) return 'just now';
  if (seconds === 1) return '1 second ago';
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
}

export function usePollingStatus() {
  const [, forceRender] = useState(0);

  useEffect(() => subscribe(() => forceRender((value) => value + 1)), []);

  return {
    ...state,
    lastUpdatedLabel: formatStatusAge(state.lastUpdatedAt),
    pollIntervalMs: currentPollIntervalMs(),
  };
}
