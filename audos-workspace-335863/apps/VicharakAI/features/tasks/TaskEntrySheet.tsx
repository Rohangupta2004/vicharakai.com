/**
 * TaskEntrySheet — the bottom task-entry sheet: quick add (one task per line), the guided form, photo→tasks entry and "Let VicharakAI decide".
 * JSX extracted verbatim from App.tsx.
 */
/* eslint-disable */
import { useMemo, useState } from 'react';
import { useDebouncedValue } from '../../shared/useDebouncedValue';
import { BookOpen, Camera, Check, ChevronDown, ChevronRight, Loader2, Plus, Search, Sparkles, Wand2, X } from 'lucide-react';
import {
  AMBER, BORDER, BORDER_STRONG, BRAND_GRADIENT, CARD, CARD_SOFT, DANGER, NAVY, NAVY_ALT, ON_AMBER,
  ORANGE, OVERLAY_BG, RADIUS, SUCCESS, TEXT, TEXT_MUTED, TEXT_SECONDARY, WARNING,
  subjectColor, subjectTint, tint,
} from '../../theme';
import { Card, SectionLabel, SubjectDot, VicharakAvatar } from '../../ui';
import { PlanDraftList, splitPlanText } from '../../PlanParser';
import { subjectTopics, inferSubjectForTopic } from '../../syllabus';
import { TASK_TYPES } from '../../engine';
import { CATEGORY_EMOJI, TASK_CATEGORIES } from './taskCategory';
import { Brain, Flag, Lock } from 'lucide-react';
import { CARD_SHADOW } from '../../theme';
import { inputStyle, pillStyle } from '../../shared/styles';
import { newSectionDrafts, type DailySection, type SectionDraft } from './taskTypes';
import { useApp } from '../../app/AppContext';

