/**
 * Session/name helpers shared by the data provider, access feature and
 * greeting copy. Extracted verbatim from App.tsx.
 */
import { getSystemDate } from '../systemDate';

const GENERIC_EMAIL_WORDS = new Set([
  'info', 'hello', 'contact', 'admin', 'test', 'mail', 'email', 'support',
  'student', 'user', 'guest', 'team', 'the', 'and', 'study', 'exam',
]);

function cleanNameWord(raw: string): string | null {
  const word = (raw ?? '').trim().split(/\s+/)[0];
  if (!/^[a-zA-Z]{2,}$/.test(word)) return null;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** The stored space session for this space (EmailGate writes it). */
export function readStoredSession(spaceId: string): Record<string, unknown> | null {
  try {
    const stored = localStorage.getItem(`space_session_${spaceId}`);
    return stored ? (JSON.parse(stored) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The signed-in student's email, lowercased — '' when not available. */
export function readSessionEmail(spaceId: string): string {
  const session = readStoredSession(spaceId);
  const email = typeof session?.email === 'string' ? (session.email ?? '').trim().toLowerCase() : '';
  return email.includes('@') ? email : '';
}

export function deriveStudentName(spaceId: string, sessionMetadata: Record<string, unknown>): string | null {
  for (const key of ['firstName', 'first_name', 'name']) {
    const v = sessionMetadata[key];
    if (typeof v === 'string' && (v ?? '').trim()) {
      const cleaned = cleanNameWord(v);
      if (cleaned) return cleaned;
    }
  }
  const session = readStoredSession(spaceId);
  if (!session) return null;
  const metadata = (session.metadata as Record<string, unknown> | undefined) ?? {};
  for (const v of [session.firstName, session.name, metadata.firstName, metadata.name]) {
    if (typeof v === 'string' && (v ?? '').trim()) {
      const cleaned = cleanNameWord(v);
      if (cleaned) return cleaned;
    }
  }
  if (typeof session.email === 'string' && session.email.includes('@')) {
    const token = session.email
      .split('@')[0]
      .split(/[._\-+0-9]+/)
      .find((t: string) => /^[a-zA-Z]{3,}$/.test(t) && !GENERIC_EMAIL_WORDS.has(t.toLowerCase()));
    if (token) return cleanNameWord(token);
  }
  return null;
}

export function timeOfDayGreeting(name: string | null): string {
  const hour = getSystemDate().getHours();
  const part = hour < 5 ? 'Studying late' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name} \uD83D\uDC4B` : `${part} \uD83D\uDC4B`;
}
