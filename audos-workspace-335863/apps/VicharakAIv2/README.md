# VicharakAI v2 — architecture

Ground-up rebuild. Three loops: **Plan** (tasks + 1/3/7/14 chapter revision),
**Test** (per-concept scores → strength + test-win boosts), **Mistake**
(photo → local OCR → concept tag → FSRS review).

## Hard rules encoded in this codebase

- **Exam-agnostic**: no exam name in code. All exam data flows from
  `registry/examRegistryData.ts` (the `exam-registry.json` content) through
  `registry/examRegistry.ts`. Tier is derived at bundle load time.
- **Closed concept enum**: enforced at write time in `data/concepts.ts`
  (`assertConceptId`) — `data/doubts.ts` and `data/testLogs.ts` refuse
  unknown concept ids.
- **Offline-first**: IndexedDB (`data/db.ts`) is the source of truth; no
  feature needs network after first load (OCR model fetch degrades to
  manual tagging when offline).
- **Backlog**: `engine/backlog.ts` never exposes the total count; overdue
  reviews spread silently across days. >50 unreviewed → drain session.
- **Privacy (§17)**: `workers/imageSanitize.ts` strips EXIF/GPS before any
  byte is stored; consent versions logged in `data/consent.ts`; under-18
  routes through parental consent; product-dev consent is separate.
- **Design (§15)**: single blue accent (`ui/tokens.ts`), B&W status banners,
  colour only in the concept-strength heatmap, 44px touch targets,
  exactly two popups (ConceptTagResolver, WhyWrongGrid).

## Module map

```
App.tsx / AppShell.tsx      composition root, bottom nav, trigger tick
state/AppContext.tsx        profile + exam + concept enum provider
lib/                        dates, ids
data/                       db (schema/migrations), kv/profile, consent,
                            concepts, tasks, doubts, images, testLogs
registry/                   examRegistryData (JSON), examRegistry (loader),
                            bundleFiles, bundles/, syllabusParser, bundleLoader
engine/                     fsrs, scheduler (1/3/7/14), conceptMatcher (BM25),
                            pace (self-correcting estimates), backlog,
                            testSignal (wins + strength), whyWrong
workers/                    imageSanitize, ocrWorker (Tesseract off-thread)
notifications/              notify (opt-in), triggers (the 6 types)
pwa/                        install, offline
components/shared/          BWBanner, SyllabusPicker, ConceptTagResolver,
                            CardDeck
components/onboarding|today|mistakes|progress|settings/
```

## Later (architected for, not built)

- `pyq.md` / `recommendation.md` per bundle → Full tier (§3.6 hook in
  `bundleFiles.ts` + `deriveTier`); weightage logic; PYQ generator (§7).
- Embedding similarity behind `engine/conceptMatcher.ts`'s interface.
- A full exam bundle (1,000–1,500 concepts) in the stub's syllabus.md format.
