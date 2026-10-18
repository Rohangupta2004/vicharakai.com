import { useState, useEffect, useCallback } from 'react';
import { Users, Mail, UserPlus, Star, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer, BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  PageHeader, Grid, Stack, Card, StatCard, DataTable, Badge, EmptyState,
} from 'dashboard-blocks';

interface TemplateProps { workspaceId: string; }

interface Contact {
  id: string;
  email: string | null;
  name: string | null;
  source: string | null;
  sourceCategory: string | null;
  campaignName: string | null;
  adSetName: string | null;
  eventCount: number;
  createdAt: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
}

interface FunnelData {
  period: string;
  totalUniqueVisitors: number;
  stages: { pageViews: number; emailsCaptured: number; ctaClicks: number; purchases: number };
  conversionRates: { viewToEmail: string; emailToPurchase: string; overallConversion: string };
}

interface EventType { eventType: string; count: number; }

const PRIMARY = '#0d69b3';

function fmtDate(v: string | null): string {
  if (!v) return '-';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function CRMDashboard({ workspaceId }: TemplateProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totals, setTotals] = useState<{ total: number; emailCount: number; recentCount: number }>({ total: 0, emailCount: 0, recentCount: 0 });
  const [subStats, setSubStats] = useState<{ total: number; activeCount: number; trialCount: number; overrideCount: number }>({ total: 0, activeCount: 0, trialCount: 0, overrideCount: 0 });
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const loadData = useCallback(() => {
    setLoading(true);
    setErrors([]);

    const jsonOrThrow = (label: string) => (r: Response) => {
      if (!r.ok) return r.text().then(t => Promise.reject(new Error(`${label}: ${t.slice(0, 200)}`)));
      return r.json();
    };
    const fail = (label: string) => (e: Error) =>
      setErrors(prev => [...prev, `${label}: ${e.message}`]);

    const pContacts = fetch(`/api/crm/contacts/${workspaceId}`)
      .then(jsonOrThrow('contacts'))
      .then(j => {
        setContacts(j.contacts || []);
        setTotals({ total: j.total || 0, emailCount: j.emailCount || 0, recentCount: j.recentCount || 0 });
      })
      .catch(fail('contacts'));

    const pSubs = fetch(`/api/crm/subscribers/${workspaceId}`)
      .then(jsonOrThrow('subscribers'))
      .then(j => setSubStats({
        total: j.total || 0,
        activeCount: j.activeCount || 0,
        trialCount: j.trialCount || 0,
        overrideCount: j.overrideCount || 0,
      }))
      .catch(fail('subscribers'));

    const pFunnel = fetch(`/api/crm/funnel-metrics?workspaceId=${workspaceId}&days=30`)
      .then(jsonOrThrow('funnel'))
      .then(j => setFunnel(j.data || null))
      .catch(fail('funnel'));

    const pEvents = fetch(`/api/crm/events?workspaceId=${workspaceId}&aggregation=by_type&days=30`)
      .then(jsonOrThrow('events'))
      .then(j => setEvents(j.data || []))
      .catch(fail('events'));

    Promise.all([pContacts, pSubs, pFunnel, pEvents]).finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => { loadData(); }, [loadData]);

  const topEvents = [...events].slice(0, 8).map(e => ({ name: e.eventType, count: e.count }));

  return (
    <Stack gap="lg">
      <PageHeader
        title="CRM Dashboard"
        subtitle={`${totals.total.toLocaleString()} contacts · last 30 days of activity`}
        icon={<Users className="w-5 h-5" />}
      />

      {errors.length > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4" /> Some data failed to load
          </div>
          <ul className="mt-1 list-disc pl-6">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Headline metrics */}
      <Grid cols={4}>
        <StatCard title="Total Contacts" value={totals.total.toLocaleString()} icon={<Users className="w-4 h-4" />} loading={loading} />
        <StatCard title="With Email" value={totals.emailCount.toLocaleString()} subtitle={totals.total ? `${Math.round((totals.emailCount / totals.total) * 100)}% of contacts` : undefined} icon={<Mail className="w-4 h-4" />} loading={loading} />
        <StatCard title="New (Last 7 Days)" value={totals.recentCount.toLocaleString()} icon={<UserPlus className="w-4 h-4" />} loading={loading} />
        <StatCard title="Subscribers" value={subStats.total.toLocaleString()} subtitle={`${subStats.activeCount} active · ${subStats.trialCount} trial · ${subStats.overrideCount} comp`} icon={<Star className="w-4 h-4" />} loading={loading} />
      </Grid>

      {/* Funnel + event mix */}
      <Grid cols={2}>
        <Card title="Acquisition Funnel (Last 30 Days)">
          {funnel ? (
            <Stack gap="sm">
              <Grid cols={2}>
                <StatCard title="Unique Visitors" value={funnel.totalUniqueVisitors.toLocaleString()} icon={<TrendingUp className="w-4 h-4" />} />
                <StatCard title="Page Views" value={funnel.stages.pageViews.toLocaleString()} />
                <StatCard title="CTA Clicks" value={funnel.stages.ctaClicks.toLocaleString()} />
                <StatCard title="Emails Captured" value={funnel.stages.emailsCaptured.toLocaleString()} subtitle={`${funnel.conversionRates.viewToEmail} view→email`} />
              </Grid>
            </Stack>
          ) : (
            <EmptyState title={loading ? 'Loading…' : 'No funnel data'} description={loading ? undefined : 'No funnel metrics for the last 30 days.'} />
          )}
        </Card>

        <Card title="Top Event Types (Last 30 Days)">
          {topEvents.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <RBarChart data={topEvents} layout="vertical" margin={{ left: 24, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Events']} />
                <Bar dataKey="count" fill={PRIMARY} radius={[0, 4, 4, 0]} />
              </RBarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title={loading ? 'Loading…' : 'No events'} description={loading ? undefined : 'No events recorded in the last 30 days.'} />
          )}
        </Card>
      </Grid>

      {/* Contacts table */}
      <Card title="Contacts">
        <DataTable
          data={contacts}
          loading={loading}
          searchable
          searchKeys={['email', 'name', 'campaignName', 'source']}
          pageSize={15}
          emptyMessage="No contacts found."
          columns={[
            { key: 'email', header: 'Email', sortable: true, render: (v) => v || <span className="text-gray-400">(no email)</span> },
            { key: 'name', header: 'Name', sortable: true, render: (v) => v || <span className="text-gray-400">-</span> },
            { key: 'source', header: 'Source', sortable: true, render: (_, row: Contact) => {
              const s = row.sourceCategory || row.source;
              return s ? <Badge variant="info">{s}</Badge> : <span className="text-gray-400">-</span>;
            } },
            { key: 'campaignName', header: 'Campaign', render: (v) => v
              ? <span className="text-xs" title={v}>{String(v).length > 40 ? String(v).slice(0, 40) + '…' : v}</span>
              : <span className="text-gray-400">-</span> },
            { key: 'eventCount', header: 'Events', sortable: true, render: (v) => (v || 0).toLocaleString() },
            { key: 'firstSeen', header: 'First Seen', sortable: true, render: (v) => fmtDate(v) },
          ]}
        />
      </Card>
    </Stack>
  );
}
