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

type AdminApplication = {
  id: number;
  username: string;
  discord_tag: string;
  status: string;
  created_at?: string | null;
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
  const [adminSecret, setAdminSecret] = useState('');
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [applicationsLoaded, setApplicationsLoaded] = useState(false);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<Record<number, boolean>>({});

  const isMaintenanceActive = Boolean(maintenance?.active);

  useEffect(() => {
    let mounted = true;

    const pullUptime = async () => {
      try {
        const response = await fetch(apiUrl('/api/uptime?range=1d'), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });

        if (!response.ok) throw new Error(`Failed uptime request: ${response.status}`);

        const raw = await response.json() as unknown;
        const payload = unwrapPayload<UptimePayload>(raw as { payload?: UptimePayload } | UptimePayload | null | undefined, {
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

        if (!mounted) return;
        setUptime({
          generatedAt: payload?.generatedAt || new Date().toISOString(),
          timezone: payload?.timezone || 'Asia/Jakarta',
          stats: {
            uptimePercent: payload?.stats?.uptimePercent ?? null,
            incidentMinutes: payload?.stats?.incidentMinutes ?? null,
            incidentFreeStreakMinutes: payload?.stats?.incidentFreeStreakMinutes ?? null,
          },
          current: {
            status: payload?.current?.status || 'unknown',
            label: payload?.current?.label || 'Unknown',
          },
        });
        setUptimeError(null);
      } catch (error) {
        if (!mounted) return;
        console.error('[admin] Unable to load uptime payload:', String((error as Error)?.message || error));
        setUptimeError('Failed to load uptime metrics.');
      } finally {
        if (mounted) {
          setLoadingUptime(false);
        }
      }
    };

    void pullUptime();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const pullStatus = async () => {
      try {
        const response = await fetch(apiUrl('/api/status'), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });

        if (!response.ok) throw new Error(`Failed status request: ${response.status}`);
        const raw = await response.json() as unknown;
        const payload = unwrapPayload<{ maintenance?: MaintenanceState }>(
          raw as { payload?: { maintenance?: MaintenanceState } } | { maintenance?: MaintenanceState } | null | undefined,
          { maintenance: undefined },
        );
        const maintenancePayload = payload?.maintenance;
        if (!mounted) return;
        if (maintenancePayload) setMaintenance(maintenancePayload);
      } catch (error) {
        console.error('[admin] Unable to load status payload:', String((error as Error)?.message || error));
      }
    };

    void pullStatus();

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

  const loadApplications = async () => {
    if (!adminSecret.trim()) {
      setApplicationsError('Enter Admin Secret to load applications.');
      return;
    }

    setLoadingApplications(true);
    setApplicationsError(null);
    setApplicationsLoaded(false);

    try {
      const response = await fetch(apiUrl('/api/admin/applications'), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Admin-Secret': adminSecret.trim(),
        },
      });

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('application/json')) {
        throw new Error('Unexpected response format from admin API.');
      }

      const payload = await response.json().catch(() => null) as {
        payload?: { applications?: AdminApplication[] };
        applications?: AdminApplication[];
        error?: string;
      } | null;

      const body = unwrapPayload<{ applications?: AdminApplication[] }>(payload, { applications: [] });

      if (!response.ok) {
        throw new Error(String(payload?.error || `Failed to load applications: ${response.status}`));
      }

      setApplications(Array.isArray(body?.applications) ? body.applications : []);
      setApplicationsLoaded(true);
    } catch (error) {
      setApplicationsError(String((error as Error)?.message || error));
    } finally {
      setLoadingApplications(false);
    }
  };

  const updateApplicationStatus = async (id: number, status: 'Accepted' | 'Declined' | 'Waitlist') => {
    if (!adminSecret.trim()) {
      setApplicationsError('Enter Admin Secret before updating status.');
      return;
    }

    setApplicationsError(null);
    setRowBusy((prev) => ({ ...prev, [id]: true }));

    try {
      const response = await fetch(apiUrl('/api/admin/update-status'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Admin-Secret': adminSecret.trim(),
        },
        body: JSON.stringify({ id, status }),
      });

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('application/json')) {
        throw new Error('Unexpected response format from admin API.');
      }

      const payload = await response.json().catch(() => null) as {
        payload?: { application?: AdminApplication };
        application?: AdminApplication;
        error?: string;
      } | null;

      const body = unwrapPayload<{ application?: AdminApplication }>(payload, { application: undefined });

      if (!response.ok || !body?.application) {
        throw new Error(String(payload?.error || `Failed to update status: ${response.status}`));
      }

      setApplications((prev) => prev.map((item) => {
        if (item.id !== id) return item;
        return body.application as AdminApplication;
      }));
    } catch (error) {
      setApplicationsError(String((error as Error)?.message || error));
    } finally {
      setRowBusy((prev) => ({ ...prev, [id]: false }));
    }
  };

  const getRowStyle = (status: string): React.CSSProperties => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'accepted') {
      return { background: 'rgba(22, 163, 74, 0.14)' };
    }
    if (normalized === 'waitlist') {
      return { background: 'rgba(250, 204, 21, 0.16)' };
    }
    if (normalized === 'declined') {
      return { background: 'rgba(220, 38, 38, 0.14)' };
    }
    return {};
  };

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

      const raw = await response.json() as unknown;
      const snapshot = ((((raw as { payload?: MaintenanceState } | null | undefined)?.payload)
        ?? (raw as MaintenanceState | undefined)) ?? {
        active: false,
        mode: 'normal',
        durationKey: null,
        startedAt: null,
        endsAt: null,
        remainingMs: 0,
      }) as MaintenanceState;

      setMaintenance(snapshot);
    } catch (error) {
      console.error('[admin] Unable to update maintenance state:', String((error as Error)?.message || error));
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

      <Card className="card" style={{ gridColumn: '1 / -1' }}>
        <h3>Applications</h3>
        <p className="meta" style={{ marginTop: '0.35rem' }}>
          Use your Admin Secret to load and manage whitelist applications.
        </p>

        <div className="stack" style={{ marginTop: '0.9rem' }}>
          <label htmlFor="admin-secret-input">Admin Secret</label>
          <input
            id="admin-secret-input"
            type="password"
            value={adminSecret}
            onChange={(event) => setAdminSecret(event.target.value)}
            className="input"
            placeholder="Enter ADMIN_SECRET"
            autoComplete="off"
          />
          <div className="button-group">
            <button type="button" className="btn btn-primary" onClick={() => {
              void loadApplications();
            }} disabled={loadingApplications}>
              {loadingApplications ? 'Loading...' : 'Load Applications'}
            </button>
          </div>
        </div>

        {applicationsError ? <p style={{ marginTop: '0.8rem', color: 'var(--danger)' }}>{applicationsError}</p> : null}
        {loadingApplications ? <p style={{ marginTop: '0.8rem' }}>Loading applications...</p> : null}
        {!loadingApplications && !applicationsLoaded && !applicationsError ? (
          <p style={{ marginTop: '0.8rem' }}>Load applications to view the dashboard table.</p>
        ) : null}

        <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', padding: '0.6rem' }}>ID</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', padding: '0.6rem' }}>Username</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', padding: '0.6rem' }}>Discord</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', padding: '0.6rem' }}>Status</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', padding: '0.6rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '0.8rem', color: 'var(--muted)' }}>
                    No applications loaded.
                  </td>
                </tr>
              ) : applications.map((item) => {
                const busy = Boolean(rowBusy[item.id]);
                return (
                  <tr key={item.id} style={getRowStyle(item.status)}>
                    <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--line)' }}>{item.id}</td>
                    <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--line)' }}>{item.username}</td>
                    <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--line)' }}>{item.discord_tag}</td>
                    <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--line)' }}>{item.status}</td>
                    <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => {
                            void updateApplicationStatus(item.id, 'Accepted');
                          }}
                          disabled={busy}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            void updateApplicationStatus(item.id, 'Declined');
                          }}
                          disabled={busy}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            void updateApplicationStatus(item.id, 'Waitlist');
                          }}
                          disabled={busy}
                        >
                          Waitlist
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
