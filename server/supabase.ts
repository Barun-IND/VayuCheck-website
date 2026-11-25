import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AtmosphericSnapshot,
  HouseholdProfile,
  LocationInfo,
} from '../src/types/air.ts';

let client: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    client = null;
    return null;
  }

  client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return client;
}

export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  projectUrl?: string;
  error?: string;
}> {
  const sb = getSupabaseClient();
  if (!sb) {
    return { connected: false, error: 'Supabase environment variables are not configured.' };
  }

  const { error } = await sb.from('air_observations').select('id').limit(1);
  if (error) {
    return { connected: false, error: error.message };
  }

  return {
    connected: true,
    projectUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  };
}

export async function logAirObservation(snapshot: AtmosphericSnapshot): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  const { error } = await sb.from('air_observations').insert({
    location_name: snapshot.location.name,
    country: snapshot.location.country,
    latitude: snapshot.location.latitude,
    longitude: snapshot.location.longitude,
    us_aqi: snapshot.current.usAqi,
    european_aqi: snapshot.current.europeanAqi,
    pm25: snapshot.current.pm25,
    pm10: snapshot.current.pm10,
    no2: snapshot.current.no2,
    o3: snapshot.current.o3,
    temperature: snapshot.current.temperature,
    humidity: snapshot.current.humidity,
    wind_speed: snapshot.current.windSpeed,
    visibility_km: snapshot.current.visibilityKm,
    fog_index: snapshot.current.fogIndex,
    inversion_risk: snapshot.inversion.risk,
  });

  if (error) {
    console.warn('[Supabase] Failed to log air observation:', error.message);
  }
}

export async function getUserState(
  sessionId: string,
  commitDate: string
): Promise<{
  location?: LocationInfo;
  profile?: HouseholdProfile;
  committedIds: string[];
} | null> {
  const sb = getSupabaseClient();
  if (!sb || sessionId.length < 8) return null;

  const [profileRes, commitsRes] = await Promise.all([
    sb
      .from('household_profiles')
      .select('location, sensitivity, commute, heating_cooking, indoor_setup, household_size')
      .eq('session_id', sessionId)
      .maybeSingle(),
    sb
      .from('daily_hack_commits')
      .select('hack_id')
      .eq('session_id', sessionId)
      .eq('commit_date', commitDate),
  ]);

  if (profileRes.error) {
    console.warn('[Supabase] Failed to fetch profile:', profileRes.error.message);
  }
  if (commitsRes.error) {
    console.warn('[Supabase] Failed to fetch commits:', commitsRes.error.message);
  }

  const row = profileRes.data;
  const committedIds = (commitsRes.data ?? []).map((r: { hack_id: string }) => r.hack_id);

  if (!row && committedIds.length === 0) {
    return null;
  }

  return {
    location: row?.location as LocationInfo | undefined,
    profile: row
      ? {
          sensitivity: row.sensitivity as HouseholdProfile['sensitivity'],
          commute: row.commute as HouseholdProfile['commute'],
          heatingCooking: row.heating_cooking as HouseholdProfile['heatingCooking'],
          indoorSetup: row.indoor_setup as HouseholdProfile['indoorSetup'],
          householdSize: row.household_size as number,
        }
      : undefined,
    committedIds,
  };
}

export async function saveHouseholdProfile(
  sessionId: string,
  location: LocationInfo,
  profile: HouseholdProfile
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb || sessionId.length < 8) return;

  const { error } = await sb.from('household_profiles').upsert(
    {
      session_id: sessionId,
      location,
      sensitivity: profile.sensitivity,
      commute: profile.commute,
      heating_cooking: profile.heatingCooking,
      indoor_setup: profile.indoorSetup,
      household_size: profile.householdSize,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'session_id' }
  );

  if (error) {
    throw new Error(`Supabase profile save failed: ${error.message}`);
  }
}

export async function toggleHackCommit(
  sessionId: string,
  commitDate: string,
  hackId: string,
  committed: boolean,
  meta?: {
    title?: string;
    estimatedCo2KgSaved?: number;
    estimatedExposureDropPct?: number;
  }
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb || sessionId.length < 8) return;

  if (committed) {
    const { error } = await sb.from('daily_hack_commits').upsert(
      {
        session_id: sessionId,
        commit_date: commitDate,
        hack_id: hackId,
        title: meta?.title ?? null,
        estimated_co2_kg_saved: meta?.estimatedCo2KgSaved ?? 0,
        estimated_exposure_drop_pct: meta?.estimatedExposureDropPct ?? 0,
      },
      { onConflict: 'session_id,commit_date,hack_id' }
    );
    if (error) {
      throw new Error(`Supabase commit save failed: ${error.message}`);
    }
  } else {
    const { error } = await sb
      .from('daily_hack_commits')
      .delete()
      .eq('session_id', sessionId)
      .eq('commit_date', commitDate)
      .eq('hack_id', hackId);
    if (error) {
      throw new Error(`Supabase commit delete failed: ${error.message}`);
    }
  }
}
