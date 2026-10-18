/**
 * Exam registry access (§3.6). The ONLY reader of examRegistryData.ts.
 * Components and engines call these functions — they never see raw JSON
 * and never reference a specific exam.
 */
import { EXAM_REGISTRY_JSON } from './examRegistryData';
import { BUNDLES } from './bundleFiles';
import type { ExamRegistryEntry, ExamTier } from '../data/types';

interface RegistryShape {
  registry_version: number;
  exams: ExamRegistryEntry[];
}

let cached: RegistryShape | null = null;

function registry(): RegistryShape {
  if (!cached) {
    cached = JSON.parse(EXAM_REGISTRY_JSON) as RegistryShape;
    for (const e of cached.exams) {
      if (!e.exam_id || !e.display_name || !e.bundle_path) {
        throw new Error(`exam-registry entry is missing required fields: ${JSON.stringify(e)}`);
      }
    }
  }
  return cached;
}

export function listExams(): ExamRegistryEntry[] {
  return registry().exams;
}

export function getExam(examId: string): ExamRegistryEntry | undefined {
  return registry().exams.find((e) => e.exam_id === examId);
}

/** Tier is derived at bundle load time (§3.6): pyq.md present → full. */
export function deriveTier(entry: ExamRegistryEntry): ExamTier {
  const files = BUNDLES[entry.bundle_path];
  return files && files['pyq.md'] ? 'full' : 'light';
}
