# VicharakAI canonical and sitemap audit — 31 October 2026

## Outcome

The indexable public surface is now limited to the homepage, JEE Main, NEET UG, NEET PG, retained prep/learn/study-method content, comparisons, and company/legal pages. Every retained route writes its own title, description, `index, follow`, Open Graph URL, and self-referencing `https://www.vicharakai.com` canonical with no query and no trailing slash (except `/`). No hreflang alternates are emitted.

The custom-domain host already returns HTTP 301 for `http://`, apex/non-www, and their combinations. Workspace code now uses `location.replace` for retired path aliases, regional URLs, public hash routes, legacy prep aliases, and trailing-slash duplicates. The host serves the SPA bundle with HTTP 200 before JavaScript and exposes no workspace-level HTTP redirect table, so path aliases cannot become true HTTP 301s from workspace source; that remaining hosting-level action is listed below.

## Canonical route table

For every exact route listed in this section:

- Final canonical: `https://www.vicharakai.com` + the exact path (root is `https://www.vicharakai.com/`)
- Robots: `index, follow`
- Draft sitemap declaration: yes (`public: true`; root is automatic)
- Direct canonical URL status: HTTP 200
- Query variant: HTTP 200, canonical strips the query (a true duplicate)
- Trailing-slash variant: HTTP 200 from the host, then client replacement to the slashless path

### Landing and exam planners

```text
/
/jee
/neet
/neet-pg
```

### Exam hub, exam pages, and subject pages

```text
/exam
/exam/jee
/exam/jee/physics
/exam/jee/chemistry
/exam/jee/mathematics
/exam/neet
/exam/neet/physics
/exam/neet/chemistry
/exam/neet/biology
/exam/neet-pg
/exam/neet-pg/medicine
/exam/neet-pg/surgery
/exam/neet-pg/obstetrics-and-gynaecology
/exam/neet-pg/paediatrics
/exam/neet-pg/community-medicine
```

### Comparison pages

```text
/compare
/compare/physics-wallah
/compare/unacademy
/compare/anki
/compare/notion
/compare/traditional-coaching
```

### Learn hub and articles

```text
/learn
/learn/spaced-repetition
/learn/ai-study-system
/learn/gap-detection
/learn/revision-budget
/learn/am-i-on-track
/learn/day-one-plan
/learn/jee-study-plan
/learn/neet-study-plan
/learn/neet-pg-strategy
/learn/mock-test-strategy
/learn/study-timetable
/learn/beat-forgetting
/learn/weak-topics-guide
/learn/revision-techniques
/learn/how-to-study-long-hours
/learn/active-recall
/learn/how-to-study-for-jee
/learn/how-to-study-for-neet
/learn/test-analysis
/learn/study-schedule
/learn/weak-topics
/learn/revision-vs-studying
/learn/neet-physics-strategy
/learn/jee-mathematics-strategy
/learn/neet-biology-high-yield
/learn/jee-chemistry-strategy
/learn/mock-test-frequency
/learn/burnout-study
/learn/ncert-for-neet
/learn/jee-vs-neet
/learn/time-management-exam
/learn/neet-pg-preparation
/learn/memory-techniques
/learn/last-month-strategy
/learn/ai-study-companion
/learn/pattern-analysis
/learn/pomodoro-competitive-exams
/learn/study-group-vs-solo
/learn/neet-inorganic-chemistry
```

### Prep hub and retained guides

