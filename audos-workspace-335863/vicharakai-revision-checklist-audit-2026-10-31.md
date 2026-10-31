# VicharakAI — 40-item product checklist audit

**Date:** 2026-10-31  
**Scope:** `apps/VicharakAI/` (in-app), signed-out landing (`components/EmailGateLanding.tsx`, `components/LandingNarrative.tsx`), root `llms.txt`, SEO microsites.  
**Method:** Read-only code + schema review via Audos MCP. No runtime click-through in this pass.  
**Note:** The workspace does **not** store a canonical numbered 1–40 checklist document. Item titles below match Otto’s task categories (P1 items 1–12 named in the brief; P2/P3/P4 inferred from product spec in `agent/customer-prompt.md` and implementation).

**Product constraints checked against recommendations:** 2-step onboarding (exam + dream goal) ✓ in `features/onboarding/OnboardingFlow.tsx`; optional post-onboarding import ✓; NEET PG syllabus ✓; deterministic scheduling ✓ (`revisionEngine.ts`, `engine.ts`, `studyEngine.ts`); India + Razorpay + ₹149/mo + 7-day trial ✓ (`access.ts`, `EmailGateLanding.tsx`, `llms.txt`); accent `#0057FF` on landing ✓ (`components/landingTokens.ts`) — app shell may still reference legacy cyan in older audit notes; verify published bundle for any `#00D4FF` stragglers.

---

## Summary

| Priority | Theme | Yes | Partial | No |
|----------|--------|-----|---------|-----|
| P1 (1–12) | Revision tracking | 8 | 4 | 0 |
| P2 (13–20) | Explainability | 6 | 2 | 0 |
| P3 (21–30) | Test mistake → task | 4 | 6 | 0 |
| P4 (31–40) | Trust / usability | 5 | 4 | 1 |

**Scheduling model (important for “FSRS” accuracy):** Topic/chapter planner revisions use a **fixed 1→3→7→14→28 ladder** plus Again/Hard/Good/Easy step rules (`config/revision.ts`, `revisionEngine.ts`). **Full FSRS-4.5** applies to **saved doubt/question cards** (`fsrsReview` in `revisionEngine.ts`, state in `zuno_question_queue.fsrs_json`). Marketing/copy sometimes says “FSRS” for the whole product — technically **partial** for topic revisions.

**Open → due → study → log (happy path):** After onboarding, default **Today** tab (~0 taps). Due revisions and tasks appear in one checklist; tick row → inline Again/Hard/Good/Easy (~2 taps to log). **Revision** tab opens calendar (~1 tap). Question deck on Today when doubts due (~0–1 tap). **Estimated 2–4 taps** for “see due topic → complete → rate” when items are already on Today.

---

## Checklist table

