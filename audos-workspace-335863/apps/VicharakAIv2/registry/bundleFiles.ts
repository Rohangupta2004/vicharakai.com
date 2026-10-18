/**
 * Bundle file map — mirrors the registry/bundles/ directory (§3.5, §3.6).
 * Each bundle is a folder of markdown files keyed by bundle_path.
 * Tier derivation reads THIS map: 'pyq.md' present → full tier;
 * only 'syllabus.md' → light tier. For v1 every bundle is Light.
 *
 * pyq.md / recommendation.md are deliberately absent (§7 skipped) — the
 * shape below already supports them, so adding them later needs no engine
 * changes.
 */
import { SAMPLE_SCIENCE_SYLLABUS_MD } from './bundles/sampleScienceSyllabus';

export interface BundleFiles {
  'syllabus.md': string;
  'pyq.md'?: string;
  'recommendation.md'?: string;
}

export const BUNDLES: Record<string, BundleFiles> = {
  'bundles/sample-science': {
    'syllabus.md': SAMPLE_SCIENCE_SYLLABUS_MD,
  },
};
