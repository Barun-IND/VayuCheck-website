import { LogIn, LogOut, Moon, SlidersHorizontal, Sun, User as UserIcon } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface TopBarProps {
  user: User | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onOpenProfile: () => void;
}

const NAV_LINKS = [
  { href: '#overview', label: 'Overview' },
  { href: '#forecast', label: 'Forecast' },
  { href: '#planner', label: 'Activity Planner' },
  { href: '#briefing', label: 'Daily Hacks' },
];

export function TopBar({
  user,
  darkMode,
  onToggleDarkMode,
  onOpenAuth,
  onSignOut,
  onOpenProfile,
}: TopBarProps) {
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'Account';
  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined);

  return (
    <header className="sticky top-0 z-30 border-b border-[#E2DDD3] bg-[#F7F5F0]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a
          href="#overview"
          className="font-display text-lg font-semibold tracking-tight text-[#181715] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F4E43]"
        >
          VayuCheck
        </a>

        <nav
          aria-label="Primary sections"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#5E5A52]"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="py-1 whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#181715] hover:underline hover:underline-offset-6 hover:decoration-[#1F4E43] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F4E43]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to night mode'}
            aria-pressed={darkMode}
            title={darkMode ? 'Light mode' : 'Night mode'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#D7D1C5] bg-white text-[#181715] transition-colors duration-150 hover:bg-[#EFECE6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4E43] cursor-pointer"
          >
            {darkMode ? (
              <Sun className="h-4 w-4 text-[#E3B04B]" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4 text-[#5E5A52]" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenProfile}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1F4E43] px-3.5 py-2 text-sm font-medium text-white whitespace-nowrap shrink-0 transition-colors duration-150 hover:bg-[#173C33] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4E43] cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Household Profile</span>
            <span className="sm:hidden">Profile</span>
          </button>

          {user ? (
            <div className="flex items-center gap-2 rounded-md border border-[#D7D1C5] bg-white px-2.5 py-1.5">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-6 w-6 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserIcon className="h-4 w-4 text-[#1F4E43]" aria-hidden="true" />
              )}
              <span className="hidden sm:inline max-w-[120px] truncate text-xs font-medium text-[#181715]">
                {displayName}
              </span>
              <button
                type="button"
                onClick={onSignOut}
                title="Sign out"
                aria-label="Sign out"
                className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-xs font-medium text-[#5E5A52] hover:bg-[#EFECE6] hover:text-[#181715] cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden lg:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[#D7D1C5] bg-white px-3.5 py-2 text-sm font-medium text-[#181715] whitespace-nowrap shrink-0 transition-colors duration-150 hover:bg-[#EFECE6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4E43] cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5 text-[#1F4E43]" aria-hidden="true" />
              <span>Sign in</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
