import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type {
  AtmosphericSnapshot,
  BriefingRecommendation,
  DailyBriefing,
  HouseholdProfile,
  LocationInfo,
} from './types/air';
import { DEFAULT_CITY, DEFAULT_PROFILE } from './lib/airStyle';
import { fetchAtmosphericData } from '../server/openMeteo';
import {
  loadAuthenticatedUserState,
  saveAuthenticatedUserProfile,
  signOutUser,
  supabase,
  toggleAuthenticatedHackCommit,
} from './lib/supabase';
import { TopBar } from './components/TopBar';
import { AuthModal } from './components/AuthModal';
import { GoogleAuthGate } from './components/GoogleAuthGate';
import { LocationToolbar } from './components/LocationToolbar';
import { AirOverviewHero } from './components/AirOverviewHero';
import { ForecastChart } from './components/ForecastChart';
import { ActivityPlanner } from './components/ActivityPlanner';
import { DailyBriefingLedger } from './components/DailyBriefingLedger';
import { ProfileDrawer } from './components/ProfileDrawer';

const STORAGE_LOCATION_KEY = 'air_almanac_location_v1';
const STORAGE_PROFILE_KEY = 'air_almanac_profile_v1';
const STORAGE_COMMIT_KEY = 'air_almanac_commits_v1';
const STORAGE_SESSION_KEY = 'air_almanac_session_v1';
const STORAGE_THEME_KEY = 'air_almanac_theme_v1';

function loadStoredTheme(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_THEME_KEY);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_SESSION_KEY);
    if (existing && existing.length >= 8) return existing;
    const next =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(STORAGE_SESSION_KEY, next);
    return next;
  } catch {
    return `sess-${Date.now()}`;
  }
}

type BriefingSummaryResponse = Pick<
  DailyBriefing,
  'generatedAt' | 'headlineSummary' | 'inversionExplanation' | 'alert' | 'activityNotes'
>;

