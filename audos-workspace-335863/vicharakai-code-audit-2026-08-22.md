# VicharakAI — Codebase & Data Audit

**Date:** 22 August 2026 · **Scope:** read-only audit of the VicharakAI app (`apps/VicharakAI/**`), its WorkspaceDB tables and registered server functions. No code was modified for this audit. Line numbers are exact where cited; where a function was verified but not its precise line, the file + function is cited. Anything unverifiable is marked **UNSURE**.

---

## A. Schema

### 1. Tables (live from the WorkspaceDB registry)

| Table | Rows | Cols | Purpose |
|---|---|---|---|
| zuno_profile | 82 | 10 | exam pick + start date + profiling answers |
| zuno_items | 436 | 16 | tasks + spaced-revision rows |
| zuno_meta | 453 | 6 | per-student key-value store |
| zuno_habits | 7 | 6 | legacy daily practices |
| zuno_scores | 0 | 9 | legacy percentage-only scores |
| zuno_test_scores | 1 | 14 | marks-based test results |
| zuno_mistakes | 0 | 11 | mistake log |
| zuno_sessions | 10 | 11 | recorded study time |
| zuno_task_feedback | 13 | 10 | Hard/Medium/Easy signals |
| zuno_question_queue | 30 | 20 | saved doubts/questions |
| zuno_mcq_questions | 67 | 18 | AI-generated MCQs |
| zuno_weekly_targets | 33 | 13 | weekly goals (targets/counters, json focus_chapters) |
| zuno_test_results | 5 | 12 | Test Mode submissions |
| zuno_attachments | 8 | 8 | task/question images |
| zuno_exam_progress | 15 | 13 | per-chapter mastery |
| zuno_weak_topics | 2 | 13 | weakness scores |
| zuno_topic_attempts | 20 | 12 | studied/correct/wrong event log |
| zuno_readiness | 10 | 10 | readiness snapshots |
| zuno_recommendation_log | 22 | 10 | explainability log |
| vicharakai_subscriptions | 4 | 14 | paid entitlements (Razorpay/Creem ids) |
| vicharakai_trials | **0** | 7 | 3-day trial records (email unique) |
| linked_references | 29 | 9 | cached web pages |
| qa_probe_table_does_not_exist | 0 | 5 | deprecated QA leftover (registry says safe to drop) |

Column-level types were verified in full for `zuno_items`, `zuno_weekly_targets`, `vicharakai_subscriptions` and `vicharakai_trials` (e.g. `zuno_items`: id serial PK; exam/subject/topic/kind/scheduled_for/status text; day_number/interval_days integer; completed_at/studied_on/source_key text; is_priority boolean; session_id text; created_at/updated_at timestamps). The other tables' counts and purposes come from the registry; full per-column dumps were not enumerated.

### 2. Tables never written by any code path

- **zuno_habits** — referenced only in the registry and reset list (`apps/VicharakAI/services/database/tables.ts` L56–57, L80–100); no insert/update anywhere.
- **zuno_scores** — no inserts; only deleted when a legacy row is upgraded (`features/tests/useTests.ts`, `handleSaveScore`, ~L891–895) and by reset.
- **linked_references** — no reference anywhere in `apps/VicharakAI` (platform/Otto-written).
- **qa_probe_table_does_not_exist** — nothing.

### 3. Concepts/topics table

No DB table — the syllabus lives in code: `apps/VicharakAI/syllabus.ts` (66 KB) and `apps/VicharakAI/data/syllabuses` (stable chapter/topic ids). DB granularity: `zuno_exam_progress` is **chapter-level**; `zuno_weak_topics` / `zuno_topic_attempts` are **topic-level** (`topic_id` = `<chapterId>|<topic-slug>`, see `SyllabusRef`, `engine.ts` L252–260). MCQ rows additionally carry a **sub-concept** string (`concept` column, `mcq.ts` `McqQuestion`).

---

## B. Weak-topic detection

**4. Where computed:** Written: `features/mastery/masteryService.ts` — `recordTestResult` (weakness bookkeeping block) and `markTopicWeak`. Read/derived: `adaptationEngine.ts` — `getWeakTopics` (weak rows first, then overdue low-mastery chapters). Secondary accuracy-based detection: `mcq.ts` `adaptiveContextForTopic` + `WEAK_TOPIC_THRESHOLD = 60`.

