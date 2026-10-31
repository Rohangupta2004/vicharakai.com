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

export const LEGAL_EFFECTIVE_DATE = '22 October 2026';
// The ONE address every public page writes to (founder instruction,
// 2026-10-01). support@vicharakai.com is retired.
export const SUPPORT_EMAIL = 'grohan24102004@gmail.com';
const BRAND = 'VicharakAI';

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
      <h2 className="text-base font-bold" style={{ color: C.textPrimary }}>{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function ContactCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl p-4" style={{ background: C.contactCard, border: `1px solid ${C.cardBorder}` }}>
      <h2 className="font-bold" style={{ color: C.textPrimary }}>{title}</h2>
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
          {BRAND} is an AI-powered study companion built for students preparing for competitive exams in India —
          JEE Main, NEET UG and NEET PG. It acts as a personal study strategist: you log what you study each day, and {BRAND}{' '}
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
          VicharakAI includes a 7-day free trial, then one optional Premium plan at ₹149 for one month of access.
          Payments are available in India through Razorpay.
        </p>
      </Section>

      <Section title="How do I pay?">
        <p>
          Payments are processed securely in INR through Razorpay. We accept UPI, debit/credit cards and supported
          wallets. All transactions are encrypted.
        </p>
      </Section>

      <Section title="How do I get support?">
        <p>
          Email us at <MailLink /> — we respond within 24–48 hours on business days.
        </p>
      </Section>

      <Section title="How do I cancel or get a refund?">
        <p>
          The free trial ends without a charge. Paid access does not currently auto-renew; each verified ₹149 Razorpay
          payment adds one month. To cancel or ask a billing question, email <MailLink subject="Cancel VicharakAI plan" />.
          For refunds, see our <a href="/refund" style={linkStyle}>Refund &amp; Cancellation Policy</a>.
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

      <Section title="Trial and billing">
        <ul className="list-disc space-y-2 pl-5">
          <li>The 7-day free trial requires no card and ends without a charge.</li>
          <li>The only paid plan is ₹149 for one month of Premium access, billed in INR through Razorpay in India.</li>
          <li>Payments do not currently auto-renew. When paid access ends, Premium features lock until another payment is verified; there is no separate free tier.</li>
        </ul>
      </Section>

      <Section title="Cancellation and refunds">
        <p>
          To cancel or ask us to stop any future billing instruction, email <MailLink subject="Cancel VicharakAI plan" />.
          Because the current Razorpay payment adds one month and does not auto-renew, your access simply continues to
          the end of the paid period. First-time subscribers may request a refund within 7 days of purchase if the
          service has not been substantially used — the full rules are in our{' '}
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
          <li><Strong>Name and email address:</Strong> collected when you sign up or sign in, including through Google sign-in, and used to identify your account and send essential service messages.</li>
          <li><Strong>Birth year and consent:</Strong> we store birth year only, not a full date of birth, so we can apply adult or minor protections and record the policy version accepted.</li>
          <li><Strong>Study logs:</Strong> the topics you study, your daily targets, confidence ratings, revision history, streaks and goals.</li>
          <li><Strong>Exam choice:</Strong> the exam you are preparing for and your exam date, used to shape your study plan.</li>
          <li><Strong>Chat content:</Strong> messages, questions and files you choose to share with the AI study agent.</li>
          <li><Strong>Device and usage data:</Strong> basic device, browser, session and usage information needed to operate, secure and improve the service.</li>
        </ul>
      </Section>

      <Section title="How we use your information">
        <p>
          We use it to personalise your study plans and revision schedules, to improve the AI and the product, and to
          send essential account or service messages. We send marketing updates and use advertising measurement only
          when you explicitly opt in and confirm that you are 18 or older or have parent or guardian permission. Other
          uses include maintaining your account, remembering study context, generating plans and AI responses,
          tracking progress, providing support and protecting the service. Advertising pixels do not receive advanced
          matching identifiers unless the optional marketing consent is recorded for the current policy version.
        </p>
      </Section>

      <Section title="Storage and security">
        <p>
          Your data is stored securely with reasonable technical and organisational safeguards, in line with the
          reasonable security practices contemplated by the SPDI Rules 2011. We do not sell or rent your personal data.
          If an adult explicitly opts into marketing, we may send a normalized identifier to advertising measurement
          providers such as Meta or Reddit for conversion measurement
          and advanced matching. Without that opt-in, we do not send your email for advertising matching. No online
          service can guarantee absolute security, but we work to protect your information at every step.
        </p>
      </Section>

      <Section title="Third-party services">
        <p>
          We use trusted third-party providers to run {BRAND} — payment processors to handle transactions, analytics
          tools to understand product usage, and AI, hosting, data-storage and email-delivery providers to operate the
          service. With an adult's explicit marketing consent, this may also include advertising measurement providers. These providers process information only for the disclosed services and are expected to protect it
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

      <Section title="Children and minors">
        <p>
          Before any study activity or personalised content is stored, every account must provide a birth year. We keep
          the year only. Anyone not confidently identified as 18 or older must complete the parent or guardian consent
          step, including a code sent to the guardian email, before entering the app. Optional marketing opt-in is
          offered only to adults and is logged separately with its timestamp and policy version. A parent or guardian can request access, correction
          or deletion by emailing <MailLink subject="Minor data request" />.
        </p>
      </Section>

      <Section title="Policy changes">
        <p>
          We may update this policy as the product or the law changes. The effective date above and the stored policy
          version show which notice was accepted; material changes may require consent again.
        </p>
      </Section>

      <Section title="Compliance and governing law">
        <p>
          This policy and our handling of your information are governed by applicable Indian law, including the
          Digital Personal Data Protection Act, 2023, the Information Technology Act, 2000 and the Information
          Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules,
          2011 (SPDI Rules).
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
          Email <MailLink subject="Cancel VicharakAI plan" /> to cancel or raise a billing request. The current ₹149
          Razorpay payment adds one month of access and does not auto-renew, so access continues until that paid month
          ends. After the 7-day refund window, there are no partial refunds for unused days.
        </p>
      </Section>

      <Section title="What happens after cancellation">
        <p>
          When the paid month ends, Premium features lock until another payment is verified; there is no separate free
          tier. Your data continues to be handled as described in our <a href="/privacy" style={linkStyle}>Privacy Policy</a>.
        </p>
      </Section>

      <Section title="Renewals">
        <p>
          VicharakAI does not currently auto-renew. Each ₹149 Razorpay payment adds one month. If this changes, we will
          show the renewal terms before payment and update these policies.
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
// Contact — routed #/contact page with a lightweight enquiry form. The form
// posts to the registered contact-form-notify server function, which validates
// the payload and emails the founder before this page confirms delivery.
// ---------------------------------------------------------------------------
export function ContactPageContent({ spaceId }: { spaceId: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const inputStyle: CSSProperties = {
    backgroundColor: C.page,
    border: `1px solid ${C.border}`,
    color: C.textPrimary,
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    try {
      const response = await fetch(`/api/hooks/execute/${spaceId}/contact-form-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim().slice(0, 2000),
        }),
      });
      const payload = await response.json().catch(() => null);
      const result = payload && typeof payload.data === 'object' ? payload.data : payload;
      if (!response.ok || result?.ok !== true) throw new Error(`contact_${response.status}`);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
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
          {status === 'error' && (
            <p role="alert" className="text-sm" style={{ color: C.danger }}>
              Your message was not sent. Retry below, or email <MailLink /> directly.
            </p>
          )}
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
            {status === 'sending' ? 'Sending…' : status === 'error' ? 'Retry' : 'Submit'}
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
    title: `About ${BRAND} — AI Study Companion for JEE Main, NEET UG and NEET PG`,
    description: `What ${BRAND} is, what a subscription includes, how payment and support work, and who builds it. An AI study planner and revision companion for JEE Main, NEET UG and NEET PG aspirants in India.`,
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

const PAGE_KEYWORDS: Record<StaticPageKey, string[]> = {
  about: ['about VicharakAI', 'AI study companion India', 'competitive exam revision planner', 'VicharakAI pricing and support'],
  terms: ['VicharakAI terms and conditions', 'study planner subscription terms', 'Razorpay education app billing', 'VicharakAI acceptable use'],
  privacy: ['VicharakAI privacy policy', 'study data privacy India', 'AI study app data rights', 'delete VicharakAI account data'],
  refund: ['VicharakAI refund policy', 'cancel VicharakAI subscription', 'Razorpay education app refund', '7 day refund window'],
  contact: ['contact VicharakAI support', 'VicharakAI billing help', 'study planner technical support', 'VicharakAI customer service'],
};

const FOOTER_LINKS: Array<{ href: string; label: string; page?: StaticPageKey }> = [
  { href: '/jee', label: 'JEE Main' },
  { href: '/neet', label: 'NEET UG' },
  { href: '/neet-pg', label: 'NEET PG' },
  { href: '/exam', label: 'Exam Prep' },
  { href: '/prep', label: 'Study Guides' },
  { href: '/learn', label: 'Learn' },
  { href: '/study-methods', label: 'Study Methods' },
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
    keywords: PAGE_KEYWORDS[page],
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
              <img src={logoUrl} alt={`${brandName} logo`} className="h-8 w-8 flex-shrink-0 rounded-lg object-cover" />
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
