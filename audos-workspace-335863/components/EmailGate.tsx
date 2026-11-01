// Runtime shims for older mobile browsers must load before the gate.
import '../lib/browserCompat';
import { Component, lazy, Suspense } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useEmailGateController } from './useEmailGateController';
import EmailGateLanding from './EmailGateLanding';
import EmailGateCodeScreen from './EmailGateCodeScreen';
import type { EmailGateProps } from './emailGateShared';

// Keep the root landing path small. None of the route families or modal
// surfaces below are requested until the visitor actually navigates to one.
const EmailGateOverlays = lazy(() => import('./EmailGateOverlays'));
const StaticPage = lazy(() => import('./StaticPages').then((module) => ({ default: module.StaticPage })));
const LearnIndex = lazy(() => import('./Learn/LearnIndex'));
const ArticlePage = lazy(() => import('./Learn/ArticlePage'));
const ExamRouteView = lazy(() => import('./Exam/ExamRouteView'));
const CompareIndex = lazy(() => import('./Compare/CompareIndex'));
const ComparePage = lazy(() => import('./Compare/ComparePage'));
const SitemapPage = lazy(() => import('./Sitemap/SitemapPage'));
const ExamSEOApp = lazy(() => import('../apps/ExamSEO/App'));
const ArticlePageApp = lazy(() => import('../apps/ArticlePage/App'));

// Google OAuth is temporarily disabled while the broken provider flow is
// repaired. Keep the handler code in the controller so one flag restores it.
export const ENABLE_GOOGLE_SIGNIN = false;

// Version marker for publish-time auto-upgrade detection. Keep this export.
export const EMAIL_GATE_VERSION = 204;

function BrandedGateSkeleton({ ctx, opening = false }: { ctx: any; opening?: boolean }) {
  return (
    <div
      className="min-h-screen"
      style={{ minHeight: '100dvh', background: '#040817', color: '#F2F5FF', fontFamily: ctx.bodyFontStack }}
      role="status"
      aria-live="polite"
      aria-label={opening ? `Opening ${ctx.brandName}` : `Loading ${ctx.brandName}`}
    >
      <style>{`
        @keyframes vicharakGatePulse { 0%, 100% { opacity: .34; } 50% { opacity: .82; } }
        .vicharak-gate-pulse { animation: vicharakGatePulse 1.35s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .vicharak-gate-pulse { animation: none; opacity: .62; } }
      `}</style>
      <header style={{ height: 72, display: 'flex', alignItems: 'center', gap: 11, maxWidth: 1200, margin: '0 auto', padding: '0 24px', borderBottom: '1px solid rgba(108,155,255,.18)' }}>
        <ctx.BrandMark size={38} />
        <strong style={{ fontFamily: ctx.headingFontStack, fontSize: 20 }}>{ctx.brandName}</strong>
      </header>
      <main style={{ width: 'min(1120px, 100%)', margin: '0 auto', padding: 'clamp(48px, 9vw, 104px) 24px' }}>
        <div style={{ width: 150, height: 14, borderRadius: 999, background: 'rgba(108,155,255,.24)' }} className="vicharak-gate-pulse" />
        <div style={{ width: 'min(680px, 92%)', height: 54, marginTop: 24, borderRadius: 14, background: 'linear-gradient(90deg, rgba(0,87,255,.42), rgba(108,155,255,.2))' }} className="vicharak-gate-pulse" />
        <div style={{ width: 'min(540px, 78%)', height: 18, marginTop: 22, borderRadius: 9, background: 'rgba(169,179,212,.18)' }} className="vicharak-gate-pulse" />
        <p style={{ marginTop: 28, color: '#A9B3D4', fontSize: 14 }}>
          {opening ? 'Opening your study space…' : 'Loading your study plan…'}
        </p>
      </main>
    </div>
  );
}

