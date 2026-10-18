import { useState, useEffect, useCallback, useMemo } from 'react';
import { Mail, MailCheck, Users, Clock, TrendingUp, Sparkles, Gift, UserX, Send, Copy, Check, Zap } from 'lucide-react';
import {
  PageHeader, Grid, Stack, Card, StatCard, DataTable, Badge, PieChart, EmptyState, Tabs, Button,
} from 'dashboard-blocks';
import {
  ResponsiveContainer, AreaChart, Area, BarChart as RBarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

interface TemplateProps { workspaceId: string; }

const COLORS = { primary: '#0d69b3', green: '#009f50', orange: '#ec8c22', purple: '#9b6ba8' };

// Statuses that mean the person currently HAS access — everyone else is a win-back target.
const ACTIVE_STATUSES = ['active', 'manual_override', 'trialing', 'trial'];
const isActiveStatus = (s?: string) => !!s && ACTIVE_STATUSES.includes(s);
// Skip internal / synthetic probe addresses.
const isRealEmail = (e?: string) =>
  !!e && /@/.test(e) && !/@agentmail\.to$/i.test(e) && !/canary|probe|test-/i.test(e);

function fmtDate(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtDateTime(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function firstName(name?: string, email?: string) {
  if (name && name.trim() && !/^geez!?$/i.test(name.trim())) return name.trim().split(/\s+/)[0];
  if (email) return email.split('@')[0].replace(/[._\-].*$/, '').replace(/[0-9]+/g, '') || 'there';
  return 'there';
}

const CLAIM_URL = 'https://vicharakai.com';

// The exact copy the AI Win-Back Autopilot sends. Personalised per recipient.
function composeWinBack(name?: string, email?: string) {
  const fn = firstName(name, email);
  const subject = `A gift from me, ${fn} — 7 days of VicharakAI, on the house 🎁`;
  const body =
`Hi ${fn},

I'm Rohan, the founder of VicharakAI. I noticed you checked us out but never started your prep with us — and I'd genuinely love to know what held you back.

Whatever the reason, let me make the decision easy: here are 7 days of VicharakAI Premium, completely free. My personal gift, so you can see for yourself whether it fits your NEET/JEE prep.

Claim your 7 free days here: ${CLAIM_URL}

And if something didn't work, felt confusing, or you just have feedback — hit reply. This comes straight to my inbox and I read every message.

Rooting for you,
Rohan
Founder, VicharakAI`;
  return { subject, body };
}

// ── Ready-to-deploy autonomous engine (shown in the "Make it autonomous" card) ──
const HOOK_CODE = `// Server Hook: "winback-autopilot"  —  schedule: run daily (e.g. 0 9 * * *)
// Makes the win-back campaign fully autonomous: finds inactive users,
// writes a personal note from Rohan, sends it, and never emails the same person twice.
const CLAIM_URL = 'https://vicharakai.com';

// 1) Who is not active? (trial expired / never converted, excluding current members)
const subs = await platform.getSubscribers();               // [{ email, name, status }]
const activeStatuses = ['active','manual_override','trialing','trial'];
const targets = subs.filter(s =>
  s.email && !activeStatuses.includes(s.status) &&
  !/@agentmail\\.to$/i.test(s.email) && !/canary|probe/i.test(s.email)
);

// 2) Skip anyone already contacted (tracked in a simple meta table)
const sent = await platform.db.query(
  "SELECT meta_value FROM zuno_meta WHERE meta_key = 'winback_sent'");
const already = new Set(sent.rows.map(r => r.meta_value));

for (const t of targets) {
  if (already.has(t.email)) continue;
  const fn = (t.name || t.email.split('@')[0]).split(' ')[0];

  // 3) Let the AI write a warm, personal note (fallback to template on error)
  const ai = await platform.generateText({
    model: 'gpt-5.6-terra',
    systemPrompt: 'You are Rohan, founder of VicharakAI (NEET/JEE prep app). Warm, brief, first person.',
    userPrompt: \`Write a short win-back email to \${fn}, who signed up interest but never started. \` +
      \`Welcome them, gently ask what held them back, and offer 7 days of VicharakAI Premium free. \` +
      \`Include this claim link once: \${CLAIM_URL}. Sign off as Rohan, Founder, VicharakAI. Plain text.\`,
    maxTokens: 350,
  });
  const body = (ai && ai.text) ? ai.text :
    \`Hi \${fn}, I'm Rohan from VicharakAI. Here are 7 free days of Premium — \${CLAIM_URL}. — Rohan\`;

  // 4) Send it, from Rohan
  await platform.sendEmail({
    to: t.email,
    fromName: 'Rohan · VicharakAI',
    subject: \`A gift from me, \${fn} — 7 days of VicharakAI, on the house\`,
    text: body,
  });

  // 5) Remember we contacted them
  await platform.db.query(
    "INSERT INTO zuno_meta (meta_key, meta_value) VALUES ('winback_sent', $1)", [t.email]);
}

return { attempted: targets.length };`;

// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ workspaceId }: TemplateProps) {
  const [funnel, setFunnel] = useState<any>(null);
  const [captureByDay, setCaptureByDay] = useState<any[]>([]);
  const [captureFeed, setCaptureFeed] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [subs, setSubs] = useState<any>(null);
  const [inbound, setInbound] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    setErrors([]);
    const jsonOrThrow = (label: string) => (r: Response) => {
      if (!r.ok) return r.text().then(t => Promise.reject(new Error(`${label}: ${t}`)));
      return r.json();
    };
    const track = (e: Error) => setErrors(prev => [...prev, e.message]);

    const p1 = fetch(`/api/crm/funnel-metrics?workspaceId=${workspaceId}&days=30`)
      .then(jsonOrThrow('funnel-metrics')).then(j => setFunnel(j.data)).catch(track);
    const p2 = fetch(`/api/crm/events?workspaceId=${workspaceId}&eventType=email_submit&days=60&aggregation=by_day`)
      .then(jsonOrThrow('captures by day')).then(j => setCaptureByDay(j.data || [])).catch(track);
    const p3 = fetch(`/api/crm/events?workspaceId=${workspaceId}&eventType=email_submit&days=60&limit=500`)
      .then(jsonOrThrow('capture feed')).then(j => setCaptureFeed(j.data || [])).catch(track);
    const p4 = fetch(`/api/crm/events?workspaceId=${workspaceId}&eventType=lead&days=60&limit=500`)
      .then(jsonOrThrow('leads')).then(j => setLeads(j.data || [])).catch(track);
    const p5 = fetch(`/api/crm/subscribers/${workspaceId}`)
      .then(jsonOrThrow('subscribers')).then(j => setSubs(j)).catch(track);
    const p6 = fetch(`/api/workspaces/${workspaceId}/db/sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(window as any).__DASHBOARD_AUTH_TOKEN__}` },
      body: JSON.stringify({ query: 'SELECT id, recipient_base, sender_email, sender_name, subject, received_at FROM inbound_emails ORDER BY received_at DESC', limit: 100 }),
    }).then(jsonOrThrow('inbound emails')).then(j => setInbound(j.rows || [])).catch(track);

    Promise.allSettled([p1, p2, p3, p4, p5, p6]).then(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const chartData = [...captureByDay]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({ date: fmtDate(d.date), count: d.count }));

  const adsetCounts: Record<string, number> = {};
  leads.forEach(l => {
    const raw = l.eventData?.utmContent || l.eventData?.utmcontent || 'Unattributed';
    const clean = String(raw).replace(/\s*\[atmpt:[^\]]+\].*/, '').replace(/^VicharakAI\s*-\s*/, '').trim() || 'Unattributed';
    adsetCounts[clean] = (adsetCounts[clean] || 0) + 1;
  });
  const adsetData = Object.entries(adsetCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const subPie = subs ? [
    { label: 'Active', value: subs.activeCount || 0, color: COLORS.green },
    { label: 'Trialing', value: subs.trialCount || 0, color: COLORS.primary },
    { label: 'Trial Expired', value: subs.expiredCount || 0, color: COLORS.orange },
    { label: 'Manual Override', value: subs.overrideCount || 0, color: COLORS.purple },
  ].filter(s => s.value > 0) : [];

  const feed = [
    ...captureFeed.map(e => ({ key: 'es_' + e.id, email: e.eventData?.label || '-', source: 'Email Gate', when: e.createdAt })),
    ...leads.map(e => ({ key: 'ld_' + e.id, email: e.eventData?.email || '-', source: 'Ad Lead', when: e.createdAt })),
  ].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

  return (
    <Stack gap="lg">
      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="font-medium mb-1">Some data failed to load:</div>
          <ul className="list-disc list-inside space-y-0.5">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <Grid cols={4}>
        <StatCard title="Emails Captured" value={funnel?.stages?.emailsCaptured ?? 0} subtitle="last 30 days" icon={<MailCheck className="w-4 h-4" />} loading={loading} />
        <StatCard title="Visitor → Email" value={funnel?.conversionRates?.viewToEmail ?? '-'} subtitle={`${funnel?.totalUniqueVisitors ?? 0} unique visitors`} icon={<TrendingUp className="w-4 h-4" />} loading={loading} />
        <StatCard title="Active Subscribers" value={subs?.activeCount ?? 0} subtitle={`of ${subs?.total ?? 0} contacts`} icon={<Users className="w-4 h-4" />} loading={loading} />
        <StatCard title="On Trial" value={subs?.trialCount ?? 0} subtitle={`${subs?.expiredCount ?? 0} expired`} icon={<Clock className="w-4 h-4" />} loading={loading} />
      </Grid>

      <Card title="Emails Captured Over Time">
        {chartData.length === 0 ? (
          <EmptyState title="No captures yet" description="Email captures from the last 60 days will appear here." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="capFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="count" name="Emails captured" stroke={COLORS.primary} strokeWidth={2} fill="url(#capFill)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Grid cols={2}>
        <Card title="Top Ad Sets by Leads">
          {adsetData.length === 0 ? (
            <EmptyState title="No lead attribution" description="Leads with UTM data appear here." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <RBarChart data={adsetData} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Leads" fill={COLORS.green} radius={[0, 4, 4, 0]} />
              </RBarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Subscriber Status">
          {subPie.length === 0 ? (<EmptyState title="No subscriber data" />) : (<PieChart data={subPie} />)}
        </Card>
      </Grid>

      <DataTable
        title={`Captured Emails (${feed.length})`}
        data={feed}
        loading={loading}
        searchable
        searchKeys={['email']}
        pageSize={10}
        emptyMessage="No captured emails in the last 60 days."
        columns={[
          { key: 'email', header: 'Email', sortable: true },
          { key: 'source', header: 'Source', render: (v) => (<Badge variant={v === 'Ad Lead' ? 'info' : 'success'}>{v}</Badge>) },
          { key: 'when', header: 'Captured', sortable: true, render: (v) => fmtDateTime(v) },
        ]}
      />

      <DataTable
        title={`Inbound Messages (${inbound.length})`}
        data={inbound}
        loading={loading}
        searchable
        searchKeys={['subject', 'sender_email', 'sender_name']}
        pageSize={10}
        emptyMessage="No inbound emails received yet."
        columns={[
          { key: 'sender_name', header: 'From', render: (v, row) => (
            <div>
              <div className="font-medium">{v || row.sender_email || '-'}</div>
              {v && row.sender_email ? <div className="text-xs text-gray-500">{row.sender_email}</div> : null}
            </div>
          ) },
          { key: 'subject', header: 'Subject', sortable: true },
          { key: 'recipient_base', header: 'To', render: (v) => <span className="text-gray-600">{v || '-'}</span> },
          { key: 'received_at', header: 'Received', sortable: true, render: (v) => fmtDateTime(v) },
        ]}
      />
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function WinBackTab({ workspaceId }: TemplateProps) {
  const [subs, setSubs] = useState<any>(null);
  const [sentEmails, setSentEmails] = useState<{ email: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedHook, setCopiedHook] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErrors([]);
    const subscribersRequest = fetch(`/api/crm/subscribers/${workspaceId}`)
      .then(r => { if (!r.ok) return r.text().then(t => Promise.reject(new Error(`subscribers: ${t}`))); return r.json(); })
      .then(j => setSubs(j))
      .catch(e => setErrors(prev => [...prev, e.message]));
    const sentEmailsRequest = fetch(`/api/workspaces/${workspaceId}/db/sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(window as any).__DASHBOARD_AUTH_TOKEN__}` },
      body: JSON.stringify({ query: "SELECT meta_key, meta_value, created_at FROM zuno_meta WHERE meta_key = 'winback_sent' OR id = (SELECT max(id) FROM zuno_meta) ORDER BY created_at DESC" }),
    })
      .then(r => { if (!r.ok) return r.text().then(t => Promise.reject(new Error(t))); return r.json(); })
      .then(j => setSentEmails((j.rows || [])
        .filter((row: any) => row.meta_key === 'winback_sent')
        .map((row: any) => ({ email: row.meta_value, created_at: row.created_at }))))
      .catch(() => setSentEmails([]));

    Promise.allSettled([subscribersRequest, sentEmailsRequest]).then(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  // Win-back audience: real emails that are NOT currently active.
  const audience = useMemo(() => {
    const list: any[] = subs?.subscribers || [];
    return list
      .filter(s => isRealEmail(s.email) && !isActiveStatus(s.status))
      .map(s => ({
        email: s.email,
        name: s.name || '',
        status: s.status || 'unknown',
        createdAt: s.createdAt,
      }))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [subs]);

  const expiredCount = audience.filter(a => a.status === 'trial_expired').length;
  const otherInactive = audience.length - expiredCount;
  const sentByEmail = useMemo(() => {
    const sent = new Map<string, string>();
    sentEmails.forEach(row => {
      const email = String(row.email || '').trim().toLowerCase();
      if (email && !sent.has(email)) sent.set(email, row.created_at);
    });
    return sent;
  }, [sentEmails]);

  // Selected recipient for the live preview (default: first in audience).
  const selected = useMemo(() => {
    if (!audience.length) return null;
    return audience.find(a => a.email === selectedEmail) || audience[0];
  }, [audience, selectedEmail]);

  const preview = composeWinBack(selected?.name, selected?.email);

  const copy = (text: string, setFlag: (b: boolean) => void) => {
    navigator.clipboard?.writeText(text).then(() => {
      setFlag(true);
      setTimeout(() => setFlag(false), 1600);
    }).catch(() => {});
  };

  return (
    <Stack gap="lg">
      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="font-medium mb-1">Some data failed to load:</div>
          <ul className="list-disc list-inside space-y-0.5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      {/* What this does */}
      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium mb-1">AI Win-Back Autopilot</div>
            <p>
              Every inactive contact gets a warm, personal note from Rohan — a welcome, a genuine
              "what held you back?", and a gift of <strong>7 free days of VicharakAI Premium</strong>.
              Preview the exact message below. To send it automatically every day, deploy the engine
              in the <strong>Make it autonomous</strong> card at the bottom.
            </p>
          </div>
        </div>
      </div>

      {/* Audience headline */}
      <Grid cols={4}>
        <StatCard title="Win-Back Audience" value={audience.length} subtitle="not active right now" icon={<UserX className="w-4 h-4" />} loading={loading} />
        <StatCard title="Trial Expired" value={expiredCount} subtitle="started but never converted" icon={<Clock className="w-4 h-4" />} loading={loading} />
        <StatCard title="Other Inactive" value={otherInactive} subtitle="captured, never a member" icon={<Users className="w-4 h-4" />} loading={loading} />
        <StatCard title="Sent Win-Backs" value={sentEmails.length} subtitle="emails sent by autopilot" icon={<Send className="w-4 h-4" />} loading={loading} />
      </Grid>

      {/* Live message preview */}
      <Card
        title="The message the autopilot sends"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={copiedSubject ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} onClick={() => copy(preview.subject, setCopiedSubject)}>
              {copiedSubject ? 'Copied' : 'Subject'}
            </Button>
            <Button size="sm" variant="secondary" icon={copiedBody ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} onClick={() => copy(preview.body, setCopiedBody)}>
              {copiedBody ? 'Copied' : 'Body'}
            </Button>
          </div>
        }
      >
        <Stack gap="md">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500">Previewing for:</span>
            <select
              className="border rounded px-2 py-1 text-sm max-w-xs"
              value={selected?.email || ''}
              onChange={(e) => setSelectedEmail(e.target.value)}
            >
              {audience.map(a => (
                <option key={a.email} value={a.email}>{a.name ? `${a.name} — ${a.email}` : a.email}</option>
              ))}
            </select>
            {selected && <Badge variant={selected.status === 'trial_expired' ? 'warning' : 'info'}>{selected.status}</Badge>}
          </div>

          <div className="rounded-md border bg-white">
            <div className="border-b px-4 py-2 text-sm">
              <div><span className="text-gray-500">From:</span> Rohan · VicharakAI</div>
              <div><span className="text-gray-500">To:</span> {selected?.email || '—'}</div>
              <div className="font-medium mt-1">{preview.subject}</div>
            </div>
            <pre className="px-4 py-3 text-sm whitespace-pre-wrap font-sans text-gray-800">{preview.body}</pre>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Gift className="w-3.5 h-3.5" />
            Reward: a claim link to <span className="font-mono">{CLAIM_URL}</span> — 7 free days are granted when they return and sign in.
          </div>
        </Stack>
      </Card>

      {/* Audience table */}
      <DataTable
        title={`Win-Back Audience (${audience.length})`}
        data={audience}
        loading={loading}
        searchable
        searchKeys={['email', 'name']}
        pageSize={12}
        emptyMessage="No inactive contacts to win back right now."
        onRowClick={(row: any) => setSelectedEmail(row.email)}
        columns={[
          { key: 'name', header: 'Name', render: (v, row) => <span className="font-medium">{v || firstName(row.name, row.email)}</span> },
          { key: 'email', header: 'Email', sortable: true },
          { key: 'status', header: 'Status', sortable: true, render: (v) => (
            <Badge variant={v === 'trial_expired' ? 'warning' : 'default'}>{v}</Badge>
          ) },
          { key: 'createdAt', header: 'First Seen', sortable: true, render: (v) => fmtDate(v) },
          { key: 'preview', header: '', render: (_: any, row: any) => {
            const sentAt = sentByEmail.get(String(row.email || '').trim().toLowerCase());
            return sentAt ? (
              <div className="flex items-center gap-2">
                <Badge variant="success">Contacted ✓</Badge>
                <span className="text-xs text-gray-500">{fmtDate(sentAt)}</span>
              </div>
            ) : (
              <Button size="sm" variant="ghost" icon={<Send className="w-3 h-3" />} onClick={() => setSelectedEmail(row.email)}>Preview</Button>
            );
          } },
        ]}
      />

      <DataTable
        title={`Sent Win-Backs (${sentEmails.length})`}
        data={sentEmails.map(row => ({ email: row.email, sentAt: row.created_at }))}
        loading={loading}
        searchable
        searchKeys={['email']}
        pageSize={10}
        emptyMessage="No win-back emails sent yet — deploy the autopilot hook to start."
        columns={[
          { key: 'email', header: 'Email', sortable: true },
          { key: 'sentAt', header: 'Sent At', sortable: true, render: (v) => fmtDateTime(v) },
        ]}
      />

      {/* Make it autonomous */}
      <Card
        title="Make it autonomous"
        actions={
          <Button size="sm" variant="primary" icon={copiedHook ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} onClick={() => copy(HOOK_CODE, setCopiedHook)}>
            {copiedHook ? 'Copied' : 'Copy engine code'}
          </Button>
        }
      >
        <Stack gap="md">
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <Zap className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" />
            <p>
              Deploy the hook below as a <strong>Server Hook</strong> named <span className="font-mono">winback-autopilot</span> with a
              daily schedule (<span className="font-mono">0 9 * * *</span>) from the <strong>Server Hooks &amp; Tasks</strong> dashboard.
              Once running, sent records will appear in the 'Sent Win-Backs' table above and contacts will
              be marked Contacted automatically.
            </p>
          </div>
          <pre className="rounded-md border bg-gray-50 p-3 text-xs overflow-x-auto text-gray-800">{HOOK_CODE}</pre>
        </Stack>
      </Card>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export function EmailDashboard({ workspaceId }: TemplateProps) {
  return (
    <Stack gap="lg">
      <PageHeader
        title="Email"
        subtitle="Capture funnel, subscribers, inbound messages, and the AI win-back autopilot"
        icon={<Mail className="w-5 h-5" />}
      />
      <Tabs
        defaultTab="overview"
        tabs={[
          { id: 'overview', label: 'Overview', content: <OverviewTab workspaceId={workspaceId} /> },
          { id: 'winback', label: 'AI Win-Back Autopilot', content: <WinBackTab workspaceId={workspaceId} /> },
        ]}
      />
    </Stack>
  );
}
