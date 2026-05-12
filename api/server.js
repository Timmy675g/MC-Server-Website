import express from 'express';
import rateLimit from 'express-rate-limit';
import { io } from 'socket.io-client';
import { status as statusJava, statusBedrock } from 'minecraft-server-util';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });
console.log('DB_NAME Check:', process.env.DB_NAME ? 'Found' : 'NOT FOUND');

const app = express();
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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

app.use(express.json());

const limiter = rateLimit({
  windowMs: envNumber('RATE_LIMIT_WINDOW_MS', 1 * 120 * 1000),
  limit: envNumber('RATE_LIMIT_LIMIT', 100),
  message: 'Too many requests, slow down!',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  skip: (req) => req.method === 'OPTIONS',
});

app.use(limiter);

const PORT = envNumber('PORT', 3001);
const MC_SERVER_HOST = envString('MC_SERVER_HOST', 'play.survivalkendy.systems');
const SERVER_IP = envString('SERVER_IP', '167.71.220.58');
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
const ADMIN_USERNAME = envString('ADMIN_USERNAME', '');
const ADMIN_SECRET = envString('ADMIN_SECRET', '');
const MYSQL_HOST = envString('MYSQL_HOST', envString('DB_HOST', ''));
const MYSQL_HOST_FALLBACK = envString('MYSQL_HOST_FALLBACK', envString('DB_HOST_FALLBACK', ''));
const MYSQL_PORT = envNumber('MYSQL_PORT', 3306);
const MYSQL_USER = envString('MYSQL_USER', envString('DB_USER', ''));
const MYSQL_PASSWORD = envString('MYSQL_PASSWORD', envString('DB_PASS', ''));
const MYSQL_DATABASE = envString('MYSQL_DATABASE', envString('DB_NAME', 'survivalkendy_db'));
const MYSQL_CONNECT_TIMEOUT_MS = envNumber('MYSQL_CONNECT_TIMEOUT_MS', 2200);
const APPLICATIONS_TABLE = envString('APPLICATIONS_TABLE', 'applications');
const AUTO_WAITLIST_INTERVAL_MS = envNumber('AUTO_WAITLIST_INTERVAL_MS', 60_000);

const STATUS_CACHE_TTL_MS = envNumber('STATUS_CACHE_TTL_MS', 15_000);
const UPTIME_CACHE_TTL_MS = envNumber('UPTIME_CACHE_TTL_MS', 20_000);

let cachedStatus = null;
let cachedStatusAt = 0;
let cachedUptime = null;
let cachedUptimeAt = 0;
const applicationsPools = new Map();
let activeMySqlHost = null;
let applicationsSchemaReady = false;
let autoWaitlistTimer = null;
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

function parseMySqlHosts() {
  const hostList = [
    ...String(MYSQL_HOST || '').split(','),
    ...String(MYSQL_HOST_FALLBACK || '').split(','),
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return Array.from(new Set(hostList));
}

const MYSQL_HOSTS = parseMySqlHosts();

function isMySqlConnectionError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    code === 'PROTOCOL_CONNECTION_LOST'
    || code === 'ER_SERVER_SHUTDOWN'
    || code === 'ECONNREFUSED'
    || code === 'ECONNRESET'
    || code === 'ETIMEDOUT'
    || code === 'EHOSTUNREACH'
    || code === 'ENETUNREACH'
    || message.includes('read etimedout')
    || message.includes('connect etimedout')
    || message.includes('connection lost')
  );
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

function isSafeIdentifier(value) {
  return /^[A-Za-z0-9_]+$/.test(String(value || ''));
}

function getApplicationsTableName() {
  return isSafeIdentifier(APPLICATIONS_TABLE) ? APPLICATIONS_TABLE : 'applications';
}

function hasMySqlConfig() {
  return Boolean(MYSQL_HOSTS.length > 0 && MYSQL_USER && MYSQL_PASSWORD && MYSQL_DATABASE);
}

function getOrCreateApplicationsPool(host) {
  if (applicationsPools.has(host)) return applicationsPools.get(host);

  const pool = mysql.createPool({
    host,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: MYSQL_CONNECT_TIMEOUT_MS,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
  });

  applicationsPools.set(host, pool);
  return pool;
}

