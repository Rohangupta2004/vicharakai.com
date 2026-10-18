import { useState, useEffect } from 'react';
import { PageHeader, Grid, Stack, StatCard, DataTable, Badge, BarChart, PieChart } from 'dashboard-blocks';
import { BarChart3, DoorOpen, Users, Mail, MessageSquare } from 'lucide-react';

interface TemplateProps {
  workspaceId: string;
  authToken?: string;
}

export function AnalyticsDashboard({ workspaceId, authToken }: TemplateProps) {
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const __dt = typeof localStorage !== 'undefined' ? localStorage.getItem('workspace_device_token') : null;
  const authHeaders: Record<string, string> = authToken ? { 'Authorization': 'Bearer ' + authToken } : __dt ? { 'x-device-token': __dt } : {};

  useEffect(() => {
    async function fetchData() {
      const json = async (r: Response) => {
        if (!r.ok) { const t = await r.text(); throw new Error(t); }
        return r.json();
      };
      // by_type over the full year is the source of truth for event volume.
      try {
        const res = await fetch(`/api/crm/events?workspaceId=${workspaceId}&aggregation=by_type&days=365&excludeType=scroll_depth`, { credentials: 'include', headers: authHeaders });
        const byType = await json(res);
        const counts: Record<string, number> = {};
        (Array.isArray(byType.data) ? byType.data : []).forEach((r: any) => { counts[r.eventType] = Number(r.count) || 0; });
        setEventCounts(counts);
      } catch (e: any) { setErrors(prev => [...prev, `events by_type: ${e.message}`]); }

      try {
        const res = await fetch(`/api/crm/events?workspaceId=${workspaceId}&aggregation=by_day&days=14&excludeType=scroll_depth`, { credentials: 'include', headers: authHeaders });
        const byDay = await json(res);
        const rows = Array.isArray(byDay.data) ? byDay.data : [];
        setDailyData(rows.slice().reverse().map((r: any) => ({
          label: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: Number(r.count) || 0,
        })));
      } catch (e: any) { setErrors(prev => [...prev, `events by_day: ${e.message}`]); }

      try {
        const res = await fetch(`/api/crm/events?workspaceId=${workspaceId}&limit=20&days=365`, { credentials: 'include', headers: authHeaders });
        const recent = await json(res);
        const evts = (recent.data || recent.events || []).map((e: any) => ({ ...e, eventType: e.eventType || e.type }));
        setRecentEvents(evts);
      } catch (e: any) { setErrors(prev => [...prev, `recent events: ${e.message}`]); }

      setLoading(false);
    }
    fetchData();
  }, [workspaceId]);

  const c = (k: string) => eventCounts[k] || 0;
  const totalEvents = Object.values(eventCounts).reduce((a, b) => a + b, 0);

  // Human-friendly labels for this workspace's real event types.
  const typeLabels: Record<string, string> = {
    app_opened: 'App Opened',
    space_entered: 'Space Entered',
    email_submit: 'Email Submit',
    lead: 'Lead',
    agent_message: 'Agent Message',
    agent_view_opened: 'Agent View Opened',
    thread_created: 'Thread Created',
    thread_switched: 'Thread Switched',
  };

  const palette = ['#0d69b3', '#009f50', '#ec8c22', '#9b6ba8'];
  const pieData = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label: typeLabels[label] || label, value, color: palette[i % palette.length] }));

  const pct = (n: number) => totalEvents ? Math.round((n / totalEvents) * 100) + '% of events' : '';

  return (
    <Stack>
      <PageHeader
        title="Analytics Dashboard"
        subtitle="Event tracking and funnel analysis — last 365 days"
      />

      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <div className="font-medium mb-1">Some data failed to load</div>
          <ul className="list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      <Grid cols={4}>
        <StatCard
          title="Total Events"
          value={totalEvents.toLocaleString()}
          subtitle={`${Object.keys(eventCounts).length} event types`}
          icon={<BarChart3 className="w-5 h-5" />}
          loading={loading}
        />
        <StatCard
          title="App Opens"
          value={c('app_opened').toLocaleString()}
          subtitle={pct(c('app_opened'))}
          icon={<DoorOpen className="w-5 h-5" />}
          loading={loading}
        />
        <StatCard
          title="Leads"
          value={c('lead').toLocaleString()}
          subtitle={`${c('email_submit').toLocaleString()} email submits`}
          icon={<Users className="w-5 h-5" />}
          loading={loading}
        />
        <StatCard
          title="Agent Messages"
          value={c('agent_message').toLocaleString()}
          subtitle={`${c('agent_view_opened').toLocaleString()} agent views opened`}
          icon={<MessageSquare className="w-5 h-5" />}
          loading={loading}
        />
      </Grid>

      <Grid cols={2}>
        <BarChart
          title="Events by Day (last 14 days)"
          data={dailyData}
          color="#0d69b3"
        />
        <PieChart
          title="Events by Type"
          data={pieData}
        />
      </Grid>

      <DataTable
        title="Recent Events"
        data={recentEvents}
        columns={[
          { key: 'eventType', header: 'Event Type', render: (val: string) => <Badge variant="info">{typeLabels[val] || val}</Badge> },
          { key: 'eventData', header: 'Details', render: (val: any) => {
            if (!val || typeof val !== 'object') return '-';
            const detail = val.source || val.page || val.email || val.path || '-';
            return String(detail);
          }},
          { key: 'createdAt', header: 'Time', render: (val: string) => {
            if (!val) return '-';
            const date = new Date(val);
            return isNaN(date.getTime()) ? '-' : date.toLocaleString();
          }}
        ]}
        pageSize={10}
        loading={loading}
        emptyMessage="No events tracked yet."
      />
    </Stack>
  );
}
