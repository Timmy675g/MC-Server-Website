import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

let lastStatusData = null;
let lastStatusTime = 0;
let lastUptimeData = null;
let lastUptimeTime = 0;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const allowedOrigins = String(process.env.CORS_ORIGINS || '*')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('CORS blocked origin')); 
    },
  }),
);

const PORT = Number(process.env.PORT || 3001);
const MC_SERVER_PORT = Number(process.env.MC_SERVER_PORT || 25565);
const BEDROCK_PORT = Number(process.env.BEDROCK_PORT || 19132);
const UPTIME_KUMA_STATUS_PAGE_URL = String(process.env.UPTIME_KUMA_STATUS_PAGE_URL || '').trim();
const UPTIME_KUMA_MONITOR_MINECRAFT = String(process.env.UPTIME_KUMA_MONITOR_MINECRAFT || '').trim();
const UPTIME_KUMA_MONITOR_VM = String(process.env.UPTIME_KUMA_MONITOR_VM || '').trim();

const hosts = String(process.env.MC_SERVER_HOSTS || '35.219.114.141')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const STATUS_CACHE_TTL_MS = 15_000;
const UPTIME_CACHE_TTL_MS = 20_000;

let cachedStatus = null;
let cachedStatusAt = 0;
let cachedUptime = null;
let cachedUptimeAt = 0;

function nowMs() {
  return Date.now();
}

async function fetchJson(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeJavaStatus(javaData, bedrockData) {
  const online = Boolean(javaData?.online);

  return {
    status: online ? 'online' : 'offline',
    playersOnline: Number(javaData?.players?.online ?? 0),
    playersMax: Number(javaData?.players?.max ?? 0),
    uptime: 0,
    javaPing: Number.isFinite(Number(javaData?.latency)) ? Number(javaData.latency) : null,
    bedrockPing: Number.isFinite(Number(bedrockData?.latency)) ? Number(bedrockData.latency) : null,
    version: javaData?.version?.name_clean || javaData?.version?.name_raw || javaData?.version?.name || undefined,
    software: Array.isArray(javaData?.motd?.clean) ? javaData.motd.clean.join(' ') : (javaData?.motd?.clean || undefined),
  };
}

function normalizePlayers(javaData) {
  const list = Array.isArray(javaData?.players?.list) ? javaData.players.list : [];
  return list.map((item) => ({
    username: String(item?.name_clean || item?.name_raw || item?.name || 'Unknown'),
    uuid: String(item?.uuid || ''),
  }));
}

function parseStatusPageSlug(urlString) {
  if (!urlString) return '';

  try {
    const parsed = new URL(urlString);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] || '';
  } catch {
    return '';
  }
}

function statusFromKumaHeartbeat(value) {
  if (value === 1) return 'operational';
  if (value === 2) return 'maintenance';
  if (value === 0) return 'outage';
  return 'degraded';
}

function toTimelineEntries(heartbeatList) {
  if (!Array.isArray(heartbeatList)) return [];

  return heartbeatList
    .map((entry) => {
      const ts = entry?.time || entry?.date || entry?.timestamp;
      const status = statusFromKumaHeartbeat(Number(entry?.status));
      return {
        ts: ts ? new Date(ts).toISOString() : new Date().toISOString(),
        status,
        label: entry?.msg || status,
      };
    })
    .slice(-96);
}

function summarizeUptime(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return { uptimePercent: null, incidentMinutes: null, incidentFreeStreakMinutes: null };
  }

  let up = 0;
  let down = 0;
  let streak = 0;

  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    const item = timeline[i];
    if (item.status === 'operational') {
      streak += 15;
    } else {
      break;
    }
  }

  timeline.forEach((item) => {
    if (item.status === 'operational') up += 1;
    else down += 1;
  });

  const total = up + down;
  const uptimePercent = total > 0 ? (up / total) * 100 : null;

  return {
    uptimePercent,
    incidentMinutes: down * 15,
    incidentFreeStreakMinutes: streak,
  };
}

async function getLiveStatus() {
  if (cachedStatus && nowMs() - cachedStatusAt < STATUS_CACHE_TTL_MS) return cachedStatus;

  const javaUrl = `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(hosts[0])}:${MC_SERVER_PORT}`;
  const bedrockUrl = `https://api.mcstatus.io/v2/status/bedrock/${encodeURIComponent(hosts[0])}:${BEDROCK_PORT}`;

  const [javaRes, bedrockRes] = await Promise.allSettled([
    fetchJson(javaUrl),
    fetchJson(bedrockUrl),
  ]);

  const javaData = javaRes.status === 'fulfilled' ? javaRes.value : null;
  const bedrockData = bedrockRes.status === 'fulfilled' ? bedrockRes.value : null;

  if (!javaData) {
    throw new Error('Unable to fetch Java server status');
  }

  const normalized = normalizeJavaStatus(javaData, bedrockData);

  cachedStatus = {
    ...normalized,
    players: normalizePlayers(javaData),
    source: 'mcstatus.io',
  };
  cachedStatusAt = nowMs();

  return cachedStatus;
}