async function canUsePool(pool) {
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          clearTimeout(timeoutId);
          reject(new Error('MySQL probe timeout'));
        }, Math.max(1200, MYSQL_CONNECT_TIMEOUT_MS));
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function getApplicationsPool() {
  if (!hasMySqlConfig()) {
    throw new Error('MySQL is not configured. Set MYSQL_HOST(+MYSQL_HOST_FALLBACK)/MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE (or DB_HOST/DB_USER/DB_PASS/DB_NAME).');
  }

  const orderedHosts = activeMySqlHost
    ? [activeMySqlHost, ...MYSQL_HOSTS.filter((host) => host !== activeMySqlHost)]
    : [...MYSQL_HOSTS];

  for (const host of orderedHosts) {
    const pool = getOrCreateApplicationsPool(host);
    const healthy = await canUsePool(pool);
    if (!healthy) continue;
    if (activeMySqlHost !== host) {
      activeMySqlHost = host;
      console.log(`[api] MySQL active host: ${host}`);
    }
    return pool;
  }

  throw new Error(`Unable to connect to MySQL hosts within timeout (${MYSQL_CONNECT_TIMEOUT_MS}ms): ${MYSQL_HOSTS.join(', ')}`);
}

async function executeApplicationsQuery(sql, params = [], options = {}) {
  const allowRetry = options.allowRetry !== false;

  const pool = await getApplicationsPool();

  try {
    return await pool.execute(sql, params);
  } catch (error) {
    if (!allowRetry || !isMySqlConnectionError(error)) {
      throw error;
    }

    // Force host re-selection and retry once on alternate host.
    const failedHost = activeMySqlHost;
    activeMySqlHost = null;
    if (failedHost) {
      console.warn(`[api] MySQL host failed (${failedHost}), retrying on fallback host.`);
    }

    const retryPool = await getApplicationsPool();
    return await retryPool.execute(sql, params);
  }
}

async function ensureApplicationsSchema() {
  if (applicationsSchemaReady) return;

  const table = getApplicationsTableName();
  const createSql = `
    CREATE TABLE IF NOT EXISTS \`${table}\` (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(255) NOT NULL,
      discord_tag VARCHAR(100) NOT NULL,
      grade VARCHAR(50) NOT NULL DEFAULT '',
      school VARCHAR(255) NOT NULL DEFAULT '',
      invited_by VARCHAR(255) NOT NULL DEFAULT '',
      reason TEXT NOT NULL,
      agreement_confirmed TINYINT(1) NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_applications_username_created_at (username, created_at),
      INDEX idx_applications_status_created_at (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

  await executeApplicationsQuery(createSql);
  await executeApplicationsQuery(`ALTER TABLE \`${table}\` ADD COLUMN IF NOT EXISTS grade VARCHAR(50) NOT NULL DEFAULT ''`);
  await executeApplicationsQuery(`ALTER TABLE \`${table}\` ADD COLUMN IF NOT EXISTS school VARCHAR(255) NOT NULL DEFAULT ''`);
  await executeApplicationsQuery(`ALTER TABLE \`${table}\` ADD COLUMN IF NOT EXISTS invited_by VARCHAR(255) NOT NULL DEFAULT ''`);
  await executeApplicationsQuery(`ALTER TABLE \`${table}\` ADD COLUMN IF NOT EXISTS agreement_confirmed TINYINT(1) NOT NULL DEFAULT 0`);
  await executeApplicationsQuery(`ALTER TABLE \`${table}\` ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'Pending'`);
  await executeApplicationsQuery(`ALTER TABLE \`${table}\` ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`);

  applicationsSchemaReady = true;
}

async function autoWaitlist() {
  await ensureApplicationsSchema();

  const table = getApplicationsTableName();
  const sql = `
    UPDATE \`${table}\`
    SET status = 'Waitlist'
    WHERE status = 'Pending'
      AND created_at < (NOW() - INTERVAL 1 HOUR)
  `;

  const [result] = await executeApplicationsQuery(sql);
  return Number(result?.affectedRows || 0);
}

