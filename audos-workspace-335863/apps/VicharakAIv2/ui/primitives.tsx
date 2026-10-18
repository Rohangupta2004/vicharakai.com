/** Small reusable UI primitives. Every interactive element ≥ 44px (§15). */
import React from 'react';
import {
  ACCENT,
  BORDER,
  CARD,
  ON_ACCENT,
  RADIUS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  TOUCH,
} from './tokens';

type ButtonVariant = 'primary' | 'ghost' | 'danger';

export function Button(props: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  full?: boolean;
  testId?: string;
}) {
  const { children, onClick, variant = 'primary', disabled, full, testId } = props;
  const styles: Record<ButtonVariant, React.CSSProperties> = {
    primary: { background: ACCENT, color: ON_ACCENT, border: 'none' },
    ghost: { background: 'transparent', color: TEXT_SECONDARY, border: `1px solid ${BORDER}` },
    danger: {
      background: 'transparent',
      color: 'var(--space-semantic-danger-600, #f87171)',
      border: `1px solid ${BORDER}`,
    },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      style={{
        minHeight: TOUCH,
        padding: '0 18px',
        borderRadius: RADIUS.control,
        fontSize: 15,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        width: full ? '100%' : undefined,
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

export function SectionTitle(props: { children: React.ReactNode }) {
  return (
    <h2 style={{ margin: '20px 0 10px', fontSize: 13, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: TEXT_MUTED }}>
      {props.children}
    </h2>
  );
}

export function Card(props: { children: React.ReactNode; onClick?: () => void; testId?: string }) {
  return (
    <div
      onClick={props.onClick}
      data-testid={props.testId}
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: RADIUS.card,
        padding: 14,
        cursor: props.onClick ? 'pointer' : undefined,
      }}
    >
      {props.children}
    </div>
  );
}

export function Pill(props: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: RADIUS.chip,
        fontSize: 11,
        fontWeight: 700,
        color: props.color ?? TEXT_SECONDARY,
        border: `1px solid ${BORDER}`,
      }}
    >
      {props.children}
    </span>
  );
}

export function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: TEXT_SECONDARY, marginBottom: 6 }}>
        {props.label}
      </span>
      {props.children}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: TOUCH,
  padding: '10px 12px',
  borderRadius: RADIUS.control,
  border: `1px solid ${BORDER}`,
  background: 'transparent',
  color: TEXT,
  fontSize: 15,
  boxSizing: 'border-box',
};

export function CheckRow(props: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <label
      data-testid={props.testId}
      style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: TOUCH, padding: '10px 0', cursor: 'pointer' }}
    >
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        style={{ width: 22, height: 22, marginTop: 1, accentColor: ACCENT, flexShrink: 0 }}
      />
      <span style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_SECONDARY }}>{props.children}</span>
    </label>
  );
}

export function EmptyState(props: { title: string; hint?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '36px 20px', color: TEXT_MUTED }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT_SECONDARY }}>{props.title}</p>
      {props.hint ? <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.5 }}>{props.hint}</p> : null}
    </div>
  );
}
