import 'server-only';
import { getSupabase } from './supabase';

export interface SiteStat {
  hostname: string;
  label: string | null;
  enabled: boolean;
  accent: string | null;
  conversations: number;
  minutes: number;
  unique_users: number;
  avg_seconds: number;
  /** False when the domain only appears in session data (not yet in `sites`). */
  registered: boolean;
}

export interface Totals {
  conversations: number;
  minutes: number;
  unique_users: number;
}

export interface DailyPoint {
  day: string; // YYYY-MM-DD
  conversations: number;
  minutes: number;
}

/**
 * Per-site rollup. Driven by BOTH the configured `sites` and the actual
 * `sessions` data, so a brand-new domain that starts sending conversations shows
 * up automatically (flagged `registered: false`) even before it's configured.
 */
export async function getSiteStats(): Promise<SiteStat[]> {
  const supabase = getSupabase();
  const [{ data: sites, error: e1 }, { data: sessions, error: e2 }] = await Promise.all([
    supabase.from('sites').select('hostname, label, enabled, accent'),
    supabase.from('sessions').select('site_hostname, visitor_id, duration_seconds'),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  type Agg = { conversations: number; seconds: number; visitors: Set<string> };
  const agg = new Map<string, Agg>();
  for (const s of sessions ?? []) {
    const host = (s.site_hostname as string) || 'unknown';
    const a = agg.get(host) ?? { conversations: 0, seconds: 0, visitors: new Set() };
    a.conversations += 1;
    a.seconds += s.duration_seconds ?? 0;
    if (s.visitor_id) a.visitors.add(s.visitor_id as string);
    agg.set(host, a);
  }

  const siteByHost = new Map((sites ?? []).map((s) => [s.hostname as string, s]));
  const hosts = new Set<string>([...siteByHost.keys(), ...agg.keys()]);

  const rows: SiteStat[] = [...hosts].map((hostname) => {
    const site = siteByHost.get(hostname);
    const a = agg.get(hostname);
    const conversations = a?.conversations ?? 0;
    const seconds = a?.seconds ?? 0;
    return {
      hostname,
      label: (site?.label as string) ?? null,
      enabled: site ? site.enabled !== false : true,
      accent: (site?.accent as string) ?? null,
      conversations,
      minutes: Math.round((seconds / 60) * 10) / 10,
      unique_users: a?.visitors.size ?? 0,
      avg_seconds: conversations ? Math.round(seconds / conversations) : 0,
      registered: Boolean(site),
    };
  });

  rows.sort((a, b) => b.conversations - a.conversations || a.hostname.localeCompare(b.hostname));
  return rows;
}

/** Overall totals across every site. Unique users counted globally by visitor_id. */
export async function getTotals(): Promise<Totals> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('sessions')
    .select('visitor_id, duration_seconds');
  if (error) throw error;
  const rows = data ?? [];
  const minutes = rows.reduce((a, r) => a + (r.duration_seconds ?? 0), 0) / 60;
  const visitors = new Set(rows.map((r) => r.visitor_id).filter(Boolean));
  return {
    conversations: rows.length,
    minutes: Math.round(minutes * 10) / 10,
    unique_users: visitors.size,
  };
}

/** Conversations + minutes per day for the last `days` days. */
export async function getDailyTrend(days = 30): Promise<DailyPoint[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data, error } = await getSupabase()
    .from('sessions')
    .select('created_at, duration_seconds')
    .gte('created_at', since)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const byDay = new Map<string, { conversations: number; seconds: number }>();
  for (const r of data ?? []) {
    const day = (r.created_at as string).slice(0, 10);
    const e = byDay.get(day) ?? { conversations: 0, seconds: 0 };
    e.conversations += 1;
    e.seconds += r.duration_seconds ?? 0;
    byDay.set(day, e);
  }
  return [...byDay.entries()].map(([day, e]) => ({
    day,
    conversations: e.conversations,
    minutes: Math.round((e.seconds / 60) * 10) / 10,
  }));
}

export interface SiteRow {
  hostname: string;
  label: string | null;
  enabled: boolean;
  template: string | null;
  accent: string | null;
  start_text: string | null;
}

/** All configured sites (for the admin page). */
export async function getSites(): Promise<SiteRow[]> {
  const { data, error } = await getSupabase()
    .from('sites')
    .select('hostname, label, enabled, template, accent, start_text')
    .order('hostname', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SiteRow[];
}

/** Admin action: flip a site's enabled flag. */
export async function setSiteEnabled(hostname: string, enabled: boolean): Promise<void> {
  const { error } = await getSupabase().from('sites').update({ enabled }).eq('hostname', hostname);
  if (error) throw error;
}
