/** Explainability-log row shape (zuno_recommendation_log). */
export interface RecommendationLogRow {
  id: number;
  kind: string;
  recommendation: string;
  reason: string;
  data_used?: string | null;
  action_taken?: string | null;
  created_on: string;
}
