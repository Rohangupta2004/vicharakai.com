import { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Mail, Activity, Zap, TrendingUp, Clock } from 'lucide-react';
import {
  ResponsiveContainer, BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import {
  PageHeader, Grid, Stack, StatCard, DataTable, Badge, Card, EmptyState,
} from 'dashboard-blocks';

interface TemplateProps { workspaceId: string; }

interface Contact {
  id: string;
  email: string | null;
  name: string | null;
  source: string | null;
  sourceCategory: string | null;
  utmCampaign: string | null;
  campaignName: string | null;
  eventCount: number;
  actions: string[];
  firstSeen: string | null;
  lastSeen: string | null;
  createdAt: string | null;
}

const COLORS = ['#0d69b3', '#009f50', '#ec8c22', '#9b6ba8'];

function fmtDate(v: string | null) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function spanLabel(first: string | null, last: string | null): string {
  if (!first || !last) return '-';
  const ms = new Date(last).getTime() - new Date(first).getTime();
  if (ms <= 0) return '< 1m';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

function actionVariant(a: string): 'success' | 'info' | 'default' {
  if (a === 'email_captured') return 'success';
  if (a === 'chat') return 'info';
  return 'default';
}

export function CustomerJourneysDashboard({ workspaceId }: TemplateProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    setErrors([]);
    fetch(`/api/crm/contacts/${workspaceId}`)
      .then(r => { if (!r.ok) return r.text().then(t => Promise.reject(new Error(t))); return r.json(); })
      .then(json => { setContacts(json.contacts || []); setLoading(false); })
      .catch(e => { setErrors(prev => [...prev, `contacts: ${e.message}`]); setLoading(false); });
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const withEmail = contacts.filter(c => c.email).length;
    const engaged = contacts.filter(c => (c.eventCount || 0) > 0).length;
    const converted = contacts.filter(c => (c.actions || []).includes('email_captured')).length;
    const totalEvents = contacts.reduce((s, c) => s + (c.eventCount || 0), 0);
    const avgEvents = contacts.length ? Math.round((totalEvents / contacts.length) * 10) / 10 : 0;
    return { withEmail, engaged, converted, totalEvents, avgEvents };
  }, [contacts]);

  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    contacts.forEach(c => {
      const k = c.sourceCategory || c.source || 'unknown';
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [contacts]);

  const topEngaged = useMemo(
    () => [...contacts]
      .sort((a, b) => (b.eventCount || 0) - (a.eventCount || 0))
      .slice(0, 6)
      .map(c => ({ label: c.email ? c.email.split('@')[0] : (c.name || 'anon'), value: c.eventCount || 0 })),
    [contacts]
  );

  return (
    <Stack>
      <PageHeader
        title="Customer Journeys"
        subtitle={`${contacts.length} contacts · ${stats.totalEvents} tracked events`}
        icon={<Users className="w-5 h-5" />}
      />

      {errors.length > 0 && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <div className="font-medium mb-1">Some data failed to load</div>
          {errors.map((e, i) => <div key={i} className="font-mono text-xs">{e}</div>)}
        </div>
      )}

      <Grid cols={4}>
        <StatCard title="Total Contacts" value={contacts.length} icon={<Users className="w-4 h-4" />} loading={loading} />
        <StatCard title="Engaged" value={stats.engaged} subtitle={`of ${contacts.length} have activity`} icon={<Activity className="w-4 h-4" />} loading={loading} />
        <StatCard title="Email Captured" value={stats.converted} subtitle={`${contacts.length ? Math.round((stats.converted / contacts.length) * 100) : 0}% of contacts`} icon={<Mail className="w-4 h-4" />} loading={loading} />
        <StatCard title="Avg Events / Contact" value={stats.avgEvents} subtitle={`${stats.totalEvents} total events`} icon={<Zap className="w-4 h-4" />} loading={loading} />
      </Grid>

      <Grid cols={2}>
        <Card title="Where contacts come from">
          {sourceData.length === 0 ? (
            <EmptyState icon={<TrendingUp className="w-6 h-6" />} title="No source data" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <RBarChart data={sourceData} layout="vertical" margin={{ left: 12, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v} contacts`, 'Contacts']} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </RBarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Most engaged contacts">
          {topEngaged.length === 0 ? (
            <EmptyState icon={<Zap className="w-6 h-6" />} title="No engagement yet" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <RBarChart data={topEngaged} layout="vertical" margin={{ left: 12, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v} events`, 'Events']} />
                <Bar dataKey="value" fill="#0d69b3" radius={[0, 4, 4, 0]} />
              </RBarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </Grid>

      <DataTable
        title="All contacts & journeys"
        data={contacts}
        loading={loading}
        searchable
        searchKeys={['email', 'name', 'source', 'campaignName']}
        pageSize={15}
        emptyMessage="No contacts yet"
        columns={[
          {
            key: 'email', header: 'Contact', sortable: true,
            render: (v, row) => (
              <div className="flex flex-col">
                <span className="font-medium">{v || row.name || 'Anonymous'}</span>
                {row.name && v && <span className="text-xs text-gray-400">{row.name}</span>}
              </div>
            ),
          },
          {
            key: 'sourceCategory', header: 'Source', sortable: true,
            render: (v, row) => <Badge variant="default">{v || row.source || 'unknown'}</Badge>,
          },
          {
            key: 'eventCount', header: 'Events', sortable: true,
            render: (v) => <span className="font-medium">{v || 0}</span>,
          },
          {
            key: 'actions', header: 'Actions Taken',
            render: (v: string[]) => {
              if (!v || v.length === 0) return <span className="text-gray-400">-</span>;
              return (
                <div className="flex gap-1 flex-wrap">
                  {v.map((a) => <Badge key={a} variant={actionVariant(a)}>{a.replace(/_/g, ' ')}</Badge>)}
                </div>
              );
            },
          },
          {
            key: 'firstSeen', header: 'First Seen', sortable: true,
            render: (v) => fmtDate(v),
          },
          {
            key: 'lastSeen', header: 'Last Seen', sortable: true,
            render: (v) => fmtDate(v),
          },
          {
            key: 'span', header: 'Active Span',
            render: (_, row) => (
              <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                <Clock className="w-3 h-3" />{spanLabel(row.firstSeen, row.lastSeen)}
              </span>
            ),
          },
        ]}
      />
    </Stack>
  );
}
