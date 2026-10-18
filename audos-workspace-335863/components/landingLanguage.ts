/**
 * ENGLISH / HINGLISH — the landing page's language toggle (founder
 * instruction, 2026-09-28).
 *
 * A small EN | हिं switch in the landing page's top bar lets an Indian
 * visitor read the page's HEADLINES in Hinglish. Body paragraphs
 * deliberately stay English — only headlines, subheads and CTAs switch — so
 * the dictionary below stays small and is keyed by the EXACT English source
 * string. A string with no entry renders in English unchanged, so a copy
 * edit elsewhere can never blank a heading: the worst case is that it simply
 * stays English until a Hinglish line is added here.
 *
 * The preference persists in localStorage ('vicharakai_lang') and defaults
 * to English for every new visitor. This is a LANDING-PAGE surface only —
 * the app shell, auth screens and checkout never read it.
 */
export type LandingLang = 'en' | 'hi';

/** localStorage key for the visitor's language choice. */
export const LANDING_LANG_KEY = 'vicharakai_lang';

/** The saved language, defaulting to English when unset or unreadable. */
export function readLandingLang(): LandingLang {
  try {
    return localStorage.getItem(LANDING_LANG_KEY) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

/** Remember the visitor's choice across visits. */
export function saveLandingLang(lang: LandingLang): void {
  try {
    localStorage.setItem(LANDING_LANG_KEY, lang);
  } catch {
    /* storage unavailable — the choice simply lasts this page view */
  }
}

/**
 * Exact English source string → its Hinglish line. Headlines, subheads and
 * CTAs only — never body copy (founder rule).
 */
const HINGLISH: Record<string, string> = {
  /* Hero */
  'Find your gaps': 'Apne gaps pakdo',
  'before the exam does.': 'exam se pehle.',
  'Study every day.': 'Roz padhai karo.',
  'Actually remember it.': 'Sach mein yaad bhi rakho.',
  'VicharakAI tracks what you study and tells you exactly what to revise.':
    'Aaj exactly kya padhna hai — VicharakAI batayega.',
  /* CTAs — PRIMARY_CTA and TRIAL_CTA are both this string today */
  'Start Improving Now': 'Free mein shuru karo',
  'Start now': 'Shuru karo',
  /* Section headings (the region variants that actually render) */
  'You finish a chapter. Three new ones arrive. You never go back.':
    'Ek chapter khatam hota hai. Teen naye aa jaate hain. Purane pe wapas kabhi nahi jaate.',
  'You finish a topic. Three new ones arrive. You never go back.':
    'Ek topic khatam hota hai. Teen naye aa jaate hain. Purane pe wapas kabhi nahi jaate.',
  'Four tools. One job: stop losing marks.': 'Chaar tools. Ek kaam: marks lose karna band.',
  "It knows what's slipping — before you do.":
    'Kya slip ho raha hai — tumse pehle VicharakAI ko pata chal jaata hai.',
  'Not arbitrary revision. The right method, for the right topic, at the right moment.':
    'Random revision nahi. Sahi topic, sahi method, sahi time pe.',
  'The longer you use it, the better it knows you.':
    'Jitna zyada use karoge, utna behtar tumhe samjhega.',
  'Your score tells you what happened. We show you why it keeps happening.':
    'Score batata hai kya hua. Hum dikhate hain baar-baar kyun ho raha hai.',
  'Built by someone still in the trenches.':
    'Ek aspirant ne banaya — jo khud abhi bhi tayyari kar raha hai.',
  'The things you’re probably thinking.': 'Jo sawaal tumhare mann mein chal rahe hain.',
  /* The V2 showcase bands (2026-09-29) */
  'Meet Vicharee. Every session starts with you.':
    'Vicharee se milo. Har session tumse shuru hota hai.',
  'See your whole prep as a map to your dream.':
    'Apni poori prep ko ek map ki tarah dekho — seedha sapne tak.',
  'No dashboards to dig through. Vicharee just tells you.':
    'Koi dashboard khangalna nahi. Vicharee khud bata deta hai.',
  /* Mid-page CTAs */
  'Ready to stop forgetting?': 'Bhoolna band karne ke liye ready ho?',
  'Your plan gets sharper every night. Start tonight.':
    'Tumhara plan har raat sharper hota hai. Aaj raat se shuru karo.',
  /* The how-it-works flow diagram */
  Study: 'Padhai karo',
  'Log it': 'Log karo',
  'AI learns': 'AI seekhta hai',
  'Detects gaps': 'Gaps pakadta hai',
  'Plan for tomorrow': 'Kal ka plan ready',
  'You study normally': 'Jaise padhte ho, waise padho',
  '30 seconds at night': 'Raat ko bas 30 second',
  'Your pattern, your pace': 'Tumhara pattern, tumhari speed',
  'Before the mock does': 'Mock se pehle hi',
  'Ready every morning': 'Har subah taiyaar',
};

/** The Hinglish line for a source string — or the string itself, unchanged,
 *  in English mode or when no Hinglish line exists. */
export function translateLanding(lang: LandingLang, text: string): string {
  if (lang !== 'hi') return text;
  return HINGLISH[text] ?? text;
}