class EmailGateErrorBoundary extends Component<
  { children: ReactNode; props: EmailGateProps },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[EmailGate] public entry crashed:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const brandName = this.props.props.branding?.name || 'VicharakAI';
    const logoUrl = this.props.props.branding?.logoUrl;
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: '#040817', color: '#F2F5FF', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ width: 'min(420px, 100%)', textAlign: 'center' }}>
          {logoUrl ? <img src={logoUrl} alt={brandName} width={56} height={56} decoding="async" style={{ width: 56, height: 56, objectFit: 'contain', margin: '0 auto 18px' }} /> : null}
          <h1 style={{ margin: 0, fontSize: 28 }}>{brandName}</h1>
          <p style={{ margin: '12px 0 22px', color: '#A9B3D4' }}>The page did not finish loading. Your VicharakAI space is still here.</p>
          <button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 13, padding: '13px 20px', background: 'linear-gradient(135deg,#0057FF,#003AB0)', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>
            Reload VicharakAI
          </button>
        </div>
      </div>
    );
  }
}

function EmailGateContent(props: EmailGateProps) {
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

  const routeFallback = <BrandedGateSkeleton ctx={ctx} />;

  if (seoPublicRoute?.kind === 'exam') return <Suspense fallback={routeFallback}><ExamSEOApp /></Suspense>;
  if (seoPublicRoute?.kind === 'prep-index' || seoPublicRoute?.kind === 'prep-article') return <Suspense fallback={routeFallback}><ArticlePageApp /></Suspense>;
  if (sitemapRoute) return <Suspense fallback={routeFallback}><SitemapPage brandName={brandName} logoUrl={logoUrl} /></Suspense>;

  if (examRoute) {
    return (
      <Suspense fallback={routeFallback}>
        <ExamRouteView route={examRoute} brandName={brandName} logoUrl={logoUrl} />
      </Suspense>
    );
  }

  if (compareRoute) {
    return (
      <Suspense fallback={routeFallback}>
        {compareRoute.kind === 'compare-index'
          ? <CompareIndex brandName={brandName} logoUrl={logoUrl} />
          : <ComparePage slug={compareRoute.slug} brandName={brandName} logoUrl={logoUrl} />}
      </Suspense>
    );
  }

  if (learnRoute) {
    return (
      <Suspense fallback={routeFallback}>
        {learnRoute.kind === 'article' ? (
          <ArticlePage slug={learnRoute.slug} brandName={brandName} logoUrl={logoUrl} supportEmail={ctx.SUPPORT_EMAIL} />
        ) : (
          <LearnIndex brandName={brandName} logoUrl={logoUrl} supportEmail={ctx.SUPPORT_EMAIL} />
        )}
      </Suspense>
    );
  }

  if (staticPage) {
    return (
      <Suspense fallback={routeFallback}>
        <StaticPage
          page={staticPage}
          spaceId={spaceId}
          brandName={brandName}
          logoUrl={logoUrl}
          bodyFontFamily={bodyFontStack}
          headingFontFamily={headingFontStack}
        />
      </Suspense>
    );
  }

  if (step === 'loading') return <BrandedGateSkeleton ctx={ctx} />;
  if (step === 'complete') return <BrandedGateSkeleton ctx={ctx} opening />;
  if (step === 'code') return <EmailGateCodeScreen ctx={ctx} />;
  // Legacy callers may still set `retry`; it intentionally falls through to
  // the normal landing shell so an auth outage never replaces the product page.

  return (
    <>
      {/* AUDOS:LANDING_SHELL:START */}
      <EmailGateLanding ctx={ctx} />
      {/* AUDOS:LANDING_SHELL:END */}
      {(ctx.loginOpen || ctx.legalDoc || ctx.checkoutSuccess || ctx.showInstallBanner) && (
        <Suspense fallback={null}>
          <EmailGateOverlays ctx={ctx} />
        </Suspense>
      )}
    </>
  );
}

export default function EmailGate(props: EmailGateProps) {
  return (
    <EmailGateErrorBoundary props={props}>
      <EmailGateContent {...props} />
    </EmailGateErrorBoundary>
  );
}