**5. Inputs:** test answers (correct/wrong events) via `recordTestResult`; manual "Mark as weak" via `markTopicWeak`; the `getWeakTopics` fallback reads chapter mastery + overdue spaced-revision dates from `zuno_exam_progress`. The Hard/Easy self-rating feeds **mastery gain and revision timing**, not the weakness score.

**6. Output:** `zuno_weak_topics.weakness_score` (plus `detected_at`, `resolved_at`). Dynamics: +25 on wrong, −20 on correct, cap 100, resolved at 0 (`adaptationEngine.ts` `WEAKNESS_ON_WRONG` / `WEAKNESS_ON_CORRECT` / `WEAKNESS_CAP`).

**7. Live or stored:** Both — the **score is stored on write** (`masteryService.recordTestResult`); the ranked **insight list is computed live on read** (`getWeakTopics`); the readiness snapshot is persisted (`masteryService.persistReadiness` → `zuno_readiness`, synced from `features/mastery/useMastery.ts`).

---

## C. Scheduler

**8. Where:** `apps/VicharakAI/revisionEngine.ts` — `calculateNextRevision` (the single interval calculator) and `topicRevisionSchedule`. Materialisation into rows: `engine.ts` `buildRevisionDrafts` (L488). What surfaces today: `engine.ts` `dueRevisions` (L622), `prioritizeDueRevisions` (L696). Capacity-fitted day plan: `studyEngine.ts` `buildPriorityQueue` / `buildDailyPlan`.

**9. Algorithm:** custom **fixed-interval ladders**, not SM-2 (`config/revision.ts`): topics 1/3/5/7/14 days with Hard/Easy variants selected by the student's feeling (`engine.ts` `revisionIntervalsForFeeling`, L481); chapters use a rolling ladder indexed by attempt count; saved questions use 1/3/7/14/30 and **exhaust** (clear for good).

**10. Reads:** pending `zuno_items` revision rows gated on completed study history (`engine.ts` L622–648), `zuno_weak_topics` scores for ordering, and — in the daily plan — weak insights, recent test accuracy, chapter weightage, saved doubts, the student's own "hard" signals and capacity from `zuno_sessions`/goal (`studyEngine.ts` `buildPriorityQueue`).

**11. Exact line where the scheduler reads weak-topic data:** `engine.ts` L702:

```ts
for (const item of due) score.set(item.id, weaknessScoreForTopic(item.topic, weakRows));
```

called with live `zuno_weak_topics` rows at `app/StudentDataContext.tsx` L619–622 (`prioritizeDueRevisions(dueRevisionsAll, weakTopicRows)`). `studyEngine.ts` `buildPriorityQueue` also scores `args.weakInsights` matches ("flagged weak" reasons).

---

## D. Doubt capture

**12. Implemented.** Capture: Doubts tab (`DoubtsTab.tsx`, photo/gallery + note) and the quick-doubt box (`StudyToolsPanel.tsx` → `saveQuickDoubt`). Storage: `features/doubts/useDoubts.ts` `saveFlagged` inserts into `zuno_question_queue` (text, `image_url`, subject/topic/concept, `revise_count: 0`, `next_revision_on` from the question ladder). Wrong quiz answers auto-queue silently (`autoQueueWrongQuestion`). "Got it" / "Revise again" advance/reset the spaced date (`advanceFlagged` / `repeatFlagged`). 30 live rows confirm the path works. Attached images also land in `zuno_attachments` (parent_type 'task'/'question').

---

## E. Questions

**13. Source:** AI at runtime — no seed data. `mcq.ts` `generateMcqs` POSTs to the platform OpenAI proxy (`OPENAI_PROXY_URL` from `config/models.ts`); validated drafts are saved to `zuno_mcq_questions`. Generate Test also converts saved doubts via `convertFlaggedToMcqs`.

**14. Count right now:** **67** rows in `zuno_mcq_questions`.

**15. Topic link:** text-key join, not a foreign key (table has `foreignKeys: []`): every MCQ stores `source_key: topicKey(subject, topic)` (`mcq.ts`, `toDraft`). The join is in `features/tests/testSelectors.ts` `buildTestTopicOptions`: `const key = q.source_key || topicKey(q.subject, q.topic)` matched against the same key on `studentItems`.

---

## F. End-to-end reality

