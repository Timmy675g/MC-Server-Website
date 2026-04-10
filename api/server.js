import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { io } from 'socket.io-client';
import { status as statusJava, statusBedrock } from 'minecraft-server-util';
import 'dotenv/config';

const app = express();
app.use(express.json());

function envString(name, fallback) {
  const safeFallback = typeof fallback === 'string' ? fallback : '';
  if (!name) return safeFallback;
  const value = String(process.env[name] ?? '').trim();
  return value || safeFallback;
}

function envNumber(name, fallback) {
  const safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : 0;
  if (!name) return safeFallback;
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : safeFallback;
}

function getClientIp(req) {
  const cfConnectingIp = req.headers['cf-connecting-ip'];
  if (typeof cfConnectingIp === 'string' && cfConnectingIp.trim()) {
    return cfConnectingIp.trim();
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// Cloudflare + reverse-proxy safe. Express will honor forwarded headers,
// while rate-limit keyGenerator below prioritizes CF-Connecting-IP.
app.set('trust proxy', true);

const limiter = rateLimit({
  windowMs: envNumber('RATE_LIMIT_WINDOW_MS', 1 * 120 * 1000),
  limit: envNumber('RATE_LIMIT_LIMIT', 100),
  message: 'Too many requests, slow down!',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
});

app.use(limiter);

const allowedOrigins = envString('CORS_ORIGINS', '*')
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

const PORT = envNumber('PORT', 3001);
const MC_SERVER_HOST = envString('MC_SERVER_HOST', 'play.survivalkendy.systems');
const MC_SERVER_PORT = envNumber('MC_SERVER_PORT', 25565);
const BEDROCK_PORT = envNumber('BEDROCK_PORT', 19132);
const UPTIME_KUMA_STATUS_PAGE_URL = envString('UPTIME_KUMA_STATUS_PAGE_URL', '');
const UPTIME_KUMA_MONITOR_MINECRAFT = envString('UPTIME_KUMA_MONITOR_MINECRAFT', '');
const UPTIME_KUMA_MONITOR_VM = envString('UPTIME_KUMA_MONITOR_VM', '');
const STATUS_PROBE_TIMEOUT_MS = envNumber('STATUS_PROBE_TIMEOUT_MS', 6000);
const KUMA_URL = envString('KUMA_URL', '');
const KUMA_USER = envString('KUMA_USER', '');
const KUMA_PASS = envString('KUMA_PASS', '');
const KUMA_MONITOR_ID = envNumber('KUMA_MONITOR_ID', 1);
const KUMA_SOCKET_TIMEOUT_MS = envNumber('KUMA_SOCKET_TIMEOUT_MS', 10_000);

const STATUS_CACHE_TTL_MS = envNumber('STATUS_CACHE_TTL_MS', 15_000);
const UPTIME_CACHE_TTL_MS = envNumber('UPTIME_CACHE_TTL_MS', 20_000);

let cachedStatus = null;
let cachedStatusAt = 0;
let cachedUptime = null;
let cachedUptimeAt = 0;
const maintenanceState = {
  untilMs: 0,
  startedAt: null,
  durationKey: null,
};
let maintenanceExpiryTimer = null;

function nowMs() {
  return Date.now();
}

function clearMaintenanceState() {
  maintenanceState.untilMs = 0;
  maintenanceState.startedAt = null;
  maintenanceState.durationKey = null;
  cachedStatusAt = 0;
}

function getKumaSocketBaseUrl() {
  if (KUMA_URL) return KUMA_URL;
  if (!UPTIME_KUMA_STATUS_PAGE_URL) return '';

  try {
    const parsed = new URL(UPTIME_KUMA_STATUS_PAGE_URL);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
}

async function syncKumaMaintenance(active) {
  const socketBaseUrl = getKumaSocketBaseUrl();
  if (!socketBaseUrl || !KUMA_USER || !KUMA_PASS) {
    throw new Error('Kuma sync missing config. Ensure KUMA_URL, KUMA_USER, and KUMA_PASS are set.');
  }

  const action = active ? 'pauseMonitor' : 'resumeMonitor';
  const socket = io(socketBaseUrl, {
    transports: ['websocket'],
    reconnection: false,
    timeout: KUMA_SOCKET_TIMEOUT_MS,
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.disconnect();
      reject(new Error(`Kuma ${action} timed out.`));
    }, KUMA_SOCKET_TIMEOUT_MS + 2000);

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      socket.disconnect();
      if (error) reject(error);
      else resolve();
    };

    socket.on('connect_error', (error) => {
      finish(new Error(`Kuma connection failed: ${error?.message || String(error)}`));
    });

    socket.on('connect', () => {
      socket.emit('login', { username: KUMA_USER, password: KUMA_PASS }, (loginResult) => {
        const loginOk = loginResult === true
          || loginResult?.ok === true
          || loginResult?.status === 'ok'
          || loginResult?.token;

        if (!loginOk) {
          finish(new Error(`Kuma login failed: ${JSON.stringify(loginResult || {})}`));
          return;
        }

        socket.emit(action, KUMA_MONITOR_ID, (actionResult) => {
          const actionOk = actionResult === undefined
            || actionResult === null
            || actionResult === true
            || actionResult?.ok === true
            || actionResult?.status === 'ok';

          if (!actionOk) {
            finish(new Error(`Kuma ${action} failed: ${JSON.stringify(actionResult || {})}`));
            return;
          }

          finish(null);
        });
      });
    });
  });
}

