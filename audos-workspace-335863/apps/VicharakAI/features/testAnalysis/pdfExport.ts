/**
 * Test Analysis — PDF export (jsPDF, platform-pinned bare import).
 *
 * Page 1: header + the score summary (from the mock's OWN Step 1 totals) +
 * the error-type distribution. Page 2: weak topics by marks lost + the trend
 * chart. Partial data is labelled.
 *
 * TWO RULES THIS FILE EXISTS TO KEEP:
 *
 *  1. ASCII ONLY. jsPDF's built-in Helvetica has no glyph for U+2212 (the
 *     typographic minus) or U+2248 ('≈'), so '−3 marks' printed as garbage
 *     with broken letter-spacing. Every string is pushed through `pdfSafe`,
 *     which maps the typographic minus to an ASCII hyphen-minus and folds the
 *     rest of the punctuation we use down to ASCII. Nothing reaches
 *     `doc.text` without going through it. In-app display is unaffected —
 *     this sanitising is PDF-only.
 *
 *  2. NO EMPTY FRAMES. A section with no data is skipped entirely and a chart
 *     with no points (or with every point at zero) is never drawn — not even
 *     its border. An empty chart frame reads as broken software.
 */

import { jsPDF } from 'jspdf';
import type { CrossMockAnalysis, PerMockAnalysis } from './taSelectors';
import { formatUnits, lostVerb, unitNoun } from './examConfig';

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const INK = '#1A1A2E';
const MUTED = '#6E7488';
const BRAND = '#0057FF';
const DANGER = '#DC2626';

/* ------------------------------------------------------------------ */
/*  ASCII safety — PDF-only, never applied to in-app display          */
/* ------------------------------------------------------------------ */

/** Characters the embedded font cannot draw → their ASCII stand-ins. */
const ASCII_FOLD: Array<[RegExp, string]> = [
  // U+2212 MINUS SIGN -> ASCII hyphen-minus. THE fix for '-3 marks'.
  [/\u2212/g, '-'],
  // Dashes and hyphen variants.
  [/[\u2010\u2011\u2013\u2014\u2015]/g, '-'],
  // Approximately-equal / almost-equal, which the font also lacks.
  [/[\u2248\u2245\u2243]/g, '~'],
  // Quotes and apostrophes.
  [/[\u2018\u2019\u201A\u201B\u2032]/g, "'"],
  [/[\u201C\u201D\u201E\u201F\u2033]/g, '"'],
  // Spaces, bullets, ellipsis, arrows.
  [/[\u00A0\u2007\u2009\u202F\u2005\u2006]/g, ' '],
  [/[\u2022\u00B7\u2027]/g, '-'],
  [/\u2026/g, '...'],
  [/[\u2192\u21D2]/g, '->'],
  // Fraction slash, multiplication, degree.
  [/\u2044/g, '/'],
  [/\u00D7/g, 'x'],
  [/\u00B0/g, ' deg'],
];

/**
 * Fold one string down to characters the built-in font can actually draw.
 * Anything still outside printable ASCII after the folds is dropped rather
 * than emitted as a broken glyph.
 */
export function pdfSafe(value: unknown): string {
  let text = String(value ?? '');
  for (const [pattern, replacement] of ASCII_FOLD) text = text.replace(pattern, replacement);
  return text.replace(/[^\x20-\x7E\n]/g, '').replace(/[ \t]{2,}/g, ' ');
}

/** Signed number as ASCII, e.g. -1 / +4 — never a typographic minus. */
export function pdfSigned(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return rounded < 0 ? `-${Math.abs(rounded)}` : `+${rounded}`;
}

/** The ONLY way text reaches the page. */
function put(doc: jsPDF, text: string, x: number, y: number, options?: { align?: 'left' | 'center' | 'right' }): void {
  doc.text(pdfSafe(text), x, y, options as never);
}

/* ------------------------------------------------------------------ */
/*  Layout primitives                                                  */
/* ------------------------------------------------------------------ */

