# VicharakAI — in-app audit and fix log

**Date:** 2026-09-27  ·  **Scope:** everything inside `apps/VicharakAI/` (onboarding, all
logged-in screens, paywall, navigation). The landing page was out of scope.
**Constraints honoured:** no new features, no changes to AI logic, the FSRS/spaced
revision ladder, weakness detection or any other mechanism. English only.
Mobile-first (checked against a 375px viewport).

---

## 1. The six known issues — verdicts

| # | Issue | Verdict |
|---|---|---|
| 1 | Exam-picker flicker / triple render | **Already fixed — verified, no change needed** |
| 2 | Vichariee FAB placement | **Already in place — verified; one deliberate difference, see below** |
| 3 | Subscription state / trial override | **Logic correct — verified in code AND against live data** |
| 4 | Hinglish copy | **Clean — one stale Hinglish quote in a code comment, removed** |
| 5 | Country / region defaulting to India | **Bug found and fixed** |
| 6 | Practice tab removed from navigation | **Confirmed gone from both navs** |

### 1.1 Exam-picker flicker — the earlier fix works

The fix from task #144664 is present and correct:

- `data/examMetadata.ts` hands the platform query a **module-level options object**
  (`CATALOG_QUERY_OPTIONS`) and a module-level `EMPTY_ROWS`, so the hook's inputs no
  longer look "changed" on every render and the fetch effect cannot re-arm.
- `OnboardingFlow.tsx` holds a `catalogReadyRef` latch: until the FIRST catalogue read
  settles, `pickerEntries` is `null` and the picker paints a **skeleton**, never the
  hard-coded fallback list. The latch is never revoked, so a later background refresh
  cannot bounce a settled list back to a skeleton.
- `lastEntriesRef` holds the last non-empty list, so a transient empty result during a
  refresh cannot swap the settled list for the fallback mid-view.

That is exactly the fallback → reload → DB-swap sequence that produced the three
renders. The data side is healthy too — I queried the live table: `exam_metadata` holds
**65 India rows across 12 categories** (civil services 8, banking 7, defence 7,
management 7, engineering 6, medical 6, SSC 5, teaching 5, finance 5, railway 4, law 3,
other 2). Every one of those categories has an explicit label and sort position in
`examPickerCatalog.ts`, so no section renders with a raw `snake_case` name. The
hard-coded 15-exam fallback only appears if the table read fails outright.

### 1.2 Vichariee FAB

`components/VicharreeLauncher.tsx` already renders a **56px circular button, fixed
bottom-right** (`right: 16`, `bottom: calc(80px + safe-area)`, 60px from 768px up), with
a cyan `#00D4FF` glow, that opens the Vicharree chat on tap. It is keyboard-aware
(lifts with the on-screen keyboard), hides during timed tests, and stands down while the
mobile chat sheet is open so it cannot sit on top of the composer.

There is **no chat button in any header** — I checked Today, Profile and Calendar.

One deliberate difference from the brief: the button face is the **Vicharree mascot
artwork**, not a gradient disc with a white speech-bubble icon. That mascot was a
founder request (it replaced the 14MB 3D model), so I did not overwrite it. Say the word
and it becomes a plain gradient speech-bubble instead — it is a one-line change.

### 1.3 Subscription state / trial override

The priority order is correct in three independent places:

1. `access.ts › computeAccessStatus()` short-circuits on `LIFETIME_PREMIUM_EMAILS`
   **before any table is read**, then checks an active paid row, then the trial, then
   returns `expired`.
2. `features/access/useAccess.ts` computes `paidPlan` first and only evaluates the trial
   when there is no active paid row (it passes `subscriptionRows: []` in that branch, so
   a subscription can never be out-ranked by a trial).
3. The trial-start effect refuses to insert a trial row when the status is already
   `subscribed`.

Live data confirms it for the founder account: `grohan24102004@gmail.com` holds an
`active` **lifetime** row expiring 2099-12-31. Both the email short-circuit and the row
resolve to `subscribed`, so that account cannot see a paywall or a trial screen.