function scheduleMaintenanceExpiry(delayMs) {
  if (maintenanceExpiryTimer) {
    clearTimeout(maintenanceExpiryTimer);
    maintenanceExpiryTimer = null;
  }

  maintenanceExpiryTimer = setTimeout(() => {
    void syncKumaMaintenance(false)
      .then(() => {
        clearMaintenanceState();
      })
      .catch((error) => {
        console.error('[api] Failed to resume Kuma monitor after maintenance TTL:', String(error?.message || error));
        maintenanceState.untilMs = nowMs() + 60_000;
        scheduleMaintenanceExpiry(60_000);
      });
  }, Math.max(1000, Number(delayMs) || 0));

  if (typeof maintenanceExpiryTimer?.unref === 'function') {
    maintenanceExpiryTimer.unref();
  }
}

function getMaintenanceSnapshot() {
  const now = nowMs();
  const active = Number(maintenanceState.untilMs) > now;

  if (!active) {
    maintenanceState.untilMs = 0;
    maintenanceState.startedAt = null;
    maintenanceState.durationKey = null;
  }

  return {
    active,
    mode: active ? 'maintenance' : 'normal',
    durationKey: maintenanceState.durationKey,
    startedAt: maintenanceState.startedAt,
    endsAt: active ? new Date(maintenanceState.untilMs).toISOString() : null,
    remainingMs: active ? Math.max(0, maintenanceState.untilMs - now) : 0,
  };
}

function applyMaintenanceToStatus(statusPayload) {
  const maintenance = getMaintenanceSnapshot();
  if (!maintenance.active) {
    return {
      ...statusPayload,
      maintenance,
    };
  }

  return {
    ...statusPayload,
    status: 'maintenance',
    maintenance: {
      ...maintenance,
      label: 'Maintenance Mode',
    },
  };
}