async function getLiveUptime(range = '30d') {
  if (cachedUptime && nowMs() - cachedUptimeAt < UPTIME_CACHE_TTL_MS && cachedUptime?.range?.key === range) {
    return cachedUptime;
  }

  const slug = parseStatusPageSlug(UPTIME_KUMA_STATUS_PAGE_URL);
  if (!slug) {
    const fallback = {
      timezone: 'Asia/Jakarta',
      generatedAt: new Date().toISOString(),
      overrides: { source: 'fallback', note: 'UPTIME_KUMA_STATUS_PAGE_URL is not configured.' },
      range: { key: range },
      components: {
        minecraftServer: { status: 'unknown', label: 'Unknown', note: 'Missing status page URL' },
        virtualMachine: { status: 'unknown', label: 'Unknown', note: 'Missing status page URL' },
      },
      componentTimelines: { minecraftServer: [], virtualMachine: [], ipPulling: [] },
      stats: { uptimePercent: null, incidentMinutes: null, incidentFreeStreakMinutes: null },
      current: { status: 'unknown', label: 'Unknown' },
    };
    cachedUptime = fallback;
    cachedUptimeAt = nowMs();
    return fallback;
  }

  const url = new URL(UPTIME_KUMA_STATUS_PAGE_URL);
  const baseOrigin = `${url.protocol}//${url.host}`;

  const [summaryRes, heartbeatRes] = await Promise.allSettled([
    fetchJson(`${baseOrigin}/api/status-page/${slug}`),
    fetchJson(`${baseOrigin}/api/status-page/heartbeat/${slug}`),
  ]);

  const summary = summaryRes.status === 'fulfilled' ? summaryRes.value : {};
  const heartbeat = heartbeatRes.status === 'fulfilled' ? heartbeatRes.value : {};

  const hbList = heartbeat?.heartbeatList || {};
  const monitorMap = summary?.publicGroupList?.flatMap((group) => group?.monitorList || []) || [];

  const detectedMinecraftMonitor = monitorMap.find((monitor) =>
    /minecraft/i.test(String(monitor?.name || '')),
  );
  const detectedVmMonitor = monitorMap.find((monitor) =>
    /vm|virtual/i.test(String(monitor?.name || '')),
  );

  const minecraftMonitorId = Number(
    UPTIME_KUMA_MONITOR_MINECRAFT || detectedMinecraftMonitor?.id || 0,
  );
  const vmMonitorId = Number(UPTIME_KUMA_MONITOR_VM || detectedVmMonitor?.id || 0);

  const mcTimeline = toTimelineEntries(hbList[String(minecraftMonitorId)] || []);
  const vmTimeline = toTimelineEntries(hbList[String(vmMonitorId)] || []);

  const selectedTimeline = mcTimeline.length > 0 ? mcTimeline : vmTimeline;
  const summaryStats = summarizeUptime(selectedTimeline);

  const payload = {
    timezone: summary?.timezone || 'Asia/Jakarta',
    generatedAt: new Date().toISOString(),
    overrides: { source: 'uptime-kuma', note: 'Fetched from Uptime Kuma public status API.' },
    range: { key: range },
    components: {
      minecraftServer: {
        status: mcTimeline.at(-1)?.status || 'unknown',
        label: mcTimeline.at(-1)?.status || 'Unknown',
        note: 'Uptime Kuma monitor',
      },
      virtualMachine: {
        status: vmTimeline.at(-1)?.status || 'unknown',
        label: vmTimeline.at(-1)?.status || 'Unknown',
        note: 'Uptime Kuma monitor',
      },
      ipPulling: { status: 'operational', label: 'Operational', note: 'API reachable' },
    },
    componentTimelines: {
      minecraftServer: mcTimeline,
      virtualMachine: vmTimeline,
      ipPulling: [],
    },
    stats: summaryStats,
    current: {
      status: selectedTimeline.at(-1)?.status || 'unknown',
      label: selectedTimeline.at(-1)?.status || 'Unknown',
    },
  };

  cachedUptime = payload;
  cachedUptimeAt = nowMs();
  return payload;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'survivalkendy-api', time: new Date().toISOString() });
});

let lastRequestTime = 0;

app.get('/status', async (_req, res) => {
  const now = Date.now();
  
  // If we fetched data less than 10 seconds ago, just send the old one
  if (lastStatusData && (now - lastStatusTime < 10000)) {
    return res.json({ payload: lastStatusData });
  }

  try {
    const status = await getLiveStatus();
    lastStatusData = status;
    lastStatusTime = now;
    res.json({ payload: status });
  } catch (error) {
    res.status(502).json({
      payload: {
        status: 'offline',
        playersOnline: 0,
        playersMax: 0,
        uptime: 0,
        javaPing: null,
        bedrockPing: null,
        error: String(error?.message || error)
      }
    });
  }
});

app.get('/players', async (_req, res) => {
  try {
    const status = await getLiveStatus();
    res.json({
      status: status.status,
      source: status.source || 'mcstatus.io',
      playersOnline: status.playersOnline,
      playersMax: status.playersMax,
      players: Array.isArray(status.players) ? status.players : [],
    });
  } catch (error) {
    res.status(502).json({
      status: 'offline',
      source: 'fallback',
      playersOnline: 0,
      playersMax: 0,
      players: [],
      error: String(error?.message || error),
    });
  }
});

app.get('/uptime', async (req, res) => {
  const now = Date.now();
  if (lastUptimeData && (now - lastUptimeTime < 15000)) {
    return res.json({ payload: lastUptimeData });
  }

  try {
    const data = await getLiveUptime(req.query?.range || '30d');
    lastUptimeData = data;
    lastUptimeTime = now;
    res.json({ payload: data });
  } catch (error) {
    res.status(502).json({ payload: { status: 'error' } });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[api] listening on http://0.0.0.0:${PORT}`);
});
