import { useEffect, useMemo, useState } from 'react';
import { FACTION_ITEMS } from '../lib/content';

type StatusPayload = {
  playersOnline?: number;
  playersMax?: number;
  uptime?: number;
  tps?: number | null;
  cpuUsage?: number | null;
  ramUsage?: number | null;
};

type UptimePayload = {
  stats?: {
    uptimePercent?: number;
    incidentMinutes?: number;
    incidentFreeStreakMinutes?: number;
  };
};

type PlayerPoint = {
  t: number;
  value: number;
};

const HISTORY_KEY = 'sk_player_history';

function loadHistory(limit: number): PlayerPoint[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as PlayerPoint[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-limit);
  } catch {
    return [];
  }
}

function pushHistory(value: number): PlayerPoint[] {
  const now = Date.now();
  const next = loadHistory(500)
    .filter((item) => now - Number(item.t) <= 48 * 60 * 60 * 1000)
    .concat({ t: now, value: Number.isFinite(value) ? value : 0 });

  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next.slice(-14);
}

function formatMinutesToHuman(minutes: number | undefined): string {
  const safe = Number(minutes ?? 0);
  if (!Number.isFinite(safe) || safe <= 0) return '0m';

  const total = Math.floor(safe);
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function uptimeText(value: number | undefined): string {
  const safe = Number(value);
  if (!Number.isFinite(safe)) return '--';
  return `${safe.toFixed(2).replace(/\.00$/, '')}%`;
}

export default function StatsPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [uptime, setUptime] = useState<UptimePayload | null>(null);
  const [history, setHistory] = useState<PlayerPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      fetch('/api/status', { headers: { Accept: 'application/json' } }),
      fetch('/api/uptime?range=1d', { headers: { Accept: 'application/json' } }),
    ])
      .then(async ([statusResponse, uptimeResponse]) => {
        if (!statusResponse.ok) throw new Error('status failed');
        if (!uptimeResponse.ok) throw new Error('uptime failed');

        const statusData = await statusResponse.json() as { payload?: StatusPayload } & StatusPayload;
        const uptimeData = await uptimeResponse.json() as UptimePayload;

        if (!mounted) return;

        const statusPayload = statusData.payload ?? statusData;
        setStatus(statusPayload);
        setUptime(uptimeData);
        setHistory(pushHistory(Number(statusPayload.playersOnline ?? 0)));
      })
      .catch(() => {
        if (!mounted) return;
        setError('Unable to load stats data right now.');
        setHistory(loadHistory(14));
      });

    return () => {
      mounted = false;
    };
  }, []);

  const ranking = useMemo(
    () => [...FACTION_ITEMS].sort((a, b) => b.power - a.power),
    [],
  );

  const maxPlayers = useMemo(() => {
    if (history.length === 0) return 1;
    return Math.max(...history.map((item) => item.value), 1);
  }, [history]);

  return (
    <main className="container section stack reveal in-view">
      <article className="card" style={{ gridColumn: '1 / -1' }}>
        <h1>Stats Dashboard</h1>
        <p className="subtitle">Live player trend, uptime health, and faction power ranking.</p>
        {error ? <p>{error}</p> : null}
      </article>

      <article className="card" style={{ gridColumn: '1 / -1' }}>
        <h3>Player Count (recent samples)</h3>
        <div style={{ marginTop: '0.9rem', display: 'flex', height: '13rem', alignItems: 'end', gap: '0.5rem', overflowX: 'auto', border: '1px solid var(--line)', borderRadius: '10px', padding: '0.65rem' }}>
          {history.length === 0 ? (
            <p className="meta">No samples yet.</p>
          ) : (
            history.map((point) => {
              const height = Math.max(8, Math.round((point.value / maxPlayers) * 170));
              const label = new Date(point.t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={point.t} style={{ display: 'flex', minWidth: '2.5rem', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                  <div
                    style={{ width: '1.7rem', borderRadius: '6px 6px 0 0', height, background: 'linear-gradient(180deg, #0b5fff, #26c5ff)' }}
                    title={`${label} - ${point.value} players`}
                  />
                  <span className="meta" style={{ fontSize: '0.65rem' }}>{label}</span>
                </div>
              );
            })
          )}
        </div>
      </article>

      <section className="card-grid two-col" style={{ gridColumn: '1 / -1' }}>
        <article className="card">
          <h3>Uptime Statistics</h3>
          <p className="stat-value">{uptimeText(uptime?.stats?.uptimePercent)}</p>
          <p className="meta" style={{ marginTop: '0.5rem' }}>
            No incident streak: {formatMinutesToHuman(uptime?.stats?.incidentFreeStreakMinutes)}
          </p>
          <p className="meta" style={{ marginTop: '0.2rem' }}>
            Incident time in range: {formatMinutesToHuman(uptime?.stats?.incidentMinutes)}
          </p>
        </article>

        <article className="card">
          <h3>Server Runtime Metrics</h3>
          <div className="stack" style={{ marginTop: '0.45rem' }}>
            <p>Players: <b>{status?.playersOnline ?? 0} / {status?.playersMax ?? 0}</b></p>
            <p>TPS: <b>{status?.tps ?? '--'}</b></p>
            <p>CPU Usage: <b>{status?.cpuUsage ?? '--'}%</b></p>
            <p>RAM Usage: <b>{status?.ramUsage ?? '--'}%</b></p>
          </div>
        </article>
      </section>

      <article className="card" style={{ gridColumn: '1 / -1' }}>
        <h3>Faction Power Rankings</h3>
        <div className="stack" style={{ marginTop: '0.7rem' }}>
          {ranking.map((faction, index) => (
            <article key={faction.name} className="card" style={{ gridColumn: '1 / -1' }}>
              <p><strong>#{index + 1} {faction.name}</strong></p>
              <p>Power score: <b>{faction.power}</b></p>
              <p className="meta">Leader: {faction.leader} | Members: {faction.members}</p>
              <p className="meta">Allegiances: {faction.allegiances}</p>
            </article>
          ))}
        </div>
      </article>
    </main>
  );
}