| # | Item | Exists? | Where in app (file / screen) | Visibility (1–2 taps?) | Accuracy issues / bugs | Ease-of-use notes | Recommended action |
|---|------|---------|------------------------------|------------------------|-------------------------|-------------------|-------------------|
| **Priority 1 — revision tracking** |
| 1 | NEET PG syllabus structure (subjects → chapters → topics) | **yes** | `data/syllabuses.ts` + `data/examsIndiaMedical.ts`; **Syllabus Browser** `SyllabusScreen.tsx`; Vision Board / syllabus picker in `+` sheet | **Partial** — Syllabus Browser is under Profile quick-links / Tools, not bottom bar (2–3 taps) | Structure is code-backed, not DB; custom exams use AI/manual fallback | Searchable browser with mastery colours | **Surface better** — link “NEET PG syllabus” from Today empty state for NEET PG profiles |
| 2 | Revision history (per-topic timeline) | **partial** | Data in `zuno_items`, `zuno_task_feedback`, `zuno_topic_attempts`; UI via **Calendar** `CalendarTab.tsx` (day popover, “Day-N revisit”) | **No** — no dedicated “history” screen; calendar is 2 taps (Revision tab → day) | History exists in DB; not aggregated as a readable log | Power users can inspect by date | **Build** (S) dedicated revision history on chapter/topic from existing rows |
| 3 | Progress stages (not started → weak → developing → strong) | **yes** | `adaptationEngine.ts` mastery bands; `SyllabusScreen.tsx`, Vision Board, Dashboard pace | **Partial** — strongest on Progress / Vision Board (2 taps) | Chapter-level `zuno_exam_progress` vs topic-level attempts — stages can disagree slightly | Colour coding is clear once found | **Surface better** — small stage chip on Today revision rows |
| 4 | One-tap logging (complete + rate) | **yes** | `features/today/TodayScreen.tsx` + `features/tasks/useTasks.ts` (`completeWithAnimation`, inline Again/Hard/Good/Easy) | **yes** — tick → rate chips on Today | Off-Today completions use overlay sheet (extra tap) | Coach tools `mark_topic_done` mirror engine | **Fix** (S) unify quick-complete on Calendar day view |
| 5 | Import existing progress (post-onboarding, optional) | **partial** | Today empty/backfill: “What have you studied in the last two weeks?” (`TodayScreen.tsx`); `backfillStudiedTopics` in `useTasks.ts`; photo/syllabus import via `PhotoTasks.tsx`, `PlanParser.tsx` | **Partial** — only when Today empty or user finds import paths | Backfill creates done tasks + revision drafts; no % syllabus import wizard | Skippable; aligns with 2-step onboarding | **Surface better** (S) Profile row “Already studied some topics?” |
| 6 | Today’s queue (due revisions + plan) | **yes** | **Today** tab; `engine.ts` `dueRevisions` / `prioritizeDueRevisions`; caps in `config/revision.ts` | **yes** — default landing | Caps: max 5 revisions / 60 min surface slice; rest queued silently | AI focus card + checklist | **Skip** — core strength |
| 7 | Calendar / list views | **yes** | `CalendarTab.tsx` — Week / Month / Road; Profile → Study calendar | **yes** — Revision tab | Road view less obvious; Overdue pills shown here but copy says Today hides “backlog” language | Editable tasks per day | **Skip** |
| 8 | Manual scheduling + undo | **partial** | `TaskOverlays.tsx` edit scheduled date; `CalendarTab.tsx` `onUpdateTask`; delete undo toast in `useTasks.ts` | **Partial** — edit buried in task menu (3+ taps) | Undo on delete only, not on reschedule/rating | Date picker works | **Build** (S) undo for reschedule; **Surface better** drag on calendar |
| 9 | Revision modes (Again / Hard / Good / Easy + question FSRS) | **yes** | Topics: `revisionEngine.ts` `nextTopicRevisionStep`; UI chips in Today/overlays; Questions: `QuestionRevisionDeck` + `fsrsReview` | **yes** on Today when rating shown | Again = same-session requeue for **cards** only; topics reset to day 1 | Distinct Again vs Hard for topics | **Skip** for topics; **Fix** (S) document difference in Help FAQ |
| 10 | Daily time budget (revision caps) | **yes** | `REVISION_DAILY_CAP`, `REVISION_DAILY_MINUTE_CAP` in `config/revision.ts`; enforced in `prioritizeDueRevisions` | **partial** — not shown as “45/60 min” meter on Today | Student-set task durations can exceed minute cap (by design) | Protects overload | **Surface better** (S) show “~60 min revisions queued” on Today |
| 11 | Backlog recovery (after missed days) | **yes** | `useTasks.ts` carry-over / `planBacklogRedistribution`; `TaskOverlays.tsx` carry-over sheet | **Partial** — auto silent spread; sheet after gaps | Product copy: no “overdue” on Today but Calendar shows Overdue — messaging split | “Spread smartly” / “Start fresh” | **Fix** (S) align Today vs Calendar overdue language |
| 12 | Reminders | **partial** | `features/notifications/useNotifications.ts`; Profile toggle + time | **Partial** — Profile → reminders (2 taps); permission gate | Profile subcopy promises “Daily mission + revision-due alerts” but code = **one** daily notification naming one topic; iOS needs PWA install | Silent when nothing due ✓ | **Fix** (S) Profile copy; **Build** (M) optional second nudge only if promised |
| **Priority 2 — explainability (13–20)** |
| 13 | “Why you’re seeing this” on due items | **yes** | Today revision rows: reason + **Why?** (`TodayScreen.tsx`); doubt deck muted line | **yes** on Today | Reasons depend on `studyEngine` / weak rows — Otto notes weak→priority sync may still drift | Tapping Why? expands | **Fix** (M) verify weak-topic → queue ordering with live data |
| 14 | “AI says: focus on this first” with reason | **yes** | Today card `nowPick.reason` (`TodayScreen.tsx`) | **yes** when card visible | Deterministic, not LLM — label says “AI” | Opens Vicharree on tap | **Surface better** rename to “Recommended focus” if no model call |
| 15 | “Vicharee decided this ✦” + evidence | **yes** | Today task rows (`TodayScreen.tsx`); coach mood plan | **yes** on auto-added tasks | Badge on subset of tasks | Builds trust when reason shown | **Skip** |
| 16 | Time-saved estimate after revision | **yes** | `revisionEngine.ts` `timeSavedLine` / `estimateTimeSaved` | **partial** — shown after some completion flows, easy to miss | Deterministic estimate, not measured | Nice payoff line | **Surface better** (S) always show after rating |
| 17 | Pace / “Am I on track?” explainability | **yes** | Today chip + `DashboardTab.tsx` / `engine.ts` pace signal | **yes** — Today + Progress | Requires logged hours + coverage; empty state neutral | Matches coach `pace` object | **Skip** |
| 18 | Recommendation / explainability log | **partial** | Table `zuno_recommendation_log` (see code audit); not a user-facing screen | **no** | Written for debugging/analytics | N/A for students | **Build** (M) optional “Plan explainability” in Profile for power users OR skip |
| 19 | Revision rung visible (Day-N / interval) | **yes** | Calendar pills `Revision due`, `Day-${n} revisit`; task metadata | **partial** — clearer on Calendar than Today list | Legacy interval values snap to ladder (`nextTopicRevisionStep`) | Helps trust scheduler | **Surface better** (S) interval badge on Today rows |
| 20 | Weak-topic rationale in plan | **partial** | `zuno_weak_topics`, `adaptationEngine.ts`, Test Analysis, coach tools | **partial** — often via Tests/Progress, not Today | **Risk:** weakness → Today priority column historically disconnected (otto.md) | Repeat offenders visible in Tests | **Fix** (M) end-to-end weak sync test for NEET PG cohort |
| **Priority 3 — test mistake → task (21–30)** |
| 21 | Question Cards (Mistake Book) | **yes** | `DoubtsTab.tsx` / `FlaggedQuestions.tsx`; Profile quick-link | **partial** — 2 taps via Profile | 30+ rows live in `zuno_question_queue` | Deck UX on Today when due | **Surface better** — Tests tab cross-link |
| 22 | Mistake merging (duplicate questions) | **partial** | `analytics.ts` `groupDoubtSignals` (aggregate only) | **no** | No merge UI; duplicates possible on repeated saves | Manual delete only | **Build** (M) merge-by-topic/concept OR skip if rare |
| 23 | Auto task creation from mock analysis | **partial** | `features/testAnalysis/TestAnalysisScreen.tsx`, `taSelectors.ts` (`topicAction`) | **partial** — after upload/analysis flow | Not every wrong Q → planner task; behavioural vs revision split | Heavy upload flow | **Build** (M) one-tap “Add revision tasks for top 3 gaps” |
| 24 | Retest / targeted drill | **partial** | `GenerateTest.tsx`; Test Analysis **“Take a timed drill”** | **partial** — Tools / Analysis (2–3 taps) | Not labeled “Retest”; pattern-based MCQs | Useful for weak topics | **Surface better** (S) from Repeat offenders row |
| 25 | Repeated-error tracking | **yes** | Test Analysis **Repeat offenders** (`TestAnalysisScreen.tsx`, `taSelectors.ts`) | **partial** — Tests tab (1 tap) | Based on logged mocks only | Strong for NEET PG mock cadence | **Skip** |
| 26 | Auto “Clear mistake” revision tasks from doubts | **partial** | Described in `customer-prompt.md`; tombstone regex in `useTasks.ts` for delete | **partial** | Hard to confirm daily cap (max 3/day) without full trace | Reduces manual entry | **Fix** (S) verify hook + document in Help |
| 27 | Question card grading (Again / Got it / Explain) | **yes** | Today `QuestionRevisionDeck`; Doubts deck | **yes** when deck visible | FSRS for cards; Got it ≠ Good/Easy naming | Swipe + buttons | **Skip** |
| 28 | Test wrong → weakness score → scheduler | **partial** | `masteryService.ts`, `engine.ts` prioritization | **no** for student visibility | Known risk of desync (founder notes) | Affects order of due revisions | **Fix** (L) audit + wire weak score to `prioritizeDueRevisions` |
| 29 | MCQ generation from mistakes | **yes** | `mcq.ts`, `GenerateTest.tsx`, `convertFlaggedToMcqs` | **partial** — Tools (2+ taps) | AI cost; needs network | Good for retest content | **Skip** |
| 30 | Mistake → task workflow end-to-end | **partial** | Tests upload → analysis → (optional) tasks; Mistake Book parallel path | **no** — multi-step, not 1–2 taps | Two pipelines (mock vs photo doubt) confuse | Power feature | **Build** (L) unified “Fix this mistake” CTA from Repeat offenders |
| **Priority 4 — trust / usability (31–40)** |
| 31 | Landing pricing visible without waiting for app JS | **partial** | Hero/pricing in React `LandingNarrative.tsx` (needs JS); static **`llms.txt`**, JSON-LD/FAQ in published bundle head | **partial** — crawlers/plaintext OK; humans need JS for hero | No `<noscript>` pricing block verified | EmailGate loads React shell | **Build** (S) `<noscript>` ₹149 + 7-day trial under hero |
| 32 | Trial terms accurate (7-day, no card) | **yes** | Onboarding trial step; `access.ts`; `vicharakai_trials` (35 rows, server_proof) | **yes** after signup | Older audit mentioned 3-day — **superseded** to 7-day in code/docs | Clear in Premium tab | **Skip** |
| 33 | India Razorpay-only checkout | **yes** | `PaywallScreen.tsx`, hooks `create-razorpay-order`; `EmailGateLanding.tsx` comment | **yes** — Premium tab | Creem may linger in `creemConfig.ts` for non-India paths — landing says India-only | UPI path live | **Fix** (S) remove dead Creem UI from India-only builds if any |
| 34 | Help / support contact | **yes** | `HelpSupport.tsx`; landing `SUPPORT_EMAIL`; `grohan24102004@gmail.com` in otto.md | **partial** — Profile → Help (2 taps) | — | FAQs present | **Skip** |
| 35 | NEET PG positioning on landing / SEO | **yes** | `llms.txt`, `/neet-pg` SEO app; landing narrative (exam list) | **yes** on marketing scroll | Landing lists many exams — NEET PG not sole hero | Aligns with founder scope | **Surface better** (S) NEET PG callout for current ad focus |
| 36 | PWA install instructions | **yes** | Header download icon; Profile “VicharakAI on your phone”; `customer-prompt.md` | **partial** — 2 taps | iOS Safari steps required | Documented | **Skip** |
| 37 | Sync-failure handling (unverified session / failed writes) | **partial** | `sessionGuard.ts` queues/blocks writes; `onboardingStorage.ts` pending onboarding | **no** — no user banner “Sync failed, retry” | Silent `.catch` on some paths historically caused data loss anxiety | OTP verify unlocks writes | **Build** (M) visible sync status + retry on Today |
| 38 | Duplicate log prevention | **yes** | `useTasks.ts` / add flows skip identical duplicates (`customer-prompt.md`) | **yes** | Edge cases: same topic different casing may duplicate | — | **Fix** (S) normalize topic keys on add |
| 39 | History preserved on manual reschedule | **yes** | Edits update `zuno_items.scheduled_for`; feedback rows kept | **partial** | Reschedule doesn’t delete `zuno_task_feedback` | Undo limited | **Fix** (S) show “moved from X to Y” in activity |
| 40 | Brand #0057FF, no cyan | **partial** | Landing `landingTokens.ts` ✓; app `theme.ts` / Sept audit noted `#00D4FF` FAB | **yes** visually if published | Stragglers possible in coach FAB / old CSS | Founder constraint | **Fix** (S) grep published bundle for cyan; replace with `#0057FF` |