**Business finding, not a bug:** the one real paying customer,
`drhimanshuthanvi@gmail.com`, has a `monthly` row that **expired on 2026-09-26** — one
day before this audit — and their trial row was force-expired (set to 2000-01-01) by the
earlier fix. So right now that customer is correctly locked out and has not renewed.
Worth a personal message today; they are the only conversion in product history.

That did surface a real UX bug, which I fixed — see §3.

### 1.4 Hinglish

No Hinglish in any user-facing string. I scanned the compiled bundle (which covers every
screen at once) for ~30 romanised Hindi markers and for Devanagari — zero hits in app
copy. The only survivor was a **stale Hinglish quote inside a code comment** at the top
of `OnboardingFlow.tsx` (`"NEET 2027 ki tayari shuru karte hain"`), describing a greeting
that had already been rewritten in English. Removed, and the comment now quotes the copy
that actually ships.

### 1.5 Country / region defaulting — REAL BUG, FIXED

There is no country selector anywhere in onboarding (the picker filters to
`country === 'India'` before grouping, so no country name can render), and
`useRegion.ts` documents the rule "any doubt means India/INR".

But `resolveRegion()`, which supplies the region for the **first paint**, fell back to
the browser locale. A very large share of Indian phones report `en-US` or `en-GB`, so
until the server-side IP lookup returned (up to 4s), those students were shown
**$14.99/month and a Creem checkout** — on the paywall, the Premium tab, the onboarding
price line and the in-app trial banner. Then the price silently flipped to ₹149. That is
the worst possible first impression on the exact screens where a paying user decides.

Fixed: with nothing cached, the first paint is now India. The IP lookup still refines it
moments later, and `detectCountryCode()` is still the fallback inside `useRegion` when
the IP lookup itself fails, so international students still reach Creem.

### 1.6 Practice tab

Gone from the mobile bottom bar (`TABS` = Today · Revision · **+** · Progress · Premium ·
Profile) and from the desktop sidebar. The `practice` screen still exists and is still
reachable from Vicharree's weak-topic tip, which is what #144724 intended.

---

## 2. Screen-by-screen audit

### Onboarding (`features/onboarding/`)

| Check | Result |
|---|---|
| Each step loads without flicker / double-render | PASS — one skeleton, then one settled list; screen transitions are a single 170ms slide |
| Progress indicator accurate and visible | PASS — "Step X of 4" + % bar; the pay screen is deliberately uncounted so the bar reads 100% while reviewing the plan |
| Exam picker fast, stable, all Indian exams | PASS — 65 exams, 12 labelled sections, instant client-side search, "Other — type your exam" escape hatch |
| Day-1 plan preview renders correctly | PASS — built from the real syllabus; topic 1 readable, the rest blurred + locked; honest placeholders when a syllabus has not arrived |
| 3-day trial copy accurate | PASS — "3 days free, full access — no card needed. Then ₹149/month." matches `TRIAL_DURATION_DAYS` and the plan config |
| All buttons ≥44px | **FAILED — fixed.** The onboarding root is `.vicharak-ob`, deliberately outside `.vicharak-app`, so it never inherited the app-wide 44px tap-target floor or the 12px minimum font size. The month chips (1/3/6/12 months) on the exam-date screen were ~36px tall and the "FREE PREVIEW" badge was 10px |
| Paywall fires immediately after onboarding | **By design it does not** — see §4 |
| End-to-end without crashes / blank screens | PASS — every branch renders something; a failed syllabus lookup falls through to a named manual exam |

### Today / home (`features/today/TodayScreen.tsx`)

All PASS. Worth recording what is already right, because this screen was clearly worked
on hard: the day's progress card, the "Am I on track?" verdict and the AI-focus card all
carry explicit flex `order` values so they sit **above** the task list (they used to
print below it, several screens down). The on-track chip stays neutral with "Waiting for
first log" until real activity exists rather than showing a misleading green. Empty state
gives one obvious action ("Add today's topic") plus an optional, skippable backfill
question. Completion is optimistic with a strikethrough animation and a queued rating.
No truncation risk — the theme neutralises Tailwind's `truncate` app-wide so labels wrap
instead of clipping.