function header(doc: jsPDF, title: string, subtitle: string, partial: boolean): number {
  doc.setTextColor(BRAND);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  put(doc, 'VicharakAI - Mock Test Analysis', MARGIN, 16);
  doc.setTextColor(INK);
  doc.setFontSize(17);
  put(doc, title, MARGIN, 26);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(MUTED);
  put(doc, subtitle, MARGIN, 32);
  let y = 38;
  if (partial) {
    doc.setTextColor(DANGER);
    doc.setFontSize(9);
    put(doc, 'Partial data - some wrong questions are not tagged yet, so topic trends may be incomplete.', MARGIN, y);
    y += 6;
  }
  return y + 2;
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setTextColor(INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  put(doc, text, MARGIN, y);
  return y + 6;
}

function bodyLine(doc: jsPDF, text: string, y: number, color = INK): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(color);
  put(doc, text, MARGIN, y);
  return y + 6;
}

function barRow(doc: jsPDF, label: string, valueLabel: string, ratio: number, y: number, color = BRAND): number {
  const barX = MARGIN + 62;
  const barW = PAGE_W - barX - MARGIN - 26;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(INK);
  const safeLabel = pdfSafe(label);
  put(doc, safeLabel.length > 34 ? `${safeLabel.slice(0, 33)}...` : safeLabel, MARGIN, y + 3.2);
  doc.setFillColor('#E4E6EE');
  doc.roundedRect(barX, y, barW, 4, 2, 2, 'F');
  doc.setFillColor(color);
  doc.roundedRect(barX, y, Math.max(2, barW * Math.max(0, Math.min(1, ratio))), 4, 2, 2, 'F');
  doc.setTextColor(MUTED);
  put(doc, valueLabel, barX + barW + 3, y + 3.2);
  return y + 7;
}

export interface ChartPoint {
  label: string;
  value: number;
}

/** True when a chart would render as an empty frame (Bug 2.5). */
export function chartHasData(points: ChartPoint[]): boolean {
  return points.length > 0 && points.some((point) => Number.isFinite(point.value) && point.value > 0);
}

/**
 * Simple polyline chart. Returns `y` UNCHANGED and draws nothing at all when
 * there is no data — never an empty frame, never a stray title.
 */
function trendChart(doc: jsPDF, points: ChartPoint[], y: number, maxValue: number, title: string): number {
  if (!chartHasData(points)) return y;
  const chartX = MARGIN;
  const chartW = PAGE_W - MARGIN * 2;
  const chartH = 44;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(INK);
  put(doc, title, chartX, y);
  let top = y + 4;
  doc.setDrawColor('#CBD0DE');
  doc.rect(chartX, top, chartW, chartH);
  const ceiling = Math.max(1, maxValue);
  const stepX = points.length === 1 ? 0 : chartW / (points.length - 1);
  let previous: { x: number; y: number } | null = null;
  doc.setDrawColor(BRAND);
  doc.setFillColor(BRAND);
  points.forEach((point, index) => {
    const px = chartX + (points.length === 1 ? chartW / 2 : index * stepX);
    const py = top + chartH - (Math.max(0, Math.min(ceiling, point.value)) / ceiling) * (chartH - 6) - 3;
    if (previous) doc.line(previous.x, previous.y, px, py);
    doc.circle(px, py, 1.1, 'F');
    previous = { x: px, y: py };
  });
  doc.setFontSize(7);
  doc.setTextColor(MUTED);
  points.forEach((point, index) => {
    const px = chartX + (points.length === 1 ? chartW / 2 : index * stepX);
    put(doc, pdfSafe(point.label).slice(0, 12), px, top + chartH + 4, { align: 'center' });
  });
  return top + chartH + 9;
}

/* ------------------------------------------------------------------ */
/*  One mock                                                           */
/* ------------------------------------------------------------------ */

