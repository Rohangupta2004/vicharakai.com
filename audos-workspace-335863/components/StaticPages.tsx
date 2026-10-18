import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { ArrowLeft, Check, FileText, Info, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { breadcrumbSchema, usePageSeo } from './seoMeta';

// Public informational pages for the VicharakAI landing space:
//   /about   — merchant-verification friendly product overview
//   /terms   — Terms & Conditions
//   /privacy — Privacy Policy (IT Act 2000 / SPDI Rules 2011)
//   /refund  — Refund & Cancellation Policy (Consumer Protection Act 2019)
//   /contact — Contact page with a lightweight enquiry form
//
// The custom-domain host rewrites these paths to the landing bundle without
// redirecting, so each page has its own crawlable URL and survives direct loads
// and refreshes. readStaticPageFromLocation() retains hash-route support for
// older links while preferring the real pathname when no hash is present.
//
// TermsPageContent / PrivacyPageContent are ALSO rendered inside EmailGate's
// in-page legal modal, so the modal and the routed page can never drift apart.

export type StaticPageKey = 'about' | 'terms' | 'privacy' | 'refund' | 'contact';

const PAGE_KEYS: StaticPageKey[] = ['about', 'terms', 'privacy', 'refund', 'contact'];

export const LEGAL_EFFECTIVE_DATE = '13 August 2026';
// The ONE address every public page writes to (founder instruction,
// 2026-10-01). support@vicharakai.com is retired.
export const SUPPORT_EMAIL = 'grohan24102004@gmail.com';
const BRAND = 'VicharakAI';
const APP_URL = 'https://app.vicharakai.com';

// Resolves which routed page (if any) the current URL points at. The hash is
// checked first and, when present, wins outright — so "#/" always means "home"
// even if the page was originally served from a real /terms-style pathname.
export function readStaticPageFromLocation(): StaticPageKey | null {
  if (typeof window === 'undefined') return null;
  const rawHash = window.location.hash || '';
  if (rawHash) {
    const hash = rawHash.replace(/^#\/?/, '').replace(/\/+$/, '').toLowerCase();
    return (PAGE_KEYS as string[]).includes(hash) ? (hash as StaticPageKey) : null;
  }
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  return (PAGE_KEYS as string[]).includes(path) ? (path as StaticPageKey) : null;
}

// ---------------------------------------------------------------------------
// Palette — THE LIGHT PAGE (v197, founder instruction 2026-09-30: the whole
// signed-out experience is light). These routed pages are reached straight
// from the landing page's footer, so they carry the same warm-white canvas,
// the same dark ink, ink hairline rules and the same #0057FF → #003AB0 brand
// gradient. Keep in sync with the PAPER_* tokens in
// components/landingTokens.ts.
//
// `highlight` is the accent as TEXT — a deepened blue (#0047D6) that clears
// WCAG AA at label size on the light sheet. Fills keep `gradient`.
//
// The in-page legal MODALS (components/EmailGateOverlays.tsx) belong to the
// auth / overlay surface and are untouched.
//
// `gradient` and `contactCard` are real gradient values — every consumer
// assigns them with the `background:` shorthand, which accepts them
// (`backgroundColor` would silently drop them).
// ---------------------------------------------------------------------------
const C = {
  page: '#FCFBF8',
  section: '#F2F0E9',
  panel: '#FFFFFF',
  border: 'rgba(22, 31, 43, 0.12)',
  textPrimary: '#161F2B',
  textMuted: '#4A5568',
  textSubtle: '#5C677A',
  highlight: '#0047D6',
  onPrimary: '#FFFFFF',
  danger: '#C2372A',
  gradient: 'linear-gradient(135deg, #0057FF 0%, #003AB0 100%)',
  /** Solid CTA blue — the button carries the gradient below instead. */
  ctaBlue: '#0057FF',
  /** A raised card on the canvas. */
  contactCard: 'linear-gradient(168deg, #FFFFFF 0%, #FAF8F3 100%)',
  cardBorder: 'rgba(22, 31, 43, 0.12)',
};

const linkStyle: CSSProperties = {
  color: C.highlight,
  fontWeight: 700,
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
};

function MailLink({ subject, children }: { subject?: string; children?: ReactNode }) {
  const href = subject
    ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${SUPPORT_EMAIL}`;
  return (
    <a href={href} style={linkStyle}>
      {children ?? SUPPORT_EMAIL}
    </a>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-base font-bold" style={{ color: C.textPrimary }}>{title}</h3>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function ContactCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl p-4" style={{ background: C.contactCard, border: `1px solid ${C.cardBorder}` }}>
      <h3 className="font-bold" style={{ color: C.textPrimary }}>{title}</h3>
      <div className="mt-1">{children}</div>
    </section>
  );
}

function Strong({ children }: { children: ReactNode }) {
  return <strong style={{ color: C.textPrimary }}>{children}</strong>;
}

// ---------------------------------------------------------------------------
// About — answers the six merchant-verification questions in plain language.
// ---------------------------------------------------------------------------
export function AboutPageContent() {
  return (
    <>
      <Section title={`What is ${BRAND}?`}>
        <p>
          {BRAND} is an AI-powered study companion built for students preparing for competitive exams in India — JEE,
          NEET, UPSC and more. It acts as a personal study strategist: you log what you study each day, and {BRAND}{' '}
          builds a persistent memory of your preparation, automatically schedules revision, detects where you&rsquo;re
          slipping, and tells you exactly what to focus on next. No more discovering gaps at mock-test time.
        </p>
      </Section>

      <Section title="What am I buying?">
        <p>
          A subscription to {BRAND} gives you unlimited access to the AI study planner, automatic spaced-revision
          scheduling, gap detection, and personalised daily study roadmaps for your chosen exam. It is a digital
          service — nothing is shipped to you.
        </p>
      </Section>

      <Section title="How much does it cost?">
        <p>
          See our current pricing on the app — pricing may vary by plan and exam. Visit{' '}
          <a href={APP_URL} target="_blank" rel="noopener noreferrer" style={linkStyle}>app.vicharakai.com</a> for the
          latest plans.
        </p>
      </Section>

      <Section title="How do I pay?">
        <p>
          Payments are processed securely online. In India we accept UPI, debit/credit cards and net banking through
          our payment partner; elsewhere we accept international cards through our overseas payment partner. All
          transactions are encrypted.
        </p>
      </Section>

      <Section title="How do I get support?">
        <p>
          Email us at <MailLink /> — we respond within 24–48 hours on business days.
        </p>
      </Section>

      <Section title="How do I cancel or get a refund?">
        <p>
          You can cancel your subscription at any time from within the app. For refunds, see our{' '}
          <a href="/refund" style={linkStyle}>Refund &amp; Cancellation Policy</a>.
        </p>
      </Section>

      <ContactCard title="Who operates this?">
        <p>
          {BRAND} is an AI-powered EdTech product. For all legal and merchant-verification enquiries, contact{' '}
          <MailLink subject="VicharakAI merchant-verification enquiry" />.
        </p>
      </ContactCard>
    </>
  );
}

// ---------------------------------------------------------------------------
// Terms & Conditions — shared between the routed #/terms page and EmailGate's
// in-page Terms modal.
// ---------------------------------------------------------------------------
export function TermsPageContent() {
  return (
    <>
      <p>
        These Terms &amp; Conditions are the agreement between you and {BRAND}. By creating an account, buying a
        subscription or otherwise using {BRAND}, you accept these terms. If you do not accept them, please do not use
        the service.
      </p>

      <Section title="What you are purchasing">
        <p>
          {BRAND} is a subscription-based AI study planning service for competitive exam preparation. A subscription
          gives you access to the AI study planner, automatic spaced-revision scheduling, gap detection and
          personalised daily study roadmaps for your chosen exam, for the period you buy. It is a digital service; no
          physical goods are supplied.
        </p>
      </Section>

      <Section title="Your responsibilities">
        <ul className="list-disc space-y-2 pl-5">
          <li><Strong>Accurate information:</Strong> provide truthful details when you sign up and keep your study logs honest — the quality of your plan depends on them.</li>
          <li><Strong>No misuse:</Strong> no unlawful content, no attempts to disrupt or overload the service, no reselling or redistributing access, and no scraping or reverse-engineering.</li>
          <li><Strong>Single account:</Strong> one account per user, used only by you.</li>
        </ul>
      </Section>

      <Section title="Account rules">
        <p>
          Accounts are personal. One account per user; sharing your sign-in details, or letting anyone else use your
          account, is not permitted. You are responsible for the activity on your account and for keeping your
          credentials secure. We may suspend or end access that breaches these terms.
        </p>
      </Section>

      <Section title="Subscriptions, billing and auto-renewal">
        <ul className="list-disc space-y-2 pl-5">
          <li>Paid plans give you access to {BRAND} for the billing period you buy, and subscription plans renew automatically at the end of each billing cycle so your access is not interrupted.</li>
          <li>Prices are shown before you pay — in INR (₹) through our payment partner Razorpay for customers in India, and in USD ($) through our international payment partner Creem elsewhere — and may change with notice for future billing periods.</li>
          <li>If a renewal payment fails or is not made, your paid access may be suspended or downgraded to the free tier until payment is resolved.</li>
        </ul>
      </Section>

      <Section title="Cancellation and refunds">
        <p>
          You can cancel any time from within the app. Cancelling stops future renewals; your access continues to the
          end of the period you have already paid for. First-time subscribers may request a refund within 7 days of
          purchase if the service has not been substantially used — the full rules are in our{' '}
          <a href="/refund" style={linkStyle}>Refund &amp; Cancellation Policy</a>.
        </p>
      </Section>

      <Section title="Educational use only">
        <p>
          {BRAND} is a study companion provided for educational use only. It supports your preparation; it does not
          replace your own study, your teachers or your institution, and no particular exam result is guaranteed.
          AI-generated guidance can be incomplete or wrong, so please check anything important against your own
          material.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          {BRAND} reserves the right to update these terms as the product or the law changes. We will give notice of
          material changes, by email or in the app, and continuing to use {BRAND} after a change means you accept the
          updated terms.
        </p>
      </Section>

      <Section title="Governing law">
        <p>
          These terms are governed by the laws of India. Any disputes arising from or relating to these terms or the
          service are subject to the jurisdiction of the competent courts in India.
        </p>
      </Section>

      <ContactCard title="Contact">
        <p>
          Questions about these terms? Contact <MailLink subject="VicharakAI terms question" />.
        </p>
      </ContactCard>
    </>
  );
}

// ---------------------------------------------------------------------------
// Privacy Policy — shared between the routed #/privacy page and EmailGate's
// in-page Privacy modal. Framed for IT Act 2000 + SPDI Rules 2011.
// ---------------------------------------------------------------------------
export function PrivacyPageContent() {
  return (
    <>
      <p>
        {BRAND} is an AI study companion that helps you plan, study, revise and understand your progress. This policy
        explains what information we collect, why we use it and the choices you have.
      </p>

      <Section title="Information we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li><Strong>Name and email address:</Strong> collected when you sign up or sign in, and used to identify your account and send essential service messages.</li>
          <li><Strong>Study logs:</Strong> the topics you study, your daily targets, confidence ratings, revision history, streaks and goals.</li>
          <li><Strong>Exam choice:</Strong> the exam you are preparing for and your exam date, used to shape your study plan.</li>
          <li><Strong>Chat content:</Strong> messages, questions and files you choose to share with the AI study agent.</li>
          <li><Strong>Device and usage data:</Strong> basic device, browser, session and usage information needed to operate, secure and improve the service.</li>
        </ul>
      </Section>

      <Section title="How we use your information">
        <p>
          We use it to personalise your study plans and revision schedules, to improve the AI and the product, and to
          send you product updates and essential account or service messages. That includes creating and maintaining
          your account, remembering your study context, generating plans and AI responses, tracking your progress,
          providing support and protecting the service.
        </p>
      </Section>

      <Section title="Storage and security">
        <p>
          Your data is stored securely with reasonable technical and organisational safeguards, in line with the
          reasonable security practices contemplated by the SPDI Rules 2011. We do not sell or rent your personal data
          to third parties, and we do not share it for third-party advertising. No online service can guarantee
          absolute security, but we work to protect your information at every step.
        </p>
      </Section>

      <Section title="Third-party services">
        <p>
          We use trusted third-party providers to run {BRAND} — payment processors to handle transactions, analytics
          tools to understand product usage, and AI, hosting, data-storage and email-delivery providers to operate the
          service. These providers process information only to deliver services to us and are expected to protect it
          under their agreements with us.
        </p>
      </Section>

      <Section title="Account deletion and data requests">
        <p>
          You can ask to access, correct or delete your personal information at any time by emailing{' '}
          <MailLink subject="Data Request" /> with the subject line <Strong>&ldquo;Data Request&rdquo;</Strong>. We may
          need to verify your identity before completing a request. Some information may be retained where law or
          legitimate security needs require it.
        </p>
      </Section>

      <Section title="Children and changes to this policy">
        <p>
          {BRAND} is not intended for children under 13. If local law requires parental or guardian consent for a
          student to use the service, the student should use it only with that consent. We may update this policy as
          the product or the law changes; the effective date above will show the latest version.
        </p>
      </Section>

      <Section title="Compliance and governing law">
        <p>
          This policy and our handling of your information are governed by applicable Indian law, including the
          Information Technology Act, 2000 and the Information Technology (Reasonable Security Practices and
          Procedures and Sensitive Personal Data or Information) Rules, 2011 (SPDI Rules).
        </p>
      </Section>

      <ContactCard title="Contact">
        <p>
          For privacy questions or data requests, contact <MailLink subject="Data Request" />.
        </p>
      </ContactCard>
    </>
  );
}

// ---------------------------------------------------------------------------
// Refund & Cancellation Policy — routed #/refund page.
// ---------------------------------------------------------------------------
export function RefundPageContent() {
  return (
    <>
      <p>
        We want {BRAND} to earn its place in your preparation. This policy explains when refunds apply, how to request
        one, and what happens when you cancel — in line with the Consumer Protection Act, 2019.
      </p>

      <Section title="7-day refund window">
        <p>
          First-time subscribers can request a full refund within <Strong>7 days from the date of purchase</Strong>,
          provided the service has not been substantially used.
        </p>
      </Section>

      <Section title="What 'substantially used' means">
        <p>
          Your subscription counts as substantially used once you have logged <Strong>more than 3 study sessions</Strong>.
          Up to that point inside the 7-day window, you remain eligible for a refund.
        </p>
      </Section>

      <Section title="How to request a refund">
        <p>
          Email <MailLink subject="Refund Request" /> with the subject line <Strong>&ldquo;Refund Request&rdquo;</Strong>{' '}
          and your registered email address. Approved refunds are returned to your original payment method.
        </p>
      </Section>

      <Section title="Cancellation">
        <p>
          You can cancel your subscription at any time from within the app. Cancelling stops future renewals, and your
          access continues until the end of the billing period you have already paid for. After the 7-day window, there
          are no partial refunds for unused days.
        </p>
      </Section>

      <Section title="What happens after cancellation">
        <p>
          When your paid period ends, your account is downgraded to the free tier (if applicable) or deactivated. Your
          data continues to be handled as described in our <a href="/privacy" style={linkStyle}>Privacy Policy</a>.
        </p>
      </Section>

      <Section title="Renewals">
        <p>
          Subscriptions renew automatically at the end of each billing cycle. To avoid being charged for the next
          period, cancel before your renewal date.
        </p>
      </Section>

      <Section title="Consumer protection">
        <p>
          This policy operates alongside your rights under the Consumer Protection Act, 2019. If anything about a
          charge looks wrong, contact us first — most billing questions are resolved within a couple of business days.
        </p>
      </Section>

      <ContactCard title="Contact">
        <p>
          Refund or billing question? Email <MailLink subject="Refund Request" />.
        </p>
      </ContactCard>
    </>
  );
}

// ---------------------------------------------------------------------------
// Contact — routed #/contact page with a lightweight enquiry form. The form is
// captured via the space's public tracking endpoint (the same one the landing
// page uses for lead events); no backend email sending is required.
// ---------------------------------------------------------------------------
export function ContactPageContent({ spaceId }: { spaceId: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const inputStyle: CSSProperties = {
    backgroundColor: C.page,
    border: `1px solid ${C.border}`,
    color: C.textPrimary,
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    const enquiry = {
      name: name.trim(),
      email: email.trim(),
      message: message.trim().slice(0, 2000),
    };
    // Log locally so the enquiry is visible even if tracking is unavailable.
    console.log('[Contact] enquiry submitted:', enquiry);
    try {
      const workspaceId = (window as any).__WORKSPACE_ID__ || null;
      let visitorId = '';
      try {
        const key = 'audos_visitor_id';
        visitorId = localStorage.getItem(key) || `v_${Math.random().toString(36).substring(2)}_${Date.now()}`;
        localStorage.setItem(key, visitorId);
      } catch {
        // storage unavailable — send without a visitor id
      }
      await fetch(`/api/space/${spaceId}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'contact_enquiry',
          sessionId: `contact_${Date.now()}`,
          visitorId,
          metadata: { source: 'contact-page', ...enquiry },
          workspaceId,
        }),
      });
    } catch {
      // Graceful capture — the console log above still records the enquiry.
    }
    setStatus('sent');
  };

  return (
    <>
      <Section title="Reach us directly">
        <p>
          {BRAND} support is one email away: <MailLink /> — we reply within{' '}
          <Strong>24–48 business hours</Strong>.
        </p>
        <p style={{ color: C.textSubtle }}>
          Mailing address: not yet available — please contact us by email.
        </p>
      </Section>

      {status === 'sent' ? (
        <div
          className="rounded-2xl p-6 text-center"
          style={{ background: C.contactCard, border: `1px solid ${C.cardBorder}` }}
          data-testid="contact-thank-you"
        >
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: C.gradient, color: C.onPrimary }}
          >
            <Check size={22} strokeWidth={3} />
          </div>
          <h3 className="mt-3 text-lg font-extrabold" style={{ color: C.textPrimary }}>
            Thank you, we&rsquo;ll be in touch!
          </h3>
          <p className="mt-1 text-sm" style={{ color: C.textMuted }}>
            Your message has been received. Expect a reply within 24–48 business hours.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="contact-form">
          <div>
            <label className="mb-1.5 block text-xs font-bold" style={{ color: C.textMuted }} htmlFor="contact-name">
              Name
            </label>
            <input
              id="contact-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-2xl px-4 py-3.5 text-base focus:outline-none"
              style={inputStyle}
              required
              data-testid="input-contact-name"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold" style={{ color: C.textMuted }} htmlFor="contact-email">
              Email
            </label>
            <input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-2xl px-4 py-3.5 text-base focus:outline-none"
              style={inputStyle}
              required
              data-testid="input-contact-email"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold" style={{ color: C.textMuted }} htmlFor="contact-message">
              Message
            </label>
            <textarea
              id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help?"
              rows={5}
              className="w-full resize-y rounded-2xl px-4 py-3.5 text-base focus:outline-none"
              style={inputStyle}
              required
              data-testid="input-contact-message"
            />
          </div>
          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full rounded-full px-5 py-4 text-base font-extrabold sm:w-auto sm:px-10"
            style={{
              background: C.gradient,
              color: C.onPrimary,
              cursor: status === 'sending' ? 'wait' : 'pointer',
              opacity: status === 'sending' ? 0.7 : 1,
              boxShadow: '0 6px 16px rgba(0, 87, 255, 0.22)',
            }}
            data-testid="button-contact-submit"
          >
            {status === 'sending' ? 'Sending…' : 'Submit'}
          </button>
        </form>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Full-page shell shared by all five routed pages.
// ---------------------------------------------------------------------------
const PAGE_META: Record<StaticPageKey, { title: string; eyebrow: string; Icon: typeof FileText; effective?: boolean }> = {
  about: { title: `About ${BRAND}`, eyebrow: 'What we do, what you buy, and how to reach us', Icon: Info },
  terms: { title: 'Terms & Conditions', eyebrow: 'The agreement, in plain English', Icon: FileText, effective: true },
  privacy: { title: 'Privacy Policy', eyebrow: 'Your data, clearly explained', Icon: ShieldCheck, effective: true },
  refund: { title: 'Refund & Cancellation Policy', eyebrow: 'Fair and simple — a 7-day window for new subscribers', Icon: RefreshCw, effective: true },
  contact: { title: 'Contact Us', eyebrow: 'We reply within 24–48 business hours', Icon: Mail },
};

// Each routed page writes its OWN title and description. Without this they
// inherit the homepage's, which is what makes five real URLs read as five
// copies of one page.
const PAGE_SEO: Record<StaticPageKey, { title: string; description: string }> = {
  about: {
    title: `About ${BRAND} — AI Study Companion for Indian Competitive Exams`,
    description: `What ${BRAND} is, what a subscription includes, how payment and support work, and who builds it. An AI study planner for JEE, NEET, UPSC and other Indian competitive exams.`,
  },
  terms: {
    title: `Terms & Conditions | ${BRAND}`,
    description: `The agreement between you and ${BRAND}, in plain English: what the subscription covers, acceptable use, billing and cancellation, liability and the governing law.`,
  },
  privacy: {
    title: `Privacy Policy | ${BRAND}`,
    description: `How ${BRAND} collects, stores and uses your study data and personal information, your rights over it, and how to ask for it to be corrected or deleted.`,
  },
  refund: {
    title: `Refund & Cancellation Policy | ${BRAND}`,
    description: `${BRAND}'s refund terms for new subscribers, how to cancel a subscription, when a refund applies and how long it takes to reach you.`,
  },
  contact: {
    title: `Contact ${BRAND} — Support for Students and Subscribers`,
    description: `Reach the ${BRAND} team about your study plan, your subscription, billing or a technical problem. We reply within 24 to 48 business hours.`,
  },
};

const FOOTER_LINKS: Array<{ href: string; label: string; page?: StaticPageKey }> = [
  { href: '/exam', label: 'Exam Prep' },
  { href: '/learn', label: 'Learn' },
  { href: '/compare', label: 'Compare' },
  { href: '/about', page: 'about', label: 'About' },
  { href: '/terms', page: 'terms', label: 'Terms' },
  { href: '/privacy', page: 'privacy', label: 'Privacy' },
  { href: '/refund', page: 'refund', label: 'Refund Policy' },
  { href: '/contact', page: 'contact', label: 'Contact' },
];

export function StaticPage({
  page,
  spaceId,
  brandName = BRAND,
  logoUrl,
  bodyFontFamily,
  headingFontFamily,
}: {
  page: StaticPageKey;
  spaceId: string;
  brandName?: string;
  logoUrl?: string;
  bodyFontFamily?: string;
  headingFontFamily?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const meta = PAGE_META[page];
  const Icon = meta.Icon;
  const seo = PAGE_SEO[page];

  usePageSeo({
    title: seo.title,
    description: seo.description,
    canonicalPath: `/${page}`,
    jsonLd: [breadcrumbSchema([{ name: 'Home', path: '/' }, { name: meta.title, path: `/${page}` }])],
  });

  // Cross-page links keep this component mounted, so reset the scroll
  // container when the route changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [page]);

  return (
    <div
      ref={scrollRef}
      className="h-screen overflow-y-auto"
      style={{
        height: '100dvh',
        WebkitOverflowScrolling: 'touch',
        backgroundColor: C.page,
        color: C.textPrimary,
        fontFamily: bodyFontFamily || 'system-ui, -apple-system, sans-serif',
      }}
      data-testid={`page-${page}`}
    >
      <header
        className="sticky top-0 z-20 px-5 py-3.5 md:px-10"
        style={{
          backgroundColor: 'rgba(252, 251, 248, 0.94)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <a href="/" className="flex min-w-0 items-center gap-2.5 hover:opacity-90" style={{ color: C.textPrimary }}>
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-lg object-cover" />
            ) : (
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-extrabold"
                style={{ background: C.gradient, color: C.onPrimary }}
              >
                {brandName.charAt(0)}
              </span>
            )}
            <span className="truncate text-base font-extrabold" style={{ fontFamily: headingFontFamily || 'inherit' }}>
              {brandName}
            </span>
          </a>
          <a
            href="/"
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold hover:opacity-80"
            style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.textMuted }}
            data-testid="link-back-home"
          >
            <ArrowLeft size={14} strokeWidth={2.6} /> Back to home
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-10 md:px-8 md:pt-14">
        <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: C.highlight }}>
          <Icon size={13} strokeWidth={2.6} /> {meta.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl" style={{ fontFamily: headingFontFamily || 'inherit' }}>
          {meta.title}
        </h1>
        {meta.effective && (
          <p className="mt-2 text-sm" style={{ color: C.textSubtle }}>Effective {LEGAL_EFFECTIVE_DATE}</p>
        )}

        <div className="mt-8 space-y-6 text-sm leading-6" style={{ color: C.textMuted }}>
          {page === 'about' && <AboutPageContent />}
          {page === 'terms' && <TermsPageContent />}
          {page === 'privacy' && <PrivacyPageContent />}
          {page === 'refund' && <RefundPageContent />}
          {page === 'contact' && <ContactPageContent spaceId={spaceId} />}
        </div>
      </main>

      <footer className="px-5 pb-10 pt-8 md:px-10" style={{ borderTop: `1px solid ${C.border}`, backgroundColor: C.page }}>
        <nav
          aria-label="Footer"
          className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-center text-xs"
          style={{ color: C.textSubtle }}
        >
          <span>© 2026 {brandName}</span>
          {FOOTER_LINKS.map(({ href, page: key, label }) => (
            <span key={href} className="inline-flex items-center gap-x-2.5">
              <span aria-hidden="true">·</span>
              {key === page ? (
                <span className="font-bold" style={{ color: C.textPrimary }}>{label}</span>
              ) : (
                <a href={href} className="font-bold hover:opacity-80" style={{ color: C.textMuted }}>
                  {label}
                </a>
              )}
            </span>
          ))}
        </nav>
        <p className="mt-3 text-center text-xs" style={{ color: C.textSubtle }}>
          Support:{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline underline-offset-2" style={{ color: C.textMuted }}>
            {SUPPORT_EMAIL}
          </a>
        </p>
      </footer>
    </div>
  );
}
