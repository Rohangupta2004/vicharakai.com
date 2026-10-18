/**
 * exam-registry.json (§3.6) — the SINGLE exam registry.
 *
 * The JSON lives verbatim in this string because the space bundler resolves
 * only TS/TSX modules; treat this file as `registry/exam-registry.json`.
 * NO component reads this directly — everything goes through examRegistry.ts.
 * No exam name is referenced anywhere in engine or component code.
 *
 * Entry shape: exam_id, display_name, bundle_path, per_question_seconds,
 * protected_subjects[]. Tier is NOT stored — it is derived at bundle load
 * time (pyq.md present → full; syllabus.md only → light).
 */
export const EXAM_REGISTRY_JSON = `{
  "registry_version": 1,
  "exams": [
    {
      "exam_id": "sample-science",
      "display_name": "Sample Science Exam (dev stub)",
      "bundle_path": "bundles/sample-science",
      "per_question_seconds": 120,
      "protected_subjects": []
    }
  ]
}`;