### Revision / Calendar (`CalendarTab.tsx`)

PASS. Revision rows carry subject + topic, a status pill (`Done` / `Overdue` /
`Pending`) and the ladder position (`Revision due`, `Day-N revisit`). Day cells mark
overdue in the `--gone` red. No horizontal overflow at 375px.

### Navigation (`ui.tsx`)

PASS. Five destinations plus the centre `+`. Each tab is 54px minimum with an
icon, a label and a brand-coloured active bar above the icon (so the active tab reads
even before colour registers). Every route in `AppShell` resolves to a real component —
no blank-screen route.

One inconsistency found and fixed: the Progress tab opened a screen whose heading said
**"Dashboard"**.

### Subscription / paywall

PASS on pricing. ₹149/month India (Razorpay, UPI/card/wallet), $14.99/month
international (Creem) — both derived from a single `PLAN_AMOUNTS` constant in
`access.ts`, so no screen can drift. **No ₹10/day plan and no yearly plan is offered
anywhere in the app**; the `create-razorpay-order` server function rejects
`planType: 'day'` with a 400, so even a stale cached bundle cannot create one.

Two defects found and fixed: the trial banner's hardcoded ₹149 (shown to international
students who are charged in dollars), and the lapsed-subscriber copy — see §3.

### Profile

One dead control found and removed: the **Theme (Dark/Light) toggle**. `theme.ts`
defines `.vicharak-app` and `.vicharak-app.vicharak-light` with *identical* declarations
and there is no other `vicharak-light` rule anywhere in the compiled bundle, so tapping
Dark or Light changed nothing at all. Everything else on the screen works: name, exam
switch, exam date, hour goals, notifications + reminder time, quick links to the screens
that left the bottom bar, and the danger zone.

### Vicharree chat (`features/coach/CoachScreen.tsx`)

Good empty state (mascot, a plain statement of what it can do, four starter prompts plus
weak-topic starters). One mobile layout defect found and fixed: the exam-context pill in
the header would not shrink, so a long exam name could squeeze the "Vicharree" title off
a 375px screen.

### General visual polish

PASS. One accent (`#00D4FF`) for filled primary actions and a deeper readable cyan
(`#007F99`) for ink; one radius; hairline rules instead of shadows. No dark/light
inconsistency now that the dead switch is gone. No Tailwind opacity-on-CSS-variable bugs
(`bg-[var(--x)]/12`, which silently emits nothing) anywhere in the app — everything
tints through the `tint()` `color-mix` helper.

---

## 3. Fix log