**16. New user → first real write:** `components/EmailGate.tsx` (email checked by the `validate-signup-email` server hook + `lib/emailValidation.ts`) → platform session → `app/AppShell.tsx` gate 4 (no profile → onboarding) → `features/onboarding/OnboardingFlow.tsx` → `useOnboarding.ts` `finishOnboarding` → **first DB write: `verifiedDbFrom(TABLES.profile).insert(...)` in `writeOnboardingToDb`** (then meta rows, Day-1 `zuno_items`, and `masteryService.recordStudySession` for pre-completed chapters). If the session isn't verified yet, the first write is localStorage (`onboardingStorage.ts` `savePendingOnboarding`) synced later. Files involved: `EmailGate.tsx`, `lib/emailValidation.ts`, hook `validate-signup-email`, `AppShell.tsx`, `OnboardingFlow.tsx`, `useOnboarding.ts`, `onboardingStorage.ts`, `engine.ts`, `services/database/dbClient.ts`, `services/database/tables.ts`, `sessionGuard.ts`, `features/mastery/masteryService.ts`, plus the trial insert in `features/access/useAccess.ts` (see Q28).

**17. Dashboard numbers:** all computed from real DB rows passed as props (`features/dashboard/DashboardScreen.tsx` → `DashboardTab.tsx`: studentItems, scoreEntries, mistakes, sessions, streak, pace). One acknowledged estimate: study-hours bars for days with no logged time ("Days you never logged fall back to an estimate", `DashboardTab.tsx` L1087). The Story of the Day is static rotating content (`stories.ts`, used at `DashboardTab.tsx` L74/L180) — content, not a faked metric. No hardcoded fake numbers found.

**18. Unreachable screens:** none among the screens — all tabs/overlays are wired in `AppShell.tsx`, and the previously orphaned `WeeklyTargetsScreen` gained entry points on 2026-08-22 (Today + Profile). Orphaned **components** (not screens): `WeeklyGoalsCard` and `WeeklyTargetSheet` in `WeeklyGoals.tsx` (no renderer found; only its `weekStartISO`/`inWeek`/`isSundayISO` helpers are imported). Dead imports: `FlaggedSection` and `MarkdownText` in `features/today/TodayScreen.tsx` L92/L95. The entire `zuno-expo/` tree is a separate React Native project never compiled into this space. UNSURE for files not opened individually (e.g. `ExamChatSupport.tsx` UI usage).

---

## G. Auth & security

**19. RLS:** there is no Postgres RLS here — this is WorkspaceDB with per-table write policies + `session_id` owner scoping. Declared (tightened) policies: `vicharakai_subscriptions` (`serverHooksOnly: true`, 10 protected columns) and `vicharakai_trials` (insert-only, `requireVerifiedOwner: true`). Tables verified WITHOUT a declared policy (platform default: `allowSharedWrites: true`, `requireVerifiedOwner: false`): `zuno_items`, `zuno_weekly_targets`. UNSURE for the remaining zuno_* tables individually.

**20. service_role in client code:** NOT IMPLEMENTED — no Supabase, no `service_role` string anywhere in the inspected code; data access goes through the platform SDK (`window.useWorkspaceDB` / `window.__workspaceDb`, `services/database/dbClient.ts` L30–56).

**21. Committed secrets:** none found. Razorpay's secret lives in the platform secrets proxy (hooks use `RAZORPAY_BASIC_AUTH` via `platform.secretsProxy`); the client only receives the public `key_id` at runtime from the `create-razorpay-order` hook (`access.ts` ~L108–111; `PaywallScreen.tsx` `startRazorpayCheckout`). Hardcoded but not secrets: the founder email in `access.ts` `LIFETIME_PREMIUM_EMAILS` (~L41) and Creem placeholder URLs in `creemConfig.ts` L27/L30.

---

## H. Payments

**22. Razorpay:** functional end-to-end and LIVE for India: `create-razorpay-order` hook (live-mode, amounts locked server-side) → Razorpay modal in `PaywallScreen.tsx` (`startRazorpayCheckout`) → `verify-razorpay-payment` hook writes `vicharakai_subscriptions` — a real captured row exists (₹149 Monthly, 2026-08-16). **Stubbed:** international Creem checkout — both payment links are `REPLACE_WITH…` placeholders (`creemConfig.ts` L27, L30), so non-India users see "international checkout is almost ready" and cannot pay; and the webhooks' HMAC check (next answer).

