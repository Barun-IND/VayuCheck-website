import type { HouseholdProfile, LocationInfo } from '../types/air';
import { DEFAULT_CITY, DEFAULT_PROFILE } from './airStyle';

const KEYS = {
  location: ['vayucheck_location_v1', 'air_almanac_location_v1'],
  profile: ['vayucheck_profile_v1', 'air_almanac_profile_v1'],
  commits: ['vayucheck_commits_v1', 'air_almanac_commits_v1'],
  session: ['vayucheck_session_v1', 'air_almanac_session_v1'],
  theme: ['vayucheck_theme_v1', 'air_almanac_theme_v1'],
} as const;

function readFirstKey(keys: readonly string[]): string | null {
  try {
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value !== null) return value;
    }
  } catch {
    // localStorage unavailable (SSR or restricted browser storage)
  }
  return null;
}

function writePrimaryKey(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage quota or privacy-mode errors
  }
}

/** Returns today's UTC calendar date key formatted as YYYY-MM-DD. */
export function getTodayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Loads persisted dark/light theme preference, falling back to system color-scheme preference. */
export function loadStoredTheme(): boolean {
  const saved = readFirstKey(KEYS.theme);
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Persists the user's selected color theme. */
export function saveStoredTheme(darkMode: boolean): void {
  writePrimaryKey(KEYS.theme[0], darkMode ? 'dark' : 'light');
}

/** Retrieves an existing guest session ID or generates and stores a new one. */
export function getOrCreateSessionId(): string {
  const existing = readFirstKey(KEYS.session);
  if (existing && existing.length >= 8) return existing;

  const next =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  writePrimaryKey(KEYS.session[0], next);
  return next;
}

/** Loads the last selected city/coordinates from storage or returns DEFAULT_CITY. */
export function loadStoredLocation(): LocationInfo {
  const raw = readFirstKey(KEYS.location);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<LocationInfo>;
      if (
        typeof parsed.latitude === 'number' &&
        typeof parsed.longitude === 'number' &&
        typeof parsed.name === 'string' &&
        typeof parsed.country === 'string'
      ) {
        return parsed as LocationInfo;
      }
    } catch {
      // fall through to default
    }
  }
  return DEFAULT_CITY;
}

/** Persists the active location locally. */
export function saveStoredLocation(location: LocationInfo): void {
  writePrimaryKey(KEYS.location[0], JSON.stringify(location));
}

/** Loads the saved household profile or returns DEFAULT_PROFILE. */
export function loadStoredProfile(): HouseholdProfile {
  const raw = readFirstKey(KEYS.profile);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<HouseholdProfile>;
      return {
        sensitivity: parsed.sensitivity ?? DEFAULT_PROFILE.sensitivity,
        commute: parsed.commute ?? DEFAULT_PROFILE.commute,
        heatingCooking: parsed.heatingCooking ?? DEFAULT_PROFILE.heatingCooking,
        indoorSetup: parsed.indoorSetup ?? DEFAULT_PROFILE.indoorSetup,
        householdSize:
          typeof parsed.householdSize === 'number' && parsed.householdSize >= 1
            ? parsed.householdSize
            : DEFAULT_PROFILE.householdSize,
      };
    } catch {
      // fall through to default
    }
  }
  return DEFAULT_PROFILE;
}

/** Persists the active household profile locally. */
export function saveStoredProfile(profile: HouseholdProfile): void {
  writePrimaryKey(KEYS.profile[0], JSON.stringify(profile));
}

/** Loads today's committed Daily Hack IDs, automatically resetting previous days. */
export function loadStoredCommits(todayKey: string = getTodayKey()): string[] {
  const raw = readFirstKey(KEYS.commits);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { date?: string; ids?: string[] };
      if (parsed.date === todayKey && Array.isArray(parsed.ids)) {
        return parsed.ids;
      }
    } catch {
      // fall through to empty list
    }
  }
  return [];
}

/** Persists today's committed Daily Hack IDs locally. */
export function saveStoredCommits(ids: string[], todayKey: string = getTodayKey()): void {
  writePrimaryKey(KEYS.commits[0], JSON.stringify({ date: todayKey, ids }));
}
