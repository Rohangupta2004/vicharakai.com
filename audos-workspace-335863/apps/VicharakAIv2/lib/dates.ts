/** Local-date helpers. All scheduling uses local calendar dates (YYYY-MM-DD). */

export function nowIso(): string {
  return new Date().toISOString();
}

/** Today as a local YYYY-MM-DD string (NOT UTC — students plan in local time). */
export function todayIso(): string {
  return toDateIso(new Date());
}

export function toDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysIso(dateIso: string, days: number): string {
  const d = parseDateIso(dateIso);
  d.setDate(d.getDate() + days);
  return toDateIso(d);
}

export function parseDateIso(dateIso: string): Date {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(aIso: string, bIso: string): number {
  const ms = parseDateIso(bIso).getTime() - parseDateIso(aIso).getTime();
  return Math.round(ms / 86400000);
}

export function isOverdue(dueIso: string | null): boolean {
  return !!dueIso && dueIso < todayIso();
}

export function isDueTodayOrEarlier(dueIso: string | null): boolean {
  return !!dueIso && dueIso <= todayIso();
}

/** Days elapsed between two full ISO timestamps, fractional. */
export function elapsedDays(fromIso: string, toIsoTs: string): number {
  return Math.max(0, (new Date(toIsoTs).getTime() - new Date(fromIso).getTime()) / 86400000);
}
