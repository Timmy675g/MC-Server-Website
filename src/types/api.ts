export interface ServerStatus {
  status: string;
  playersOnline: number;
  playersMax: number;
  uptime: number;
  javaPing: number | null;
  bedrockPing: number | null;
  tps?: number | null;
  mspt?: number | null;
  source?: string;
  playerSampleAvailable?: boolean;
  players?: Array<{
    username?: string;
    fullName?: string;
    uuid?: string;
    headUrl?: string;
  }>;
  version?: string;
  software?: string;
}

export interface ApiEnvelope<T> {
  payload?: T;
}
