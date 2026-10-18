/**
 * ToolsScreen — the Tools tab: menu plus the Weightage and Syllabus coverage views.
 * JSX extracted verbatim from App.tsx; state and actions come from the
 * feature hooks via useApp().
 */
/* eslint-disable */
import { useState } from 'react';
import { BarChart3, BookOpen, Brain, CalendarDays, Check, ChevronDown, ChevronRight, Clock, Compass, GraduationCap, Target, Timer, Trophy, Wand2 } from 'lucide-react';
import {
  AMBER, BORDER, BORDER_STRONG, BRAND_GRADIENT, CARD, CARD_SOFT, DANGER, NAVY, NAVY_ALT, ON_AMBER,
  ORANGE, RADIUS, SUCCESS, TEXT, TEXT_MUTED, TEXT_SECONDARY, WARNING, subjectColor, subjectTint, tint,
} from '../../theme';
import { Card, SectionLabel, ShowMoreToggle, SubjectDot, BarRow } from '../../ui';
import { Lock, Users, ChevronLeft } from 'lucide-react';
import { useSyllabusCatalog } from '../../data/syllabusRuntime';
import { CARD_SHADOW } from '../../theme';
import { subjectTopics } from '../../syllabus';
import { topicKey } from '../../engine';
import { chapterWeightage } from '../../weightage';
import { examLabelFromId } from '../../customExam';
import { useApp } from '../../app/AppContext';

