/**
 * Central AI model configuration — the ONLY place model names live.
 *
 * Every AI call in the app goes through the platform's server-side OpenAI
 * proxy (OPENAI_PROXY_URL) — no client keys, billing handled server-side.
 * Pick the tier by task:
 *  - `standard`: rich generation where quality matters — MCQ writing,
 *    doubt→MCQ conversion, the coach's free-form replies.
 *  - `fast`: cheap structured tasks — plan parsing, photo/doubt tagging,
 *    syllabus lookup, welcome lines, single-task polish.
 *  - `vision`: the IMAGE-reading fallback. Only reach for it when a text
 *    model has already refused the image content — see visionRetryModel().
 *
 * Changing a model for the whole app = changing one line here.
 */

export const OPENAI_PROXY_URL = '/proxy/openai/v1/chat/completions';

export const AI_MODELS = {
  standard: 'gpt-5.6-terra',
  fast: 'gpt-5.6-luna',
  /** Proven image-capable on the workspace proxy (doubtOcr's fallback OCR
   * has always used it). The retry rung under `standard` for vision work. */
  vision: 'gpt-4o',
} as const;

export type AiModelTier = keyof typeof AI_MODELS;

/**
 * The token-limit field a model expects. GPT-5.6 rejects `max_tokens`, and
 * the older 4o family predates `max_completion_tokens` — one helper so no
 * call site has to remember which.
 */
export function tokenLimitField(model: string): 'max_tokens' | 'max_completion_tokens' {
  return model.startsWith('gpt-5') ? 'max_completion_tokens' : 'max_tokens';
}

/** True when `reasoning_effort` is a valid field for this model. */
export function supportsReasoningEffort(model: string): boolean {
  return model.startsWith('gpt-5');
}

/**
 * The image-capable model to retry with when `model` turned an image request
 * down, or null when there is nothing better to try. Keeps the "which model
 * can see?" decision in this file rather than in every vision call site.
 */
export function visionRetryModel(model: string): string | null {
  return model === AI_MODELS.vision ? null : AI_MODELS.vision;
}