| File | Change |
|---|---|
| `apps/VicharakAI/useRegion.ts` | First-paint region defaults to **India** when nothing is cached, instead of guessing from the browser locale. Stops Indian students being shown $14.99 / Creem for the first seconds of a session. |
| `apps/VicharakAI/app/AppShell.tsx` | Trial banner price is now region-aware (`planPriceLabel`) instead of a hardcoded `₹149/month` — an international student was quoted rupees and charged dollars. Also passes the new `subscriptionLapsed` flag to the blocking paywall. |
| `apps/VicharakAI/PaywallScreen.tsx` | New `subscriptionLapsed` prop: a student whose **paid plan** expired now reads "Your VicharakAI Premium plan has ended. Renew to keep your plan, revisions and history." instead of "Your 3-day free trial has ended" — a trial they never had. Close button enlarged from 36px to **44px** (this screen renders outside `.vicharak-app`, so it never inherited the app-wide tap-target floor). |
| `apps/VicharakAI/features/premium/PremiumScreen.tsx` | Same correction on the Premium tab: a lapsed subscriber sees "Premium — expired / Your Premium plan has ended / Renew…" instead of trial-ended copy. |
| `apps/VicharakAI/features/profile/ProfileScreen.tsx` | Removed the **dead Dark/Light theme toggle** (and its now-unused hook and icon imports). A switch that visibly does nothing reads as a broken app. |
| `apps/VicharakAI/features/dashboard/DashboardScreen.tsx` | Heading `Dashboard` → **`Progress`**, matching the nav label that opens it. |
| `apps/VicharakAI/ExamChatSupport.tsx` | Exam-context pill now shrinks and ellipsises (`min-w-0`, `max-w-full`, inline overflow rules — Tailwind's `truncate` is neutralised app-wide), so a long exam name can no longer crush the Vicharree chat header at 375px. |
| `apps/VicharakAI/features/onboarding/OnboardingFlow.tsx` | Added the app's two mobile floors to the `.vicharak-ob` stylesheet: **nothing under 12px, no tap target under 44px**. Fixes the 36px month chips and the 10px "FREE PREVIEW" badge. Also removed the stale Hinglish quote from the file's header comment. |

Nothing was published — all of this is saved as a draft for review.

---

## 4. Flagged, not changed

1. **"Paywall fires immediately after onboarding"** — it deliberately does not, and I did
   not reintroduce it. The hard paywall was killed on 2026-08-17 after 0/16 conversions
   and replaced by the 3-day free trial, which is the live conversion hypothesis. Today
   the preview screen's primary CTA starts the trial and "Or subscribe now — ₹149/month"
   sits directly beneath it as the immediate pay path. Reinstating a blocking paywall
   would be a product/mechanism reversal, not a bug fix — your call.

2. **"Where are you in your studying?"** — this screen no longer exists. It was removed
   in the 2026-09 onboarding streamline (drop-off fix) that cut the flow to five screens.
   Its equivalent survives as the optional, skippable backfill question on the Today
   empty state ("What have you studied in the last two weeks?"). Re-adding the onboarding
   screen would be a new step in the funnel, so I left it out.

3. **Revision ladder wording** — your brief says 1-3-5-7-14. The shipped ladder is
   **1-3-7-14-28** (`config/revision.ts › TOPIC_REVISION_INTERVALS`), and every piece of
   copy in the app and the FAQ matches that. I did not touch either, since the intervals
   are explicitly a mechanism. Flagging only in case the brief, not the code, is right.

4. **Yearly plan is still orderable server-side.** No UI sells it, but the
   `create-razorpay-order` hook still honours `{ planType: 'yearly' }` (₹1,430.40) for
   legacy callers. Nothing in the app can reach it. Worth confirming the landing page
   does not post it before removing that branch — changing a live payment hook was out of
   scope for an in-app polish pass.

5. **Practice has no permanent entry point.** With the tab removed, the Practice screen
   is only reachable when Vicharree happens to surface a weak-topic tip. That is what the
   removal task asked for, but it means a fully built screen is nearly unreachable.
   Adding it to the Profile quick-links list would be a one-line change if you want it
   back.

---

## 5. Verification

- Every write went through the workspace's server-side syntax/transform gate, which
  **rejected one malformed attempt** during this pass — so the gate is real, not nominal.
- The two largest edited files (`OnboardingFlow.tsx`, `ProfileScreen.tsx`) were re-read
  after editing and run through `tsc --noEmit` (`--jsx react-jsx --noResolve`). Clean,
  apart from the expected `TS2307 Cannot find module` lines for `react`, `lucide-react`
  and sibling modules. That check earned its keep: it caught backticks I had put inside
  the onboarding CSS **template literal**, which would have broken the string. Fixed, and
  the file re-checks clean.
- Every other edit was read back from the workspace and verified in place, including the
  declaration and every use site of each new identifier.
- A project-wide `tsc --noEmit` is **not** runnable from this session: the workspace's
  dependency graph (react, lucide-react, the platform `window.useWorkspaceDB` globals)
  is not installable here, and files are reachable only one at a time through the
  editing bridge. The per-file parse and scope check above is the strongest verification
  available from this side; the publish-time compile is the backstop.
