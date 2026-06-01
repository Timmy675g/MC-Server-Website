import { useEffect, useMemo, useState } from 'react';
import { CURRENT_FACTION_ITEMS, PREVIOUS_FACTION_ITEMS } from '../lib/content';
import { Card } from '../components/ui/card';
import { usePollingStatus } from '../hooks/usePollingStatus';
import { MotionReveal } from '../components/MotionReveal';

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

export default function StatsPage() {
  const [history, setHistory] = useState<PlayerPoint[]>([]);
  const [factionServerView, setFactionServerView] = useState<'current' | 'previous'>('current');
  const {
    status,
    isLoading: isStatusLoading,
    isError: isStatusError,
    isStale: isStatusStale,
    lastUpdatedAt,
    lastUpdatedLabel,
    lastError,
  } = usePollingStatus();

  useEffect(() => {
    if (status && lastUpdatedAt) {
      setHistory(pushHistory(status.playersOnline));
      return;
    }

    setHistory(loadHistory(14));
  }, [lastUpdatedAt, status]);

  const ranking = useMemo(() => {
    const selected = factionServerView === 'current' ? CURRENT_FACTION_ITEMS : PREVIOUS_FACTION_ITEMS;
    return [...selected].sort((a, b) => b.power - a.power);
  }, [factionServerView]);

  const chartMaxPlayers = useMemo(() => {
    const sampleMax = history.length > 0 ? Math.max(...history.map((item) => item.value), 0) : 0;
    return Math.max(status?.playersMax ?? 0, sampleMax, 1);
  }, [history, status?.playersMax]);

  return (
    <main className="container section stack reveal in-view">
      <Card className="card" style={{ gridColumn: '1 / -1' }}>
        <h1>Stats Dashboard</h1>
        <p className="subtitle">Live player trend and faction power ranking.</p>
        <div className={`live-status-strip ${isStatusStale ? 'is-stale' : ''} ${isStatusError ? 'is-error' : ''}`} role="status" aria-live="polite">
          <span className="live-status-dot" aria-hidden="true" />
          <strong>{isStatusLoading && !status ? 'Loading' : isStatusStale ? 'Stale' : 'Live'}</strong>
          <span>Last updated {lastUpdatedLabel}</span>
          {isStatusError ? <span>{lastError || 'Unable to load stats data right now.'}</span> : null}
        </div>
      </Card>

      <Card className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="stats-chart-head">
          <div>
            <h3>Player Count</h3>
            <p className="meta">Recent samples stored locally in this browser.</p>
          </div>
          <p className="stats-chart-current">
            <span>Now</span>
            <strong>{status?.playersOnline ?? '--'} / {status?.playersMax ?? '--'}</strong>
          </p>
        </div>
        <div className="stats-player-chart">
          {history.length === 0 ? (
            <p className="meta">No samples yet.</p>
          ) : (
            history.map((point) => {
              const height = Math.max(8, Math.round((point.value / chartMaxPlayers) * 170));
              const label = new Date(point.t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={point.t} className="stats-player-sample">
                  <div
                    className="stats-player-bar"
                    style={{ height }}
                    title={`${label} - ${point.value} players`}
                  />
                  <strong>{point.value}</strong>
                  <span className="meta" style={{ fontSize: '0.65rem' }}>{label}</span>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <MotionReveal className="full-grid-row">
      <Card className="card" style={{ gridColumn: '1 / -1' }}>
        <h3>Faction Power Rankings</h3>
        <div className="button-group" role="group" aria-label="Faction ranking server selector" style={{ marginTop: '0.6rem' }}>
          <button
            type="button"
            className={`btn ${factionServerView === 'current' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFactionServerView('current')}
          >
            Current Server
          </button>
          <button
            type="button"
            className={`btn ${factionServerView === 'previous' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFactionServerView('previous')}
          >
            Previous Server
          </button>
        </div>
        <div className="stack" style={{ marginTop: '0.7rem' }}>
          {ranking.length === 0 ? (
            <Card className="card polished-empty-state" style={{ gridColumn: '1 / -1' }}>
              <p><strong>No faction data for current server.</strong></p>
              <p className="meta">Switch to Previous Server to view historical clan information.</p>
            </Card>
          ) : ranking.map((faction, index) => (
            <MotionReveal key={faction.name} delay={index * 0.03}>
              <Card className="card" style={{ gridColumn: '1 / -1' }}>
                <p><strong>#{index + 1} {faction.name}</strong></p>
                <p>Power score: <b>{faction.power}</b></p>
                <p className="meta">Leader: {faction.leader} | Members: {faction.members}</p>
                <p className="meta">Allegiances: {faction.allegiances}</p>
              </Card>
            </MotionReveal>
          ))}
        </div>
      </Card>
      </MotionReveal>
    </main>
  );
}
