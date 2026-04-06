import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../lib/api-base';
import { unwrapPayload } from '../lib/api-envelope';
import type { ApiEnvelope } from '../types/api';

type UptimeComponent = {
  status?: string;
  label?: string;
  note?: string;
};

type TimelinePoint = {
  ts: string;
  status: 'operational' | 'degraded' | 'maintenance' | 'outage' | string;
  label?: string;
};

type UptimePayload = {
  timezone?: string;
  generatedAt?: string;
  overrides?: {
    source?: string;
    note?: string;
  };
  range?: { key?: '30d' | '90d' | string };
  components?: {
    minecraftServer?: UptimeComponent;
    virtualMachine?: UptimeComponent;
    ipPulling?: UptimeComponent;
  };
  componentTimelines?: {
    minecraftServer?: TimelinePoint[];
    virtualMachine?: TimelinePoint[];
    ipPulling?: TimelinePoint[];
  };
};

function formatPercent(value: number | null): string {
  if (!Number.isFinite(Number(value))) return '--';
  return Number(value).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function computeTimelineUptimePercent(timeline: TimelinePoint[]): number | null {
  if (!Array.isArray(timeline) || timeline.length === 0) return null;

  let up = 0;
  let denominator = 0;
  timeline.forEach((entry) => {
    if (entry.status === 'maintenance') return;
    denominator += 1;
    if (entry.status === 'operational') up += 1;
  });

  if (denominator <= 0) return 100;
  return (up / denominator) * 100;
}

function statusClass(status: string | undefined): string {
  if (status === 'operational') return 'status-online';
  if (status === 'maintenance' || status === 'degraded') return 'status-pinging';
  return 'status-offline';
}

function prettyTime(value: string | undefined, timezone: string): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('en-GB', { hour12: false, timeZone: timezone });
}

export default function UptimePage() {
  const [range, setRange] = useState<'30d' | '90d'>('30d');
  const [payload, setPayload] = useState<UptimePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch(apiUrl(`/uptime?range=${encodeURIComponent(range)}`), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Uptime request failed: ${response.status}`);
        return response.json() as Promise<ApiEnvelope<UptimePayload> | UptimePayload>;
      })
      .then((raw) => {
        if (!mounted) return;
        setPayload(unwrapPayload<UptimePayload>(raw, {
          timezone: 'Asia/Jakarta',
          generatedAt: new Date().toISOString(),
          range: { key: range },
          components: {
            minecraftServer: { status: 'unknown', label: 'Unknown' },
            virtualMachine: { status: 'unknown', label: 'Unknown' },
          },
          componentTimelines: { minecraftServer: [], virtualMachine: [], ipPulling: [] },
          overrides: { source: 'fallback', note: 'Missing uptime payload' },
        }));
        setError(null);
      })
      .catch(() => {
        if (!mounted) return;
        setError('Unable to fetch uptime data right now.');
      });

    return () => {
      mounted = false;
    };
  }, [range]);

  const timezone = payload?.timezone || 'Asia/Jakarta';

  const services = useMemo(() => [
    {
      key: 'minecraftServer',
      title: 'Minecraft Server',
      component: payload?.components?.minecraftServer,
      timeline: payload?.componentTimelines?.minecraftServer || [],
    },
    {
      key: 'virtualMachine',
      title: 'Virtual Machine',
      component: payload?.components?.virtualMachine,
      timeline: payload?.componentTimelines?.virtualMachine || [],
    },
  ], [payload]);

  const leftLabel = range === '90d' ? '90 days ago' : '30 days ago';
  const gistNote = payload?.overrides?.source === 'github-gist'
    ? (payload?.overrides?.note || 'GitHub Gist override is active.')
    : 'No GitHub Gist override is active.';

  return (
    <main className="container section stack reveal in-view uptime-page uptime-status-v2">
      <section className="status-top-note" role="note" aria-label="Routine maintenance information" style={{ gridColumn: '1 / -1' }}>
        <strong>Routine Server Shutdown for Players to Rest</strong>
        <span>01 : 00 AM - 06 : 00 AM ( WIB )</span>
      </section>

      <article className="card" style={{ gridColumn: '1 / -1' }}>
        <section className="status-toolbar">
          <div>
            <h1>Service Status</h1>
          </div>
          <div className="uptime-range-switch" role="group" aria-label="Uptime range selector">
            <button
              id="uptime-range-30d"
              type="button"
              onClick={() => setRange('30d')}
              aria-pressed={range === '30d' ? 'true' : 'false'}
              className={`btn ${range === '30d' ? 'btn-primary' : 'btn-outline'}`}
            >
              30 Days
            </button>
            <button
              id="uptime-range-90d"
              type="button"
              onClick={() => setRange('90d')}
              aria-pressed={range === '90d' ? 'true' : 'false'}
              className={`btn ${range === '90d' ? 'btn-primary' : 'btn-outline'}`}
            >
              90 Days
            </button>
          </div>
        </section>
        {error ? <p>{error}</p> : null}
      </article>

      <section className="status-services" style={{ gridColumn: '1 / -1' }}>
      {services.map((service) => (
        <article key={service.key} className="status-service-row">
          <div className="status-service-head">
            <h2>{service.title}</h2>
            <p className={`status-service-state ${statusClass(service.component?.status)}`}>
              {service.component?.label || 'Unknown'}
            </p>
          </div>
          <p className="status-service-meta">
            {service.component?.note || 'Automatic health probes'}
          </p>

          <div className="status-bars-wrap">
            <div className="uptime-bars">
            {service.timeline.slice(-80).map((point, index) => (
              <span
                key={`${service.key}-${index}-${point.ts}`}
                title={`${new Date(point.ts).toLocaleString('en-GB', { hour12: false, timeZone: timezone })} - ${point.label || point.status}`}
                className={`uptime-bar ${
                  point.status === 'operational'
                    ? 'uptime-operational'
                    : point.status === 'maintenance'
                      ? 'uptime-maintenance'
                      : point.status === 'degraded'
                        ? 'uptime-degraded'
                        : 'uptime-outage'
                }`}
              />
            ))}
            </div>
          </div>

          <div className="status-service-foot">
            <span>{leftLabel}</span>
            <span className="status-line" aria-hidden="true" />
            <span>{formatPercent(computeTimelineUptimePercent(service.timeline))} % uptime</span>
            <span className="status-line" aria-hidden="true" />
            <span>Today</span>
          </div>
        </article>
      ))}
      </section>

      <p id="uptime-note" className="uptime-note" style={{ gridColumn: '1 / -1' }}>{gistNote}</p>
      <p id="uptime-updated" className="meta" style={{ gridColumn: '1 / -1' }}>
        Last updated: {prettyTime(payload?.generatedAt, timezone)} ({timezone})
      </p>
    </main>
  );
}