function scheduleAutoWaitlist() {
  if (!hasMySqlConfig()) {
    console.log('[api] Application DB not configured, skipping autoWaitlist scheduler.');
    return;
  }

  const tick = async () => {
    try {
      const changed = await autoWaitlist();
      if (changed > 0) {
        console.log(`[api] autoWaitlist moved ${changed} applications to Waitlist.`);
      }
    } catch (error) {
      console.error('[api] autoWaitlist failed:', String(error?.message || error));
    }
  };

  void tick();
  autoWaitlistTimer = setInterval(() => {
    void tick();
  }, Math.max(10_000, AUTO_WAITLIST_INTERVAL_MS));

  if (typeof autoWaitlistTimer?.unref === 'function') {
    autoWaitlistTimer.unref();
  }
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

function normalizeStatusFromMcstatus(data) {
  const online = Boolean(data?.online);
  const playersOnline = Number(data?.players?.online ?? 0);
  const playersMax = Number(data?.players?.max ?? 0);

  return {
    status: online ? 'online' : 'offline',
    playersOnline,
    playersMax,
    uptime: 0,
    javaPing: null,
    bedrockPing: null,
    version: data?.version?.name || data?.version?.name_clean || undefined,
    software: data?.software || undefined,
    java: {
      online,
      port: MC_SERVER_PORT,
      playersOnline,
      playersMax,
      ping: null,
    },
    bedrock: {
      online: false,
      port: BEDROCK_PORT,
      playersOnline: 0,
      playersMax: 0,
      ping: null,
    },
  };
}

async function fetchMcstatusStatus() {
  const url = `https://api.mcstatus.io/v2/status/java/${SERVER_IP}`;
  return fetchJson(url, STATUS_PROBE_TIMEOUT_MS);
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

  try {
    const mcstatusData = await fetchMcstatusStatus();
    const normalized = normalizeStatusFromMcstatus(mcstatusData);

    cachedStatus = {
      ...normalized,
      players: [],
      source: 'mcstatus.io',
    };
    cachedStatusAt = nowMs();

    return cachedStatus;
  } catch (error) {
    const offline = buildOfflineStatus(String(error?.message || error || 'mcstatus.io status failed'));
    cachedStatus = offline;
    cachedStatusAt = nowMs();
    return offline;
  }
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

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '').trim();

  if (!ADMIN_USERNAME || !ADMIN_SECRET) {
    return res.status(503).json({ ok: false, message: 'Admin login is not configured on the server.' });
  }

  if (username !== ADMIN_USERNAME || password !== ADMIN_SECRET) {
    return res.status(401).json({ ok: false, message: 'Invalid credentials.' });
  }

  return res.json({ ok: true, username: ADMIN_USERNAME });
});

async function submitApplication(req, res) {
  const username = String(req.body?.username || '').trim();
  const discordTag = String(req.body?.discord_tag || '').trim();
  const grade = String(req.body?.grade || '').trim();
  const school = String(req.body?.school || '').trim();
  const invitedBy = String(req.body?.invited_by || '').trim();
  const reason = String(req.body?.reason || '').trim();
  const agreementConfirmed = req.body?.agreement_confirmed === true;

  if (!username || !discordTag || !grade || !school || !invitedBy || !reason) {
    return res.status(400).json({
      error: 'username, discord_tag, grade, school, invited_by, and reason are required.',
    });
  }

  if (!agreementConfirmed) {
    return res.status(400).json({
      error: 'agreement_confirmed must be true to submit an application.',
    });
  }

  if (
    username.length > 255
    || discordTag.length > 100
    || grade.length > 50
    || school.length > 255
    || invitedBy.length > 255
  ) {
    return res.status(400).json({ error: 'One or more fields are too long.' });
  }

  try {
    await ensureApplicationsSchema();

    const table = getApplicationsTableName();

    // Reject duplicate submissions for the same username unless the
    // most recent application was Declined (in which case the user is
    // allowed to re-apply). Otherwise admin decisions on the earlier
    // row would be overwritten by a stale Pending duplicate appearing
    // "newer" in lookups.
    const existingSql = `
      SELECT id, status
      FROM \`${table}\`
      WHERE username = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `;
    const [existingRows] = await executeApplicationsQuery(existingSql, [username]);
    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
    const existingStatus = String(existing?.status || '').toLowerCase();

    if (existing && existingStatus !== 'declined') {
      return res.status(409).json({
        error: `An application for "${username}" already exists with status "${existing.status}". Please wait for it to be reviewed, or contact an admin.`,
        status: existing.status,
        id: Number(existing.id || 0),
      });
    }

    const sql = `
      INSERT INTO \`${table}\` (username, discord_tag, grade, school, invited_by, reason, agreement_confirmed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await executeApplicationsQuery(sql, [
      username,
      discordTag,
      grade,
      school,
      invitedBy,
      reason,
      agreementConfirmed ? 1 : 0,
    ]);

    return res.status(201).json({
      ok: true,
      id: Number(result?.insertId || 0),
      status: 'Pending',
      message: 'Application submitted successfully.',
    });
  } catch (error) {
    return res.status(503).json({ error: String(error?.message || error) });
  }
}

async function getApplicationStatus(req, res) {
  const username = String(req.params?.username || '').trim();
  if (!username) {
    return res.status(400).json({ error: 'username is required in path.' });
  }

  try {
    await ensureApplicationsSchema();
    await autoWaitlist();

    const table = getApplicationsTableName();

    // Resolve the most authoritative status for the username instead of
    // just the newest row. If the same username has multiple rows (e.g.
    // legacy duplicates from before the duplicate-submission block was
    // added), an admin's decision on an earlier row should not be
    // hidden by a stale Pending row created later.
    //
    // Priority order: Accepted > Waitlist > Declined > Pending > other.
    const sql = `
      SELECT username, discord_tag, status, created_at
      FROM \`${table}\`
      WHERE username = ?
      ORDER BY
        CASE LOWER(status)
          WHEN 'accepted' THEN 1
          WHEN 'waitlist' THEN 2
          WHEN 'declined' THEN 3
          WHEN 'pending'  THEN 4
          ELSE 5
        END ASC,
        created_at DESC,
        id DESC
      LIMIT 1
    `;

    const [rows] = await executeApplicationsQuery(sql, [username]);
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (!row) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    return res.json({
      ok: true,
      username: row.username,
      discord_tag: row.discord_tag,
      status: row.status,
      created_at: row.created_at,
    });
  } catch (error) {
    return res.status(503).json({ error: String(error?.message || error) });
  }
}