export default function ToolsScreen() {
  const { data, access: accessFeature, tasks, tests, syllabus, settings, setTab } = useApp();
  const { exams: syllabusCatalog } = useSyllabusCatalog();
  /* The moved JSX reads `access.premiumUnlocked` — the AiAccess verdict. */
  const access = accessFeature.access;
  const { openPaywall } = accessFeature;
  const {
    profile, examDef, savedExamLabel, doneTopicKeys, studentItems, activeSyllabusExam, flaggedRows,
  } = data;
  const { setSyllabusBrowserOpen } = syllabus;
  const { setFocusOpen } = tasks;
  const { setWeeklyScreenOpen, openTestSetup, setGenerateTestOpen, setGenerateTestError } = tests;
  const { setShowTimeMachine } = settings;

  /* Tools-tab local view state (was app-level; resets on tab change). */
  const [toolView, setToolView] = useState<'menu' | 'weightage' | 'syllabus'>('menu');
  const [toolSubject, setToolSubject] = useState('');
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [showAllToolRows, setShowAllToolRows] = useState(false);

  const subjectNames = examDef?.subjects.map((s) => s.name) ?? [];
  const examName = examDef?.name ?? (savedExamLabel || (profile ? examLabelFromId(profile.exam) : 'Your exam'));

  if (!profile) return null;

  return (
    <>
          <div className="flex-1 w-full max-w-[600px] lg:max-w-[860px] mx-auto px-5 sm:px-8 pt-6 vicharak-screen-pad">
            {toolView === 'menu' ? (
              <>
                <div className="flex items-center justify-between gap-3 vicharak-rise">
                  <h1 className="text-lg font-extrabold" style={{ color: TEXT }}>Tools</h1>
                </div>
                <p className="mt-1 text-[11px] vicharak-rise" style={{ color: TEXT_MUTED }}>
                  Everything one tap away — no menus inside menus.
                </p>
                {/* FIX 8: Generate Test — the hero tool, front and centre. */}
                <button
                  type="button"
                  onClick={() => {
                    setGenerateTestError(null);
                    setGenerateTestOpen(true);
                  }}
                  className="mt-4 w-full p-4 flex items-center gap-3 text-left vicharak-rise touch-manipulation"
                  style={{ background: BRAND_GRADIENT, borderRadius: RADIUS.lg, color: ON_AMBER, boxShadow: '0 10px 26px rgba(0,87,255,0.35)' }}
                  data-testid="tool-generate-test"
                >
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }}>
                    <Trophy className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[15px] font-extrabold">
                      Generate Test
                      {!access.premiumUnlocked && <Lock className="w-3.5 h-3.5 flex-shrink-0" aria-label="AI generation is a Premium feature" />}
                    </span>
                    <span className="block text-[11px] mt-0.5 opacity-85">
                      Weighted by marks lost in your own logged mocks
                    </span>
                  </span>
                  <ChevronRight className="w-5 h-5 flex-shrink-0" />
                </button>
                {/* FIX 3: big tappable cards — Road View and Calendar removed
                    (the calendar already sits in the bottom nav). */}
                <div className="mt-3 grid grid-cols-2 gap-2.5 vicharak-rise" style={{ animationDelay: '30ms' }}>
                  {([
                    { id: 'timer', label: 'Focus Timer', helper: 'Full-screen countdown — logs itself', Icon: Timer, action: () => setFocusOpen(true) },
                    { id: 'test-mode', label: 'Take a Test', helper: 'Timed MCQ test on your topics', Icon: GraduationCap, action: openTestSetup },
                    { id: 'weightage', label: 'Weightage', helper: 'Where the marks are in your exam', Icon: BarChart3, action: () => { setToolView('weightage'); setShowAllToolRows(false); } },
                    { id: 'syllabus', label: 'Syllabus', helper: 'Every chapter and your coverage', Icon: BookOpen, action: () => { setToolView('syllabus'); setShowAllToolRows(false); setOpenChapter(null); } },
                    { id: 'syllabus-browser', label: 'Syllabus Browser', helper: `${syllabusCatalog.length} exams — mastery colour-coded`, Icon: GraduationCap, action: () => setSyllabusBrowserOpen(true) },
                    { id: 'vision-board', label: 'Vision Board', helper: 'Dream goal on a pinboard, topics strung around it', Icon: Compass, action: () => setTab('vision') },
                  ] as const).map(({ id, label, helper, Icon, action }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={action}
                      className="p-4 flex flex-col items-start gap-2.5 text-left touch-manipulation"
                      style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.lg }}
                      data-testid={`tool-${id}`}
                    >
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: tint(AMBER, 0.14), color: AMBER }}>
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-extrabold" style={{ color: TEXT }}>{label}</span>
                        <span className="block text-[10px] mt-0.5 leading-snug" style={{ color: TEXT_MUTED }}>{helper}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {/* Coming soon — the Elite-plan features promised on the landing page.
                    Teasers only: the shimmer says “on the way”, nothing is tappable,
                    and backgroundColor (not the background shorthand) keeps the
                    .vicharak-shimmer background-image sweep visible. */}
                <div className="mt-3 grid grid-cols-2 gap-2.5 vicharak-rise" style={{ animationDelay: '60ms' }}>
                  {([
                    { id: 'community', label: 'Community Groups', helper: 'Study circles with aspirants on your exam', emoji: '\uD83D\uDD12', Icon: Users },
                    { id: 'leaderboard', label: 'Leaderboard', helper: 'See how your streak stacks up', emoji: '\uD83C\uDFC6', Icon: Trophy },
                  ] as const).map(({ id, label, helper, emoji, Icon }) => (
                    <div
                      key={id}
                      className="vicharak-shimmer p-4 flex flex-col items-start gap-2.5"
                      style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.lg, boxShadow: CARD_SHADOW }}
                      data-testid={`teaser-${id}`}
                    >
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: tint(ORANGE, 0.14), color: ORANGE }}>
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-extrabold" style={{ color: TEXT }}>{label}</span>
                        <span className="block text-[10px] mt-0.5 leading-snug" style={{ color: TEXT_MUTED }}>{helper}</span>
                      </span>
                      <span
                        className="px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em]"
                        style={{ borderRadius: RADIUS.chip, background: tint(ORANGE, 0.14), color: ORANGE }}
                      >
                        Coming Soon {emoji}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 vicharak-rise">
                  <button
                    type="button"
                    onClick={() => setToolView('menu')}
                    aria-label="Back to tools"
                    className="w-8 h-8 rounded-full flex items-center justify-center touch-manipulation"
                    style={{ border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: CARD }}
                    data-testid="button-tool-back"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h1 className="text-lg font-extrabold" style={{ color: TEXT }}>
                    {toolView === 'weightage' ? 'Weightage' : 'Syllabus'}
                  </h1>
                </div>

                {toolView === 'weightage' && (
                  <div className="mt-4">
                    <p className="text-[11px]" style={{ color: TEXT_MUTED }}>
                      Approximate exam weightage per chapter — highest first, so you always know where the marks are in {examName}.
                    </p>
                    {!examDef ? (
                      <p className="text-xs mt-3" style={{ color: TEXT_MUTED }}>No syllabus is loaded for this exam yet.</p>
                    ) : (
                      <>
                        <div className="flex gap-1.5 flex-wrap mt-3">
                          {subjectNames.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => { setToolSubject(name); setShowAllToolRows(false); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold touch-manipulation"
                              style={(toolSubject || subjectNames[0]) === name
                                ? { borderRadius: RADIUS.chip, background: subjectColor(name), color: NAVY }
                                : { borderRadius: RADIUS.chip, background: subjectTint(name, 0.14), color: subjectColor(name) }}
                              data-testid={`weightage-subject-${name}`}
                            >
                              <SubjectDot subject={name} size={5} />
                              {name}
                            </button>
                          ))}
                        </div>
                        {(() => {
                          const subjectDef = examDef.subjects.find((s) => s.name === (toolSubject || subjectNames[0]));
                          if (!subjectDef) return null;
                          const total = subjectDef.chapters.reduce((sum, c) => sum + c.topics.length, 0) || 1;
                          // CHANGE 10: static JEE/NEET weightage first, topic-count estimate as fallback.
                          const rows = [...subjectDef.chapters]
                            .map((c) => ({
                              name: c.name,
                              percent:
                                chapterWeightage(profile.exam, subjectDef.name, c.name) ??
                                Math.max(1, Math.round((c.topics.length / total) * 100)),
                            }))
                            .sort((a, b) => b.percent - a.percent);
                          const visible = showAllToolRows ? rows : rows.slice(0, 6);
                          return (
                            <Card radius={RADIUS.lg} className="mt-3 p-4 space-y-2.5" testId="card-weightage">
                              {visible.map((row) => (
                                <BarRow key={row.name} label={row.name} percent={row.percent} color={subjectColor(subjectDef.name)} right={`${row.percent}% of ${examDef.name}`} />
                              ))}
                              <ShowMoreToggle
                                hiddenCount={Math.max(0, rows.length - 6)}
                                expanded={showAllToolRows}
                                onToggle={() => setShowAllToolRows((v) => !v)}
                                testId="toggle-weightage"
                              />
                            </Card>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}

                {toolView === 'syllabus' && (
                  <div className="mt-4">
                    {!examDef ? (
                      <p className="text-xs" style={{ color: TEXT_MUTED }}>No syllabus is loaded for this exam yet.</p>
                    ) : (
                      <>
                        <div className="flex gap-1.5 flex-wrap">
                          {subjectNames.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => { setToolSubject(name); setShowAllToolRows(false); setOpenChapter(null); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold touch-manipulation"
                              style={(toolSubject || subjectNames[0]) === name
                                ? { borderRadius: RADIUS.chip, background: subjectColor(name), color: NAVY }
                                : { borderRadius: RADIUS.chip, background: subjectTint(name, 0.14), color: subjectColor(name) }}
                              data-testid={`syllabus-subject-${name}`}
                            >
                              <SubjectDot subject={name} size={5} />
                              {name}
                            </button>
                          ))}
                        </div>
                        {(() => {
                          const subjectDef = examDef.subjects.find((s) => s.name === (toolSubject || subjectNames[0]));
                          if (!subjectDef) return null;
                          const subjectTopicTotal = subjectDef.chapters.reduce((sum, c) => sum + c.topics.length, 0) || 1;
                          const weightOf = (chapter: (typeof subjectDef.chapters)[number]) =>
                            chapterWeightage(profile.exam, subjectDef.name, chapter.name) ??
                            Math.max(1, Math.round((chapter.topics.length / subjectTopicTotal) * 100));
                          // CHANGE 10: highest-weight chapters first.
                          const chapters = [...subjectDef.chapters].sort((a, b) => weightOf(b) - weightOf(a));
                          const visible = showAllToolRows ? chapters : chapters.slice(0, 8);
                          return (
                            <div className="mt-3 space-y-2">
                              {visible.map((chapter) => {
                                // Same rule as the Dashboard: a chapter completed
                                // as one task counts as covering all its topics.
                                const chapterDone = doneTopicKeys.has(topicKey(subjectDef.name, chapter.name));
                                const covered = chapterDone
                                  ? chapter.topics.length
                                  : chapter.topics.filter((t) => doneTopicKeys.has(topicKey(subjectDef.name, t))).length;
                                const open = openChapter === chapter.name;
                                return (
                                  <div key={chapter.name} className="overflow-hidden vicharak-fade" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}>
                                    <button
                                      type="button"
                                      onClick={() => setOpenChapter(open ? null : chapter.name)}
                                      aria-expanded={open}
                                      className="w-full px-3.5 py-3 flex items-center gap-3 text-left touch-manipulation"
                                      data-testid={`syllabus-chapter-${chapter.name.slice(0, 20)}`}
                                    >
                                      <span className="min-w-0 flex-1">
                                        <span className="block text-[13px] font-semibold truncate" style={{ color: TEXT }}>{chapter.name}</span>
                                        <span className="mt-1 flex items-center gap-1.5 flex-wrap">
                                          <span
                                            className="px-1.5 py-0.5 text-[9px] font-extrabold"
                                            style={{ borderRadius: RADIUS.chip, background: subjectTint(subjectDef.name, 0.14), color: subjectColor(subjectDef.name) }}
                                            data-testid={`weightage-pill-${chapter.name.slice(0, 20)}`}
                                          >
                                            {weightOf(chapter)}% of {examDef.name}
                                          </span>
                                          <span className="text-[10px]" style={{ color: covered === chapter.topics.length && covered > 0 ? SUCCESS : TEXT_MUTED }}>
                                            {covered}/{chapter.topics.length} topics covered
                                          </span>
                                        </span>
                                      </span>
                                      <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform" style={{ color: TEXT_MUTED, transform: open ? 'rotate(180deg)' : undefined }} />
                                    </button>
                                    {open && (
                                      <ul className="px-3.5 pb-3 space-y-1.5 vicharak-fade">
                                        {chapter.topics.map((topicName) => {
                                          const done = chapterDone || doneTopicKeys.has(topicKey(subjectDef.name, topicName));
                                          return (
                                            <li key={topicName} className="flex items-center gap-2 text-[12px]" style={{ color: done ? TEXT_MUTED : TEXT_SECONDARY }}>
                                              {done ? (
                                                <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: SUCCESS }} />
                                              ) : (
                                                <span className="w-3.5 h-3.5 rounded-[4px] flex-shrink-0" style={{ border: `1px solid ${BORDER_STRONG}` }} aria-hidden="true" />
                                              )}
                                              <span className={done ? 'line-through' : ''}>{topicName}</span>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    )}
                                  </div>
                                );
                              })}
                              <ShowMoreToggle
                                hiddenCount={Math.max(0, chapters.length - 8)}
                                expanded={showAllToolRows}
                                onToggle={() => setShowAllToolRows((v) => !v)}
                                testId="toggle-syllabus"
                              />
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
    </>
  );
}
