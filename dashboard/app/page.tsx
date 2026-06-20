import { getDailyTrend, getSiteStats, getTotals } from '@/lib/db';
import { isConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic'; // always fresh

export default async function StatsPage() {
  if (!isConfigured()) {
    return (
      <>
        <h1>Stats</h1>
        <p className="sub">Usage across all sites running the voice assistant.</p>
        <div className="notice">
          Supabase isn’t configured yet. Set <code>SUPABASE_URL</code> and{' '}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> in <code>.env.local</code>, run{' '}
          <code>supabase/schema.sql</code>, then reload.
        </div>
      </>
    );
  }

  let totals, sites, trend;
  try {
    [totals, sites, trend] = await Promise.all([getTotals(), getSiteStats(), getDailyTrend(30)]);
  } catch {
    return (
      <>
        <h1>Stats</h1>
        <p className="sub">Usage across all sites running the voice assistant.</p>
        <div className="notice">
          Connected to Supabase, but the tables aren’t there yet. Run{' '}
          <code>dashboard/supabase/schema.sql</code>, then reload.
        </div>
      </>
    );
  }

  const maxConv = Math.max(1, ...trend.map((d) => d.conversations));
  const liveCount = sites.filter((s) => s.enabled && s.registered).length;
  const discovered = sites.filter((s) => !s.registered);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="sub">Voice assistant usage across every site.</p>
        </div>
        <div className="live-pill">
          <span className="dot on" /> {liveCount} live
        </div>
      </div>

      {/* KPI bento */}
      <section className="bento">
        <Kpi
          className="span2 feature"
          label="Conversations"
          value={totals.conversations}
          accent="#22c55e"
        />
        <Kpi label="Total minutes" value={totals.minutes} unit="min" accent="#38bdf8" />
        <Kpi label="Unique users" value={totals.unique_users} accent="#a78bfa" />
        <Kpi label="Sites tracked" value={sites.length} accent="#f59e0b" />

        {/* Trend */}
        <div className="card span4 trend-card">
          <div className="card-head">
            <span>Conversations · last 30 days</span>
          </div>
          {trend.length ? (
            <div className="bars">
              {trend.map((d) => (
                <div
                  key={d.day}
                  className="bar"
                  style={{ height: `${Math.max(4, (d.conversations / maxConv) * 100)}%` }}
                  title={`${d.day}: ${d.conversations} conversations · ${d.minutes} min`}
                />
              ))}
            </div>
          ) : (
            <div className="empty">No conversations yet.</div>
          )}
        </div>
      </section>

      {/* Per-site bento */}
      <div className="section-head">
        <h2>By website</h2>
        {discovered.length > 0 && (
          <span className="hint">
            {discovered.length} new domain{discovered.length > 1 ? 's' : ''} discovered — configure
            in Admin
          </span>
        )}
      </div>

      <section className="site-grid">
        {sites.map((s) => {
          const status = !s.registered ? 'new' : s.enabled ? 'live' : 'off';
          return (
            <div
              key={s.hostname}
              className="site-card"
              style={{ ['--c' as string]: s.accent || '#22c55e' }}
            >
              <span className="accent-strip" />
              <div className="site-top">
                <div className="site-name">
                  {s.label || s.hostname}
                  <div className="site-host">{s.hostname}</div>
                </div>
                <span className={`status ${status}`}>
                  {status === 'live' ? 'Live' : status === 'off' ? 'Disabled' : 'New'}
                </span>
              </div>

              <div className="metrics">
                <Metric value={s.conversations} label="convos" />
                <Metric value={s.minutes} label="min" />
                <Metric value={s.unique_users} label="users" />
                <Metric value={formatDuration(s.avg_seconds)} label="avg" />
              </div>

              {s.enabled && (
                <a
                  className="visit"
                  href={`https://${s.hostname}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Visit site ↗
                </a>
              )}
            </div>
          );
        })}
        {!sites.length && <div className="notice">No sites or conversations yet.</div>}
      </section>
    </>
  );
}

function Kpi({
  label,
  value,
  unit,
  accent,
  className = '',
}: {
  label: string;
  value: number | string;
  unit?: string;
  accent: string;
  className?: string;
}) {
  return (
    <div className={`card kpi ${className}`} style={{ ['--c' as string]: accent }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="metric">
      <div className="m-value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="m-label">{label}</div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ''}`;
}