/** Export one mock's analysis. Page 2 only exists when it has content. */
export function exportMockPdf(analysis: PerMockAnalysis, examLabel: string): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { session, config, totals } = analysis;
  const score = `${totals.score}/${totals.maxScore}`;
  let y = header(
    doc,
    session.name,
    `${examLabel} - ${session.date} - Score ${score} (${totals.scorePercent}%)`,
    analysis.partial,
  );

  /* Score summary: THE accuracy and score, straight from the Step 1 totals.
   * Nothing here is derived from the logged entries. */
  y = sectionTitle(doc, 'Score summary (from the totals you entered)', y);
  y = bodyLine(doc, `Attempted ${totals.attempted} of ${totals.totalQuestions} - correct ${totals.correct} - incorrect ${totals.incorrect}`, y);
  y = bodyLine(doc, `Accuracy ${totals.accuracy}% of attempted - score ${score} (${totals.scorePercent}%)`, y);
  if (totals.scaled) y = bodyLine(doc, `Scaled score: ${totals.scaled.label}`, y, MUTED);
  y = bodyLine(
    doc,
    `Marking scheme: ${config.exam_type} - correct ${pdfSigned(config.marks_correct)}, wrong ${pdfSigned(config.marks_incorrect)}, skipped ${pdfSigned(config.marks_skipped)} (${unitNoun(config)})`,
    y,
    MUTED,
  );

  /* Error-type distribution — skipped entirely when nothing is tagged. */
  if (analysis.errors.length > 0) {
    y += 4;
    y = sectionTitle(doc, `Where the ${unitNoun(config)} went (error types)`, y);
    const maxErr = Math.max(1, ...analysis.errors.map((slice) => slice.count));
    for (const slice of analysis.errors) {
      y = barRow(
        doc,
        slice.label,
        `${slice.count} q - ${formatUnits(config, slice.marksLost)}`,
        slice.count / maxErr,
        y,
        DANGER,
      );
    }
  }

  /* Subject cost — marks lost per subject, from the logged entries. */
  const subjectsWithCost = analysis.subjects.filter((slice) => slice.marksLost > 0);
  if (subjectsWithCost.length > 0) {
    y += 4;
    y = sectionTitle(doc, `${unitNoun(config)[0].toUpperCase()}${unitNoun(config).slice(1)} lost by subject`, y);
    const maxSubject = Math.max(1, ...subjectsWithCost.map((slice) => slice.marksLost));
    for (const slice of subjectsWithCost.slice(0, 8)) {
      y = barRow(
        doc,
        slice.subject,
        `${formatUnits(config, slice.marksLost)} - ${slice.missed} logged`,
        slice.marksLost / maxSubject,
        y,
      );
    }
  }

  if (analysis.timeSinks.length > 0) {
    y += 4;
    y = sectionTitle(doc, 'Time sinks', y);
    y = bodyLine(
      doc,
      `${analysis.timeSinks.length} question${analysis.timeSinks.length === 1 ? '' : 's'} ran past your exam's per-question pace.`,
      y,
    );
  }

  if (analysis.nudges.length > 0 && y < PAGE_H - 40) {
    y += 4;
    y = sectionTitle(doc, 'What to change next', y);
    for (const nudge of analysis.nudges) {
      const lines = doc.splitTextToSize(pdfSafe(nudge), PAGE_W - MARGIN * 2) as string[];
      for (const line of lines) y = bodyLine(doc, line, y);
    }
  }

  /* -------- page 2: weak topics + trend (only when there is content) -------- */
  const weakTopics = analysis.weakTopics.slice(0, 10);
  const subjectChart: ChartPoint[] = subjectsWithCost.map((slice) => ({ label: slice.subject, value: slice.marksLost }));
  if (weakTopics.length > 0 || chartHasData(subjectChart)) {
    doc.addPage();
    let y2 = header(doc, 'Weak topics', `${session.name} - ${session.date}`, analysis.partial);
    if (weakTopics.length > 0) {
      y2 = sectionTitle(doc, `Topics that cost the most (ranked by ${unitNoun(config)} ${lostVerb(config)})`, y2);
      const maxLost = Math.max(1, ...weakTopics.map((topic) => topic.marksLost));
      for (const topic of weakTopics) {
        const doubts = topic.doubts > 0 ? ` - ${topic.doubts} doubt${topic.doubts === 1 ? '' : 's'}` : '';
        y2 = barRow(
          doc,
          `${topic.topic}${topic.subject ? ` (${topic.subject})` : ''}`,
          `${formatUnits(config, topic.marksLost)} - ${topic.missed}/${topic.logged} logged${doubts}`,
          topic.marksLost / maxLost,
          y2,
          DANGER,
        );
      }
      y2 += 4;
    }
    trendChart(
      doc,
      subjectChart,
      y2,
      Math.max(1, ...subjectChart.map((point) => point.value)),
      `${unitNoun(config)[0].toUpperCase()}${unitNoun(config).slice(1)} lost by subject`,
    );
  }

  doc.save(`${pdfSafe(session.name).replace(/[^\w-]+/g, '-')}-analysis.pdf`);
}

