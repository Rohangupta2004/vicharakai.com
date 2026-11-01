// Runtime shims for older mobile browsers must load before the gate.
import '../lib/browserCompat';
import { useEmailGateController } from './useEmailGateController';
import EmailGateLanding from './EmailGateLanding';
import EmailGateCodeScreen from './EmailGateCodeScreen';
import EmailGateOverlays from './EmailGateOverlays';
import { StaticPage } from './StaticPages';
import LearnIndex from './Learn/LearnIndex';
import ArticlePage from './Learn/ArticlePage';
import ExamIndex from './Exam/ExamIndex';
import ExamPage from './Exam/ExamPage';
import ExamSubjectPage from './Exam/ExamSubjectPage';
import { getExam } from './Exam/examData';
import CompareIndex from './Compare/CompareIndex';
import ComparePage from './Compare/ComparePage';
import SitemapPage from './Sitemap/SitemapPage';
import ExamSEOApp from '../apps/ExamSEO/App';
import ArticlePageApp from '../apps/ArticlePage/App';
import type { EmailGateProps } from './emailGateShared';

// Google OAuth is temporarily disabled while the broken provider flow is
// repaired. Keep the handler code in the controller so one flag restores it.
export const ENABLE_GOOGLE_SIGNIN = false;

// Version marker for publish-time auto-upgrade detection. Keep this export.
export const EMAIL_GATE_VERSION = 204;

export default function EmailGate(props: EmailGateProps) {
  const ctx = useEmailGateController(props, { enableGoogleSignIn: ENABLE_GOOGLE_SIGNIN });
  const {
    staticPage,
    learnRoute,
    examRoute,
    compareRoute,
    seoPublicRoute,
    sitemapRoute,
    step,
    spaceId,
    brandName,
    logoUrl,
    bodyFontStack,
    headingFontStack,
  } = ctx;

  if (seoPublicRoute?.kind === 'exam') return <ExamSEOApp />;
  if (seoPublicRoute?.kind === 'prep-index' || seoPublicRoute?.kind === 'prep-article') return <ArticlePageApp />;
  if (sitemapRoute) return <SitemapPage brandName={brandName} logoUrl={logoUrl} />;

  if (examRoute) {
    if (examRoute.kind === 'exam-index') return <ExamIndex brandName={brandName} logoUrl={logoUrl} />;
    const exam = getExam(examRoute.kind === 'exam-page' ? examRoute.slug : examRoute.examSlug);
    if (!exam) {
      window.location.hash = '#/exam';
      return <ExamIndex brandName={brandName} logoUrl={logoUrl} />;
    }
    if (examRoute.kind === 'exam-page') return <ExamPage exam={exam} brandName={brandName} logoUrl={logoUrl} />;
    const subject = exam.subjects.find((item) => item.slug === examRoute.subjectSlug);
    if (!subject) {
      window.location.hash = `#/exam/${exam.slug}`;
      return <ExamPage exam={exam} brandName={brandName} logoUrl={logoUrl} />;
    }
    return <ExamSubjectPage exam={exam} subject={subject} brandName={brandName} logoUrl={logoUrl} />;
  }

  if (compareRoute) {
    return compareRoute.kind === 'compare-index'
      ? <CompareIndex brandName={brandName} logoUrl={logoUrl} />
      : <ComparePage slug={compareRoute.slug} brandName={brandName} logoUrl={logoUrl} />;
  }

  if (learnRoute) {
    return learnRoute.kind === 'article' ? (
      <ArticlePage slug={learnRoute.slug} brandName={brandName} logoUrl={logoUrl} supportEmail={ctx.SUPPORT_EMAIL} />
    ) : (
      <LearnIndex brandName={brandName} logoUrl={logoUrl} supportEmail={ctx.SUPPORT_EMAIL} />
    );
  }

  if (staticPage) {
    return (
      <StaticPage
        page={staticPage}
        spaceId={spaceId}
        brandName={brandName}
        logoUrl={logoUrl}
        bodyFontFamily={bodyFontStack}
        headingFontFamily={headingFontStack}
      />
    );
  }

  if (step === 'loading' || step === 'complete') return null;
  if (step === 'code') return <EmailGateCodeScreen ctx={ctx} />;
  if (step === 'retry') {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: ctx.gateGradient, fontFamily: ctx.bodyFontStack }}
      >
        <div
          className="w-full max-w-sm rounded-3xl p-7 text-center"
          style={{ backgroundColor: ctx.panelColor, border: `1px solid ${ctx.borderColor}` }}
        >
          <h1 className="text-xl font-extrabold" style={{ color: ctx.textPrimary, fontFamily: ctx.headingFontStack }}>
            We couldn&apos;t verify your saved sign-in
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: ctx.textMuted }} role="alert">
            Your account was not opened with an unverified session. Check your connection, then retry the secure session check.
          </p>
          <button
            type="button"
            className="mt-5 w-full rounded-2xl px-4 py-3 font-bold"
            style={{ background: ctx.brandGradient, color: ctx.onPrimary }}
            onClick={() => {
              ctx.setError('');
              ctx.setStep('loading');
              void ctx.checkExistingSession().catch((err: unknown) => {
                console.error('[EmailGate] saved-session retry failed:', err);
                ctx.setError('We still could not verify your saved sign-in. Check your connection and retry.');
                ctx.setStep('retry');
              });
            }}
          >
            Retry secure sign-in
          </button>
          <button
            type="button"
            className="mt-3 text-sm font-semibold"
            style={{ color: ctx.textMuted }}
            onClick={() => {
              try { localStorage.removeItem(`space_session_${spaceId}`); } catch {}
              ctx.setError('');
              ctx.setStep('email');
            }}
          >
            Sign in another way
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* AUDOS:LANDING_SHELL:START */}
      <EmailGateLanding ctx={ctx} />
      {/* AUDOS:LANDING_SHELL:END */}
      <EmailGateOverlays ctx={ctx} />
    </>
  );
}
