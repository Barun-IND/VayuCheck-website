import { useState } from 'react';
import { ShieldCheck, Wind } from 'lucide-react';
import { signInWithGoogle } from '../lib/supabase';

interface GoogleAuthGateProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export function GoogleAuthGate({ darkMode, onToggleDarkMode }: GoogleAuthGateProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to sign in with Google. Please try again.'
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#181715] flex flex-col justify-between px-4 py-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Wind className="h-5 w-5 text-[#1F4E43]" aria-hidden="true" />
          <span className="font-display text-lg font-semibold tracking-tight text-[#181715]">
            VayuCheck
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleDarkMode}
          aria-pressed={darkMode}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to night mode'}
          className="rounded-md border border-[#D7D1C5] bg-white px-3 py-1.5 text-xs font-medium text-[#181715] hover:bg-[#EFECE6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4E43] cursor-pointer"
        >
          {darkMode ? 'Light mode' : 'Night mode'}
        </button>
      </div>

      <main className="mx-auto my-auto w-full max-w-md py-12">
        <div className="rounded-md border border-[#E2DDD3] bg-white p-7 sm:p-8 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-[#1F4E43]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>Google Account Required</span>
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#181715]">
            Sign in to VayuCheck
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#5E5A52]">
            Sign in with your Google account to access live Open-Meteo air quality forecasts, save
            your location and household profile in Supabase, and sync your Daily Hacks checklist.
          </p>

          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={loading}
            className="mt-6 flex h-11 w-full items-center justify-center gap-2.5 rounded-md bg-[#1F4E43] px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#173C33] disabled:opacity-60 cursor-pointer"
          >
            <svg
              className="h-4 w-4 shrink-0 rounded-full bg-white p-0.5"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.22 1.18-3.25 0-6-2.19-6.98-5.14H1.01v3.14C3.05 21.21 7.21 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.02 14.03c-.25-.74-.39-1.54-.39-2.36 0-.82.14-1.62.39-2.36V6.17H1.01C.37 7.45 0 8.88 0 10.37s.37 2.92 1.01 4.2l4.01-3.14Z"
                transform="translate(0 1.3)"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.8 0 3.41.62 4.68 1.83l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.05 2.79 1.01 6.87l4.01 3.14c.98-2.95 3.73-5.26 6.98-5.26Z"
              />
            </svg>
            <span>{loading ? 'Redirecting to Google...' : 'Continue with Google'}</span>
          </button>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-[#E2BDBD] bg-[#F9EFEF] px-3 py-2 text-xs text-[#7F1D1D]"
            >
              {error}
            </p>
          )}

          <p className="mt-5 border-t border-[#EFECE6] pt-4 text-xs text-[#847F75]">
            Your preferences and daily task progress are stored securely per Google account in
            Supabase.
          </p>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1240px] text-center text-xs text-[#847F75]">
        VayuCheck — Live Open-Meteo telemetry &amp; WHO 2021 air quality benchmarks
      </footer>
    </div>
  );
}