```text
/prep
/prep/how-to-revise-jee-physics-mechanics
/prep/how-to-study-jee-chemistry-organic
/prep/jee-maths-calculus-tips
/prep/jee-electromagnetism-weak-topic-guide
/prep/jee-advanced-vs-main-study-strategy
/prep/how-to-manage-revision-during-jee-coaching
/prep/jee-physics-optics-revision-guide
/prep/jee-chemistry-physical-chemistry-plan
/prep/jee-maths-algebra-tips
/prep/beat-forgetting-jee
/prep/jee-mock-test-analysis-strategy
/prep/jee-revision-schedule-last-3-months
/prep/jee-daily-study-plan-template
/prep/jee-weak-topic-detection-guide
/prep/jee-main-paper-2-preparation
/prep/jee-inorganic-chemistry-memory-tricks
/prep/jee-coordinate-geometry-study-guide
/prep/jee-thermodynamics-revision
/prep/jee-modern-physics-study-plan
/prep/jee-chemical-bonding-guide
/prep/jee-rotational-motion-tips
/prep/jee-electrochemistry-revision
/prep/jee-probability-study-guide
/prep/jee-waves-optics-revision
/prep/jee-surface-chemistry-tips
/prep/jee-fluid-mechanics-guide
/prep/jee-complex-numbers-study-plan
/prep/jee-p-block-elements-revision
/prep/jee-magnetic-effects-guide
/prep/jee-polynomials-algebra-tips
/prep/jee-main-chemistry-organic-tips
/prep/jee-maths-coordinate-geometry-study-plan
/prep/jee-inorganic-chemistry-revision
/prep/jee-waves-optics-practice-strategy
/prep/jee-physics-electrostatics-question-strategy
/prep/jee-chemistry-chemical-kinetics-revision-plan
/prep/neet-biology-cell-division-guide
/prep/neet-human-physiology-revision
/prep/neet-genetics-study-plan
/prep/neet-plant-physiology-tips
/prep/neet-ecology-revision-guide
/prep/neet-chemistry-organic-for-neet
/prep/neet-physics-optics-guide
/prep/beat-forgetting-neet
/prep/neet-biology-reproduction-revision
/prep/neet-mock-test-strategy
/prep/neet-last-month-revision-plan
/prep/neet-weak-topic-detection
/prep/neet-daily-study-target-guide
/prep/neet-human-anatomy-tips
/prep/neet-chemical-coordination-revision
/prep/neet-neural-control-guide
/prep/neet-body-fluids-circulation-study
/prep/neet-locomotion-movement-tips
/prep/neet-excretory-products-guide
/prep/neet-microbes-human-welfare-revision
/prep/neet-biotechnology-study-plan
/prep/neet-environmental-issues-guide
/prep/neet-biomolecules-revision
/prep/neet-digestion-absorption-tips
/prep/neet-breathing-exchange-gases-guide
/prep/neet-photosynthesis-revision
/prep/neet-respiration-plants-study
/prep/neet-mineral-nutrition-tips
/prep/neet-plant-growth-development
/prep/neet-animal-kingdom-classification
/prep/neet-morphology-plants-guide
/prep/neet-cell-structure-function
/prep/neet-transport-plants-revision
/prep/neet-organisms-population-guide
/prep/neet-ecosystem-study-plan
/prep/neet-biodiversity-conservation-tips
/prep/neet-origin-evolution-guide
/prep/neet-human-health-disease-revision
/prep/neet-strategies-food-production
/prep/neet-microbes-biotechnology-tips
/prep/neet-botany-plant-kingdom-notes
/prep/neet-zoology-human-physiology-tips
/prep/neet-chemistry-biomolecules-study-guide
/prep/neet-ecology-environment-revision
/prep/neet-genetics-evolution-guide
/prep/neet-physics-current-electricity-practice
/prep/neet-chemistry-organic-reaction-mechanism-guide
/prep/neet-pg-pharmacology-guide
/prep/neet-pg-surgery-revision
/prep/neet-pg-medicine-tips
/prep/neet-pg-pathology-study-plan
/prep/neet-pg-microbiology-guide
/prep/neet-pg-biochemistry-revision
/prep/neet-pg-anatomy-revision
/prep/neet-pg-physiology-study-plan
/prep/neet-pg-obgyn-high-yield-guide
/prep/neet-pg-pediatrics-revision
/prep/neet-pg-surgery-high-yield-topics
/prep/neet-pg-medicine-revision-strategy
/prep/neet-pg-obs-gynae-study-plan
/prep/neet-pg-pediatrics-preparation
/prep/neet-pg-anatomy-revision-guide
/prep/how-to-make-a-study-schedule-for-competitive-exams
/prep/spaced-repetition-study-technique-guide
/prep/how-to-analyze-mock-test-results
/prep/best-revision-techniques-for-exams
/prep/how-to-stay-consistent-in-exam-preparation
```

The database still contains published rows for retired exam families, but the app filters them out and `config.json` does not declare them public. They are not listed, linked, or indexed.

### Study-method hub and guides

```text
/study-methods
/study-methods/spaced-repetition-neet-biology
/study-methods/jee-physics-error-log
/study-methods/neet-pg-grand-test-analysis
/study-methods/how-many-hours-study-jee
/study-methods/pyq-practice-method
/study-methods/prioritize-competitive-exam-syllabus
/study-methods/weekly-study-review
```

### Company, legal, contact, and readable sitemap

```text
/about
/terms
/privacy
/refund
/contact
/sitemap
```

## Duplicate and retired URL table

