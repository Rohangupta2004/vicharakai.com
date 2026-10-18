/**
 * AI YouTube revision recommendations.
 *
 * Near test dates (and on demand) VicharakAI searches YouTube for the
 * student's exam — query shapes like "[exam] revision by AIR [rank]" and
 * "best [exam] revision one shot" — pulls ~50 results through the platform's
 * web-search integration (POST /api/search), ranks them with a heuristic
 * that favours topper/AIR/interview content and high view counts, stores the
 * full ranked list as a markdown report in zuno_meta, and surfaces the top
 * 3–5 as real recommendation cards (title · channel · views — not bare
 * links). The card renders on Today and, compactly, in the coach chat.
 */
import { useMemo, useState } from 'react';
import { ExternalLink, Loader2, PlayCircle, RefreshCw, Youtube } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BRAND_GRADIENT,
  NAVY_ALT,
  ON_AMBER,
  RADIUS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  tint,
} from '../../theme';
import { Card } from '../../ui';
import { useApp } from '../../app/AppContext';
import { examLabelFromId } from '../../customExam';

/** zuno_meta keys — the compact card cache and the full markdown report. */
const CACHE_META_KEY = 'yt_recs_cache';
const REPORT_META_KEY = 'yt_recs_markdown';
/** A cached list this many days old is refreshed on the next tap. */
const CACHE_FRESH_DAYS = 7;
/** "Near test dates": the card self-surfaces inside this exam countdown. */
export const YT_RECS_NEAR_EXAM_DAYS = 45;

export interface YtRec {
  title: string;
  link: string;
  channel: string;
  views: string | null;
  reason: string;
}

interface RawResult {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
}

/** Best-effort "1.2M views" out of a search snippet, or null. */
function parseViews(text: string): string | null {
  const match = /([\d.,]+\s*[KkMm]?)\s*views/.exec(text);
  return match ? `${(match[1] ?? '').trim()} views` : null;
}

/** Best-effort channel name: serp titles often end "… - ChannelName". */
function parseChannel(title: string): string {
  const cleaned = title.replace(/\s*-\s*YouTube\s*$/i, '');
  const parts = cleaned.split(/\s[|‑–—-]\s/);
  return parts.length > 1 ? (parts[parts.length - 1] ?? '').trim().slice(0, 40) : 'YouTube';
}

/** Heuristic rank — approximates "most liked / most viewed / by AIR rankers /
 * interviews / hidden gems" without a YouTube API: keyword boosts + position. */
function scoreResult(result: RawResult): { score: number; reason: string } {
  const text = `${result.title ?? ''} ${result.snippet ?? ''}`.toLowerCase();
  let score = Math.max(0, 30 - (result.position ?? 30));
  let reason = 'Popular pick';
  if (/\bair\s*-?\s*\d+|\brank\s*-?\s*\d+|topper/.test(text)) {
    score += 40;
    reason = 'By an AIR ranker / topper';
  }
  if (/interview/.test(text)) {
    score += 18;
    reason = 'Topper interview';
  }
  if (/one\s*shot|revision|marathon|crash course/.test(text)) score += 15;
  const views = parseViews(`${result.snippet ?? ''}`);
  if (views && /[Mm]/.test(views)) score += 12;
  else if (views && /[Kk]/.test(views)) score += 6;
  else if (views) score += 3;
  return { score, reason };
}

async function searchOnce(query: string, num: number): Promise<RawResult[]> {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, searchType: 'web', num }),
  });
  const data = (await response.json()) as { success?: boolean; results?: RawResult[] };
  if (!response.ok || !data.success || !Array.isArray(data.results)) return [];
  return data.results;
}

/**
 * ~50 YouTube results across the spec's query shapes, deduped and ranked.
 * Returns the top recommendations plus the full ranked markdown report.
 */
