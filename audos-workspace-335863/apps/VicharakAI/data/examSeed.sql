-- VicharakAI — exam_metadata seed (sample rows for the 5 anchor exams).
--
-- TARGET TABLE: app_exam_metadata (WorkspaceDB registry name: exam_metadata).
-- The table ALREADY EXISTS with thin rows for these exam_ids (exam_name,
-- category, country populated; total_time_minutes and the JSON columns null),
-- so this script UPSERTS: it fills in the structural data without touching
-- created_at or duplicating rows. Idempotent — safe to run repeatedly.
--
-- HOW TO RUN: exam_metadata's write policy is serverHooksOnly, so this script
-- cannot be executed from app code or ad-hoc SQL. Run it from a server
-- function (like the existing us-exam-data-seed hook) or hand it to Otto as
-- the migration payload. Values mirror apps/VicharakAI/data/examDatabase.ts.
--
-- FORMAT FACTS are the 2025-26 official patterns:
--   * JEE Main: 75 compulsory questions since Jan 2025 (90-with-choice retired).
--   * NEET UG: 180 questions / 180 minutes since 2025 (200/3h20m retired).

INSERT INTO app_exam_metadata
  (exam_id, exam_name, category, country, total_time_minutes, sections_json, scoring_json, official_url, description, target_age_range)
