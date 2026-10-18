/**
 * syllabus.md parser (§3.5). Format (line-based):
 *
 *   ## subject: <Subject>
 *   ### chapter: <Chapter>
 *   - id: <concept_id>
 *     name: <display name>
 *     source_ref: <ref>
 *     est_hours: <float>
 *     triggers: <comma, separated, terms>
 *
 * Throws on structural errors so a broken bundle fails loudly at load
 * time instead of corrupting the concept enum.
 */
import type { Concept, SyllabusChapter } from '../data/types';

export interface ParsedSyllabus {
  concepts: Concept[];
  chapters: SyllabusChapter[];
}

export function parseSyllabusMd(examId: string, md: string): ParsedSyllabus {
  const concepts: Concept[] = [];
  let subject = '';
  let chapter = '';
  let current: Partial<Concept> | null = null;

  const flush = () => {
    if (!current) return;
    const c = current;
    current = null;
    if (!c.concept_id) throw new Error('syllabus.md: concept without id');
    if (!c.name) throw new Error(`syllabus.md: concept ${c.concept_id} has no name`);
    if (!subject || !chapter) throw new Error(`syllabus.md: concept ${c.concept_id} outside subject/chapter`);
    if (concepts.some((x) => x.concept_id === c.concept_id)) {
      throw new Error(`syllabus.md: duplicate concept_id ${c.concept_id}`);
    }
    concepts.push({
      concept_id: c.concept_id,
      exam_id: examId,
      name: c.name,
      subject,
      chapter,
      source_ref: c.source_ref ?? '',
      est_hours: c.est_hours && c.est_hours > 0 ? c.est_hours : 1,
      triggers: c.triggers ?? [],
    });
  };

  for (const rawLine of md.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('# ') || line.startsWith('exam:')) continue;
    if (line.startsWith('## subject:')) {
      flush();
      subject = line.slice('## subject:'.length).trim();
      chapter = '';
    } else if (line.startsWith('### chapter:')) {
      flush();
      chapter = line.slice('### chapter:'.length).trim();
    } else if (line.startsWith('- id:')) {
      flush();
      current = { concept_id: line.slice('- id:'.length).trim() };
    } else if (current) {
      const sep = line.indexOf(':');
      if (sep < 0) continue;
      const key = line.slice(0, sep).trim();
      const value = line.slice(sep + 1).trim();
      if (key === 'name') current.name = value;
      else if (key === 'source_ref') current.source_ref = value;
      else if (key === 'est_hours') current.est_hours = parseFloat(value);
      else if (key === 'triggers') {
        current.triggers = value.split(',').map((t) => t.trim()).filter(Boolean);
      }
    }
  }
  flush();

  if (concepts.length === 0) throw new Error('syllabus.md: no concepts found');
  return { concepts, chapters: deriveChapters(concepts) };
}

/** Chapters are derived from concepts — est_hours is the sum of its concepts. */
export function deriveChapters(concepts: Concept[]): SyllabusChapter[] {
  const map = new Map<string, SyllabusChapter>();
  for (const c of concepts) {
    const key = `${c.subject}::${c.chapter}`;
    let ch = map.get(key);
    if (!ch) {
      ch = { subject: c.subject, chapter: c.chapter, est_hours: 0, concept_ids: [] };
      map.set(key, ch);
    }
    ch.est_hours += c.est_hours;
    ch.concept_ids.push(c.concept_id);
  }
  return Array.from(map.values());
}