**23. Server-side verification:** yes, but the literal signature check is NOT IMPLEMENTED — the hook sandbox has no crypto module, so `verify-razorpay-payment` (server function registry) instead **re-fetches the payment from Razorpay's own API** (via `RAZORPAY_BASIC_AUTH` through the secrets proxy) and confirms it exists, belongs to the order, and is captured before writing the entitlement. `razorpay-webhook` requires the `X-Razorpay-Signature` header to be present (400 without) but cannot recompute the HMAC. The `razorpay_signature` field the client sends is transported but never HMAC-verified.

---

## I. Dead weight

**24. TODO/FIXME/mocks/placeholders:** no TODO/FIXME/HACK comments found in the ~25 files searched. Real placeholders/stubs: `creemConfig.ts` L27/L30 (`REPLACE_WITH…` payment links — blocks international payments); `access.ts` ~L72–75 deprecated legacy constants (`TRIAL_DAYS`, `FREE_DAILY_AI_MESSAGES`) kept only to compile; `masteryService.ts` `recordTestResult` ends with `void score; // reserved`; ToolsScreen "Coming Soon" teasers (Community/Leaderboard) are deliberate non-functional cards. UNSURE for files not individually searched.

**25. Not imported anywhere (verified scope):** `WeeklyGoalsCard` + `WeeklyTargetSheet` (in `WeeklyGoals.tsx`); dead imports `FlaggedSection`/`MarkdownText` in `TodayScreen.tsx` L92/L95. Outside the compiled app entirely: `zuno-expo/` (12+ files, a parallel Expo/React-Native project), `tmp-mirror-data.zip` (45 KB artifact at the workspace root), and the `qa_probe_table_does_not_exist` DB table.

**26. package.json deps:** NOT IMPLEMENTED for the compiled space — there is no `package.json` (dependencies are platform-pinned / `config.json` `cdnDependencies`). `zuno-expo/package.json` exists but belongs to the uncompiled side project; its dependency usage: UNSURE (not audited).

---

## J. Honest summary

**27. Works end-to-end today:** roughly **85–90%** — signup → onboarding → Day-1 plan → complete tasks → spaced revision → Hard/Easy adaptation → mastery/weakness/readiness → AI quizzes/tests → doubts loop → dashboard/calendar → live Razorpay payments all have working, DB-backed paths with real rows behind them.

**28. Single biggest broken thing: the free-trial clock never starts, so the paywall never fires.** `vicharakai_trials` has **0 rows against 82 profiles**. `computeAccessStatus` (`access.ts`) returns `status: 'trial'` **whenever no trial record exists**, so with zero rows nobody can ever reach `'expired'` — every student has permanent free access. The insert lives in `features/access/useAccess.ts` (trial-start effect) and is wrapped in a silent `.catch`; the table's policy requires `requireVerifiedOwner: true` and the effect requires a non-empty `paidSessionEmail`, either of which could be silently refusing every insert. UNSURE which precise condition fails — but the evidence (0 rows, 82 profiles, live since 2026-08-18) says the write has never landed for a real user.

**29. If half had to go:** the whole `zuno-expo/` tree (a parallel mobile app this space never compiles), `tmp-mirror-data.zip`, the `qa_probe_table_does_not_exist` and `zuno_habits` tables plus the `zuno_scores` legacy path, the orphaned `WeeklyGoalsCard`/`WeeklyTargetSheet` components, and the dead imports above. The compiled app itself is mostly live code — the deletable weight sits beside it, not inside it.

**30. Not asked, worth worrying about:**

- (a) All study tables run the default write policy (`allowSharedWrites: true`, `requireVerifiedOwner: false`) — per-student isolation rides entirely on platform `session_id` scoping.
- (b) Study data is keyed by session while entitlements/trials are keyed by email — a student on a new device keeps their paid plan but plan/history continuity depends on platform session restore (UNSURE how robust that is).
- (c) `zuno_weekly_targets` holds duplicate rows for the same week (five rows for week 2026-08-10 in the sample) — `findWeekRow` just picks one, so it's noise rather than breakage, but the counter-sync writes multiply.
- (d) `WeeklyTargetsScreen.tsx` (`letAiChoose`) hardcodes model `gpt-4o-mini` instead of using `config/models.ts` like every other AI call.
- (e) The `grant-lifetime-premium` hook is publicly callable, though hardcoded to one founder email so it's harmless.
- (f) `masteryService` writes `user_id: null` on every adaptation row — the column exists but is never populated; per-student scoping rides on `session_id`.
