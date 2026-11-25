import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { HouseholdProfile, LocationInfo } from '../types/air';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(error?.message || 'Unable to sign in.');
  }
  return data.user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName?: string
): Promise<{ user: User | null; needsEmailConfirmation: boolean }> {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
      data: fullName?.trim() ? { full_name: fullName.trim() } : undefined,
    },
  });
  if (error) {
    throw new Error(error.message);
  }
  return {
    user: data.user,
    needsEmailConfirmation: !data.session,
  };
}

export async function signOutUser(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

export async function loadAuthenticatedUserState(
  userId: string,
  commitDate: string
): Promise<{
  location?: LocationInfo;
  profile?: HouseholdProfile;
  committedIds: string[];
} | null> {
  if (!supabase) return null;

  const [profileRes, commitsRes] = await Promise.all([
    supabase
      .from('household_profiles')
      .select('location, sensitivity, commute, heating_cooking, indoor_setup, household_size')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('daily_hack_commits')
      .select('hack_id')
      .eq('user_id', userId)
      .eq('commit_date', commitDate),
  ]);

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

export async function saveAuthenticatedUserProfile(
  userId: string,
  location: LocationInfo,
  profile: HouseholdProfile
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from('household_profiles').upsert(
    {
      user_id: userId,
      location,
      sensitivity: profile.sensitivity,
      commute: profile.commute,
      heating_cooking: profile.heatingCooking,
      indoor_setup: profile.indoorSetup,
      household_size: profile.householdSize,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.warn('[Supabase Auth] Profile save failed:', error.message);
  }
}

export async function toggleAuthenticatedHackCommit(
  userId: string,
  commitDate: string,
  hackId: string,
  committed: boolean,
  meta?: {
    title?: string;
    estimatedCo2KgSaved?: number;
    estimatedExposureDropPct?: number;
  }
): Promise<void> {
  if (!supabase) return;

  if (committed) {
    const { error } = await supabase.from('daily_hack_commits').upsert(
      {
        user_id: userId,
        commit_date: commitDate,
        hack_id: hackId,
        title: meta?.title ?? null,
        estimated_co2_kg_saved: meta?.estimatedCo2KgSaved ?? 0,
        estimated_exposure_drop_pct: meta?.estimatedExposureDropPct ?? 0,
      },
      { onConflict: 'user_id,commit_date,hack_id' }
    );
    if (error) {
      console.warn('[Supabase Auth] Commit save failed:', error.message);
    }
  } else {
    const { error } = await supabase
      .from('daily_hack_commits')
      .delete()
      .eq('user_id', userId)
      .eq('commit_date', commitDate)
      .eq('hack_id', hackId);
    if (error) {
      console.warn('[Supabase Auth] Commit delete failed:', error.message);
    }
  }
}