/* ------------------------------------------------------------------ */
/*  Across mocks                                                       */
/* ------------------------------------------------------------------ */

/** Export the cross-mock analysis. Empty sections and charts are omitted. */
export function exportCrossMockPdf(analysis: CrossMockAnalysis, examLabel: string): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const config = analysis.config;
  let y = header(
    doc,
    'Across your mocks',
    `${examLabel} - ${analysis.mockCount} mock${analysis.mockCount === 1 ? '' : 's'} analysed`,
    analysis.partial,
  );

  /* Score trend comes from each mock's OWN entered totals. */
  const scorePoints: ChartPoint[] = analysis.scoreTrend.map((point) => ({
    label: point.date.slice(5),
    value: point.scorePercent,
  }));
  if (analysis.scoreTrend.length > 0) {
    y = sectionTitle(doc, 'Score and accuracy per mock (from your entered totals)', y);
    for (const point of analysis.scoreTrend.slice(-8)) {
      y = bodyLine(doc, `${point.date} - ${point.mockName}: score ${point.scorePercent}%, accuracy ${point.accuracy}%`, y);
    }
    y += 2;
    y = trendChart(doc, scorePoints, y, 100, 'Score per mock (%)');
  }

  const trends = analysis.topicTrends.slice(0, 10);
  if (trends.length > 0) {
    y += 4;
    y = sectionTitle(doc, `Topics ranked by ${unitNoun(config)} ${lostVerb(config)}`, y);
    const maxLost = Math.max(1, ...trends.map((trend) => trend.marksLost));
    for (const trend of trends) {
      const color = trend.direction === 'improving' ? '#16A34A' : trend.direction === 'declining' ? DANGER : BRAND;
      const doubts = trend.doubts > 0 ? ` - ${trend.doubts} doubt${trend.doubts === 1 ? '' : 's'}` : '';
      y = barRow(
        doc,
        `${trend.topic}${trend.subject ? ` (${trend.subject})` : ''}`,
        `${formatUnits(config, trend.marksLost)} - ${trend.direction}${doubts}`,
        trend.marksLost / maxLost,
        y,
        color,
      );
    }
  }

  if (analysis.repeatOffenders.length > 0) {
    y += 4;
    y = sectionTitle(doc, 'Repeat offenders (missed in 2+ consecutive mocks)', y);
    for (const offender of analysis.repeatOffenders.slice(0, 8)) {
      y = bodyLine(
        doc,
        `- ${offender.topic}${offender.subject ? ` (${offender.subject})` : ''}: ${offender.consecutiveMocks} mocks running, last in ${offender.lastMockName}, ${formatUnits(config, offender.marksLost)} ${lostVerb(config)}`,
        y,
      );
    }
  }

  /* -------- page 2: error-type trend, only when a tag actually moved -------- */
  const carelessPoints: ChartPoint[] = analysis.errorTrend.map((point) => ({
    label: point.date.slice(5),
    value: point.counts.careless,
  }));
  const conceptPoints: ChartPoint[] = analysis.errorTrend.map((point) => ({
    label: point.date.slice(5),
    value: point.counts.concept_gap,
  }));
  if (chartHasData(carelessPoints) || chartHasData(conceptPoints)) {
    doc.addPage();
    let y2 = header(doc, 'Error-type trend', 'Is carelessness going down as concepts firm up?', analysis.partial);
    const maxCount = Math.max(
      1,
      ...analysis.errorTrend.flatMap((point) => [
        point.counts.careless,
        point.counts.concept_gap,
        point.counts.couldnt_apply,
        point.counts.out_of_time,
      ]),
    );
    y2 = trendChart(doc, carelessPoints, y2, maxCount, 'Careless errors per mock');
    trendChart(doc, conceptPoints, y2, maxCount, 'Concept gaps per mock');
  }

  doc.save('vicharakai-cross-mock-analysis.pdf');
}
