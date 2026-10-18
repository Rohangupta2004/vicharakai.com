/**
 * Consent logging (§17 — DPDP).
 * Every grant/revoke is appended with the policy version it was shown under.
 * Product-development consent is its own record kind, never bundled (§5).
 */
import { STORES, dbPut, dbGetAll } from './db';
import type { ConsentRecord } from './types';
import { newId } from '../lib/id';
import { nowIso } from '../lib/dates';

/** Bump when consent copy changes so new grants are logged under the new version. */
export const CONSENT_VERSION = '2026-08-29.1';

export type ConsentKind = 'dpdp_basic' | 'product_development' | 'parental' | 'notifications';

export async function logConsent(kind: ConsentKind, granted: boolean): Promise<ConsentRecord> {
  const record: ConsentRecord = {
    consent_id: newId('consent'),
    kind,
    version: CONSENT_VERSION,
    granted,
    at: nowIso(),
  };
  await dbPut(STORES.consent, record);
  return record;
}

export async function listConsents(): Promise<ConsentRecord[]> {
  const all = await dbGetAll<ConsentRecord>(STORES.consent);
  return all.sort((a, b) => a.at.localeCompare(b.at));
}

/** Latest state per kind (records are append-only; last one wins). */
export async function currentConsent(kind: ConsentKind): Promise<boolean> {
  const all = await listConsents();
  const mine = all.filter((c) => c.kind === kind);
  return mine.length > 0 ? mine[mine.length - 1].granted : false;
}