interface BriefingActionsResponse {
  generatedAt: string;
  recommendations: BriefingRecommendation[];
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadStoredLocation(): LocationInfo {
  try {
    const raw = localStorage.getItem(STORAGE_LOCATION_KEY);
    if (!raw) return DEFAULT_CITY;
    const parsed = JSON.parse(raw) as LocationInfo;
    if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_CITY;
}

function loadStoredProfile(): HouseholdProfile {
  try {
    const raw = localStorage.getItem(STORAGE_PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
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
    return DEFAULT_PROFILE;
  }
}

function loadStoredCommits(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_COMMIT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { date?: string; ids?: string[] };
    if (parsed.date === getTodayKey() && Array.isArray(parsed.ids)) {
      return parsed.ids;
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

export default function App() {
  const [sessionId] = useState<string>(getOrCreateSessionId);
  const [location, setLocation] = useState<LocationInfo>(loadStoredLocation);
  const [profile, setProfile] = useState<HouseholdProfile>(loadStoredProfile);
  const [committedIds, setCommittedIds] = useState<string[]>(loadStoredCommits);

  const [snapshot, setSnapshot] = useState<AtmosphericSnapshot | null>(null);
  const [airLoading, setAirLoading] = useState<boolean>(true);
  const [airError, setAirError] = useState<string | null>(null);

  const [summaryData, setSummaryData] = useState<BriefingSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);

  const [recommendations, setRecommendations] = useState<BriefingRecommendation[]>([]);
  const [actionsLoading, setActionsLoading] = useState<boolean>(false);
  const [actionsError, setActionsError] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(Boolean(supabase));
  const [darkMode, setDarkMode] = useState<boolean>(loadStoredTheme);
  const [authOpen, setAuthOpen] = useState<boolean>(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, darkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [darkMode]);
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const [isNewProfileSetup, setIsNewProfileSetup] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const hydratedUserIdRef = useRef<string | null>(null);

  const locationRef = useRef<LocationInfo>(location);
  const profileRef = useRef<HouseholdProfile>(profile);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const airAbortRef = useRef<AbortController | null>(null);
  const airSeqRef = useRef<number>(0);
  const summaryAbortRef = useRef<AbortController | null>(null);
  const summarySeqRef = useRef<number>(0);
  const actionsAbortRef = useRef<AbortController | null>(null);
  const actionsSeqRef = useRef<number>(0);

  // Track Supabase Auth session (Google OAuth & Email) and hydrate saved user state
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    const hydrateForUser = async (signedInUser: User) => {
      if (hydratedUserIdRef.current === signedInUser.id) return;
      hydratedUserIdRef.current = signedInUser.id;
      const sbState = await loadAuthenticatedUserState(signedInUser.id, getTodayKey());
      if (!active) return;
      if (!sbState || !sbState.profile) {
        // First time this user signs in: open Household Profile drawer so they choose preferences rather than defaults
        setIsNewProfileSetup(true);
        setProfileOpen(true);
        return;
      }
      setIsNewProfileSetup(false);
      if (
        sbState.location &&
        typeof sbState.location.latitude === 'number' &&
        typeof sbState.location.longitude === 'number'
      ) {
        setLocation(sbState.location);
        try {
          localStorage.setItem(STORAGE_LOCATION_KEY, JSON.stringify(sbState.location));
        } catch {
          // ignore
        }
      }
      if (sbState.profile) {
        setProfile(sbState.profile);
        try {
          localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(sbState.profile));
        } catch {
          // ignore
        }
      }
      setCommittedIds(sbState.committedIds);
      try {
        localStorage.setItem(
          STORAGE_COMMIT_KEY,
          JSON.stringify({ date: getTodayKey(), ids: sbState.committedIds })
        );
      } catch {
        // ignore
      }
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        void hydrateForUser(currentUser);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        setAuthOpen(false);
        void hydrateForUser(nextUser);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Sync saved location, profile, and today's hack commits from Supabase guest session when signed out
  useEffect(() => {
    if (user) return;
    let cancelled = false;
    fetch(
      `/api/user-state?sessionId=${encodeURIComponent(sessionId)}&date=${encodeURIComponent(
        getTodayKey()
      )}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          payload: {
            state?: {
              location?: LocationInfo;
              profile?: HouseholdProfile;
              committedIds?: string[];
            } | null;
          } | null
        ) => {
          if (cancelled || !payload?.state) return;
          const { location: sbLoc, profile: sbProf, committedIds: sbCommits } = payload.state;
          if (sbLoc && typeof sbLoc.latitude === 'number' && typeof sbLoc.longitude === 'number') {
            setLocation(sbLoc);
            try {
              localStorage.setItem(STORAGE_LOCATION_KEY, JSON.stringify(sbLoc));
            } catch {
              // ignore
            }
          }
          if (sbProf) {
            setProfile(sbProf);
            try {
              localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(sbProf));
            } catch {
              // ignore
            }
          }
          if (Array.isArray(sbCommits) && sbCommits.length > 0) {
            setCommittedIds(sbCommits);
            try {
              localStorage.setItem(
                STORAGE_COMMIT_KEY,
                JSON.stringify({ date: getTodayKey(), ids: sbCommits })
              );
            } catch {
              // ignore
            }
          }
        }
      )
      .catch(() => {
        // ignore network errors; localStorage remains active
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, user]);

  // If a prior session stored a raw "Current Location" coordinate label, upgrade it via reverse-geocode once
  useEffect(() => {
    if (location.name !== 'Current Location') return;
    let cancelled = false;
    fetch(
      `/api/reverse-geocode?lat=${encodeURIComponent(
        String(location.latitude)
      )}&lon=${encodeURIComponent(String(location.longitude))}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { location?: LocationInfo } | null) => {
        if (cancelled || !payload?.location || payload.location.name === 'Current Location') return;
        setLocation(payload.location);
        try {
          localStorage.setItem(STORAGE_LOCATION_KEY, JSON.stringify(payload.location));
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, [location.name, location.latitude, location.longitude]);

  const fetchAir = useCallback(async (loc: LocationInfo, forceRefresh = false) => {
    airAbortRef.current?.abort();
    summaryAbortRef.current?.abort();
    actionsAbortRef.current?.abort();

    const controller = new AbortController();
    airAbortRef.current = controller;
    const reqId = ++airSeqRef.current;

    setAirLoading(true);
    setAirError(null);
    setSummaryData(null);
    setRecommendations([]);
    setActionsError(null);
    setSummaryLoading(false);
    setActionsLoading(false);

    try {
      const params = new URLSearchParams({
        lat: String(loc.latitude),
        lon: String(loc.longitude),
        name: loc.name,
        country: loc.country,
      });
      if (loc.admin1) params.set('admin1', loc.admin1);
      if (forceRefresh) params.set('refresh', '1');

      const res = await fetch(`/api/air-data?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = (await res.json()) as AtmosphericSnapshot & { error?: string };
      if (!res.ok) {
        // Render's shared outbound IPs can hit Open-Meteo 429 rate limits;
        // fall back to fetching Open-Meteo directly from the user's browser.
        const clientSnapshot = await fetchAtmosphericData(loc, forceRefresh);
        if (reqId !== airSeqRef.current) return;
        setSnapshot(clientSnapshot);
        return;
      }

      if (reqId !== airSeqRef.current) return;
      setSnapshot(data);
    } catch (err) {
      if ((err as Error).name === 'AbortError' || reqId !== airSeqRef.current) {
        return;
      }
      setAirError(
        err instanceof Error
          ? err.message
          : 'Unable to load Open-Meteo atmospheric observations.'
      );
    } finally {
      if (reqId === airSeqRef.current) {
        setAirLoading(false);
      }
    }
  }, []);

  const fetchSummaryAndActions = useCallback(
    (snap: AtmosphericSnapshot, prof: HouseholdProfile, forceRefresh = false) => {
      // 1) Fast parallel call for Today's Briefing Summary, Alert & Activity Notes
      summaryAbortRef.current?.abort();
      const sController = new AbortController();
      summaryAbortRef.current = sController;
      const sReqId = ++summarySeqRef.current;
      setSummaryLoading(true);

      fetch('/api/briefing/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: snap, profile: prof, forceRefresh }),
        signal: sController.signal,
      })
        .then(async (res) => {
          const data = (await res.json()) as BriefingSummaryResponse & { error?: string };
          if (!res.ok) throw new Error(data.error || `Summary request failed (${res.status})`);
          if (sReqId !== summarySeqRef.current) return;
          setSummaryData(data);
        })
        .catch((err) => {
          if ((err as Error).name === 'AbortError' || sReqId !== summarySeqRef.current) return;
          // Surface summary error via actionsError only if actions also failed
          setActionsError((prev) => prev || (err instanceof Error ? err.message : 'Summary unavailable.'));
        })
        .finally(() => {
          if (sReqId === summarySeqRef.current) {
            setSummaryLoading(false);
          }
        });

      // 2) Fast parallel call for Tailored Daily Routines, Indoor Air Hacks & Sustainable Alternatives
      actionsAbortRef.current?.abort();
      const aController = new AbortController();
      actionsAbortRef.current = aController;
      const aReqId = ++actionsSeqRef.current;
      setActionsLoading(true);
      setActionsError(null);

      fetch('/api/briefing/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: snap, profile: prof, forceRefresh }),
        signal: aController.signal,
      })
        .then(async (res) => {
          const data = (await res.json()) as BriefingActionsResponse & { error?: string };
          if (!res.ok) throw new Error(data.error || `Actions request failed (${res.status})`);
          if (aReqId !== actionsSeqRef.current) return;
          setRecommendations(data.recommendations ?? []);
        })
        .catch((err) => {
          if ((err as Error).name === 'AbortError' || aReqId !== actionsSeqRef.current) return;
          setActionsError(
            err instanceof Error
              ? err.message
              : 'Unable to generate daily guidance right now.'
          );
        })
        .finally(() => {
          if (aReqId === actionsSeqRef.current) {
            setActionsLoading(false);
          }
        });
    },
    []
  );

  // Fetch live Open-Meteo data when signed in & location changes, and auto-refresh every 10 minutes
  useEffect(() => {
    if (!user) return;
    void fetchAir(location, false);
    const refreshTimer = window.setInterval(() => {
      void fetchAir(location, true);
    }, 10 * 60 * 1000);
    return () => {
      window.clearInterval(refreshTimer);
      airAbortRef.current?.abort();
    };
  }, [user, location, fetchAir]);

  // Automatically regenerate structured summary + actions in parallel whenever snapshot or profile updates
  useEffect(() => {
    if (!user || !snapshot) return;
    fetchSummaryAndActions(snapshot, profile, false);
    return () => {
      summaryAbortRef.current?.abort();
      actionsAbortRef.current?.abort();
    };
  }, [user, snapshot, profile, fetchSummaryAndActions]);

  const syncProfileToSupabase = useCallback(
    (nextLoc: LocationInfo, nextProf: HouseholdProfile) => {
      if (user) {
        void saveAuthenticatedUserProfile(user.id, nextLoc, nextProf);
        return;
      }
      fetch('/api/user-state/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, location: nextLoc, profile: nextProf }),
      }).catch(() => {
        // non-blocking; localStorage already persisted
      });
    },
    [sessionId, user]
  );

  const handleSelectLocation = (nextLoc: LocationInfo) => {
    airAbortRef.current?.abort();
    summaryAbortRef.current?.abort();
    actionsAbortRef.current?.abort();
    setGeoError(null);
    setSnapshot(null);
    setSummaryData(null);
    setRecommendations([]);
    setActionsError(null);
    setLocation(nextLoc);
    try {
      localStorage.setItem(STORAGE_LOCATION_KEY, JSON.stringify(nextLoc));
    } catch {
      // ignore
    }
    syncProfileToSupabase(nextLoc, profile);
  };

  const handleSaveProfile = (nextProfile: HouseholdProfile) => {
    setProfile(nextProfile);
    setIsNewProfileSetup(false);
    try {
      localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(nextProfile));
    } catch {
      // ignore
    }
    syncProfileToSupabase(location, nextProfile);
  };

  const handleToggleCommit = (id: string) => {
    const rec = recommendations.find((r) => r.id === id);
    const willCommit = !committedIds.includes(id);
    setCommittedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem(
          STORAGE_COMMIT_KEY,
          JSON.stringify({ date: getTodayKey(), ids: next })
        );
      } catch {
        // ignore
      }
      return next;
    });

    const meta = rec
      ? {
          title: rec.title,
          estimatedCo2KgSaved: rec.estimatedCo2KgSaved,
          estimatedExposureDropPct: rec.estimatedExposureDropPct,
        }
      : undefined;

    if (user) {
      void toggleAuthenticatedHackCommit(user.id, getTodayKey(), id, willCommit, meta);
      return;
    }

    fetch('/api/user-state/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        date: getTodayKey(),
        hackId: id,
        committed: willCommit,
        meta,
      }),
    }).catch(() => {
      // non-blocking; localStorage already persisted
    });
  };

  const handleSignOut = () => {
    void signOutUser().then(() => {
      hydratedUserIdRef.current = null;
      setIsNewProfileSetup(false);
      setProfileOpen(false);
      setUser(null);
    });
  };

  const handleUseGeolocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoError('Browser geolocation is not supported on this device. Use city search instead.');
      return;
    }
    setIsLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let resolved: LocationInfo = {
          name: 'Current Location',
          country: `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? 'N' : 'S'}, ${Math.abs(
            longitude
          ).toFixed(2)}°${longitude >= 0 ? 'E' : 'W'}`,
          latitude,
          longitude,
        };

        try {
          const res = await fetch(
            `/api/reverse-geocode?lat=${encodeURIComponent(
              String(latitude)
            )}&lon=${encodeURIComponent(String(longitude))}`
          );
          if (res.ok) {
            const payload = (await res.json()) as { location?: LocationInfo };
            if (payload.location) {
              resolved = payload.location;
            }
          }
        } catch {
          // fallback to coordinate label
        }

        handleSelectLocation(resolved);
        setIsLocating(false);
      },
      (err) => {
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was declined. Search your city (e.g., Kolkata) in the search box above.'
            : 'Unable to determine your coordinates. Search your city above to load its live forecast.'
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const combinedBriefing: DailyBriefing | null =
    summaryData || recommendations.length > 0
      ? {
          generatedAt: summaryData?.generatedAt ?? new Date().toISOString(),
          headlineSummary: summaryData?.headlineSummary ?? '',
          inversionExplanation: summaryData?.inversionExplanation ?? '',
          alert: summaryData?.alert ?? {
            active: false,
            severityLabel: snapshot?.current.bandLabel ?? '',
            headline: snapshot?.current.advisorySummary ?? '',
            immediateActions: [],
          },
          activityNotes: summaryData?.activityNotes ?? [],
          recommendations,
        }
      : null;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F7F5F0] text-[#181715] flex items-center justify-center p-6">
        <p className="text-sm font-medium text-[#5E5A52]">Checking Google session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <GoogleAuthGate
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#181715]">
      <TopBar
        user={user}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        onOpenAuth={() => setAuthOpen(true)}
        onSignOut={handleSignOut}
        onOpenProfile={() => setProfileOpen(true)}
      />

      <LocationToolbar
        location={location}
        observationTime={snapshot?.current.time}
        timezone={snapshot?.timezone}
        isLoading={airLoading}
        onSelectLocation={handleSelectLocation}
        onUseGeolocation={handleUseGeolocation}
        isLocating={isLocating}
        geoError={geoError}
        onRefresh={() => void fetchAir(location, true)}
      />

      <main className="mx-auto max-w-[1240px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {airError ? (
          <div
            role="alert"
            className="rounded-md border border-[#E2BDBD] bg-[#F9EFEF] p-6"
          >
            <h1 className="text-base font-semibold text-[#7F1D1D]">
              Open-Meteo data unavailable
            </h1>
            <p className="mt-1 text-sm text-[#5E5A52]">{airError}</p>
            <button
              type="button"
              onClick={() => void fetchAir(location, true)}
              className="mt-4 inline-flex h-10 items-center rounded-md bg-[#181715] px-4 py-2 text-sm font-medium text-white hover:bg-[#33312E] cursor-pointer"
            >
              Retry forecast fetch
            </button>
          </div>
        ) : airLoading && !snapshot ? (
          <div className="space-y-6" aria-label={`Loading atmospheric observations for ${location.name}`}>
            <p className="text-xs font-medium text-[#5E5A52]">
              Loading live Open-Meteo readings for {location.name}...
            </p>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7 h-72 rounded-md border border-[#E2DDD3] bg-white p-6 space-y-4">
                <div className="h-5 w-48 rounded bg-[#EFECE6]" />
                <div className="h-14 w-32 rounded bg-[#EFECE6]" />
                <div className="h-4 w-full rounded bg-[#F7F5F0]" />
                <div className="h-4 w-3/4 rounded bg-[#F7F5F0]" />
              </div>
              <div className="lg:col-span-5 h-72 rounded-md border border-[#E2DDD3] bg-white p-6 space-y-3">
                <div className="h-5 w-40 rounded bg-[#EFECE6]" />
                <div className="h-7 w-full rounded bg-[#F7F5F0]" />
                <div className="h-7 w-full rounded bg-[#F7F5F0]" />
                <div className="h-7 w-full rounded bg-[#F7F5F0]" />
                <div className="h-7 w-full rounded bg-[#F7F5F0]" />
              </div>
            </div>
            <div className="h-80 rounded-md border border-[#E2DDD3] bg-white p-6" />
          </div>
        ) : snapshot ? (
          <>
            <AirOverviewHero
              snapshot={snapshot}
              briefing={summaryData ? combinedBriefing : null}
              briefingLoading={summaryLoading}
            />

            <ForecastChart
              key={`${snapshot.location.latitude.toFixed(3)}-${snapshot.location.longitude.toFixed(3)}`}
              hourly={snapshot.hourly}
              currentTime={snapshot.current.time}
            />

            <ActivityPlanner
              activities={snapshot.activities}
              activityNotes={summaryData?.activityNotes ?? []}
            />

            <DailyBriefingLedger
              locationName={snapshot.location.name}
              briefing={combinedBriefing}
              loading={actionsLoading}
              error={actionsError}
              profile={profile}
              committedIds={committedIds}
              onToggleCommit={handleToggleCommit}
              onRetry={() => fetchSummaryAndActions(snapshot, profile, true)}
              onOpenProfile={() => setProfileOpen(true)}
            />
          </>
        ) : null}
      </main>

      <footer className="mt-8 border-t border-[#E2DDD3] bg-[#F7F5F0]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-4 py-6 text-xs text-[#5E5A52] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            VayuCheck — Atmospheric &amp; particulate forecasts via Open-Meteo; thresholds aligned with WHO 2021 Air Quality Guidelines.
          </p>
          <p className="text-[#847F75]">
            Informational civic guidance; follow local medical and municipal advisories during severe smog episodes.
          </p>
        </div>
      </footer>

      <ProfileDrawer
        open={profileOpen}
        profile={profile}
        isOnboarding={isNewProfileSetup}
        onClose={() => setProfileOpen(false)}
        onSave={handleSaveProfile}
      />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
