/**
 * Shared types + builder for the exam-syllabus database (data/syllabuses.ts).
 *
 * The syllabus catalogue is embedded directly in the app as typed constants so
 * it works offline and instantly. Every exam / subject / chapter carries a
 * stable id derived from its name, and topics get stable ids via topicIdFor()
 * — those ids are what the adaptation engine stores in zuno_exam_progress,
 * zuno_topic_attempts and zuno_weak_topics.
 *
 * NOTE: this module is intentionally separate from ../syllabus.ts (the
 * original 5-exam planner catalogue). The planner keeps using ExamDef; the
 * adaptation engine and the Syllabus Browser use ExamSyllabus from here.
 */

export type ChapterWeightage = 'high' | 'medium' | 'low';

export type ExamSyllabusCategory =
  | 'Engineering'
  | 'Medical'
  | 'Civil Services'
  | 'MBA'
  | 'Finance'
  | 'Defence'
  | 'Law'
  | 'Language'
  | 'Undergraduate'
  | 'Postgraduate'
  | 'Staff Selection';

export interface SyllabusChapter {
  id: string;
  name: string;
  /** Granular subtopics, each studiable in one sitting. */
  topics: string[];
  weightage?: ChapterWeightage;
}

export interface SyllabusSubject {
  id: string;
  name: string;
  chapters: SyllabusChapter[];
}

export interface ExamSyllabus {
  id: string;
  name: string;
  country: string;
  category: ExamSyllabusCategory;
  subjects: SyllabusSubject[];
}

/** Lowercase, alphanumeric-and-underscore slug — stable across builds. */
export function syllabusSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

/** Stable topic id: `<chapterId>|<topic-slug>`. */
export function topicIdFor(chapterId: string, topic: string): string {
  return `${chapterId}|${syllabusSlug(topic)}`;
}

/** Compact authoring shape: [chapterName, weightage | null, topics]. */
export type ChapterSeed = [string, ChapterWeightage | null, string[]];
/** Compact authoring shape: [subjectName, chapters]. */
export type SubjectSeed = [string, ChapterSeed[]];

/**
 * Assemble an ExamSyllabus from compact seeds, deriving subject ids as
 * `<examId>_<subject-slug>` and chapter ids as `<subjectId>_<chapter-slug>`.
 */
export function buildExam(
  id: string,
  name: string,
  country: string,
  category: ExamSyllabusCategory,
  subjectSeeds: SubjectSeed[],
): ExamSyllabus {
  const subjects: SyllabusSubject[] = subjectSeeds.map(([subjectName, chapterSeeds]) => {
    const subjectId = `${id}_${syllabusSlug(subjectName)}`;
    const chapters: SyllabusChapter[] = chapterSeeds.map(([chapterName, weightage, topics]) => ({
      id: `${subjectId}_${syllabusSlug(chapterName)}`,
      name: chapterName,
      topics,
      ...(weightage ? { weightage } : {}),
    }));
    return { id: subjectId, name: subjectName, chapters };
  });
  return { id, name, country, category, subjects };
}

/** Every chapter of an exam, flattened with its parent subject. */
export function examChapters(
  exam: ExamSyllabus,
): Array<{ subject: SyllabusSubject; chapter: SyllabusChapter }> {
  return exam.subjects.flatMap((subject) => subject.chapters.map((chapter) => ({ subject, chapter })));
}

/** Total granular topics in an exam's syllabus. */
export function examSyllabusTopicCount(exam: ExamSyllabus): number {
  return exam.subjects.reduce(
    (sum, subject) => sum + subject.chapters.reduce((n, chapter) => n + chapter.topics.length, 0),
    0,
  );
}
