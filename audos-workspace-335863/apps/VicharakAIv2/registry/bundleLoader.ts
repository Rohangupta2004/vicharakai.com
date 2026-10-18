/**
 * Bundle loading (§3.6): registry entry → parsed bundle → concepts installed
 * into IndexedDB. Tier derived here, at load time. Exam-agnostic throughout.
 */
import type { ExamBundle, ExamRegistryEntry } from '../data/types';
import { BUNDLES } from './bundleFiles';
import { deriveTier } from './examRegistry';
import { parseSyllabusMd } from './syllabusParser';
import { installConcepts, countConcepts } from '../data/concepts';
import { kvSet, kvGet } from '../data/kv';

export function loadBundle(entry: ExamRegistryEntry): ExamBundle {
  const files = BUNDLES[entry.bundle_path];
  if (!files || !files['syllabus.md']) {
    throw new Error(`bundle "${entry.bundle_path}" has no syllabus.md`);
  }
  const { concepts, chapters } = parseSyllabusMd(entry.exam_id, files['syllabus.md']);
  return { exam_id: entry.exam_id, tier: deriveTier(entry), chapters, concepts };
}

export interface InstalledBundleMeta {
  exam_id: string;
  tier: string;
  concept_count: number;
  chapter_count: number;
  installed_at: string;
}

const metaKey = (examId: string) => `bundle_meta:${examId}`;

/** Parse + write the concept enum into the DB. Returns install metadata. */
export async function installBundle(entry: ExamRegistryEntry): Promise<InstalledBundleMeta> {
  const bundle = loadBundle(entry);
  await installConcepts(entry.exam_id, bundle.concepts);
  const meta: InstalledBundleMeta = {
    exam_id: entry.exam_id,
    tier: bundle.tier,
    concept_count: bundle.concepts.length,
    chapter_count: bundle.chapters.length,
    installed_at: new Date().toISOString(),
  };
  await kvSet(metaKey(entry.exam_id), meta);
  return meta;
}

export async function getInstalledBundleMeta(examId: string): Promise<InstalledBundleMeta | undefined> {
  const meta = await kvGet<InstalledBundleMeta>(metaKey(examId));
  if (!meta) return undefined;
  // Self-heal: meta without concepts means a torn install — report as absent.
  return (await countConcepts(examId)) > 0 ? meta : undefined;
}
