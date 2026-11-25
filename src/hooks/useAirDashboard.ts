import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type {
  AtmosphericSnapshot,
  BriefingRecommendation,
  DailyBriefing,
  HouseholdProfile,
  LocationInfo,
} from '../types/air';
import { fetchAtmosphericData } from '../../server/openMeteo';
import {
  loadAuthenticatedUserState,
  saveAuthenticatedUserProfile,
  signOutUser,
  supabase,
  toggleAuthenticatedHackCommit,
} from '../lib/supabase';
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
} from '../lib/storage';

export type BriefingSummaryResponse = Pick<
  DailyBriefing,
  'generatedAt' | 'headlineSummary' | 'inversionExplanation' | 'alert' | 'activityNotes'
>;

interface BriefingActionsResponse {
  generatedAt: string;
  recommendations: BriefingRecommendation[];
}

function isValidCoords(loc?: Partial<LocationInfo> | null): loc is LocationInfo {
  return Boolean(loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number');
}

/** Centralizes authentication, location, live telemetry, Gemini briefings, and Supabase sync. */
export function useAirDashboard() {
  const [sessionId] = useState<string>(getOrCreateSessionId);
  const [location, setLocation] = useState<LocationInfo>(loadStoredLocation);
  const [profile, setProfile] = useState<HouseholdProfile>(loadStoredProfile);
  const [committedIds, setCommittedIds] = useState<string[]>(() => loadStoredCommits());

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
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const [isNewProfileSetup, setIsNewProfileSetup] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const hydratedUserIdRef = useRef<string | null>(null);
  const airAbortRef = useRef<AbortController | null>(null);
  const airSeqRef = useRef<number>(0);
  const summaryAbortRef = useRef<AbortController | null>(null);
  const summarySeqRef = useRef<number>(0);
  const actionsAbortRef = useRef<AbortController | null>(null);
  const actionsSeqRef = useRef<number>(0);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    saveStoredTheme(darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    const hydrateForUser = async (signedInUser: User) => {
      if (hydratedUserIdRef.current === signedInUser.id) return;
      hydratedUserIdRef.current = signedInUser.id;
      const sbState = await loadAuthenticatedUserState(signedInUser.id, getTodayKey());
      if (!active) return;

      if (!sbState || !sbState.profile) {
        setIsNewProfileSetup(true);
        setProfileOpen(true);
        return;
      }

      setIsNewProfileSetup(false);
      if (isValidCoords(sbState.location)) {
        setLocation(sbState.location);
        saveStoredLocation(sbState.location);
      }
      setProfile(sbState.profile);
      saveStoredProfile(sbState.profile);
      setCommittedIds(sbState.committedIds);
      saveStoredCommits(sbState.committedIds);
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) void hydrateForUser(currentUser);
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
          if (isValidCoords(sbLoc)) {
            setLocation(sbLoc);
            saveStoredLocation(sbLoc);
          }
          if (sbProf) {
            setProfile(sbProf);
            saveStoredProfile(sbProf);
          }
          if (Array.isArray(sbCommits) && sbCommits.length > 0) {
            setCommittedIds(sbCommits);
            saveStoredCommits(sbCommits);
          }
        }
      )
      .catch(() => {
        // non-blocking; localStorage remains active
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, user]);

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
        saveStoredLocation(payload.location);
      })
      .catch(() => {
        // keep coordinate fallback
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
        const clientSnapshot = await fetchAtmosphericData(loc, forceRefresh);
        if (reqId !== airSeqRef.current) return;
        setSnapshot(clientSnapshot);
        return;
      }

      if (reqId !== airSeqRef.current) return;
      setSnapshot(data);
    } catch (err) {
      if ((err as Error).name === 'AbortError' || reqId !== airSeqRef.current) return;
      setAirError(
        err instanceof Error ? err.message : 'Unable to load Open-Meteo atmospheric observations.'
      );
    } finally {
      if (reqId === airSeqRef.current) setAirLoading(false);
    }
  }, []);

  const fetchSummaryAndActions = useCallback(
    (snap: AtmosphericSnapshot, prof: HouseholdProfile, forceRefresh = false) => {
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
          setActionsError((prev) => prev || (err instanceof Error ? err.message : 'Summary unavailable.'));
        })
        .finally(() => {
          if (sReqId === summarySeqRef.current) setSummaryLoading(false);
        });

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
            err instanceof Error ? err.message : 'Unable to generate daily guidance right now.'
          );
        })
        .finally(() => {
          if (aReqId === actionsSeqRef.current) setActionsLoading(false);
        });
    },
    []
  );

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
    saveStoredLocation(nextLoc);
    syncProfileToSupabase(nextLoc, profile);
  };

  const handleSaveProfile = (nextProfile: HouseholdProfile) => {
    setProfile(nextProfile);
    setIsNewProfileSetup(false);
    saveStoredProfile(nextProfile);
    syncProfileToSupabase(location, nextProfile);
  };

  const handleToggleCommit = (id: string) => {
    const rec = recommendations.find((r) => r.id === id);
    const willCommit = !committedIds.includes(id);
    setCommittedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      saveStoredCommits(next);
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
            if (payload.location) resolved = payload.location;
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

  return {
    user,
    authLoading,
    darkMode,
    toggleDarkMode: () => setDarkMode((prev) => !prev),
    authOpen,
    setAuthOpen,
    location,
    profile,
    committedIds,
    snapshot,
    airLoading,
    airError,
    summaryData,
    summaryLoading,
    actionsLoading,
    actionsError,
    combinedBriefing,
    profileOpen,
    setProfileOpen,
    isNewProfileSetup,
    isLocating,
    geoError,
    fetchAir,
    fetchSummaryAndActions,
    handleSelectLocation,
    handleSaveProfile,
    handleToggleCommit,
    handleSignOut,
    handleUseGeolocation,
  };
}
