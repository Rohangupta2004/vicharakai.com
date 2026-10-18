# PYQ bank — open-dataset seeding (2026-09-25)

The PYQ tables (`pyq_questions` / `pyq_options` / `pyq_answers` / `pyq_sources`
+ taxonomy) were bulk-seeded from open, permissively-licensed datasets via the
HuggingFace datasets-server REST API. **The seeder is NOT a file in this repo**
— files in the space tree never execute server-side. It is the registered
server function **`pyq-open-dataset-import`** (see the hooks registry), which
is resumable and idempotent.

## How to run / resume

Execute the hook with body `{ "source": "<source>", "pages": <1-40> }`.
Each page is 100 dataset rows. One `pyq_import_batches` row per source
(`batch_id 'opendataset-<source>'`) stores the resume cursor in
`processed_records`; a completed source answers `{ done: true }` without
writing. Dedupe is by `question_text_normalized` (capped at 800 chars), so
re-running never duplicates.

| source | dataset | maps to | rows |
|---|---|---|---|
| `medmcqa_train` | openlifescienceai/medmcqa (train) | NEET PG (`official_pyq`, unverified) | 182,822 |
| `medmcqa_validation` | openlifescienceai/medmcqa (validation) | NEET PG | 4,183 |
| `medqa_train` / `medqa_test` | GBaker/MedQA-USMLE-4-options | USMLE (`practice`) | 10,178 / 1,273 |
| `mmlu_test` | cais/mmlu (config `all`, test) | MCAT / SAT / GRE / LSAT / Bar Exam / JEE Main / NEET UG / UPSC CSE (`practice`) | 14,042 |

Integrity rules honoured: nothing is generated or invented;
`verification_status: 'verified'` is never written by this pipeline (dataset
answer keys are recorded as `community_verified` in `pyq_answers`, and
`pyq_sources` rows name the dataset, `source_type 'public_domain'`). MMLU and
MedQA rows are `origin_type 'practice'` — the official-PYQ-only surfaces
(Vicharree chat cards via `pyq/retrieval.ts`) never show them; only the
Practice tab serves them, clearly labelled.

## Status after the initial seeding run

- `mmlu_test`, `medqa_train`, `medqa_test`: **complete**.
- `medmcqa_train`: **paused at dataset offset 6,000 of 182,822** — the
  workspace database enforces a hard cap of **100,000 rows per table**, and
  `pyq_options` (4 rows per question) reached it at ~24,850 questions
  bank-wide. Resuming requires the founder/Otto to raise the per-table row
  cap first; then simply re-run `pyq-open-dataset-import` with
  `source: medmcqa_train` until `done: true`, and after that
  `medmcqa_validation`.
- GitHub sources named in the task brief: `dpamar/neet-pyq`,
  `arunslb123/neet-pyq`, `drav1drajkumar/jee-questions`, `beingkk/upsc-dataset`
  are all **404** (skipped). `StudentSuite/awesome-study-resources` exists but
  is a links-only curation list with no hosted question data.

## How the app reads the bank

The Practice tab (`features/practice/`) fetches per-exam pools from the
**`pyq-practice-pool`** server function
(`/api/hooks/execute/<spaceId>/pyq-practice-pool?exam=<code>&limit=200`),
which joins questions + options + answers + sources server-side. The
hand-verified static bank in `data/questionBank.ts` always renders first and
is the offline/failure floor. `pyq/retrieval.ts` remains the official-PYQ-only
read path for chat surfaces.