---

## Ranked top 10 next actions

| Rank | Action | Size | Rationale |
|------|--------|------|-----------|
| 1 | Verify and fix **weak-topic score → Today revision ordering** (item 20/28) | **L** | Core NEET PG promise; founder-flagged desync |
| 2 | **Unified mock mistake → revision task** CTA from Repeat offenders (30) | **L** | Closes test→study loop in 1–2 taps |
| 3 | **Sync status UI** when `sessionGuard` blocks writes (37) | **M** | Trust; reduces “I logged but it vanished” |
| 4 | **Dedicated revision history** per topic/chapter (2) | **M** | Checklist gap vs “full revision history” marketing |
| 5 | Align **overdue/backlog messaging** Today vs Calendar (11) | **S** | Avoid contradictory mental model |
| 6 | **Profile reminder copy** vs one-notification implementation (12) | **S** | Quick trust fix |
| 7 | Landing **noscript/static pricing** block (31) | **S** | Readable ₹149 + 7-day trial before React hydrates |
| 8 | **NEET PG syllabus entry** from Today/Profile for PG students (1) | **S** | Focus exam scope |
| 9 | Show **revision time budget** on Today (10) | **S** | Explainability for capped queue |
| 10 | Remove remaining **cyan** accents in app shell (40) | **S** | Founder design constraint |

---

## Files reviewed (representative)

`apps/VicharakAI/config/revision.ts`, `revisionEngine.ts`, `fsrsTypes.ts`, `engine.ts`, `studyEngine.ts`, `features/today/TodayScreen.tsx`, `features/tasks/useTasks.ts`, `features/tasks/TaskOverlays.tsx`, `CalendarTab.tsx`, `features/onboarding/OnboardingFlow.tsx`, `features/notifications/useNotifications.ts`, `features/testAnalysis/TestAnalysisScreen.tsx`, `features/testAnalysis/taSelectors.ts`, `DoubtsTab.tsx`, `SyllabusScreen.tsx`, `sessionGuard.ts`, `access.ts`, `components/EmailGateLanding.tsx`, `components/landingTokens.ts`, `llms.txt`, `agent/customer-prompt.md`, prior audits `vicharakai-code-audit-2026-08-22.md`, `vicharakai-in-app-audit-2026-09-27.md`, WorkspaceDB `vicharakai_trials`.

**No application source files were modified** — read-only audit.