export default function TaskEntrySheet() {
  const { data, toast, access: accessCtl, plan, tasks, tests, doubts } = useApp();
  const access = accessCtl.access;
  const {
    spaceId, today, profile, examDef, savedExamLabel, quickAddSubjects, overdueRevisions,
  } = data;
  const { setFlagOpen } = doubts;
  const { showToast } = toast;
  const { openPaywall } = accessCtl;
  const { tomorrowPicks } = plan;
  const {
    sheetOpen, setSheetOpen, sheetMode, setSheetMode, taskSections, setTaskSections,
    ambientDismissed, setAmbientDismissed, formType, setFormType, formSubject, setFormSubject,
    formSubjectManual, setFormSubjectManual, formChapter, setFormChapter, formSearch, setFormSearch,
    formCustom, setFormCustom, addingTask, aiResult, setAiResult, quickTitle, setQuickTitle,
    quickSubject, setQuickSubject, quickCategory, setQuickCategory, planDrafts, setPlanDrafts, parsingPlan, savingPlan,
    parsePlanText, confirmPlanDrafts, submitQuickTitle, submitTaskSections, submitFormTask,
    submitAiTask, quickAddTask, setTopicPickerFor,
  } = tasks;
  const { setPhotoTasksOpen } = tests;

  const subjectNames = examDef?.subjects.map((s) => s.name) ?? [];
  const formSubjectDef = examDef?.subjects.find((subject) => subject.name === formSubject);
  /* PERF: this used to rebuild the WHOLE exam's topic list on every app
   * render — even with the sheet closed (the early return sits below). Now
   * it is built only while the sheet is open and its inputs change, and the
   * search filter waits for a 300 ms pause in typing. */
  const allFormTopics = useMemo(() => {
    if (!sheetOpen || !examDef) return [];
    return formSubjectDef
      ? subjectTopics(formSubjectDef).map((entry) => ({ ...entry, subject: formSubjectDef.name }))
      : examDef.subjects.flatMap((subject) => subjectTopics(subject).map((entry) => ({ ...entry, subject: subject.name })));
  }, [sheetOpen, formSubjectDef, examDef]);
  const debouncedFormSearch = useDebouncedValue((formSearch ?? '').trim());
  const formTopics = useMemo(
    () =>
      allFormTopics.filter((entry) => {
        if (formChapter && entry.chapter !== formChapter) return false;
        if (debouncedFormSearch) {
          const query = debouncedFormSearch.toLowerCase();
          return (
            entry.topic.toLowerCase().includes(query) ||
            entry.chapter.toLowerCase().includes(query) ||
            entry.subject.toLowerCase().includes(query)
          );
        }
        return true;
      }),
    [allFormTopics, formChapter, debouncedFormSearch],
  );

  const hasTaskDraft = Object.values(taskSections).some((section) => (section.text ?? '').trim());
  const ambientSuggestion = hasTaskDraft && !ambientDismissed
    ? overdueRevisions[0]
      ? { section: 'Revision' as DailySection, subject: overdueRevisions[0].subject, topic: overdueRevisions[0].topic, reason: 'This revision is due from your 1-3-5-7 cycle.' }
      : tomorrowPicks[0]
        ? { section: 'Self Study' as DailySection, ...tomorrowPicks[0] }
        : null
    : null;

  if (!sheetOpen) return null;

  return (
    <>
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Add a task">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 vicharak-fade"
            style={{ background: OVERLAY_BG }}
          />
          <div
            className="relative max-h-[72vh] flex flex-col vicharak-sheet"
            style={{
              borderTopLeftRadius: RADIUS.sheet,
              borderTopRightRadius: RADIUS.sheet,
              background: `linear-gradient(180deg, ${NAVY_ALT} 0%, ${NAVY} 48%)`,
              borderTop: `1px solid ${BORDER_STRONG}`,
              boxShadow: CARD_SHADOW,
            }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-base font-extrabold" style={{ color: TEXT }}>
                Add to today
              </h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: BORDER, color: TEXT }}
                data-testid="button-close-sheet"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* three clear paths */}
            <div className="px-5 pb-3">
              <div
                className="inline-flex p-0.5 w-full"
                style={{ borderRadius: RADIUS.chip, background: BORDER }}
                role="tablist"
                aria-label="Ways to add a task"
              >
                {(
                  [
                    { id: 'list', label: 'Daily list' },
                    { id: 'form', label: 'Pick topic' },
                    { id: 'ai', label: 'VicharakAI picks' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={sheetMode === m.id}
                    onClick={() => {
                      setSheetMode(m.id);
                      setAiResult(null);
                    }}
                    className="flex-1 py-2 text-xs font-extrabold transition-all"
                    style={pillStyle(sheetMode === m.id)}
                    data-testid={`sheet-mode-${m.id}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
              {sheetMode === 'list' && (
                <div>
                  <div className="mb-3">
                    <p className="text-[10px]" style={{ color: TEXT_MUTED }}>All sections are optional · one task per line</p>
                  </div>

                  {/* [Fix 1] Scan — the photo→tasks path is a first-class CTA,
                      visually distinct instead of a muted dashed row. */}
                  <button
                    type="button"
                    onClick={() => setPhotoTasksOpen(true)}
                    className="mb-3 w-full flex items-center justify-center gap-2 py-3.5 text-[14px] font-extrabold touch-manipulation transition-transform active:scale-[0.98]"
                    style={{ borderRadius: RADIUS.md, background: BRAND_GRADIENT, color: ON_AMBER, boxShadow: '0 8px 20px rgba(0,87,255,0.32)' }}
                    data-testid="button-add-from-photo"
                  >
                    <Camera className="w-5 h-5" />
                    Scan — add tasks from a photo
                  </button>

                  {/* CHANGE 10: the question-revision entry lives here too. */}
                  <button
                    type="button"
                    onClick={() => {
                      setSheetOpen(false);
                      setFlagOpen(true);
                    }}
                    className="mb-3 w-full flex items-center justify-center gap-2 py-3 text-[13px] font-extrabold touch-manipulation"
                    style={{ borderRadius: RADIUS.md, border: `1px dashed ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
                    data-testid="button-add-question-from-sheet"
                  >
                    <Flag className="w-4 h-4" />
                    Add a question for revision
                  </button>

                  {/* Quick add (#2) — one line, Enter saves; chips set or create in one tap */}
                  <div className="mb-3 p-3.5" style={{ borderRadius: RADIUS.md, background: NAVY_ALT, border: `1px solid ${BORDER}` }} data-testid="quick-add-panel">
                    <p className="text-xs font-extrabold" style={{ color: TEXT }}>Quick add</p>
                    <textarea
                      value={quickTitle}
                      onChange={(event) => setQuickTitle(event.target.value)}
                      rows={2}
                      placeholder={'One task per line, e.g.\nSolve 30 Thermodynamics questions'}
                      autoFocus
                      className="mt-2 w-full px-3 py-2.5 text-sm resize-none"
                      style={inputStyle}
                      data-testid="input-quick-add"
                    />
                    {/* Category — a compact horizontal pill row; one neutral
                        highlight for the pick, no per-category colours. */}
                    <div
                      className="mt-2 -mx-0.5 px-0.5 flex gap-1.5 overflow-x-auto"
                      style={{ scrollbarWidth: 'none' }}
                      role="group"
                      aria-label="Task category"
                    >
                      {TASK_CATEGORIES.map((cat) => {
                        const active = quickCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setQuickCategory(cat)}
                            aria-pressed={active}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold flex-shrink-0 whitespace-nowrap touch-manipulation"
                            style={active
                              ? { borderRadius: RADIUS.chip, background: tint(AMBER, 0.16), color: AMBER, border: `1px solid ${tint(AMBER, 0.5)}` }
                              : { borderRadius: RADIUS.chip, background: NAVY_ALT, color: TEXT_SECONDARY, border: `1px solid ${BORDER}` }}
                            data-testid={`quick-add-category-${cat}`}
                          >
                            <span aria-hidden="true">{CATEGORY_EMOJI[cat]}</span>
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                    {/* Syllabus-first entry — pick the exact topic instead of typing it. */}
                    <button
                      type="button"
                      onClick={() => setTopicPickerFor('quickadd')}
                      className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 text-[12px] font-extrabold touch-manipulation"
                      style={{ borderRadius: RADIUS.md, border: `1px dashed ${tint(AMBER, 0.5)}`, color: AMBER, background: tint(AMBER, 0.06) }}
                      data-testid="button-quick-add-pick-topic"
                    >
                      <BookOpen className="w-4 h-4" />
                      Pick a topic from the syllabus
                    </button>
                    {quickAddSubjects.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-2">
                        {Array.from(new Set([...(quickSubject ? [quickSubject] : []), ...quickAddSubjects])).map((name) => (
                          <button
                            key={`qs-${name}`}
                            type="button"
                            onClick={() => setQuickSubject((current) => (current === name ? '' : name))}
                            aria-pressed={quickSubject === name}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold touch-manipulation"
                            style={quickSubject === name
                              ? { borderRadius: RADIUS.chip, background: subjectColor(name), color: NAVY }
                              : { borderRadius: RADIUS.chip, background: subjectTint(name, 0.14), color: subjectColor(name) }}
                            data-testid={`quick-subject-${name}`}
                          >
                            <SubjectDot subject={name} size={5} />
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={!(quickTitle ?? '').trim() || addingTask}
                      /* Never steal focus from the box: the tasks save
                         optimistically, so the keyboard stays up for the next one. */
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void submitQuickTitle()}
                      className="mt-2 w-full py-2.5 text-[12px] font-extrabold disabled:opacity-45 inline-flex items-center justify-center gap-1.5 touch-manipulation"
                      style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                      data-testid="button-quick-add-all"
                    >
                      {addingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      {quickTitle.split(/\n+/).filter((line) => (line ?? '').trim()).length > 1
                        ? `Add All · ${quickTitle.split(/\n+/).filter((line) => (line ?? '').trim()).length} tasks`
                        : 'Add task'}
                    </button>
                    <p className="text-[10px] mt-2" style={{ color: TEXT_MUTED }}>
                      {quickSubject
                        ? `Saving under ${quickSubject} — Enter starts a new task line.`
                        : 'Enter starts a new task line — I detect each subject, or tap a chip to set it.'}
                    </p>
                    {quickAddSubjects.length > 0 && (
                      <div className="mt-2.5 pt-2.5 flex gap-1.5 flex-wrap items-center" style={{ borderTop: `1px solid ${BORDER}` }}>
                        <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>Quick Add</span>
                        {quickAddSubjects.slice(0, 4).map((name) => (
                          <button
                            key={`qa-${name}`}
                            type="button"
                            disabled={addingTask}
                            onClick={() => void quickAddTask(name)}
                            className="px-2.5 py-1 text-[10px] font-bold disabled:opacity-50 touch-manipulation"
                            style={{ borderRadius: RADIUS.chip, border: `1px dashed ${tint(AMBER, 0.5)}`, color: AMBER, background: 'transparent' }}
                            data-testid={`quick-add-${name}`}
                          >
                            + {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Parsed-plan review (#2, #3): confirm, edit or delete each task. */}
                  {parsingPlan && (
                    <div className="mb-3 flex items-center gap-2 px-3.5 py-3" style={{ borderRadius: RADIUS.md, background: NAVY_ALT, border: `1px solid ${BORDER}` }} data-testid="plan-parsing">
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: AMBER }} />
                      <p className="text-[12px] font-bold" style={{ color: TEXT_SECONDARY }}>Reading your plan — splitting it into tasks…</p>
                    </div>
                  )}
                  {planDrafts && !parsingPlan && (
                    <PlanDraftList
                      drafts={planDrafts}
                      onChange={setPlanDrafts}
                      subjects={subjectNames}
                      saving={savingPlan}
                      onConfirm={() => void confirmPlanDrafts()}
                      onCancel={() => setPlanDrafts(null)}
                    />
                  )}

                  <div className="space-y-2">
                    {(Object.keys(taskSections) as DailySection[]).map((section) => {
                      const draft = taskSections[section];
                      return (
                        <div key={section} className="overflow-hidden" style={{ borderRadius: RADIUS.md, border: `1px solid ${BORDER}`, background: NAVY_ALT }}>
                          <button
                            type="button"
                            onClick={() => setTaskSections((current) => ({ ...current, [section]: { ...current[section], open: !current[section].open } }))}
                            className="w-full px-3 py-2.5 flex items-center justify-between text-left"
                          >
                            <span className="text-xs font-extrabold" style={{ color: TEXT }}>{section}</span>
                            <span className="text-[10px]" style={{ color: TEXT_MUTED }}>{draft.text.split(/\n+/).filter((line) => (line ?? '').trim()).length || 'optional'} {draft.open ? '▴' : '▾'}</span>
                          </button>
                          {draft.open && (
                            <div className="px-3 pb-3">
                              <select
                                value={draft.subject}
                                onChange={(event) => setTaskSections((current) => ({ ...current, [section]: { ...current[section], subject: event.target.value } }))}
                                className="w-full px-2.5 py-2 text-xs"
                                style={inputStyle}
                                aria-label={`${section} subject`}
                              >
                                <option value="">Auto-detect subject</option>
                                {subjectNames.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                              </select>
                              <textarea
                                value={draft.text}
                                onChange={(event) => setTaskSections((current) => ({ ...current, [section]: { ...current[section], text: event.target.value } }))}
                                rows={2}
                                placeholder={section === 'Revision' ? 'Revise Kinematics\nRevise Cell Cycle' : section === 'Lecture' ? 'Watch Electrostatics lecture' : 'Solve 30 Probability questions'}
                                className="mt-2 px-3 py-2 text-sm resize-none"
                                style={inputStyle}
                                data-testid={`tasks-${section.replace(/\s/g, '-').toLowerCase()}`}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {ambientSuggestion && (
                    <div className="mt-3 p-3" style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.4)}` }} data-testid="ambient-ai-suggestion">
                      <div className="flex items-start gap-2">
                        <Brain className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: AMBER }} />
                        <div className="flex-1 min-w-0"><p className="text-xs font-extrabold" style={{ color: TEXT }}>AI Coach noticed something</p><p className="text-[10px] mt-0.5" style={{ color: TEXT_SECONDARY }}>{ambientSuggestion.topic} · {ambientSuggestion.reason}</p></div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button type="button" onClick={() => { const suggestion = ambientSuggestion; setTaskSections((current) => ({ ...current, [suggestion.section]: { ...current[suggestion.section], open: true, subject: suggestion.subject, text: [current[suggestion.section].text, suggestion.topic].filter(Boolean).join('\n') } })); setAmbientDismissed(true); }} className="px-3 py-1.5 text-[10px] font-extrabold rounded-full" style={{ background: BRAND_GRADIENT, color: ON_AMBER }}>Add it</button>
                        <button type="button" onClick={() => setAmbientDismissed(true)} className="px-3 py-1.5 text-[10px] font-bold" style={{ color: TEXT_MUTED }}>Not today</button>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={!hasTaskDraft || addingTask}
                    onClick={() => void submitTaskSections()}
                    className="mt-3 w-full py-2.5 text-sm font-extrabold disabled:opacity-45 inline-flex items-center justify-center gap-2"
                    style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                    data-testid="button-add-daily-list"
                  >
                    {addingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add all to today
                  </button>
                  <p className="text-[9px] mt-2 text-center" style={{ color: TEXT_MUTED }}>When you finish a topic, 1-3-5-7 spaced revisions are queued quietly.</p>
                </div>
              )}

              {sheetMode === 'form' && (
                <div className="space-y-4">
                  <div>
                    <SectionLabel>1 · Task type</SectionLabel>
                    <div className="flex gap-1.5 flex-wrap">
                      {TASK_TYPES.map((taskType) => (
                        <button
                          key={taskType}
                          type="button"
                          onClick={() => {
                            setFormType(taskType);
                            setFormCustom('');
                            if (!formSubjectManual) {
                              setFormSubject('');
                              setFormChapter('');
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-bold transition-all"
                          style={pillStyle(formType === taskType)}
                          data-testid={`type-pill-${taskType}`}
                        >
                          {taskType}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <SectionLabel>2 · Subject</SectionLabel>
                      {!formSubject && (
                        <span className="text-[10px] mb-2" style={{ color: TEXT_MUTED }}>
                          Auto-fills from a clear topic
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {subjectNames.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            setFormSubject(name);
                            setFormSubjectManual(true);
                            setFormChapter('');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all"
                          style={
                            formSubject === name
                              ? { borderRadius: RADIUS.chip, background: subjectColor(name), color: NAVY }
                              : { borderRadius: RADIUS.chip, background: subjectTint(name, 0.14), color: subjectColor(name) }
                          }
                          data-testid={`subject-pill-${name}`}
                        >
                          <SubjectDot subject={name} size={6} />
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <SectionLabel>3 · Topic</SectionLabel>
                      {formType !== 'Custom' && (
                        <select
                          value={formChapter}
                          onChange={(event) => setFormChapter(event.target.value)}
                          disabled={!formSubjectDef}
                          className="text-[11px] px-2 py-1 mb-2 max-w-[55%] disabled:opacity-50"
                          style={{ ...inputStyle, width: 'auto', borderRadius: RADIUS.chip }}
                          aria-label="Optional chapter filter"
                          data-testid="select-chapter-filter"
                        >
                          <option value="">{formSubjectDef ? 'All chapters' : 'Pick subject to filter'}</option>
                          {(formSubjectDef?.chapters ?? []).map((chapter) => (
                            <option key={chapter.name} value={chapter.name}>
                              {chapter.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {formType === 'Custom' ? (
                      <div className="space-y-2">
                        <textarea
                          value={formCustom}
                          onChange={(event) => {
                            const value = event.target.value;
                            setFormCustom(value);
                            if (formSubjectManual) return;
                            setFormSubject(inferSubjectForTopic(examDef, value));
                            setFormChapter('');
                          }}
                          placeholder="Describe exactly what you want to do — for example, ‘Make notes on Haloalkanes SN1 reactions’…"
                          rows={5}
                          autoFocus
                          className="px-3 py-3 text-sm resize-y"
                          style={{ ...inputStyle, minHeight: 120 }}
                          data-testid="textarea-custom-task"
                        />
                        <p className="text-[10px]" style={{ color: formSubject ? TEXT_SECONDARY : TEXT_MUTED }}>
                          {formSubject ? `Subject: ${formSubject}` : 'If VicharakAI cannot identify one subject confidently, choose it above.'}
                        </p>
                        <button
                          type="button"
                          disabled={!(formCustom ?? '').trim() || addingTask}
                          onClick={() => void submitFormTask((formCustom ?? '').trim())}
                          className="w-full px-4 py-2.5 text-xs font-extrabold disabled:opacity-50"
                          style={{ borderRadius: RADIUS.sm, background: BRAND_GRADIENT, color: ON_AMBER }}
                          data-testid="button-add-custom"
                        >
                          Add custom task
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={formSearch}
                          onChange={(event) => setFormSearch(event.target.value)}
                          placeholder={formSubject ? `Search ${formSubject} topics…` : 'Search every subject and topic…'}
                          className="px-3 py-2 text-sm mb-2"
                          style={inputStyle}
                          data-testid="input-topic-search"
                        />
                        <ul
                          className="overflow-hidden max-h-56 overflow-y-auto"
                          style={{ border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                        >
                          {formTopics.slice(0, 100).map((topicEntry) => (
                            <li key={`${topicEntry.subject}|${topicEntry.chapter}|${topicEntry.topic}`} style={{ borderBottom: `1px solid ${BORDER}` }}>
                              <button
                                type="button"
                                disabled={addingTask}
                                onClick={() => void submitFormTask(topicEntry.topic, topicEntry.subject)}
                                className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left"
                                style={{ background: CARD }}
                                data-testid={`topic-option-${topicEntry.topic.slice(0, 24)}`}
                              >
                                <span className="min-w-0">
                                  <span className="block text-xs font-semibold truncate" style={{ color: TEXT }}>
                                    {topicEntry.topic}
                                  </span>
                                  <span className="block text-[10px] truncate" style={{ color: TEXT_MUTED }}>
                                    {topicEntry.subject} · {topicEntry.chapter}
                                  </span>
                                </span>
                                <Plus className="w-3.5 h-3.5 flex-shrink-0" style={{ color: AMBER }} />
                              </button>
                            </li>
                          ))}
                          {formTopics.length === 0 && (
                            <li className="px-3.5 py-3 text-xs" style={{ background: CARD, color: TEXT_MUTED }}>
                              No topics match — type a granular topic below.
                            </li>
                          )}
                        </ul>
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            value={formCustom}
                            onChange={(event) => {
                              const value = event.target.value;
                              setFormCustom(value);
                              if (formSubjectManual) return;
                              setFormSubject(inferSubjectForTopic(examDef, value));
                              setFormChapter('');
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && (formCustom ?? '').trim()) void submitFormTask((formCustom ?? '').trim());
                            }}
                            placeholder="Or type a granular topic…"
                            className="px-3 py-2 text-sm flex-1"
                            style={inputStyle}
                            data-testid="input-custom-topic"
                          />
                          <button
                            type="button"
                            disabled={!(formCustom ?? '').trim() || addingTask}
                            onClick={() => void submitFormTask((formCustom ?? '').trim())}
                            className="px-4 py-2 text-xs font-extrabold disabled:opacity-50 flex-shrink-0"
                            style={{ borderRadius: RADIUS.sm, background: BRAND_GRADIENT, color: ON_AMBER }}
                            data-testid="button-add-typed-topic"
                          >
                            Add
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {sheetMode === 'ai' && (
                <div className="text-center py-4">
                  <div className="flex justify-center mb-3">
                    <VicharakAvatar size="lg" />
                  </div>
                  {aiResult ? (
                    <>
                      <p className="text-sm font-semibold px-2" style={{ color: TEXT }} data-testid="text-ai-result">
                        {aiResult}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSheetOpen(false)}
                        className="mt-5 px-6 py-2.5 text-sm font-extrabold"
                        style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                        data-testid="button-ai-done"
                      >
                        Nice — done
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm px-4" style={{ color: TEXT_SECONDARY }}>
                        I'll weigh your pace, weak areas and what's due for revision — then queue the smartest next task.
                      </p>
                      <button
                        type="button"
                        disabled={addingTask}
                        onClick={() => void submitAiTask()}
                        className="mt-5 px-6 py-3 text-sm font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2"
                        style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                        data-testid="button-ai-add"
                      >
                        {addingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        Let VicharakAI add a task for me
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
