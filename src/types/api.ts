export interface ServerStatus {
  status: string;
  playersOnline: number;
  playersMax: number;
  uptime: number;
  javaPing: number | null;
  bedrockPing: number | null;
  version?: string;
  software?: string;
}

export interface UptimeStats {
  uptimePercent: number | null;
  currentStatus: string;
  currentLabel: string;
}

export interface ApiEnvelope<T> {
  payload?: T;
}
