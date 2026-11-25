import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getOrCreateSessionId,
  getTodayKey,
  loadStoredCommits,
  loadStoredLocation,
  loadStoredProfile,
  loadStoredTheme,
  saveStoredCommits,
  saveStoredLocation,
  saveStoredProfile,
  saveStoredTheme,
} from '../src/lib/storage.ts';
import { DEFAULT_CITY, DEFAULT_PROFILE } from '../src/lib/airStyle.ts';

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

const originalLocalStorage = globalThis.localStorage;

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMockStorage(),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: originalLocalStorage,
    configurable: true,
    writable: true,
  });
});

describe('Local Storage Persistence & Legacy Migration', () => {
  it('saves and loads theme, session ID, location, and household profile', () => {
    assert.equal(loadStoredTheme(), false);
    saveStoredTheme(true);
    assert.equal(loadStoredTheme(), true);

    const sid1 = getOrCreateSessionId();
    const sid2 = getOrCreateSessionId();
    assert.ok(sid1.length >= 8);
    assert.equal(sid1, sid2);

    assert.equal(loadStoredLocation().name, DEFAULT_CITY.name);
    const kolkata = { name: 'Kolkata', country: 'India', latitude: 22.57, longitude: 88.36 };
    saveStoredLocation(kolkata);
    assert.equal(loadStoredLocation().name, 'Kolkata');

    assert.equal(loadStoredProfile().sensitivity, DEFAULT_PROFILE.sensitivity);
    saveStoredProfile({ ...DEFAULT_PROFILE, sensitivity: 'respiratory', householdSize: 3 });
    const loadedProfile = loadStoredProfile();
    assert.equal(loadedProfile.sensitivity, 'respiratory');
    assert.equal(loadedProfile.householdSize, 3);
  });

  it('persists commits for today and clears commits from prior dates', () => {
    const today = getTodayKey(new Date('2026-11-26T10:00:00Z'));
    const yesterday = getTodayKey(new Date('2026-11-25T10:00:00Z'));

    saveStoredCommits(['hack-1', 'hack-2'], yesterday);
    assert.deepEqual(loadStoredCommits(today), []);

    saveStoredCommits(['hack-1', 'hack-2'], today);
    assert.deepEqual(loadStoredCommits(today), ['hack-1', 'hack-2']);
  });

  it('reads legacy storage keys seamlessly when primary keys are absent', () => {
    localStorage.setItem('air_almanac_theme_v1', 'dark');
    assert.equal(loadStoredTheme(), true);
  });
});
