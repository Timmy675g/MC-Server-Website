import type { ServerStatus } from '../types/api';

const ARCHIVE_STATUS: ServerStatus = {
  status: 'offline',
  playersOnline: 0,
  playersMax: 0,
  uptime: 0,
  javaPing: null,
  bedrockPing: null,
  tps: null,
  mspt: null,
  source: 'Archive Mode',
  playerSampleAvailable: false,
  players: [],
};

type PollingStatusState = {
  status: ServerStatus | null;
  isLoading: boolean;
  isError: boolean;
  isStale: boolean;
  lastUpdatedAt: number | null;
  lastError: string | null;
};

const state: PollingStatusState = {
  status: ARCHIVE_STATUS,
  isLoading: false,
  isError: false,
  isStale: true,
  lastUpdatedAt: null,
  lastError: null,
};

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
  return {
    ...state,
    lastUpdatedLabel: 'archive snapshot',
    pollIntervalMs: 0,
  };
}