function parseMaintenanceDurationMs(durationKey, customMinutes) {
  const map = {
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
  };

  if (durationKey in map) return map[durationKey];
  if (durationKey !== 'custom') return 0;

  const safeCustom = Number(customMinutes);
  if (!Number.isFinite(safeCustom) || safeCustom <= 0) return 0;
  return Math.floor(safeCustom * 60 * 1000);
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

function normalizePlayers(javaData) {
  const list = Array.isArray(javaData?.players?.sample) ? javaData.players.sample : [];
  return list.map((item) => ({
    username: String(item?.name || 'Unknown'),
    uuid: String(item?.id || ''),
  }));
}

function normalizeStatusFromSettled(javaData, bedrockData, bedrockPingMs) {
  const javaOnline = Boolean(javaData);
  const bedrockOnline = Boolean(bedrockData);
  const online = javaOnline || bedrockOnline;

  return {
    status: online ? 'online' : 'offline',
    playersOnline: Number(javaData?.players?.online ?? bedrockData?.players?.online ?? 0),
    playersMax: Number(javaData?.players?.max ?? bedrockData?.players?.max ?? 0),
    uptime: 0,
    javaPing: Number.isFinite(Number(javaData?.roundTripLatency)) ? Number(javaData.roundTripLatency) : null,
    bedrockPing: Number.isFinite(Number(bedrockPingMs)) ? Number(bedrockPingMs) : null,
    version: javaData?.version?.name || bedrockData?.version?.name || undefined,
    software: javaData?.motd?.clean || bedrockData?.motd?.clean || undefined,
    java: {
      online: javaOnline,
      port: MC_SERVER_PORT,
      playersOnline: Number(javaData?.players?.online ?? 0),
      playersMax: Number(javaData?.players?.max ?? 0),
      ping: Number.isFinite(Number(javaData?.roundTripLatency)) ? Number(javaData.roundTripLatency) : null,
    },
    bedrock: {
      online: bedrockOnline,
      port: BEDROCK_PORT,
      playersOnline: Number(bedrockData?.players?.online ?? 0),
      playersMax: Number(bedrockData?.players?.max ?? 0),
      ping: Number.isFinite(Number(bedrockPingMs)) ? Number(bedrockPingMs) : null,
    },
  };
}

function buildOfflineStatus(errorMessage) {
  return {
    status: 'offline',
    playersOnline: 0,
    playersMax: 0,
    uptime: 0,
    javaPing: null,
    bedrockPing: null,
    version: undefined,
    software: undefined,
    java: {
      online: false,
      port: MC_SERVER_PORT,
      playersOnline: 0,
      playersMax: 0,
      ping: null,
    },
    bedrock: {
      online: false,
      port: BEDROCK_PORT,
      playersOnline: 0,
      playersMax: 0,
      ping: null,
    },
    players: [],
    source: 'minecraft-server-util',
    ...(errorMessage ? { error: errorMessage } : {}),
  };
}

function probeJavaStatus() {
  return statusJava(MC_SERVER_HOST, MC_SERVER_PORT, { timeout: STATUS_PROBE_TIMEOUT_MS, enableSRV: true });
}

async function probeBedrockStatus() {
  const startedAt = Date.now();
  const response = await statusBedrock(MC_SERVER_HOST, BEDROCK_PORT, { timeout: STATUS_PROBE_TIMEOUT_MS, enableSRV: true });
  return {
    data: response,
    ping: Date.now() - startedAt,
  };
}

function parseStatusPageSlug(urlString) {
  if (!urlString) return '';

  try {
    const parsed = new URL(urlString);
    const segments = parsed.pathname.split('/').filter(Boolean);

    // Supports:
    // - /status/<slug>
    // - /api/status-page/<slug>
    // - /api/status-page/heartbeat/<slug>
    const heartbeatIndex = segments.findIndex((segment) => segment === 'heartbeat');
    if (heartbeatIndex >= 0 && segments[heartbeatIndex + 1]) {
      return segments[heartbeatIndex + 1];
    }

    const statusPageIndex = segments.findIndex((segment) => segment === 'status-page');
    if (statusPageIndex >= 0 && segments[statusPageIndex + 1] && segments[statusPageIndex + 1] !== 'heartbeat') {
      return segments[statusPageIndex + 1];
    }

    const statusIndex = segments.findIndex((segment) => segment === 'status');
    if (statusIndex >= 0 && segments[statusIndex + 1]) {
      return segments[statusIndex + 1];
    }

    return segments[segments.length - 1] || '';
  } catch {
    // Fallback for plain slug / non-URL inputs.
    return String(urlString).trim().replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).pop() || '';
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

  const [javaRes, bedrockRes] = await Promise.allSettled([
    probeJavaStatus(),
    probeBedrockStatus(),
  ]);

  const javaData = javaRes.status === 'fulfilled' ? javaRes.value : null;
  const bedrockProbe = bedrockRes.status === 'fulfilled' ? bedrockRes.value : null;
  const bedrockData = bedrockProbe?.data ?? null;
  const bedrockPingMs = bedrockProbe?.ping ?? null;

  if (!javaData && !bedrockData) {
    const javaReason = javaRes.status === 'rejected' ? String(javaRes.reason?.message || javaRes.reason || 'Java status failed') : '';
    const bedrockReason = bedrockRes.status === 'rejected' ? String(bedrockRes.reason?.message || bedrockRes.reason || 'Bedrock status failed') : '';
    const offline = buildOfflineStatus(`Unable to fetch both Java and Bedrock status. ${javaReason} ${bedrockReason}`.trim());
    cachedStatus = offline;
    cachedStatusAt = nowMs();
    return offline;
  }

  const normalized = normalizeStatusFromSettled(javaData, bedrockData, bedrockPingMs);

  cachedStatus = {
    ...normalized,
    players: normalizePlayers(javaData),
    source: 'minecraft-server-util',
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
  res.json({
    ok: true,
    service: 'survivalkendy-api',
    time: new Date().toISOString(),
    maintenance: getMaintenanceSnapshot(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'survivalkendy-api',
    time: new Date().toISOString(),
    maintenance: getMaintenanceSnapshot(),
  });
});

app.get('/status', async (_req, res) => {
  try {
    const status = applyMaintenanceToStatus(await getLiveStatus());
    res.json({ payload: status });
  } catch (error) {
    res.json({ payload: applyMaintenanceToStatus(buildOfflineStatus(String(error?.message || error))) });
  }
});

app.get('/api/status', async (_req, res) => {
  try {
    const status = applyMaintenanceToStatus(await getLiveStatus());
    res.json({ payload: status });
  } catch (error) {
    res.json({ payload: applyMaintenanceToStatus(buildOfflineStatus(String(error?.message || error))) });
  }
});

app.get('/players', async (_req, res) => {
  try {
    const status = applyMaintenanceToStatus(await getLiveStatus());
    res.json({
      status: status.status,
      source: status.source || 'minecraft-server-util',
      playersOnline: status.playersOnline,
      playersMax: status.playersMax,
      players: Array.isArray(status.players) ? status.players : [],
    });
  } catch (error) {
    res.json({
      status: 'offline',
      source: 'fallback',
      playersOnline: 0,
      playersMax: 0,
      players: [],
      error: String(error?.message || error),
      maintenance: getMaintenanceSnapshot(),
    });
  }
});

app.get('/api/players', async (_req, res) => {
  try {
    const status = applyMaintenanceToStatus(await getLiveStatus());
    res.json({
      status: status.status,
      source: status.source || 'minecraft-server-util',
      playersOnline: status.playersOnline,
      playersMax: status.playersMax,
      players: Array.isArray(status.players) ? status.players : [],
      maintenance: status.maintenance,
    });
  } catch (error) {
    res.json({
      status: 'offline',
      source: 'fallback',
      playersOnline: 0,
      playersMax: 0,
      players: [],
      error: String(error?.message || error),
      maintenance: getMaintenanceSnapshot(),
    });
  }
});

app.get('/uptime', async (req, res) => {
  try {
    const data = await getLiveUptime(req.query?.range || '30d');
    res.json({ payload: data });
  } catch (error) {
    res.status(502).json({ payload: { status: 'error' } });
  }
});

app.get('/api/uptime', async (req, res) => {
  try {
    const data = await getLiveUptime(req.query?.range || '30d');
    res.json({ payload: data });
  } catch (error) {
    res.status(502).json({ payload: { status: 'error' } });
  }
});

app.post('/api/maintenance', (req, res) => {
  const enabled = req.body?.enabled !== false;
  const durationKey = String(req.body?.duration || '').trim();
  const durationMs = parseMaintenanceDurationMs(durationKey, req.body?.customMinutes);

  if (enabled && durationMs <= 0) {
    return res.status(400).json({
      error: 'Invalid maintenance duration. Use 5m, 15m, 1h, 24h, or custom + customMinutes.',
    });
  }

  const apply = async () => {
    await syncKumaMaintenance(enabled);

    if (!enabled) {
      if (maintenanceExpiryTimer) {
        clearTimeout(maintenanceExpiryTimer);
        maintenanceExpiryTimer = null;
      }
      clearMaintenanceState();
      return res.json({ payload: getMaintenanceSnapshot() });
    }

    maintenanceState.startedAt = new Date().toISOString();
    maintenanceState.untilMs = nowMs() + durationMs;
    maintenanceState.durationKey = durationKey;
    cachedStatusAt = 0;
    scheduleMaintenanceExpiry(durationMs);

    return res.json({ payload: getMaintenanceSnapshot() });
  };

  return apply().catch((error) => {
    return res.status(502).json({
      error: `Unable to sync maintenance state with Uptime Kuma: ${String(error?.message || error)}`,
    });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[api] listening on http://0.0.0.0:${PORT}`);
  if (UPTIME_KUMA_STATUS_PAGE_URL) {
    console.log(`[api] UPTIME_KUMA_STATUS_PAGE_URL loaded: ${UPTIME_KUMA_STATUS_PAGE_URL}`);
  } else {
    console.log('[api] UPTIME_KUMA_STATUS_PAGE_URL is missing or empty');
  }
});