VALUES
  (
    'jee_main',
    'JEE Main',
    'engineering',
    'India',
    180,
    '[
      {"name": "Physics", "time_minutes": null, "questions": 25, "format": "mcq_and_numerical"},
      {"name": "Chemistry", "time_minutes": null, "questions": 25, "format": "mcq_and_numerical"},
      {"name": "Mathematics", "time_minutes": null, "questions": 25, "format": "mcq_and_numerical"}
    ]'::jsonb,
    '{
      "scale": "0-300 marks (percentile-normalised across shifts)",
      "passing_score": "Qualifying cutoff for JEE Advanced varies by category (~93 percentile general)",
      "notes": "+4 per correct, -1 per wrong for BOTH MCQ and numerical questions. Since January 2025 all 75 questions are compulsory (20 MCQ + 5 numerical per subject); the 2021-24 pattern of 90 questions with a Section B choice is retired. Best of two yearly attempts counts."
    }'::jsonb,
    'https://jeemain.nta.nic.in',
    'Gateway to NITs, IIITs and GFTIs and the qualifier for JEE Advanced (IITs). Twice a year (January and April), ~14 lakh unique candidates.',
    'Class 12 students and one-to-two-year droppers (ages 17-20)'
  ),
  (
    'neet_ug',
    'NEET UG',
    'medical',
    'India',
    180,
    '[
      {"name": "Physics", "time_minutes": null, "questions": 45, "format": "mcq"},
      {"name": "Chemistry", "time_minutes": null, "questions": 45, "format": "mcq"},
      {"name": "Botany", "time_minutes": null, "questions": 45, "format": "mcq"},
      {"name": "Zoology", "time_minutes": null, "questions": 45, "format": "mcq"}
    ]'::jsonb,
    '{
      "scale": "0-720 marks",
      "passing_score": "Qualifying percentile: 50th (general), 40th (reserved); government MBBS seats need far higher",
      "notes": "+4 per correct, -1 per wrong. From 2025 all 180 questions are compulsory in 3 hours flat — the 2021-24 pattern (200 questions, 20 optional, 3h20m) is retired. Pen-and-paper OMR. Largest medical entrance in the world (~23 lakh aspirants)."
    }'::jsonb,
    'https://neet.nta.nic.in',
    'The single entrance for all MBBS/BDS/AYUSH seats in India — NCERT-anchored and brutal on recall precision, with roughly one government seat per twenty aspirants.',
    'Class 12 students and droppers (ages 17-21)'
  ),
  (
    'upsc_cse',
    'UPSC CSE',
    'civil_services',
    'India',
    240,
    '[
      {"name": "Prelims Paper I — General Studies", "time_minutes": 120, "questions": 100, "format": "mcq"},
      {"name": "Prelims Paper II — CSAT (qualifying, 33%)", "time_minutes": 120, "questions": 80, "format": "mcq"},
      {"name": "Mains — 9 descriptive papers (Essay, GS I-IV, Optional x2, 2 qualifying language papers)", "time_minutes": 1620, "questions": 9, "format": "descriptive"},
      {"name": "Personality Test / Interview", "time_minutes": null, "questions": null, "format": "interview"}
    ]'::jsonb,
    '{
      "scale": "Final merit out of 2025 marks (Mains 1750 + Interview 275); Prelims is a screening stage",
      "passing_score": "Prelims GS-I cutoff varies (~50% general); CSAT qualifying at 33%",
      "notes": "Prelims GS-I: +2 per correct, -1/3 of 2 marks (-0.66) per wrong. CSAT: +2.5, -0.83, qualifying only. Mains is fully descriptive; the Interview carries 275 marks. Once a year: Prelims ~May/June, Mains ~September, Interviews Jan-Apr. ~10-13 lakh apply."
    }'::jsonb,
    'https://upsc.gov.in',
    'Recruits IAS, IPS, IFS and 20+ central services — a three-stage, roughly year-long examination cycle combining MCQ elimination, long-form writing and a personality assessment.',
    'Graduates aged 21-32 (general category; relaxations apply)'
  ),
  (
    'cat',
    'CAT',
    'management',
    'India',
    120,
    '[
      {"name": "Verbal Ability and Reading Comprehension (VARC)", "time_minutes": 40, "questions": 24, "format": "mcq_and_tita"},
      {"name": "Data Interpretation and Logical Reasoning (DILR)", "time_minutes": 40, "questions": 22, "format": "mcq_and_tita"},
      {"name": "Quantitative Ability (QA)", "time_minutes": 40, "questions": 22, "format": "mcq_and_tita"}
    ]'::jsonb,
    '{
      "scale": "Scaled score reported as percentile (0-100)",
      "passing_score": "~99 percentile for old-IIM general-category calls",
      "notes": "MCQ: +3 per correct, -1 per wrong. TITA (type-in-the-answer): +3, no negative. Hard 40-minute sectional locks — no returning to a section. Question count is ~68 (CAT 2024 pattern: 24 + 22 + 22); it has ranged 66-68 in recent years. Once a year, last Sunday of November, ~3.3 lakh registered."
    }'::jsonb,
    'https://iimcat.ac.in',
    'Entrance to the 21 IIMs and most top Indian B-schools — a percentile-based speed-and-selection test conducted by a different IIM each year.',
    'Final-year students and working professionals (ages 20-28)'
  ),
  (
    'mcat',
    'MCAT',
    'medical',
    'US',
    450,
    '[
      {"name": "Chemical and Physical Foundations of Biological Systems", "time_minutes": 95, "questions": 59, "format": "passage_based_mcq"},
      {"name": "Critical Analysis and Reasoning Skills (CARS)", "time_minutes": 90, "questions": 53, "format": "passage_based_mcq"},
      {"name": "Biological and Biochemical Foundations of Living Systems", "time_minutes": 95, "questions": 59, "format": "passage_based_mcq"},
      {"name": "Psychological, Social and Biological Foundations of Behavior", "time_minutes": 95, "questions": 59, "format": "passage_based_mcq"}
    ]'::jsonb,
    '{
      "scale": "472-528 total (118-132 per section); 500 is the median",
      "passing_score": "~511+ competitive for US MD programs",
      "notes": "No negative marking — never leave a blank. 230 questions; content time 6h15m, full seated day with breaks ~7.5 hours. ~30 test dates per year (January and March-September), administered by AAMC. ~85,000-90,000 test takers annually."
    }'::jsonb,
    'https://students-residents.aamc.org/mcat-exam/mcat-exam',
    'The gateway to US and Canadian MD/DO programs — a 7.5-hour endurance test of applied science reasoning plus a pure verbal (CARS) section, typically prepared with 300-350 study hours.',
    'College juniors/seniors and post-baccalaureate students (ages 20-26)'
  )
ON CONFLICT (exam_id) DO UPDATE SET
  exam_name          = EXCLUDED.exam_name,
  category           = EXCLUDED.category,
  country            = EXCLUDED.country,
  total_time_minutes = EXCLUDED.total_time_minutes,
  sections_json      = EXCLUDED.sections_json,
  scoring_json       = EXCLUDED.scoring_json,
  official_url       = EXCLUDED.official_url,
  description        = EXCLUDED.description,
  target_age_range   = EXCLUDED.target_age_range,
  updated_at         = NOW();