export async function fetchYoutubeRecommendations(
  examLabel: string,
  today: string,
): Promise<{ recs: YtRec[]; markdown: string }> {
  const queries = [
    `${examLabel} revision by AIR rank topper site:youtube.com`,
    `best ${examLabel} revision one shot site:youtube.com`,
    `${examLabel} topper interview strategy site:youtube.com`,
  ];
  const settled = await Promise.allSettled(queries.map((query) => searchOnce(query, 17)));
  const seen = new Set<string>();
  const ranked: Array<YtRec & { score: number }> = [];
  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue;
    for (const result of outcome.value) {
      const link = String(result.link ?? '');
      if (!/youtube\.com|youtu\.be/.test(link) || seen.has(link)) continue;
      seen.add(link);
      const { score, reason } = scoreResult(result);
      ranked.push({
        title: String(result.title ?? '').replace(/\s*-\s*YouTube\s*$/i, '').slice(0, 120) || 'YouTube video',
        link,
        channel: parseChannel(String(result.title ?? '')),
        views: parseViews(`${result.snippet ?? ''}`),
        reason,
        score,
      });
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  const markdown = [
    `# ${examLabel} — YouTube revision recommendations`,
    `Generated ${today} · ${ranked.length} videos found · ranked by topper/AIR signals, interviews and popularity.`,
    '',
    ...ranked.map(
      (rec, index) =>
        `${index + 1}. [${rec.title}](${rec.link}) — ${rec.channel}${rec.views ? ` · ${rec.views}` : ''} · ${rec.reason}`,
    ),
  ].join('\n');
  return { recs: ranked.slice(0, 5).map(({ score: _score, ...rec }) => rec), markdown };
}

interface CachePayload {
  examLabel: string;
  fetchedOn: string;
  recs: YtRec[];
}

function readCache(raw: string | undefined | null): CachePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachePayload;
    return parsed && Array.isArray(parsed.recs) && parsed.recs.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The recommendation card. Self-surfaces near the exam; once fetched, the
 * cached list keeps showing (with a quiet refresh) wherever it's rendered.
 * `compact` trims it to 3 rows for the coach chat.
 */
export default function YoutubeRecsCard({ compact = false }: { compact?: boolean }) {
  const { data, toast } = useApp();
  const { metaMap, upsertMeta, daysToExam, examDef, savedExamLabel, profile, today } = data;
  const { showToast } = toast;
  const [loading, setLoading] = useState(false);
  const [fresh, setFresh] = useState<CachePayload | null>(null);

  const examLabel = examDef?.name ?? (savedExamLabel || (profile ? examLabelFromId(profile.exam) : ''));
  const cached = useMemo(() => readCache(metaMap.get(CACHE_META_KEY)?.meta_value), [metaMap]);
  const payload = fresh ?? (cached && cached.examLabel === examLabel ? cached : null);
  const nearExam = daysToExam <= YT_RECS_NEAR_EXAM_DAYS;

  if (!examLabel || (!nearExam && !payload)) return null;

  const stale = payload
    ? Math.abs(new Date(`${today}T12:00:00`).getTime() - new Date(`${payload.fetchedOn}T12:00:00`).getTime()) >
      CACHE_FRESH_DAYS * 86400000
    : true;

  const refresh = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { recs, markdown } = await fetchYoutubeRecommendations(examLabel, today);
      if (recs.length === 0) {
        showToast("No videos came back — mind trying once more in a bit?");
        return;
      }
      const next: CachePayload = { examLabel, fetchedOn: today, recs };
      setFresh(next);
      // Persist the card cache AND the full ranked markdown report.
      try {
        await upsertMeta(CACHE_META_KEY, JSON.stringify(next));
        await upsertMeta(REPORT_META_KEY, markdown);
      } catch {
        /* the fetched list still shows this session */
      }
    } catch {
      showToast("Video search didn't go through — mind trying once more?");
    } finally {
      setLoading(false);
    }
  };

  const visible = payload ? payload.recs.slice(0, compact ? 3 : 5) : [];

  return (
    <Card radius={RADIUS.lg} className={compact ? 'mt-3 p-3.5' : 'mt-5 p-4 vicharak-rise'} testId="card-youtube-recs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 min-w-0 truncate text-[14px] font-extrabold" style={{ color: TEXT }}>
          <Youtube className="w-4 h-4 flex-shrink-0" style={{ color: '#FF0033' }} />
          Top revision videos · {examLabel}
        </h2>
        {payload && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void refresh()}
            aria-label="Refresh video recommendations"
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50 touch-manipulation"
            style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
            data-testid="button-yt-refresh"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      {!payload ? (
        <>
          <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
            {daysToExam} days out — want the best {examLabel} revision videos? I'll rank ~50 results by AIR
            rankers, topper interviews and views, and keep the top picks here.
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void refresh()}
            className="mt-3 w-full py-3 text-[13px] font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2 touch-manipulation"
            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
            data-testid="button-yt-fetch"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
            {loading ? 'Searching and ranking…' : 'Get my video recommendations'}
          </button>
        </>
      ) : (
        <>
          <ul className="mt-2.5 space-y-1.5" data-testid="list-yt-recs">
            {visible.map((rec) => (
              <li key={rec.link}>
                <a
                  href={rec.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2.5 touch-manipulation"
                  style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                  data-testid={`yt-rec-${rec.link.slice(-11)}`}
                >
                  <PlayCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#FF0033' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-bold leading-snug" style={{ color: TEXT, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {rec.title}
                    </span>
                    <span className="block text-[10px] mt-0.5 truncate" style={{ color: TEXT_MUTED }}>
                      {rec.channel}
                      {rec.views ? ` · ${rec.views}` : ''} · {rec.reason}
                    </span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TEXT_MUTED }} />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px]" style={{ color: TEXT_MUTED }}>
            Ranked from ~50 results · fetched {payload.fetchedOn}
            {stale ? ' · tap ↻ for a fresh list' : ''} · full report saved to your notes.
          </p>
        </>
      )}
    </Card>
  );
}