| Requested URL or family | Final canonical destination | Robots while navigation runs | Sitemap | Observed HTTP / navigation |
|---|---|---:|---:|---|
| `https://vicharakai.com/*` | same path on `https://www.vicharakai.com` | destination value | no duplicate | HTTP 301 |
| `http://www.vicharakai.com/*` | same path on HTTPS www | destination value | no duplicate | HTTP 301 |
| `http://vicharakai.com/*` | same path on HTTPS www | destination value | no duplicate | HTTP 301 |
| any retained route with `?query` | same path, query-free | `index, follow` | only clean URL | HTTP 200; true duplicate canonical |
| any retained non-root route with trailing `/` | slashless path | destination value | only slashless URL | HTTP 200, then `location.replace` |
| public `#/...` route, including `#/in` | corresponding real path; `#/in` → `/` | destination value | no hash URL | HTTP 200 at `/`, then `location.replace` |
| `/in`, `/us`, `/uk`, `/global` | `/` | homepage value | no | HTTP 200, then `location.replace` |
| `/inicet` | `/neet-pg` | `noindex, follow` during move | no | HTTP 200, then `location.replace` |
| `/gate`, `/upsc`, `/cat`, `/clat`, `/ssc`, `/rrb`, `/mpsc`, `/banking`, `/defence`, `/teaching` | `/prep` | `noindex, follow` during move | no | HTTP 200, then `location.replace` |
| `/exam/inicet[/...]` | `/exam/neet-pg` | destination value | no | HTTP 200, then `location.replace` |
| `/exam/gate[/...]`, `/exam/upsc[/...]`, `/exam/cat[/...]`, `/exam/clat[/...]`, `/exam/ssc[/...]`, `/exam/rrb[/...]`, `/exam/mpsc[/...]`, `/exam/banking[/...]`, `/exam/defence[/...]`, `/exam/teaching[/...]` | `/exam` | destination value | no | HTTP 200, then `location.replace` |
| retired `/learn/jee-advanced-strategy` | `/jee` | destination value | no | HTTP 200, then `location.replace` |
| retired UPSC/CAT/CLAT/SSC learn slugs in `seoRedirects.ts` | `/learn` | destination value | no | HTTP 200, then `location.replace` |
| retired study-method slugs in `seoRedirects.ts` | `/study-methods` | destination value | no | HTTP 200, then `location.replace` |
| `/prep-<slug>` | `/prep/<slug>` | destination value | no alias | HTTP 200, then `location.replace` |
| `/prep/beating-forgetting-curve-jee` | `/prep/beat-forgetting-jee` | `noindex, follow` during move | no | HTTP 200, then `location.replace` |
| `/prep/beating-forgetting-curve-neet` | `/prep/beat-forgetting-neet` | `noindex, follow` during move | no | HTTP 200, then `location.replace` |
| removed or unknown prep article | `/prep` | `noindex, follow` | no | HTTP 200, then `location.replace` |

## Sitemap verification

`robots.txt` points to `https://www.vicharakai.com/sitemap.xml`. The draft `config.json` declares only the retained, indexable self-canonical routes above as public; the two old “beating forgetting curve” paths are explicitly `public: false`.

At 08:57 UTC, before this draft was published, the live generated sitemap still reflected the earlier live build and listed only 13 top-level URLs: `/`, `/about`, `/compare`, `/contact`, `/exam`, `/jee`, `/learn`, `/neet`, `/neet-pg`, `/privacy`, `/refund`, `/sitemap`, and `/terms`. The next successful publish is required for the generated sitemap to consume the full final route registry. This task did not call Publish.

## Head and image checks

- All retained route components call `applyPageSeo` / `usePageSeo` with route-specific title, description, canonical, robots, Open Graph, Twitter, and page JSON-LD.
- Landing metadata is now specific to JEE Main, NEET UG, and NEET PG.
- Regional hreflang links are removed on both landing and routed pages; no custom-head hreflang tag exists.
- The restored landing page no longer links to retired exam planner URLs.
- Public-page images have alt text: shared header logos identify VicharakAI; Learn thumbnails and heroes include the article title and context; the landing page gives each repeated logo image a distinct contextual alt label. Prep, exam, comparison, sitemap and study-method bodies do not render content images.

## Remaining action

After the final draft is published, open Google Search Console and:

1. Resubmit `https://www.vicharakai.com/sitemap.xml`.
2. Inspect one URL from each route family and confirm Google sees the rendered self-canonical.
3. Use **Validate Fix** for “Alternate page with proper canonical tag.”
4. Request hosting-level HTTP 301 rules for the regional and retired path aliases in the duplicate table. Workspace code can replace them only after the host has already returned HTTP 200.
