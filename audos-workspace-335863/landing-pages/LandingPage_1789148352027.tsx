import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
// === SECTION 1: IMPORTS AND TYPES ===

interface NavLink {
  id: string;
  label: string;
  href: string;
}

interface Benefit {
  id: string;
  icon: string;
  title: string;
  description: string;
}

interface Feature {
  id: string;
  badge: string;
  icon: string;
  title: string;
  description: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

interface FooterLink {
  id: string;
  label: string;
  href: string;
}

// === SECTION 2: CONSTANTS AND CONFIGURATION ===
const WORKSPACE_BRAND_NAME = 'VicharakAI';
const WORKSPACE_PRIMARY_COLOR = '#3B82F6';
const WORKSPACE_CONTRAST_COLOR = '#FFFFFF';
const WORKSPACE_HIGHLIGHT_COLOR = '#8B5CF6';
const WORKSPACE_CTA_URL = 'https://zuno-335863.audoapps.com/os';
const WORKSPACE_FONT_FAMILY = 'Inter, system-ui, sans-serif';

// === SECTION 3: STRUCTURED CONTENT DATA ===
const NAV_LINKS: NavLink[] = [
  { id: 'nav-1', label: 'Features', href: '#features' },
  { id: 'nav-2', label: 'How it Works', href: '#features' },
  { id: 'nav-3', label: 'FAQ', href: '#faq' },
];

const BENEFITS: Benefit[] = [
  {
    id: 'benefit-1',
    icon: '📊',
    title: 'Test Analysis That Reveals Gaps',
    description:
      'Every mock exam becomes a roadmap. VicharakAI breaks down accuracy, speed, and topic-wise weakness so you revise what actually moves your score.',
  },
  {
    id: 'benefit-2',
    icon: '📝',
    title: 'Short Notes Built for Revision',
    description:
      'Condensed, subject-specific short notes designed for last-mile revision — not textbook dumps. Scan, recall, and retain under exam pressure.',
  },
  {
    id: 'benefit-3',
    icon: '🎯',
    title: 'Exam-Focused Study Paths',
    description:
      'Dynamic article routes for JEE, NEET, UPSC, GATE, CAT, and more — each path tuned to syllabus weightage, question patterns, and time-to-exam.',
  },
  {
    id: 'benefit-4',
    icon: '🔁',
    title: 'Structured Revision Loops',
    description:
      'Spaced revision schedules tied to your test performance. Revisit weak chapters automatically until your analysis shows consistent improvement.',
  },
];

const FEATURES: Feature[] = [
  {
    id: 'feature-1',
    badge: 'Step 01 · Diagnose',
    icon: '🧪',
    title: 'Start With Test Analysis, Not Guesswork',
    description:
      'Upload or log your latest mock results. Our articles on test analysis teach you to read scorecards, error patterns, and time traps — turning every test into actionable insight before you open a textbook.',
  },
  {
    id: 'feature-2',
    badge: 'Step 02 · Route',
    icon: '🗺️',
    title: 'Dynamic Routing to the Right Articles',
    description:
      'No more endless browsing. Dynamic routing maps your exam, subject, and weak topics to curated article paths — from foundational concepts to advanced problem-solving strategies for high-stakes tests.',
  },
  {
    id: 'feature-3',
    badge: 'Step 03 · Revise',
    icon: '📋',
    title: 'Short Notes & Subject-Specific Deep Dives',
    description:
      'Each route surfaces bite-sized revision sheets and subject-specific guides — Physics formulae clusters, Organic reaction maps, Polity timelines — optimized for the exam you are actually taking.',
  },
  {
    id: 'feature-4',
    badge: 'Step 04 · Repeat',
    icon: '📈',
    title: 'Close the Loop With the Next Mock',
    description:
      'Re-test, re-analyze, and watch your personalized article feed adapt. SEO-optimized study guides ensure you always land on the most relevant content when searching for exam prep strategies.',
  },
];

const FAQS: FAQ[] = [
  {
    id: 'faq-1',
    question: 'What is the best way to study for competitive exams?',
    answer:
      'Lead with test analysis, not passive reading. Take a diagnostic mock, identify your top three weak areas, revise those with short notes, then repeat weekly. VicharakAI routes you to articles matched to your exact gaps.',
  },
  {
    id: 'faq-2',
    question: 'How does dynamic routing help my exam prep?',
    answer:
      'Instead of a static blog, dynamic routing serves article sequences based on your exam type, subject, and performance data. A NEET Biology struggler and a JEE Physics repeater see completely different paths — both SEO-indexed and exam-specific.',
  },
  {
    id: 'faq-3',
    question: 'Which exams does VicharakAI cover?',
    answer:
      'We publish subject-specific content for popular exams including JEE Main & Advanced, NEET, UPSC CSE, GATE, CAT, SSC, and state-level engineering and medical entrances — with more routes added continuously.',
  },
  {
    id: 'faq-4',
    question: 'Why focus on test analysis over more study hours?',
    answer:
      'More hours without analysis often reinforce the same mistakes. Test analysis exposes whether errors are conceptual, careless, or time-management related — so every revision hour targets the right fix.',
  },
  {
    id: 'faq-5',
    question: 'Are the short notes enough for final revision?',
    answer:
      'Short notes are designed as high-yield recall triggers, not replacements for understanding. Pair them with targeted article deep-dives on weak topics and periodic full-length mocks for best results.',
  },
];

const FOOTER_LINKS: FooterLink[] = [
  { id: 'footer-link-1', label: 'Study Guides', href: WORKSPACE_CTA_URL },
  { id: 'footer-link-2', label: 'Test Analysis', href: WORKSPACE_CTA_URL },
  { id: 'footer-link-3', label: 'Revision Notes', href: WORKSPACE_CTA_URL },
  { id: 'footer-link-4', label: 'Contact', href: WORKSPACE_CTA_URL },
];

// === SECTION 4: NAVIGATION SECTION ===
function Navigation({
  scrollProgress,
  mobileOpen,
  setMobileOpen,
}: {
  scrollProgress: number;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}) {
  return (
    <>
      <div
        className="fixed top-0 left-0 h-[3px] z-[60]"
        style={{ width: `${scrollProgress * 100}%`, backgroundColor: WORKSPACE_HIGHLIGHT_COLOR }}
      />
      <header className="fixed top-0 inset-x-0 z-50">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mt-4 mb-3 rounded-2xl glass border border-white/10 shadow-lg">
            <div className="flex items-center justify-between px-4 py-3">
              <a href="#hero" className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold"
                  style={{ backgroundColor: WORKSPACE_PRIMARY_COLOR, color: WORKSPACE_CONTRAST_COLOR }}
                >
                  V
                </span>
                <span
                  className="text-xl font-bold tracking-tight"
                  style={{ color: WORKSPACE_CONTRAST_COLOR, fontFamily: WORKSPACE_FONT_FAMILY }}
                  data-section="nav-brand"
                >
                  {WORKSPACE_BRAND_NAME}
                </span>
              </a>
              <div className="hidden md:flex items-center gap-6">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.id}
                    href={link.href}
                    className="text-sm font-medium text-white/80 hover:text-white transition-colors"
                    style={{ fontFamily: WORKSPACE_FONT_FAMILY }}
                    data-section={`${link.id}-label`}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={WORKSPACE_CTA_URL}
                  className="hidden sm:inline-flex px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: WORKSPACE_PRIMARY_COLOR,
                    color: WORKSPACE_CONTRAST_COLOR,
                    fontFamily: WORKSPACE_FONT_FAMILY,
                  }}
                  data-section="nav-cta"
                >
                  Get Started
                </a>
                <button
                  type="button"
                  className="md:hidden p-2 rounded-lg text-white/80 hover:text-white"
                  onClick={() => setMobileOpen(!mobileOpen)}
                  aria-label="Toggle menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {mobileOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              </div>
            </div>
            {mobileOpen && (
              <div className="md:hidden px-4 pb-4 flex flex-col gap-3 border-t border-white/10 pt-3">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.id}
                    href={link.href}
                    className="text-sm font-medium text-white/80 hover:text-white"
                    onClick={() => setMobileOpen(false)}
                    data-section={`${link.id}-label-mobile`}
                  >
                    {link.label}
                  </a>
                ))}
                <a
                  href={WORKSPACE_CTA_URL}
                  className="inline-flex justify-center px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ backgroundColor: WORKSPACE_PRIMARY_COLOR, color: WORKSPACE_CONTRAST_COLOR }}
                  data-section="nav-cta-mobile"
                >
                  Get Started
                </a>
              </div>
            )}
          </div>
        </nav>
      </header>
    </>
  );
}

