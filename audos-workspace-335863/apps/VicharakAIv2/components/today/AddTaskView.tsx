/**
 * Plan loop entry (§4): pick subject → chapter → date, and the estimate is
 * pre-filled from the bundle, corrected by observed speed (§12). Rendered as
 * a full screen (not a popup — §15 allows popups in two places only).
 */
import React, { useEffect, useMemo, useState } from 'react';
import type { Concept } from '../../data/types';
import { deriveChapters } from '../../registry/syllabusParser';
import { addStudyTask } from '../../data/tasks';
import { effectiveEstHours } from '../../engine/pace';
import { Button, Field, inputStyle, SectionTitle } from '../../ui/primitives';
import { ACCENT, BORDER, CARD_STRONG, RADIUS, TEXT, TOUCH } from '../../ui/tokens';
import { todayIso } from '../../lib/dates';

export default function AddTaskView(props: {
  examId: string;
  concepts: Concept[];
  onDone: (added: boolean) => void;
}) {
  const chapters = useMemo(() => deriveChapters(props.concepts), [props.concepts]);
  const subjects = useMemo(() => Array.from(new Set(chapters.map((c) => c.subject))), [chapters]);

  const [subject, setSubject] = useState<string>(subjects[0] ?? '');
  const [chapterName, setChapterName] = useState<string>('');
  const [plannedFor, setPlannedFor] = useState(todayIso());
  const [estHours, setEstHours] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  const subjectChapters = chapters.filter((c) => c.subject === subject);
  const chapter = subjectChapters.find((c) => c.chapter === chapterName);

  useEffect(() => {
    if (!chapter) return;
    void effectiveEstHours(chapter.subject, chapter.est_hours).then((h) =>
      setEstHours(Math.round(h * 2) / 2),
    );
  }, [chapterName]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!chapter) return;
    setSaving(true);
    await addStudyTask({
      exam_id: props.examId,
      subject: chapter.subject,
      chapter: chapter.chapter,
      planned_for: plannedFor,
      est_hours: estHours,
    });
    props.onDone(true);
  };

  const chipStyle = (active: boolean): React.CSSProperties => ({
    minHeight: TOUCH,
    padding: '0 14px',
    borderRadius: RADIUS.control,
    border: `1px solid ${active ? ACCENT : BORDER}`,
    background: active ? CARD_STRONG : 'transparent',
    color: TEXT,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  });

  return (
    <div>
      <SectionTitle>Subject</SectionTitle>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {subjects.map((s) => (
          <button key={s} type="button" style={chipStyle(s === subject)} onClick={() => { setSubject(s); setChapterName(''); }}>
            {s}
          </button>
        ))}
      </div>

      <SectionTitle>Chapter</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {subjectChapters.map((c) => (
          <button key={c.chapter} type="button" style={{ ...chipStyle(c.chapter === chapterName), textAlign: 'left' }} onClick={() => setChapterName(c.chapter)} data-testid={`chapter-option-${c.chapter}`}>
            {c.chapter}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <Field label="Planned for">
          <input type="date" value={plannedFor} min={todayIso()} onChange={(e) => setPlannedFor(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Estimated hours">
          <input type="number" step="0.5" min="0.5" value={estHours} onChange={(e) => setEstHours(parseFloat(e.target.value) || 1)} style={inputStyle} />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Button full variant="ghost" onClick={() => props.onDone(false)}>Cancel</Button>
        </div>
        <div style={{ flex: 2 }}>
          <Button full disabled={!chapter || saving} onClick={() => void save()} testId="button-add-task-save">
            Add to plan
          </Button>
        </div>
      </div>
    </div>
  );
}
