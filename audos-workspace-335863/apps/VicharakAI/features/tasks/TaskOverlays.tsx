/**
 * TaskOverlays — the add-task modal, quick-add topic picker, carry-over decision, task editor, duration sheet and focus mode overlays.
 * JSX extracted verbatim from App.tsx.
 */
/* eslint-disable */
import { CalendarDays, Check, ChevronRight, Loader2, Pencil, Plus, RotateCcw, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import {
  AMBER, BORDER, BORDER_STRONG, BRAND_GRADIENT, CARD, CARD_SOFT, DANGER, NAVY, NAVY_ALT, ON_AMBER,
  ORANGE, OVERLAY_BG, RADIUS, SUCCESS, TEXT, TEXT_MUTED, TEXT_SECONDARY, WARNING,
  subjectColor, subjectTint, tint,
} from '../../theme';
import { SectionLabel, SubjectDot } from '../../ui';
import AddTaskSheet from '../../AddTaskSheet';
import TopicPicker from '../../TopicPicker';
import SyllabusTaskPicker from './SyllabusTaskPicker';
import { DurationSheet } from '../../StudyTime';
import { FocusModeScreen } from '../../FocusTimer';
import { AttachImageButton, ImageThumbStrip } from '../../Attachments';
import { formatDuration, nextTopicRevisionStep, topicKey, parseOneLiner, TASK_TYPES } from '../../engine';
import { DIFFICULTY, NO_REVISION_LABEL } from '../../config/sharedConfig';
import { adaptiveContextForTopic } from '../../mcq';
import { inputStyle } from '../../shared/styles';
import { useApp } from '../../app/AppContext';

export default function TaskOverlays() {
  const { data, toast, tasks, tests, tab, setTab } = useApp();
  /* [Back → Today] Closing the task detail editor lands on Today — never
   * back on the AI chat screen it may have been opened over. */
  const closeEditToToday = () => {
    tasks.setEditTask(null);
    if (tab === 'coach') setTab('today');
  };
  const {
    spaceId, today, profile, examDef, annotations, carryOver, quickAddSubjects,
    topicPickerSubjects, topicPickerExamLabel, attachmentsBySourceKey, todayMinutes,
    testResults, missionQueue, mainPending, carriedPending, lastRatingLabelByKey,
  } = data;
  const subjectNames = examDef?.subjects.map((s) => s.name) ?? [];
  const { showToast } = toast;
  const {
    addTaskOpen, setAddTaskOpen, syllabusPickerOpen, setSyllabusPickerOpen, addTopicsToToday,
    savingNewTask, handleAddTaskSave, topicPickerFor, setTopicPickerFor,
    setQuickTitle, quickTitle, setQuickSubject, carryoverPromptOpen, carryoverBusy, decideCarryover,
    dismissCarryoverPrompt, editTask, setEditTask, editTaskTitle, setEditTaskTitle, editTaskSubject,
    setEditTaskSubject, editTaskMinutes, setEditTaskMinutes, editTaskType, setEditTaskType,
    editTaskDate, setEditTaskDate, savingTaskEdit, saveTaskEdit, deleteTask, busyIds,
    improvingTask, improveEditedTask, durationPrompt, setDurationPrompt, savingDuration,
    saveDuration, focusOpen, setFocusOpen, logFocusSession,
    feedbackPrompt, saveFeeling, savingFeeling, declineRevision, skipFeedback,
    revisionRatingPrompt, rateRevision, skipRevisionRating, savingRating,
  } = tasks;
  const { attachImageToTask, removeTaskAttachment, attachBusy, setLightboxUrl, setQuizTarget, setPhotoTasksOpen } = tests;

  return (
    <>
      {/* CHANGE 1/8: the '+' FAB's add-task sheet — name, subject, photo. */}
      {addTaskOpen && (
        <AddTaskSheet
          subjects={quickAddSubjects.length > 0 ? quickAddSubjects : subjectNames}
          syllabusSubjects={topicPickerSubjects}
          examLabel={topicPickerExamLabel}
          saving={savingNewTask}
          onSave={(draft) => void handleAddTaskSave(draft)}
          onClose={() => setAddTaskOpen(false)}
          onScanPhoto={() => {
            setAddTaskOpen(false);
            setPhotoTasksOpen(true);
          }}
        />
      )}

      {/* The POWER add flow: a full-screen syllabus picker behind the main
          '+'. Tick topics across subjects and chapters, then one CTA drops
          them all on today. The Today card's inline row stays the quick path. */}
      {syllabusPickerOpen && (
        <SyllabusTaskPicker
          examLabel={topicPickerExamLabel}
          subjects={topicPickerSubjects}
          queuedTopics={[...mainPending, ...carriedPending].map((item) => item.topic)}
          saving={savingNewTask}
          onAdd={(picks) => void addTopicsToToday(picks)}
          onClose={() => setSyllabusPickerOpen(false)}
          onCustomTask={() => {
            setSyllabusPickerOpen(false);
            setAddTaskOpen(true);
          }}
        />
      )}

      {/* Syllabus topic picker for the quick-add panel — the picked topic
          lands in the text box exactly as if typed. */}
      {topicPickerFor && (
        <TopicPicker
          examLabel={topicPickerExamLabel}
          subjects={topicPickerSubjects}
          onPick={(pick) => {
            const appendLine = (current: string) => {
              const trimmed = current.replace(/\s+$/, '');
              return trimmed ? `${trimmed}\n${pick.topic}` : pick.topic;
            };
            setQuickTitle(appendLine);
            if (pick.subject) setQuickSubject(pick.subject);
            setTopicPickerFor(null);
          }}
          onClose={() => setTopicPickerFor(null)}
        />
      )}

      {/* FIX 6: the ONE-TIME daily carry-over decision — carry yesterday's
          unfinished tasks into today, or start fresh (archived as skipped).
          Shown only on the first open of a new day; the choice is stored. */}
      {carryoverPromptOpen && carryOver.length > 0 && (
        <div className="fixed inset-0 z-[64] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Unfinished tasks from yesterday">
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: OVERLAY_BG }}
            onClick={carryoverBusy ? undefined : dismissCarryoverPrompt}
            aria-label="Close carry-over prompt"
          />
          <div
            className="relative max-h-[75vh] overflow-y-auto px-5 pt-5 pb-8 vicharak-sheet"
            style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-extrabold" style={{ color: TEXT }} data-testid="text-carryover-title">
                You have {carryOver.length} unfinished task{carryOver.length === 1 ? '' : 's'} from yesterday
              </h2>
              <button
                type="button"
                disabled={carryoverBusy}
                onClick={dismissCarryoverPrompt}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="mt-3 space-y-1.5" data-testid="list-carryover-preview">
              {carryOver.slice(0, 5).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2.5 px-3 py-2.5"
                  style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm }}
                >
                  <SubjectDot subject={item.subject} size={6} />
                  <span className="min-w-0 flex-1 text-[13px] font-semibold truncate" style={{ color: TEXT }}>
                    {item.kind === 'revision' ? `Revise: ${item.topic}` : item.topic}
                  </span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: TEXT_MUTED }}>planned {item.scheduled_for}</span>
                </li>
              ))}
              {carryOver.length > 5 && (
                <li className="text-[10px] text-center" style={{ color: TEXT_MUTED }}>+{carryOver.length - 5} more</li>
              )}
            </ul>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={carryoverBusy}
                onClick={() => void decideCarryover('carry')}
                className="w-full py-3.5 text-sm font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2 touch-manipulation"
                style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                data-testid="button-carryover-carry"
              >
                {carryoverBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Carry them over
              </button>
              {/* [FIX 5] Smart spread — the engine distributes the backlog over
                  coming days instead of stacking it all on today. */}
              {carryOver.length >= 3 && (
                <button
                  type="button"
                  disabled={carryoverBusy}
                  onClick={() => void decideCarryover('spread')}
                  className="w-full py-3.5 text-sm font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2 touch-manipulation"
                  style={{ borderRadius: RADIUS.chip, border: `1px solid ${tint(AMBER, 0.45)}`, color: AMBER, background: tint(AMBER, 0.08) }}
                  data-testid="button-carryover-spread"
                >
                  <CalendarDays className="w-4 h-4" />
                  Spread smartly over coming days
                </button>
              )}
              {/* "I finished these — I just forgot to tick them off." Closes the
                  listed tasks as done on their planned day; nothing carries over. */}
              <button
                type="button"
                disabled={carryoverBusy}
                onClick={() => void decideCarryover('done')}
                className="w-full py-3.5 text-sm font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2 touch-manipulation"
                style={{ borderRadius: RADIUS.chip, border: `1px solid ${tint(SUCCESS, 0.45)}`, color: SUCCESS, background: tint(SUCCESS, 0.08) }}
                data-testid="button-carryover-done"
              >
                <Check className="w-4 h-4" />
                I completed {carryOver.length === 1 ? 'this' : 'these'} — mark done
              </button>
              <button
                type="button"
                disabled={carryoverBusy}
                onClick={() => void decideCarryover('fresh')}
                className="w-full py-3.5 text-sm font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2 touch-manipulation"
                style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
                data-testid="button-carryover-fresh"
              >
                Start fresh today
              </button>
            </div>
            <p className="mt-2.5 text-[10px] text-center" style={{ color: TEXT_MUTED }}>
              Carried tasks land in a “From yesterday” section on Today. Spreading schedules a couple per day over the coming days. “I completed these” checks them off as done — no judgment, it happens. Starting fresh archives them — they won't come back.
            </p>
          </div>
        </div>
      )}

      {/* Light task editor (#1) — fix a title, subject or duration, no ceremony */}
      {editTask && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Edit task">
          <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={closeEditToToday} aria-label="Close editor" />
          <div className="relative px-5 pt-5 pb-8 vicharak-sheet" style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-base font-extrabold" style={{ color: TEXT }}>Edit task</p>
                <p className="text-[11px] mt-0.5" style={{ color: TEXT_MUTED }}>Title, subject, type, time and date — saved instantly.</p>
              </div>
              <button
                type="button"
                onClick={closeEditToToday}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
              Title
              <input
                value={editTaskTitle}
                onChange={(event) => setEditTaskTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void saveTaskEdit();
                  }
                }}
                autoFocus
                enterKeyHint="done"
                className="mt-1 px-3 py-2.5 text-sm"
                style={inputStyle}
                data-testid="input-edit-task-title"
              />
            </label>
            <p className="mt-3 text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>Subject</p>
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              {Array.from(new Set([editTask.subject, ...quickAddSubjects])).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setEditTaskSubject(name)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold touch-manipulation"
                  style={editTaskSubject === name
                    ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
                    : { borderRadius: RADIUS.chip, background: 'transparent', border: `1px solid ${BORDER}`, color: TEXT_SECONDARY }}
                  data-testid={`edit-subject-${name}`}
                >
                  <SubjectDot subject={name} size={6} />
                  {name}
                </button>
              ))}
            </div>
            {editTask.kind === 'new' && (
              <>
                <p className="mt-3 text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>Task type</p>
                <div className="flex gap-1.5 flex-wrap mt-1.5">
                  {TASK_TYPES.map((taskType) => (
                    <button
                      key={taskType}
                      type="button"
                      onClick={() => setEditTaskType(taskType)}
                      className="px-3 py-1.5 text-xs font-bold touch-manipulation"
                      style={editTaskType === taskType
                        ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
                        : { borderRadius: RADIUS.chip, background: 'transparent', border: `1px solid ${BORDER}`, color: TEXT_SECONDARY }}
                      data-testid={`edit-type-${taskType}`}
                    >
                      {taskType}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
                Duration (minutes)
                <input
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={1080}
                  value={editTaskMinutes}
                  onChange={(event) => setEditTaskMinutes(event.target.value)}
                  placeholder="e.g. 45"
                  className="mt-1 px-3 py-2.5 text-sm"
                  style={inputStyle}
                  data-testid="input-edit-task-minutes"
                />
              </label>
              <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
                Scheduled for
                <input
                  type="date"
                  value={editTaskDate}
                  onChange={(event) => setEditTaskDate(event.target.value)}
                  className="mt-1 px-3 py-2.5 text-sm"
                  style={inputStyle}
                  data-testid="input-edit-task-date"
                />
              </label>
            </div>
            {/* Task-detail extras: attach an image, or drill it with MCQs. */}
            <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
              <AttachImageButton
                busy={attachBusy}
                onPick={(file) => void attachImageToTask(editTask, file)}
                testId="button-attach-task-image"
              />
              <button
                type="button"
                disabled={improvingTask}
                onClick={() => void improveEditedTask()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold disabled:opacity-60 touch-manipulation"
                style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.12), color: AMBER, border: `1px solid ${tint(AMBER, 0.4)}` }}
                data-testid="button-task-ai-improve"
              >
                {improvingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {improvingTask ? 'Tidying…' : 'AI tidy-up'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const task = editTask;
                  setEditTask(null);
                  setQuizTarget({ subject: task.subject, topic: task.topic });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold touch-manipulation"
                style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.12), color: AMBER, border: `1px solid ${tint(AMBER, 0.4)}` }}
                data-testid="button-task-generate-questions"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate Questions
                {adaptiveContextForTopic(testResults, editTask.subject, editTask.topic) && (
                  <span aria-label="Adapted to your level">· 📊 Adapted</span>
                )}
              </button>
            </div>
            {(attachmentsBySourceKey.get(editTask.source_key || topicKey(editTask.subject, editTask.topic)) ?? []).length > 0 && (
              <div className="mt-3">
                <ImageThumbStrip
                  urls={attachmentsBySourceKey.get(editTask.source_key || topicKey(editTask.subject, editTask.topic)) ?? []}
                  onExpand={setLightboxUrl}
                  onRemove={(url) => void removeTaskAttachment(editTask, url)}
                />
              </div>
            )}
            <button
              type="button"
              disabled={savingTaskEdit || !(editTaskTitle ?? '').trim() || !(editTaskSubject ?? '').trim()}
              onClick={() => void saveTaskEdit()}
              className="mt-4 w-full py-3 text-sm font-extrabold disabled:opacity-50"
              style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
              data-testid="button-save-task-edit"
            >
              {savingTaskEdit ? 'Saving…' : 'Save changes'}
            </button>
            {/* Remove a mistakenly-added task right from the editor — the toast
                offers a one-tap Undo, so nothing is ever lost for good. */}
            <button
              type="button"
              disabled={savingTaskEdit || busyIds.has(editTask.id)}
              onClick={() => {
                const task = editTask;
                setEditTask(null);
                void deleteTask(task);
              }}
              className="mt-2.5 w-full py-2.5 text-[12px] font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-1.5 touch-manipulation"
              style={{ borderRadius: RADIUS.chip, border: `1px solid ${tint(DANGER, 0.4)}`, color: DANGER, background: tint(DANGER, 0.08) }}
              data-testid="button-delete-task-edit"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove task
            </button>
          </div>
        </div>
      )}

      {/* [Feature 1] Completion difficulty prompt — Easy / Medium / Hard /
          No Revision, straight after a STUDY task is checked off. The answer
          is a prioritisation signal (weakest-first queues, 'felt hard'
          badges) — scheduling always follows the one 1·3·7·14·28 ladder, and
          only the post-REVISION rating chips (the sheet below) move a topic
          along it. 'No Revision' still removes the topic's queued revisions
          entirely. Always skippable. */}
      {/* NOT on Today: that screen answers this ON the completed card itself
          (TodayScreen's inline chips), which is a single tap with nothing to
          dismiss. The sheet stays for completions made from other screens. */}
      {feedbackPrompt && tab !== 'today' && (
        <div className="fixed inset-0 z-[63] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="How did that topic feel?">
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: OVERLAY_BG }}
            onClick={savingFeeling ? undefined : skipFeedback}
            aria-label="Skip the difficulty question"
          />
          <div
            className="relative px-5 pt-5 pb-8 vicharak-sheet"
            style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}
            data-testid="sheet-task-difficulty"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-extrabold" style={{ color: TEXT }} data-testid="text-difficulty-title">
                  How did “{feedbackPrompt.topic}” feel?
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: TEXT_MUTED }}>
                  Revision follows the 1·3·7·14·28 rhythm — your answer sets what gets priority, or skips revision entirely.
                </p>
              </div>
              <button
                type="button"
                disabled={savingFeeling}
                onClick={skipFeedback}
                aria-label="Skip"
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
                data-testid="button-difficulty-skip"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {([
                { feeling: 'easy' as const, label: DIFFICULTY.EASY, hint: 'Logged as a strength', color: SUCCESS },
                { feeling: 'medium' as const, label: DIFFICULTY.MEDIUM, hint: 'Standard rhythm', color: WARNING },
                { feeling: 'hard' as const, label: DIFFICULTY.HARD, hint: 'Flagged — revised first', color: DANGER },
              ]).map((choice) => (
                <button
                  key={choice.feeling}
                  type="button"
                  disabled={savingFeeling}
                  onClick={() => void saveFeeling(choice.feeling)}
                  className="flex flex-col items-center gap-1 px-2 py-3.5 disabled:opacity-50 touch-manipulation"
                  style={{ borderRadius: RADIUS.md, background: tint(choice.color, 0.1), border: `1.5px solid ${tint(choice.color, 0.4)}` }}
                  data-testid={`button-difficulty-${choice.feeling}`}
                >
                  <span className="text-[14px] font-extrabold" style={{ color: choice.color }}>{choice.label}</span>
                  <span className="text-[9px] font-bold text-center leading-tight" style={{ color: TEXT_MUTED }}>{choice.hint}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={savingFeeling}
              onClick={() => void declineRevision()}
              className="mt-2 w-full py-3 text-[13px] font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
              style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
              data-testid="button-difficulty-no-revision"
            >
              {savingFeeling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {NO_REVISION_LABEL} — don't bring this back
            </button>
          </div>
        </div>
      )}

      {/* [Rating chips] Post-REVISION rating — Again / Hard / Good / Easy,
          straight after a revision is completed anywhere the on-card chips
          didn't already answer it (Calendar, Today's revision sub-rows, the
          coach). MANDATORY on the topic's very first rating: no close button
          and no backdrop dismiss — the rating is what schedules the next
          revision. Once a previous rating exists the sheet may be dismissed,
          and the standard next step is scheduled anyway (skipRevisionRating),
          so the chain never breaks. A tap just closes back to the task list
          — deliberately NO duration popup, NO extra exercise, NO second
          prompt after rating. */}
      {revisionRatingPrompt && (() => {
        const ratingItem = revisionRatingPrompt;
        const ratingKey = ratingItem.source_key || topicKey(ratingItem.subject, ratingItem.topic);
        const lastLabel = lastRatingLabelByKey.get(ratingKey) ?? null;
        const dismissible = lastLabel !== null;
        const ratingChips = ([
          { rating: 'again' as const, label: 'Again', color: DANGER },
          { rating: 'hard' as const, label: 'Hard', color: ORANGE },
          { rating: 'good' as const, label: 'Good', color: AMBER },
          { rating: 'easy' as const, label: 'Easy', color: SUCCESS },
        ]).map((chip) => {
          const step = nextTopicRevisionStep(ratingItem.interval_days ?? null, chip.rating, today);
          return { ...chip, hint: step.dueInDays === 1 ? 'Back tomorrow' : `In ${step.dueInDays} days` };
        });
        return (
          <div className="fixed inset-0 z-[63] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Rate this revision">
            <button
              type="button"
              className="absolute inset-0"
              style={{ background: OVERLAY_BG, cursor: dismissible ? 'pointer' : 'default' }}
              onClick={dismissible && !savingRating ? () => void skipRevisionRating(ratingItem) : undefined}
              aria-label={dismissible ? 'Dismiss — the standard next revision stays scheduled' : 'Pick a rating to schedule the next revision'}
            />
            <div
              className="relative px-5 pt-5 pb-8 vicharak-sheet"
              style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}
              data-testid="sheet-revision-rating"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-extrabold" style={{ color: TEXT }} data-testid="text-revision-rating-title">
                    {lastLabel ? `Last time you rated this ${lastLabel} — how do you feel now?` : 'How did this feel?'}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: TEXT_MUTED }}>
                    “{ratingItem.topic}” — your answer schedules the next revisit on the 1·3·7·14·28 rhythm.
                  </p>
                </div>
                {dismissible && (
                  <button
                    type="button"
                    disabled={savingRating}
                    onClick={() => void skipRevisionRating(ratingItem)}
                    aria-label="Dismiss — keep the standard next revision"
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                    style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
                    data-testid="button-revision-rating-dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {ratingChips.map((chip) => (
                  <button
                    key={chip.rating}
                    type="button"
                    disabled={savingRating}
                    onClick={() => void rateRevision(ratingItem, chip.rating)}
                    className="flex flex-col items-center gap-1 px-1.5 py-3.5 disabled:opacity-50 touch-manipulation"
                    style={{ borderRadius: RADIUS.md, background: tint(chip.color, 0.1), border: `1.5px solid ${tint(chip.color, 0.4)}` }}
                    data-testid={`button-revision-rating-${chip.rating}`}
                  >
                    <span className="text-[14px] font-extrabold" style={{ color: chip.color }}>{chip.label}</span>
                    <span className="text-[9px] font-bold text-center leading-tight" style={{ color: TEXT_MUTED }}>{chip.hint}</span>
                  </button>
                ))}
              </div>
              {!dismissible && (
                <p className="mt-2.5 text-[10px] text-center" style={{ color: TEXT_MUTED }} data-testid="text-rating-required">
                  First revisit of this topic — pick one to schedule the next revision.
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* “How long did you study?” — one tap after a completion, always skippable */}
      {durationPrompt && (
        <DurationSheet
          topic={durationPrompt.topic}
          subject={durationPrompt.subject}
          note={durationPrompt.note}
          prefillMinutes={durationPrompt.prefillMinutes}
          saving={savingDuration}
          onSave={(minutes, fromTimer) => void saveDuration(minutes, fromTimer)}
          onSkip={() => setDurationPrompt(null)}
        />
      )}

      {/* Focus mode — full-screen countdown; sessions auto-log. */}
      {focusOpen && (
        <FocusModeScreen
          taskName={missionQueue[0]?.topic ?? null}
          subject={missionQueue[0]?.subject ?? null}
          onLog={(minutes) => void logFocusSession(minutes)}
          onClose={() => setFocusOpen(false)}
        />
      )}

    </>
  );
}