// === SECTION 5: HERO SECTION ===
function Hero() {
  return (
    <section
      id="hero"
      className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden"
      style={{ fontFamily: WORKSPACE_FONT_FAMILY }}
    >
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% -10%, ${WORKSPACE_PRIMARY_COLOR}33, transparent), radial-gradient(ellipse 60% 40% at 80% 60%, ${WORKSPACE_HIGHLIGHT_COLOR}22, transparent)`,
        }}
      />
      <div className="mx-auto max-w-5xl text-center reveal">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-white/10"
          style={{ backgroundColor: `${WORKSPACE_HIGHLIGHT_COLOR}22`, color: WORKSPACE_HIGHLIGHT_COLOR }}
        >
          <span data-section="hero-badge">Smart Exam Prep · Test Analysis First</span>
        </div>
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight"
          style={{ color: WORKSPACE_CONTRAST_COLOR }}
          data-section="hero-title"
        >
          Study Smarter With Dynamic Article Routes Built for Your Exam
        </h1>
        <p
          className="text-lg sm:text-xl text-white/70 max-w-3xl mx-auto mb-10 leading-relaxed"
          data-section="hero-subtitle"
        >
          {WORKSPACE_BRAND_NAME} maps test analysis to subject-specific revision paths — short notes,
          deep-dive articles, and SEO-ready guides for JEE, NEET, UPSC, and every major competitive exam.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={WORKSPACE_CTA_URL}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold shadow-lg transition-transform hover:scale-105"
            style={{ backgroundColor: WORKSPACE_PRIMARY_COLOR, color: WORKSPACE_CONTRAST_COLOR }}
            data-section="cta-primary"
          >
            Start Your Study Path
            <span aria-hidden="true">→</span>
          </a>
          <a
            href="#features"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-medium border border-white/20 text-white/90 hover:bg-white/5 transition-colors"
            data-section="cta-secondary"
          >
            See How It Works
          </a>
        </div>
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto">
          {['JEE', 'NEET', 'UPSC', 'GATE'].map((exam, i) => (
            <div
              key={exam}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center"
            >
              <p
                className="text-2xl font-bold"
                style={{ color: WORKSPACE_HIGHLIGHT_COLOR }}
                data-section={`hero-stat-${i + 1}-value`}
              >
                {exam}
              </p>
              <p
                className="text-xs text-white/50 mt-1"
                data-section={`hero-stat-${i + 1}-label`}
              >
                Subject Routes
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// === SECTION 6: SOCIAL PROOF SECTION ===
function SocialProof() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ fontFamily: WORKSPACE_FONT_FAMILY }}>
      <div className="mx-auto max-w-6xl reveal">
        <div className="text-center mb-14">
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: WORKSPACE_CONTRAST_COLOR }}
            data-section="benefits-heading"
          >
            Why Test-Led Revision Beats Blind Study Marathons
          </h2>
          <p
            className="text-lg text-white/60 max-w-2xl mx-auto"
            data-section="benefits-subheading"
          >
            Thousands of aspirants use {WORKSPACE_BRAND_NAME} to turn mock scores into focused,
            exam-specific study plans powered by dynamic article routing.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {BENEFITS.map((benefit, index) => (
            <div
              key={benefit.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-white/20 transition-colors"
            >
              <span className="text-3xl mb-4 block">{benefit.icon}</span>
              <h3
                className="text-lg font-semibold mb-2"
                style={{ color: WORKSPACE_CONTRAST_COLOR }}
                data-section={`benefit-${index + 1}-title`}
              >
                {benefit.title}
              </h3>
              <p
                className="text-sm text-white/60 leading-relaxed"
                data-section={`benefit-${index + 1}-description`}
              >
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-white/40 text-sm">
          <span data-section="social-proof-1">Trusted by JEE & NEET aspirants</span>
          <span className="hidden sm:inline">·</span>
          <span data-section="social-proof-2">500+ SEO-optimized study articles</span>
          <span className="hidden sm:inline">·</span>
          <span data-section="social-proof-3">Subject-specific short notes library</span>
        </div>
      </div>
    </section>
  );
}

// === SECTION 7: FEATURES SECTION ===
function FeaturesSection({ activeFeature }: { activeFeature: string }) {
  return (
    <section id="features" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-white" style={{ fontFamily: WORKSPACE_FONT_FAMILY }}>
      <div className="mx-auto max-w-4xl">
        <div className="sticky top-24 z-10 mb-16 bg-white/95 backdrop-blur-sm pb-8 text-center reveal">
          <h2
            className="text-4xl md:text-5xl font-bold mb-3 text-gray-900"
            data-section="features-heading"
          >
            How It Works
          </h2>
          <p
            className="text-lg text-gray-600"
            data-section="features-subheading"
          >
            Scroll the magazine-style walkthrough. Each card pins while the story unfolds.
          </p>
          <div className="flex items-center justify-center gap-2 mt-6">
            {FEATURES.map((feat) => (
              <div
                key={feat.id}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: activeFeature === feat.id ? '2rem' : '0.5rem',
                  backgroundColor: activeFeature === feat.id ? WORKSPACE_HIGHLIGHT_COLOR : '#D1D5DB',
                }}
              />
            ))}
          </div>
        </div>

        {FEATURES.map((feat, index) => (
          <div
            key={feat.id}
            id={`wrap-${feat.id}`}
            data-feature-id={feat.id}
            className="min-h-[60vh] flex items-center justify-center mb-32 last:mb-0"
          >
            <a
              href={WORKSPACE_CTA_URL}
              className="w-full max-w-2xl mx-auto group cursor-pointer"
            >
              <div className="rounded-3xl border-2 border-gray-200 bg-white p-8 md:p-12 shadow-sm hover:shadow-md transition-all group-hover:border-blue-200">
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="text-sm font-medium text-gray-600"
                    data-section={`feature-${index + 1}-badge`}
                  >
                    {feat.badge}
                  </span>
                  {feat.icon && <span className="text-xl">{feat.icon}</span>}
                </div>
                <h3
                  className="text-2xl md:text-3xl font-bold mb-4 text-gray-900"
                  data-section={`feature-${index + 1}-title`}
                >
                  {feat.title}
                </h3>
                <p
                  className="text-base md:text-lg text-gray-600 mb-6 leading-relaxed"
                  data-section={`feature-${index + 1}-description`}
                >
                  {feat.description}
                </p>
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium group-hover:gap-3 transition-all"
                  style={{ backgroundColor: `${WORKSPACE_PRIMARY_COLOR}15`, color: WORKSPACE_PRIMARY_COLOR }}
                  data-section={`feature-${index + 1}-cta`}
                >
                  Tap to try <span>→</span>
                </div>
              </div>
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

// === SECTION 8: FAQ SECTION ===
function FAQSection() {
  const [openId, setOpenId] = useState<string | null>('faq-1');

  return (
    <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8" style={{ fontFamily: WORKSPACE_FONT_FAMILY }}>
      <div className="mx-auto max-w-3xl reveal">
        <div className="text-center mb-12">
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: WORKSPACE_CONTRAST_COLOR }}
            data-section="faq-heading"
          >
            Frequently Asked Questions
          </h2>
          <p
            className="text-lg text-white/60"
            data-section="faq-subheading"
          >
            Everything you need to know about test analysis, dynamic routing, and exam-focused revision.
          </p>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq, index) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                className="rounded-xl border border-white/10 bg-white/5 overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                >
                  <span
                    className="font-medium pr-4"
                    style={{ color: WORKSPACE_CONTRAST_COLOR }}
                    data-section={`faq-${index + 1}-q`}
                  >
                    {faq.question}
                  </span>
                  <span
                    className="text-xl flex-shrink-0 transition-transform duration-200"
                    style={{
                      color: WORKSPACE_HIGHLIGHT_COLOR,
                      transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                    }}
                  >
                    +
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-4">
                    <p
                      className="text-sm text-white/60 leading-relaxed"
                      data-section={`faq-${index + 1}-a`}
                    >
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// === SECTION 9: FINAL CTA AND FOOTER ===
function FinalCTA() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ fontFamily: WORKSPACE_FONT_FAMILY }}>
      <div
        className="mx-auto max-w-4xl rounded-3xl p-10 md:p-16 text-center reveal border border-white/10"
        style={{
          background: `linear-gradient(135deg, ${WORKSPACE_PRIMARY_COLOR}33, ${WORKSPACE_HIGHLIGHT_COLOR}22)`,
        }}
      >
        <h2
          className="text-3xl md:text-4xl font-bold mb-4"
          style={{ color: WORKSPACE_CONTRAST_COLOR }}
          data-section="final-cta-title"
        >
          Ready to Turn Every Mock Into a Study Plan?
        </h2>
        <p
          className="text-lg text-white/70 mb-8 max-w-2xl mx-auto"
          data-section="final-cta-subtitle"
        >
          Join {WORKSPACE_BRAND_NAME} and get dynamically routed articles, short revision notes, and
          test analysis guides tailored to your next big exam.
        </p>
        <a
          href={WORKSPACE_CTA_URL}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold shadow-lg transition-transform hover:scale-105"
          style={{ backgroundColor: WORKSPACE_PRIMARY_COLOR, color: WORKSPACE_CONTRAST_COLOR }}
          data-section="final-cta-button"
        >
          Get Started Free
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 py-12 px-4 sm:px-6 lg:px-8" style={{ fontFamily: WORKSPACE_FONT_FAMILY }}>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <p
              className="text-xl font-bold mb-2"
              style={{ color: WORKSPACE_CONTRAST_COLOR }}
            >
              {WORKSPACE_BRAND_NAME}
            </p>
            <p
              className="text-sm text-white/50 max-w-xs"
              data-section="footer-tagline"
            >
              Dynamic study routes, test analysis articles, and subject-specific revision notes for every major exam.
            </p>
          </div>
          <div className="flex flex-wrap gap-6">
            {FOOTER_LINKS.map((link, index) => (
              <a
                key={link.id}
                href={link.href}
                className="text-sm text-white/60 hover:text-white transition-colors"
                data-section={`footer-link-${index + 1}-label`}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-white/10 text-center">
          <p
            className="text-xs text-white/40"
            data-section="footer-copyright"
          >
            © {new Date().getFullYear()} {WORKSPACE_BRAND_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

// === SECTION 10: MAIN COMPONENT AND ROOT RENDER ===
function LandingPage() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeFeature, setActiveFeature] = useState('feature-1');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? scrollTop / docHeight : 0;
      setScrollProgress(progress);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const wrappers = Array.from(document.querySelectorAll('[data-feature-id]')) as HTMLElement[];
    if (wrappers.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-feature-id');
            if (id) setActiveFeature(id);
          }
        });
      },
      { threshold: 0.6 }
    );
    wrappers.forEach((w) => io.observe(w));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('reveal-visible');
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div
      className="min-h-full overflow-y-auto"
      style={{
        fontFamily: WORKSPACE_FONT_FAMILY,
        backgroundColor: '#0F172A',
        color: WORKSPACE_CONTRAST_COLOR,
      }}
    >
      <style>{`
        .glass {
          backdrop-filter: blur(8px);
          background: rgba(255, 255, 255, 0.06);
        }
        .reveal {
          opacity: 0;
          transform: translateY(12px);
          transition: opacity 0.8s ease, transform 0.8s ease;
        }
        .reveal-visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
      <Navigation scrollProgress={scrollProgress} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <main>
        <Hero />
        <SocialProof />
        <FeaturesSection activeFeature={activeFeature} />
        <FAQSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

export default LandingPage;

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<LandingPage />);