import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from '../lib/supabase';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNotice(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleGoogleAuth = async () => {
    setError(null);
    setNotice(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to start Google sign-in. Ensure Google provider is enabled in Supabase Auth.'
      );
      setGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
        onClose();
      } else {
        const res = await signUpWithEmail(email.trim(), password, fullName);
        if (res.needsEmailConfirmation) {
          setNotice(
            'Account created. Check your email inbox to confirm your address, then sign in.'
          );
        } else {
          onClose();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#181715]/35 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-md border border-[#E2DDD3] bg-[#FFFFFF] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#EFECE6] px-6 py-4">
          <div>
            <h2 id="auth-modal-title" className="text-base font-semibold text-[#181715]">
              {mode === 'signin' ? 'Sign in to VayuCheck' : 'Create your VayuCheck account'}
            </h2>
            <p className="mt-0.5 text-xs text-[#5E5A52]">
              Save your city, household preferences, and daily checklist across devices.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#5E5A52] hover:bg-[#EFECE6] hover:text-[#181715] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Primary Google Sign In / Sign Up Button */}
          <button
            type="button"
            onClick={() => void handleGoogleAuth()}
            disabled={googleLoading || loading}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-[#D7D1C5] bg-[#FAF9F6] px-4 text-sm font-medium text-[#181715] transition-colors duration-150 hover:bg-[#EFECE6] disabled:opacity-60 cursor-pointer"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
            <span>
              {googleLoading
                ? 'Connecting to Google...'
                : mode === 'signin'
                  ? 'Continue with Google'
                  : 'Sign up with Google'}
            </span>
          </button>

          <div className="relative flex items-center">
            <div className="grow border-t border-[#EFECE6]" />
            <span className="mx-3 shrink-0 text-[11px] font-medium uppercase tracking-wider text-[#847F75]">
              or with email
            </span>
            <div className="grow border-t border-[#EFECE6]" />
          </div>

          {/* Mode Switch Tabs */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="grid grid-cols-2 gap-1 rounded-md bg-[#EFECE6] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              onClick={() => {
                setMode('signin');
                setError(null);
                setNotice(null);
              }}
              className={`rounded py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white text-[#181715] shadow-xs'
                  : 'text-[#5E5A52] hover:text-[#181715]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => {
                setMode('signup');
                setError(null);
                setNotice(null);
              }}
              className={`rounded py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-[#181715] shadow-xs'
                  : 'text-[#5E5A52] hover:text-[#181715]'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-3.5">
            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-medium text-[#5E5A52]">
                  Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  className="mt-1 h-10 w-full rounded-md border border-[#D7D1C5] bg-[#F7F5F0] px-3 text-sm text-[#181715] placeholder:text-[#847F75] focus:border-[#1F4E43] focus:bg-white focus:outline-none"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-[#5E5A52]">
                Email address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 h-10 w-full rounded-md border border-[#D7D1C5] bg-[#F7F5F0] px-3 text-sm text-[#181715] placeholder:text-[#847F75] focus:border-[#1F4E43] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-[#5E5A52]">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="mt-1 h-10 w-full rounded-md border border-[#D7D1C5] bg-[#F7F5F0] px-3 text-sm text-[#181715] placeholder:text-[#847F75] focus:border-[#1F4E43] focus:bg-white focus:outline-none"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-[#E2BDBD] bg-[#F9EFEF] px-3 py-2 text-xs text-[#7F1D1D]"
              >
                {error}
              </p>
            )}

            {notice && (
              <p
                role="status"
                className="rounded-md border border-[#C8DFD3] bg-[#F2F7F4] px-3 py-2 text-xs text-[#2D6A4F]"
              >
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="h-10 w-full rounded-md bg-[#1F4E43] px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#173C33] disabled:opacity-60 cursor-pointer"
            >
              {loading
                ? 'Please wait...'
                : mode === 'signin'
                  ? 'Sign in with Email'
                  : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
