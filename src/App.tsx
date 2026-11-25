import { useAirDashboard } from './hooks/useAirDashboard';
import { TopBar } from './components/TopBar';
import { AuthModal } from './components/AuthModal';
import { GoogleAuthGate } from './components/GoogleAuthGate';
import { LocationToolbar } from './components/LocationToolbar';
import { AirOverviewHero } from './components/AirOverviewHero';
import { ForecastChart } from './components/ForecastChart';
import { ActivityPlanner } from './components/ActivityPlanner';
import { DailyBriefingLedger } from './components/DailyBriefingLedger';
import { ProfileDrawer } from './components/ProfileDrawer';

/** Root VayuCheck dashboard shell with Google auth gate, telemetry views, and Daily Hacks ledger. */
export default function App() {
  const {
    user,
    authLoading,
    darkMode,
    toggleDarkMode,
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
  } = useAirDashboard();

  if (authLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen bg-[#F7F5F0] text-[#181715] flex items-center justify-center p-6"
      >
        <p className="text-sm font-medium text-[#5E5A52]">Checking Google session...</p>
      </div>
    );
  }

  if (!user) {
    return <GoogleAuthGate darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />;
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#181715]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[#1F4E43] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>

      <TopBar
        user={user}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
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

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[1240px] space-y-8 px-4 py-8 sm:px-6 lg:px-8 focus:outline-none"
      >
        {airError ? (
          <div role="alert" className="rounded-md border border-[#E2BDBD] bg-[#F9EFEF] p-6">
            <h1 className="text-base font-semibold text-[#7F1D1D]">Open-Meteo data unavailable</h1>
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
          <div
            role="status"
            aria-live="polite"
            className="space-y-6"
            aria-label={`Loading atmospheric observations for ${location.name}`}
          >
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
            VayuCheck — Atmospheric &amp; particulate forecasts via Open-Meteo; thresholds aligned
            with WHO 2021 Air Quality Guidelines.
          </p>
          <p className="text-[#847F75]">
            Informational civic guidance; follow local medical and municipal advisories during
            severe smog episodes.
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
