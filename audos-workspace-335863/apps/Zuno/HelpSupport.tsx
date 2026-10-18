/**
 * Help & Support — the one place a student can get unstuck without leaving the
 * app. Opened from the Profile tab's settings list.
 *
 * Two halves, deliberately small: a handful of questions a new aspirant
 * actually asks in week one (answers written from what the app really does —
 * the 1/3/5/7/14 revision ladder in engine.ts, the two-axis pace signal, the
 * exam switcher on Profile), and one plain mailto so a real reply is always
 * one tap away. No backend, no ticket form, nothing to configure.
 */
import { useState } from 'react';
import { ChevronDown, LifeBuoy, Mail, MessageCircle, X } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  CARD,
  NAVY_ALT,
  ON_AMBER,
  OVERLAY_BG,
  RADIUS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  tint,
} from './theme';

export const SUPPORT_EMAIL = 'support@vicharakai.com';

interface Faq {
  q: string;
  a: string;
}

const FAQS: Faq[] = [
  {
    q: 'How does the AI plan my study?',
    a: "You pick your exam (or type your own) and VicharakAI builds your first week straight from that syllabus — about three topics a day, rotated across subjects so you're never stuck on one. From there it keeps planning around what you actually finish: every completed topic queues its own revisions, and Today shows one clear mission — with your revisions folded into a single Revise row underneath. Nothing to fill in, no long form.",
  },
  {
    q: 'What is the revision schedule?',
    a: 'Spaced repetition, counted from the day you really studied a topic — not the day it was planned. Each finished topic comes back at 1, 3, 5, 7 and 14 days. Today keeps exactly five revision items behind the Revise row: anything due or overdue first (oldest first), then quick recalls of recent topics if fewer than five are due, so the daily ritual stays the same size.',
  },
  {
    q: 'How is my pace calculated?',
    a: "Two things, honestly. First, syllabus coverage against your exam date: how much is left versus how many days remain. Second — once you've logged any study time — the hours you're averaging against the hours your exam date needs. Whichever tells the harder truth is the one you see, as green (on track), amber (slipping, recoverable) or red (won't fit at this pace). Setting your real exam date on Profile is what makes it accurate.",
  },
  {
    q: 'How do I change my exam or exam date?',
    a: 'Profile → Exam → Change. Pick another exam, or tap “+ Type another exam” to enter one that isn’t listed and we’ll build a syllabus for it. Your streak, completed topics, revisions and test history all stay safe when you switch. The exam date sits just below, and saving it recalculates your pace immediately.',
  },
  {
    q: 'Do I have to log my study hours?',
    a: "No — the planner works fine without it. But hours are the one thing we can't guess, so if you tap the timer or enter minutes after a task, the study-hours chart on Dashboard and the hours half of your pace signal switch on. You can set daily and weekly hour goals on Profile and we'll compare against those instead of an estimate.",
  },
  {
    q: 'Can I use Hindi or Hinglish?',
    a: 'Yes. Profile → Language lets you switch between English, Hindi and Hinglish, and Your Second Mind replies in whichever you choose. You can also just talk to it in your language mid-chat and it will follow you.',
  },
];

const MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('VicharakAI — help request')}&body=${encodeURIComponent(
  "Hi VicharakAI team,\n\nHere's what I need help with:\n\n",
)}`;

function FaqRow({ faq, open, onToggle }: { faq: Faq; open: boolean; onToggle: () => void }) {
  return (
    <div
      style={{ background: CARD, border: `1px solid ${open ? tint(AMBER, 0.4) : BORDER}`, borderRadius: RADIUS.md }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full px-4 py-3.5 flex items-center gap-3 text-left touch-manipulation"
        data-testid="button-faq-toggle"
      >
        <span className="text-sm font-bold flex-1 leading-snug" style={{ color: open ? AMBER : TEXT }}>
          {faq.q}
        </span>
        <ChevronDown
          className="w-4 h-4 flex-shrink-0 transition-transform"
          style={{ color: open ? AMBER : TEXT_MUTED, transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open && (
        <p className="px-4 pb-4 -mt-0.5 text-[13px] leading-relaxed vicharak-fade" style={{ color: TEXT_SECONDARY }}>
          {faq.a}
        </p>
      )}
    </div>
  );
}

/**
 * @param onAskCoach optional — jumps the student into Your Second Mind, which
 * answers most "how do I…" questions faster than an email ever will.
 */
export default function HelpSupportSheet({ onClose, onAskCoach }: { onClose: () => void; onAskCoach?: () => void }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Help and support"
      data-testid="sheet-help"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 vicharak-fade"
        style={{ background: OVERLAY_BG }}
      />
      <div
        className="relative max-h-[90vh] overflow-y-auto vicharak-sheet"
        style={{
          borderTopLeftRadius: RADIUS.sheet,
          borderTopRightRadius: RADIUS.sheet,
          background: NAVY_ALT,
          borderTop: `1px solid ${BORDER_STRONG}`,
          boxShadow: '0 -12px 40px rgba(0,0,0,0.55)',
        }}
      >
        <div className="flex items-start justify-between px-5 pt-4">
          <span
            className="w-10 h-10 flex items-center justify-center flex-shrink-0"
            style={{ borderRadius: RADIUS.md, background: BRAND_GRADIENT, color: ON_AMBER }}
            aria-hidden="true"
          >
            <LifeBuoy className="w-5 h-5" />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: BORDER, color: TEXT }}
            data-testid="button-close-help"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-3 pb-7">
          <h2 className="text-xl font-extrabold leading-tight" style={{ color: TEXT }}>
            Help &amp; Support
          </h2>
          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: TEXT_SECONDARY }}>
            The questions most aspirants ask in their first week — and a real person at the end of an email if yours
            isn&apos;t here.
          </p>

          <p
            className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] mt-5 mb-2"
            style={{ color: TEXT_MUTED }}
          >
            Frequently asked
          </p>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <FaqRow
                key={faq.q}
                faq={faq}
                open={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            ))}
          </div>

          <p
            className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] mt-6 mb-2"
            style={{ color: TEXT_MUTED }}
          >
            Still stuck?
          </p>
          <div
            className="p-4"
            style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.lg }}
            data-testid="card-contact"
          >
            <p className="text-sm leading-relaxed" style={{ color: TEXT_SECONDARY }}>
              Tell us what went wrong, what you expected, and which screen you were on. We read every message and
              usually reply within a day.
            </p>
            <a
              href={MAILTO}
              className="mt-3.5 w-full py-3 text-sm font-extrabold inline-flex items-center justify-center gap-2"
              style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
              data-testid="link-contact-support"
            >
              <Mail className="w-4 h-4" />
              Send us a message
            </a>
            <p className="text-[11px] mt-2.5 text-center" style={{ color: TEXT_MUTED }}>
              {SUPPORT_EMAIL}
            </p>
          </div>

          {onAskCoach && (
            <button
              type="button"
              onClick={onAskCoach}
              className="mt-3 w-full py-2.5 text-xs font-extrabold inline-flex items-center justify-center gap-2"
              style={{
                borderRadius: RADIUS.chip,
                background: tint(AMBER, 0.14),
                border: `1px solid ${tint(AMBER, 0.35)}`,
                color: AMBER,
              }}
              data-testid="button-help-ask-coach"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Ask Your Second Mind instead
            </button>
          )}

          <p className="text-[11px] mt-4 text-center leading-relaxed" style={{ color: TEXT_MUTED }}>
            Your plan, streak, revisions and test history are saved to your account — nothing is lost while we sort a
            problem out.
          </p>
        </div>
      </div>
    </div>
  );
}
