import { useEffect, useRef, useState } from 'react';
import { LocateFixed, RefreshCw, Search, X } from 'lucide-react';
import type { LocationInfo } from '../types/air';
import { PRESET_CITIES } from '../lib/airStyle';

interface LocationToolbarProps {
  location: LocationInfo;
  observationTime?: string;
  timezone?: string;
  isLoading: boolean;
  onSelectLocation: (loc: LocationInfo) => void;
  onUseGeolocation: () => void;
  isLocating: boolean;
  geoError: string | null;
  onRefresh: () => void;
}

export function LocationToolbar({
  location,
  observationTime,
  timezone,
  isLoading,
  onSelectLocation,
  onUseGeolocation,
  isLocating,
  geoError,
  onRefresh,
}: LocationToolbarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationInfo[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { results?: LocationInfo[]; error?: string };
        if (!res.ok) {
          throw new Error(data.error || 'City lookup failed');
        }
        setResults(data.results ?? []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setSearchError(err instanceof Error ? err.message : 'Unable to search cities.');
        }
      } finally {
        setSearching(false);
      }
    }, 260);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const handleChoose = (loc: LocationInfo) => {
    onSelectLocation(loc);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (results.length > 0) {
      handleChoose(results[0]);
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
      const data = (await res.json()) as { results?: LocationInfo[]; error?: string };
      if (res.ok && data.results && data.results.length > 0) {
        handleChoose(data.results[0]);
      } else {
        setResults([]);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Unable to search cities.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <section
      aria-label="Location and observation controls"
      className="border-b border-[#E2DDD3] bg-[#FFFFFF]"
    >
      <div className="mx-auto max-w-[1240px] px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search & Geolocation Controls */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div ref={containerRef} className="relative w-full sm:w-80">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#847F75]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onFocus={() => setIsOpen(true)}
                onKeyDown={(e) => void handleSearchKeyDown(e)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsOpen(true);
                }}
                placeholder="Search any city worldwide..."
                aria-label="Search city"
                className="h-10 w-full rounded-md border border-[#D7D1C5] bg-[#F7F5F0] pl-9 pr-8 text-sm text-[#181715] placeholder:text-[#847F75] transition-colors duration-150 focus:border-[#1F4E43] focus:bg-white focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setResults([]);
                  }}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#847F75] hover:text-[#181715] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {isOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 rounded-md border border-[#E2DDD3] bg-white shadow-sm">
                  {query.trim().length < 2 ? (
                    <div className="p-2">
                      <p className="px-2.5 py-1.5 text-xs font-medium text-[#847F75]">
                        Monitored winter smog corridors
                      </p>
                      <ul className="divide-y divide-[#EFECE6]">
                        {PRESET_CITIES.map((city) => {
                          const active =
                            city.name === location.name && city.country === location.country;
                          return (
                            <li key={`${city.name}-${city.country}`}>
                              <button
                                type="button"
                                onClick={() => handleChoose(city)}
                                className={`flex w-full items-center justify-between px-2.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-[#F7F5F0] cursor-pointer ${
                                  active ? 'font-medium text-[#1F4E43]' : 'text-[#181715]'
                                }`}
                              >
                                <span>
                                  {city.name}
                                  <span className="text-[#847F75]">, {city.country}</span>
                                </span>
                                <span className="font-mono text-xs tabular-nums text-[#847F75]">
                                  {city.latitude.toFixed(2)}, {city.longitude.toFixed(2)}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : searching ? (
                    <div className="px-3.5 py-3 text-xs text-[#5E5A52]">
                      Searching Open-Meteo stations...
                    </div>
                  ) : searchError ? (
                    <div className="px-3.5 py-3 text-xs text-[#7F1D1D]">{searchError}</div>
                  ) : results.length === 0 ? (
                    <div className="px-3.5 py-3 text-xs text-[#5E5A52]">
                      No matching locations found for &ldquo;{query.trim()}&rdquo;.
                    </div>
                  ) : (
                    <ul className="max-h-64 overflow-y-auto divide-y divide-[#EFECE6] p-1">
                      {results.map((item) => (
                        <li key={`${item.name}-${item.latitude}-${item.longitude}`}>
                          <button
                            type="button"
                            onClick={() => handleChoose(item)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[#181715] transition-colors duration-150 hover:bg-[#F7F5F0] cursor-pointer"
                          >
                            <span className="truncate pr-3">
                              <span className="font-medium">{item.name}</span>
                              <span className="text-[#5E5A52]">
                                {item.admin1 ? `, ${item.admin1}` : ''}, {item.country}
                              </span>
                            </span>
                            <span className="font-mono text-xs tabular-nums text-[#847F75] shrink-0">
                              {item.latitude.toFixed(2)}°, {item.longitude.toFixed(2)}°
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onUseGeolocation}
                disabled={isLocating}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[#D7D1C5] bg-white px-3.5 py-2 text-sm font-medium text-[#181715] whitespace-nowrap shrink-0 transition-colors duration-150 hover:bg-[#F7F5F0] disabled:opacity-60 cursor-pointer"
              >
                <LocateFixed className="h-3.5 w-3.5 text-[#1F4E43]" aria-hidden="true" />
                <span>{isLocating ? 'Locating...' : 'Use my location'}</span>
              </button>

              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                aria-label="Refresh Open-Meteo data"
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[#D7D1C5] bg-white px-3 py-2 text-sm font-medium text-[#5E5A52] whitespace-nowrap shrink-0 transition-colors duration-150 hover:bg-[#F7F5F0] hover:text-[#181715] disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* Unboxed Metadata & Coordinates */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#5E5A52]">
            <span className="font-medium text-[#181715]">
              {location.name}
              {location.admin1 ? `, ${location.admin1}` : ''}, {location.country}
            </span>
            <span aria-hidden="true" className="text-[#C2BBB0]">
              ·
            </span>
            <span className="font-mono tabular-nums">
              {Math.abs(location.latitude).toFixed(2)}°{location.latitude >= 0 ? 'N' : 'S'},{' '}
              {Math.abs(location.longitude).toFixed(2)}°{location.longitude >= 0 ? 'E' : 'W'}
            </span>
            {observationTime && (
              <>
                <span aria-hidden="true" className="text-[#C2BBB0]">
                  ·
                </span>
                <span className="font-mono tabular-nums">
                  {observationTime.replace('T', ' ')} {timezone ? `(${timezone})` : ''}
                </span>
              </>
            )}
          </div>
        </div>

        {geoError && (
          <p className="mt-2.5 text-xs text-[#B84A27]" role="status">
            {geoError}
          </p>
        )}
      </div>
    </section>
  );
}
