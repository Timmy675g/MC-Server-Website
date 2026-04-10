import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { apiUrl } from '../lib/api-base';
import { unwrapPayload } from '../lib/api-envelope';
import { getAuthProvider } from '../lib/auth';

type UptimePayload = {
  generatedAt?: string;
  timezone?: string;
  stats?: {
    uptimePercent?: number | null;
    incidentMinutes?: number | null;
    incidentFreeStreakMinutes?: number | null;
  };
  current?: {
    status?: string;
    label?: string;
  };
};

type MaintenanceState = {
  active: boolean;
  mode: 'maintenance' | 'normal';
  durationKey?: '5m' | '15m' | '1h' | '24h' | 'custom' | null;
  startedAt?: string | null;
  endsAt?: string | null;
  remainingMs?: number;
};

const DURATION_OPTIONS = [
  { key: '5m', label: '5 minutes' },
  { key: '15m', label: '15 minutes' },
  { key: '1h', label: '1 hour' },
  { key: '24h', label: '24 hours' },
  { key: 'custom', label: 'Custom time' },
] as const;

function formatPercent(value: number | null | undefined): string {
  if (!Number.isFinite(Number(value))) return '--';
  const safe = Number(value);
  return `${safe.toFixed(2).replace(/\.00$/, '')}%`;
}

function formatMinutes(value: number | null | undefined): string {
  const safe = Number(value ?? 0);
  if (!Number.isFinite(safe) || safe <= 0) return '0m';
  const rounded = Math.round(safe);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatDateTime(value: string | null | undefined, timezone?: string): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('en-GB', {
    hour12: false,
    timeZone: timezone || 'Asia/Jakarta',
  });
}

