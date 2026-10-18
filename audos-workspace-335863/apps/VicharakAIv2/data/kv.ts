/** Key-value store access: profile, settings, and small engine state blobs. */
import { STORES, dbGet, dbPut } from './db';
import type { Profile } from './types';
import { nowIso } from '../lib/dates';

interface KvRow<T> {
  key: string;
  value: T;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const row = (await dbGet<KvRow<T>>(STORES.kv, key)) as KvRow<T> | undefined;
  return row?.value;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  await dbPut(STORES.kv, { key, value });
}

/* ---- Profile ---- */

const PROFILE_KEY = 'profile';

export function emptyProfile(): Profile {
  return {
    birth_year: null,
    is_minor: false,
    parental_consent_at: null,
    exam_id: null,
    exam_date: null,
    onboarding_complete: false,
    onboarding_completed_at: null,
    created_at: nowIso(),
  };
}

export async function getProfile(): Promise<Profile> {
  return (await kvGet<Profile>(PROFILE_KEY)) ?? emptyProfile();
}

export async function saveProfile(patch: Partial<Profile>): Promise<Profile> {
  const next = { ...(await getProfile()), ...patch };
  await kvSet(PROFILE_KEY, next);
  return next;
}