function requireAdminSecret(req, res, next) {
  if (!ADMIN_SECRET) {
    return res.status(503).json({ error: 'Admin secret is not configured on the server.' });
  }

  const headerSecret = String(req.headers['admin-secret'] || '').trim();
  if (!headerSecret || headerSecret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized admin request.' });
  }

  return next();
}

async function listAdminApplications(_req, res) {
  try {
    await ensureApplicationsSchema();
    await autoWaitlist();

    const table = getApplicationsTableName();
    const sql = `
      SELECT id, username, discord_tag, grade, school, invited_by, reason, status, created_at
      FROM \`${table}\`
      ORDER BY created_at DESC
      LIMIT 500
    `;

    const [rows] = await executeApplicationsQuery(sql);
    const applications = Array.isArray(rows) ? rows.map((row) => ({
      id: Number(row.id || 0),
      username: String(row.username || ''),
      discord_tag: String(row.discord_tag || ''),
      grade: String(row.grade || ''),
      school: String(row.school || ''),
      invited_by: String(row.invited_by || ''),
      reason: String(row.reason || ''),
      status: String(row.status || 'Pending'),
      created_at: row.created_at || null,
    })) : [];

    return res.json({ ok: true, applications });
  } catch (error) {
    return res.status(503).json({ error: String(error?.message || error) });
  }
}

async function updateAdminApplicationStatus(req, res) {
  const id = Number(req.body?.id);
  const status = String(req.body?.status || '').trim();
  const allowed = new Set(['Accepted', 'Declined', 'Waitlist']);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive integer.' });
  }

  if (!allowed.has(status)) {
    return res.status(400).json({ error: 'status must be one of: Accepted, Declined, Waitlist.' });
  }

  try {
    await ensureApplicationsSchema();

    const table = getApplicationsTableName();

    // First, fetch the target row so we can also propagate the status
    // change to any duplicate rows that exist for the same username.
    const targetSql = `
      SELECT id, username
      FROM \`${table}\`
      WHERE id = ?
      LIMIT 1
    `;
    const [targetRows] = await executeApplicationsQuery(targetSql, [id]);
    const targetRow = Array.isArray(targetRows) && targetRows.length > 0 ? targetRows[0] : null;
    if (!targetRow) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    // Update the targeted row plus any sibling rows for the same
    // username so legacy duplicates are kept in sync. This prevents
    // a stale Pending duplicate from masking an admin decision in
    // public status lookups.
    const updateSql = `
      UPDATE \`${table}\`
      SET status = ?
      WHERE username = ?
    `;

    const [result] = await executeApplicationsQuery(updateSql, [status, targetRow.username]);
    if (!Number(result?.affectedRows || 0)) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const fetchSql = `
      SELECT id, username, discord_tag, grade, school, invited_by, reason, status, created_at
      FROM \`${table}\`
      WHERE id = ?
      LIMIT 1
    `;

    const [rows] = await executeApplicationsQuery(fetchSql, [id]);
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) {
      return res.status(404).json({ error: 'Application not found after update.' });
    }

    return res.json({
      ok: true,
      application: {
        id: Number(row.id || 0),
        username: String(row.username || ''),
        discord_tag: String(row.discord_tag || ''),
        grade: String(row.grade || ''),
        school: String(row.school || ''),
        invited_by: String(row.invited_by || ''),
        reason: String(row.reason || ''),
        status: String(row.status || 'Pending'),
        created_at: row.created_at || null,
      },
    });
  } catch (error) {
    return res.status(503).json({ error: String(error?.message || error) });
  }
}

app.post('/apply', submitApplication);
app.post('/api/apply', submitApplication);
app.get('/status/:username', getApplicationStatus);
app.get('/api/status/:username', getApplicationStatus);
app.get('/admin/applications', requireAdminSecret, listAdminApplications);
app.get('/api/admin/applications', requireAdminSecret, listAdminApplications);
app.post('/admin/update-status', requireAdminSecret, updateAdminApplicationStatus);
app.post('/api/admin/update-status', requireAdminSecret, updateAdminApplicationStatus);

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

  scheduleAutoWaitlist();
});