export default function AdminPage() {
  const navigate = useNavigate();

  const [uptime, setUptime] = useState<UptimePayload | null>(null);
  const [loadingUptime, setLoadingUptime] = useState(true);
  const [uptimeError, setUptimeError] = useState<string | null>(null);

  const [duration, setDuration] = useState<'5m' | '15m' | '1h' | '24h' | 'custom'>('15m');
  const [customMinutes, setCustomMinutes] = useState('30');
  const [controlBusy, setControlBusy] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceState | null>(null);

  const isMaintenanceActive = Boolean(maintenance?.active);

  useEffect(() => {
    let mounted = true;

    fetch(apiUrl('/api/uptime?range=1d'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed uptime request: ${response.status}`);
        return response.json() as Promise<UptimePayload | { payload?: UptimePayload }>;
      })
      .then((raw) => {
        if (!mounted) return;
        const payload = unwrapPayload<UptimePayload>(raw, {
          generatedAt: new Date().toISOString(),
          timezone: 'Asia/Jakarta',
          stats: {
            uptimePercent: null,
            incidentMinutes: null,
            incidentFreeStreakMinutes: null,
          },
          current: {
            status: 'unknown',
            label: 'Unknown',
          },
        });

        setUptime(payload);
        setUptimeError(null);
      })
      .catch(() => {
        if (!mounted) return;
        setUptimeError('Failed to load uptime metrics.');
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingUptime(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    fetch(apiUrl('/api/status'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed status request: ${response.status}`);
        return response.json() as Promise<{ payload?: { maintenance?: MaintenanceState } } | { maintenance?: MaintenanceState }>;
      })
      .then((raw) => {
        if (!mounted) return;
        const payload = unwrapPayload<{ maintenance?: MaintenanceState }>(raw, {});
        if (payload?.maintenance) setMaintenance(payload.maintenance);
      })
      .catch(() => {
        // Keep dashboard usable even if initial maintenance pull fails.
      });

    return () => {
      mounted = false;
    };
  }, []);

  const uptimeSummary = useMemo(() => {
    return {
      percent: formatPercent(uptime?.stats?.uptimePercent),
      incident: formatMinutes(uptime?.stats?.incidentMinutes),
      streak: formatMinutes(uptime?.stats?.incidentFreeStreakMinutes),
      current: uptime?.current?.label || 'Unknown',
      updatedAt: formatDateTime(uptime?.generatedAt || null, uptime?.timezone),
    };
  }, [uptime]);

  const onSubmitMaintenance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setControlBusy(true);
    setControlError(null);

    const nextEnabled = !isMaintenanceActive;
    const numericCustom = Number(customMinutes);
    if (nextEnabled && duration === 'custom' && (!Number.isFinite(numericCustom) || numericCustom <= 0)) {
      setControlError('Custom minutes must be greater than zero.');
      setControlBusy(false);
      return;
    }

    try {
      const response = await fetch(apiUrl('/api/maintenance'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          enabled: nextEnabled,
          duration,
          customMinutes: duration === 'custom' ? numericCustom : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Maintenance request failed: ${response.status}`);
      }

      const raw = await response.json() as { payload?: MaintenanceState } | MaintenanceState;
      const snapshot = unwrapPayload<MaintenanceState>(raw, {
        active: false,
        mode: 'normal',
        durationKey: null,
        startedAt: null,
        endsAt: null,
        remainingMs: 0,
      });

      setMaintenance(snapshot);
    } catch {
      setControlError('Unable to apply maintenance window right now.');
    } finally {
      setControlBusy(false);
    }
  };

  const logout = () => {
    getAuthProvider().logout();
    navigate('/login', { replace: true });
  };

  return (
    <main className="container section stack reveal in-view">
      <Card className="card" style={{ gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h1>Admin Dashboard</h1>
            <p className="subtitle" style={{ marginTop: '0.3rem' }}>
              Uptime metrics and maintenance mode controls.
            </p>
          </div>
          <button type="button" className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </Card>

      <Card className="card" style={{ gridColumn: '1 / -1' }}>
        <h3>Uptime Overview</h3>
        {loadingUptime ? <p style={{ marginTop: '0.55rem' }}>Loading uptime metrics...</p> : null}
        {uptimeError ? <p style={{ marginTop: '0.55rem', color: 'var(--danger)' }}>{uptimeError}</p> : null}

        {!loadingUptime && !uptimeError ? (
          <div className="stack" style={{ marginTop: '0.75rem' }}>
            <p>Current status: <strong>{uptimeSummary.current}</strong></p>
            <p>Uptime (24h): <strong>{uptimeSummary.percent}</strong></p>
            <p>Incident minutes: <strong>{uptimeSummary.incident}</strong></p>
            <p>Incident-free streak: <strong>{uptimeSummary.streak}</strong></p>
            <p className="meta">Last updated: {uptimeSummary.updatedAt}</p>
          </div>
        ) : null}
      </Card>

      <Card className="card" style={{ gridColumn: '1 / -1' }}>
        <h3>Maintenance Control</h3>
        <p className="meta" style={{ marginTop: '0.35rem' }}>
          Select a maintenance duration and apply it to server status.
        </p>

        <form onSubmit={onSubmitMaintenance} className="stack" style={{ marginTop: '0.9rem' }}>
          <label htmlFor="maintenance-duration">Duration</label>
          <select
            id="maintenance-duration"
            value={duration}
            onChange={(event) => setDuration(event.target.value as '5m' | '15m' | '1h' | '24h' | 'custom')}
            style={{
              height: '2.5rem',
              borderRadius: '10px',
              border: '1px solid var(--line)',
              background: 'var(--bg-panel)',
              color: 'var(--text)',
              padding: '0 0.75rem',
            }}
          >
            {DURATION_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>

          {duration === 'custom' ? (
            <>
              <label htmlFor="maintenance-custom-minutes">Custom minutes</label>
              <input
                id="maintenance-custom-minutes"
                type="number"
                min={1}
                max={10080}
                value={customMinutes}
                onChange={(event) => setCustomMinutes(event.target.value)}
                className="input"
              />
            </>
          ) : null}

          {controlError ? <p style={{ color: 'var(--danger)' }}>{controlError}</p> : null}

          <div className="button-group">
            <button type="submit" className="btn btn-primary" disabled={controlBusy}>
              {controlBusy ? 'Applying...' : 'Toggle Maintenance'}
            </button>
          </div>
        </form>

        {maintenance ? (
          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--line)', paddingTop: '0.8rem' }}>
            <p>
              Mode: <strong>{maintenance.active ? 'Maintenance Mode' : 'Normal'}</strong>
            </p>
            <p>Ends at: <strong>{formatDateTime(maintenance.endsAt ?? null, uptime?.timezone)}</strong></p>
          </div>
        ) : null}
      </Card>
    </main>
  );
}
