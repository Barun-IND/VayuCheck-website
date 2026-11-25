import { useMemo } from 'react';
import { Eye, Wind, Radio, Activity } from 'lucide-react';
import type { LocationInfo } from '../types/air';

interface WindFogRadarMapProps {
  location: LocationInfo;
  windSpeed: number; // km/h
  windDirection?: number; // degrees 0-360
  visibilityKm: number; // km
  fogIndex: number; // 0-100
  humidity: number; // %
}

// Convert degrees to cardinal compass string
function getCompassHeading(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((deg % 360) / 45)) % 8;
  return directions[index] ?? 'N';
}

export function WindFogRadarMap({
  location,
  windSpeed,
  windDirection = 180,
  visibilityKm,
  fogIndex,
  humidity,
}: WindFogRadarMapProps) {
  const cardinal = getCompassHeading(windDirection);

  // Normalized wind and fog parameters
  const windVectorSpeed = Math.max(0.5, 2.8 - Math.min(30, windSpeed) * 0.08);
  const isStagnant = windSpeed < 6;
  const isDenseFog = fogIndex >= 65 || visibilityKm < 2.5;
  const isModerateFog = (fogIndex >= 35 || visibilityKm < 5) && !isDenseFog;

  const fogSeverity = isDenseFog
    ? { label: 'Dense Fog Trapping', color: '#B84A27', bg: 'bg-[#B84A27]/10', border: 'border-[#B84A27]/30' }
    : isModerateFog
      ? { label: 'Hazy Mist / Inversion', color: '#9A6B16', bg: 'bg-[#9A6B16]/10', border: 'border-[#9A6B16]/30' }
      : { label: 'Clear Atmosphere', color: '#2D6A4F', bg: 'bg-[#2D6A4F]/10', border: 'border-[#2D6A4F]/30' };

  // Calculate flow vector angle (wind blowing towards direction)
  const angleRad = ((windDirection - 90) * Math.PI) / 180;
  const arrowDx = Math.cos(angleRad) * 42;
  const arrowDy = Math.sin(angleRad) * 42;

  // Concentric radar rings (representing 5km, 10km, 15km, 20km)
  const radarRings = [28, 56, 84, 110];

  // Particle paths along the wind vector
  const windParticles = useMemo(() => {
    return Array.from({ length: 9 }).map((_, i) => ({
      id: i,
      delay: (i * 0.32) % 2.5,
      offset: (i * 22 - 88),
    }));
  }, []);

  return (
    <div className="relative overflow-hidden rounded-md border border-[#E2DDD3] bg-gradient-to-r from-[#FAF9F6] via-[#F5F2EB] to-[#EFECE4] p-3.5 sm:p-4 shadow-2xs">
      {/* Top Header Strip: Location Radar Title & Live Status Tag */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2DDD3]/80 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-[#1F4E43]/10 text-[#1F4E43]">
            <Radio className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
          </div>
          <span className="font-semibold text-xs tracking-tight text-[#181715] truncate">
            {location.name} Wind Flow &amp; Fog Radar Field
          </span>
          <span className="hidden sm:inline-block font-mono text-[10px] text-[#847F75]">
            ({location.latitude.toFixed(2)}°N, {location.longitude.toFixed(2)}°E)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold tracking-wider ${fogSeverity.bg} ${fogSeverity.border}`}
            style={{ color: fogSeverity.color }}
          >
            ● {fogSeverity.label}
          </span>
          <span className="hidden md:inline-block rounded bg-white/80 px-1.5 py-0.5 font-mono text-[9px] text-[#847F75] border border-[#E2DDD3]">
            Open-Meteo Live Vector
          </span>
        </div>
      </div>

      {/* Main Horizontal Body: Radar Scope on Left, Telemetry Dashboard on Right */}
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-12 md:items-center">
        {/* Left Side: SVG Circular Radar Scope (md:col-span-5) */}
        <div className="relative md:col-span-5 flex h-36 w-full items-center justify-center overflow-hidden rounded-md border border-[#E2DDD3] bg-white/80 backdrop-blur-xs">
          {/* Animated Fog Density Radial Cloud */}
          <div
            className="pointer-events-none absolute inset-0 transition-opacity duration-700"
            style={{
              opacity: Math.max(0.18, Math.min(0.85, fogIndex / 100)),
              background:
                'radial-gradient(ellipse at 50% 50%, rgba(210, 200, 185, 0.8) 0%, rgba(225, 220, 210, 0.5) 55%, transparent 88%)',
              filter: 'blur(10px)',
            }}
          />

          {/* Radar Sweep Effect */}
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              background:
                'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(31, 78, 67, 0.4) 30deg, transparent 60deg)',
              animation: 'spin 6s linear infinite',
            }}
          />

          {/* SVG Atmospheric Grid & Radar Compass */}
          <svg
            viewBox="-130 -65 260 130"
            className="pointer-events-none absolute inset-0 h-full w-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="vectorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1F4E43" stopOpacity="0.2" />
                <stop offset="60%" stopColor="#1F4E43" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#181715" stopOpacity="1" />
              </linearGradient>
              <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#1F4E43" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#1F4E43" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Concentric distance radar rings */}
            {radarRings.map((r, idx) => (
              <circle
                key={r}
                cx="0"
                cy="0"
                r={r}
                fill="none"
                stroke="#D6D0C4"
                strokeWidth="0.8"
                strokeDasharray={idx === 1 ? '3 3' : undefined}
                opacity="0.9"
              />
            ))}

            {/* Cardinal coordinate axes */}
            <line x1="-120" y1="0" x2="120" y2="0" stroke="#D6D0C4" strokeWidth="0.8" />
            <line x1="0" y1="-60" x2="0" y2="60" stroke="#D6D0C4" strokeWidth="0.8" />

            {/* Compass direction labels */}
            <text x="0" y="-50" textAnchor="middle" className="fill-[#847F75] font-mono text-[9px] font-semibold">N</text>
            <text x="105" y="3" textAnchor="middle" className="fill-[#847F75] font-mono text-[9px] font-semibold">E</text>
            <text x="0" y="58" textAnchor="middle" className="fill-[#847F75] font-mono text-[9px] font-semibold">S</text>
            <text x="-105" y="3" textAnchor="middle" className="fill-[#847F75] font-mono text-[9px] font-semibold">W</text>

            {/* Wind Flow Stream Particles */}
            {windParticles.map((p) => {
              const px1 = -arrowDx * 1.5 + (p.offset * Math.cos(angleRad + Math.PI / 2));
              const py1 = -arrowDy * 1.5 + (p.offset * Math.sin(angleRad + Math.PI / 2));
              const px2 = arrowDx * 1.8 + (p.offset * Math.cos(angleRad + Math.PI / 2));
              const py2 = arrowDy * 1.8 + (p.offset * Math.sin(angleRad + Math.PI / 2));
              return (
                <line
                  key={p.id}
                  x1={px1}
                  y1={py1}
                  x2={px2}
                  y2={py2}
                  stroke="#1F4E43"
                  strokeWidth="1.2"
                  strokeDasharray="12 8"
                  strokeOpacity="0.4"
                  className="animate-[dash_linear_infinite]"
                  style={{
                    animationDuration: `${windVectorSpeed}s`,
                    animationDelay: `${p.delay}s`,
                  }}
                />
              );
            })}

            {/* Central Station Location Beacon */}
            <circle cx="0" cy="0" r="16" fill="url(#centerGlow)" />
            <circle cx="0" cy="0" r="4.5" fill="#1F4E43" stroke="#FFFFFF" strokeWidth="1.5" />

            {/* Dominant Direction Arrow Vector from Station */}
            <line
              x1="0"
              y1="0"
              x2={arrowDx * 1.3}
              y2={arrowDy * 1.3}
              stroke="url(#vectorGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle
              cx={arrowDx * 1.3}
              cy={arrowDy * 1.3}
              r="3.5"
              fill="#181715"
              stroke="#FFFFFF"
              strokeWidth="1"
            />
          </svg>

          {/* Floating Radar Legend HUD */}
          <div className="pointer-events-none absolute bottom-1.5 left-2 flex items-center gap-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-mono text-[#5E5A52] shadow-2xs border border-[#E2DDD3]/80">
            <span className="font-semibold text-[#1F4E43]">20 km</span>
            <span>field</span>
          </div>

          <div className="pointer-events-none absolute bottom-1.5 right-2 flex items-center gap-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-mono text-[#181715] shadow-2xs border border-[#E2DDD3]/80">
            <span className="font-semibold text-[#1F4E43]">{cardinal}</span>
            <span>{windDirection}°</span>
          </div>
        </div>

        {/* Right Side: Horizontal Telemetry Panels (md:col-span-7) */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Panel 1: Wind Flow Vector */}
            <div className="rounded border border-[#E2DDD3] bg-white/90 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#5E5A52]">
                <Wind className="h-3.5 w-3.5 text-[#1F4E43]" />
                <span>Wind Vector</span>
              </div>
              <p className="mt-1 font-mono text-base font-semibold tabular-nums text-[#181715]">
                {windSpeed} <span className="text-xs font-normal text-[#847F75]">km/h</span>
              </p>
              <p className="mt-0.5 text-[11px] text-[#5E5A52]">
                Flow towards <span className="font-semibold text-[#181715]">{cardinal}</span> ({windDirection}°)
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-[#847F75]">
                {isStagnant ? 'Weak dispersion force' : 'Active clearing vector'}
              </p>
            </div>

            {/* Panel 2: Fog & Optical Range */}
            <div className="rounded border border-[#E2DDD3] bg-white/90 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#5E5A52]">
                <Eye className="h-3.5 w-3.5 text-[#9A6B16]" />
                <span>Optical Range</span>
              </div>
              <p className="mt-1 font-mono text-base font-semibold tabular-nums text-[#181715]">
                {visibilityKm} <span className="text-xs font-normal text-[#847F75]">km</span>
              </p>
              <p className="mt-0.5 text-[11px] text-[#5E5A52]">
                Fog Index: <span className="font-mono font-semibold text-[#181715]">{fogIndex}%</span>
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-[#847F75]">
                {humidity}% relative humidity
              </p>
            </div>

            {/* Panel 3: Boundary-Layer Stability */}
            <div className="rounded border border-[#E2DDD3] bg-white/90 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#5E5A52]">
                <Activity className="h-3.5 w-3.5 text-[#1F4E43]" />
                <span>Dispersion Layer</span>
              </div>
              <p className="mt-1 font-mono text-xs font-semibold text-[#181715] leading-snug">
                {isStagnant && humidity > 80 ? 'Inversion Trapping' : 'Ventilated Flow'}
              </p>
              <p className="mt-1 text-[10px] leading-tight text-[#5E5A52]">
                {isStagnant
                  ? 'Surface layer traps soot & fine particles near breathing level.'
                  : 'Sufficient kinetic energy to disperse ambient emissions.'}
              </p>
            </div>
          </div>

          {/* Sub-strip: Summary explanation */}
          <div className="flex items-center justify-between rounded bg-[#FAF9F6] px-2.5 py-1 text-[10px] text-[#5E5A52] border border-[#E2DDD3]/70">
            <span>
              Radar vectoring {location.name} local atmospheric dispersion radius.
            </span>
            <span className="font-mono text-[#847F75]">
              Update interval: 15m
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
