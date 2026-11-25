import { useMemo } from 'react';
import weathermanGif from '../assets/weatherman.gif';

interface WeatherHeroIllustrationProps {
  windSpeed: number; // km/h
  rainMm?: number; // mm/h
  visibilityKm?: number; // km
  humidity?: number; // %
}

export function WeatherHeroIllustration({
  windSpeed,
  rainMm = 0,
  visibilityKm = 10,
  humidity = 50,
}: WeatherHeroIllustrationProps) {
  // Normalize wind intensity: 0 to 40+ km/h
  const windIntensity = Math.min(1, Math.max(0.1, windSpeed / 35));
  // Rain intensity: 0 to 10+ mm/h
  const isRaining = rainMm > 0.05;
  const rainIntensity = Math.min(1, Math.max(0, rainMm / 6));
  // Fog/haze intensity: low visibility (< 4km) or high humidity (> 80%) with low wind
  const isFoggy = visibilityKm <= 3.5 || (humidity >= 85 && windSpeed < 10);
  const fogOpacity = isFoggy ? Math.min(0.65, Math.max(0.2, (4 - Math.min(4, visibilityKm)) / 3.5)) : 0;

  // Animation speed for wind gusts (faster when windier)
  const windDuration = Math.max(0.6, 2.4 - windIntensity * 1.6);
  // Sway angle of the character & umbrella based on wind force
  const umbrellaWobble = Math.min(18, Math.max(4, windSpeed * 0.5));

  // Generate wind stream paths
  const windStreams = useMemo(() => {
    return [
      { y: 16, delay: 0, length: 110, speed: windDuration * 1.2 },
      { y: 34, delay: 0.4, length: 140, speed: windDuration },
      { y: 64, delay: 0.2, length: 120, speed: windDuration * 1.1 },
      { y: 95, delay: 0.6, length: 100, speed: windDuration * 0.9 },
    ];
  }, [windDuration]);

  // Rain drop positions
  const rainDrops = useMemo(() => {
    const drops = [];
    const count = Math.min(20, Math.max(6, Math.round(rainIntensity * 20)));
    for (let i = 0; i < count; i++) {
      drops.push({
        x: (i * 14) % 190,
        delay: (i * 0.09) % 0.8,
        speed: Math.max(0.35, 0.7 - rainIntensity * 0.3),
        len: 12 + (i % 6) * 3,
      });
    }
    return drops;
  }, [rainIntensity]);

  return (
    <div
      className="relative flex h-full min-h-[135px] w-full flex-col items-center justify-between overflow-hidden rounded-md border border-[#E2DDD3]/80 bg-[#FAF9F5] p-2.5"
      aria-label={`Live atmospheric visual: wind ${windSpeed} km/h, ${
        isRaining ? `rain ${rainMm} mm` : isFoggy ? 'foggy/haze' : 'clear'
      }`}
    >
      {/* Background Weather Ambience / Sky Tint */}
      <div
        className={`pointer-events-none absolute inset-0 transition-colors duration-500 ${
          isRaining
            ? 'bg-gradient-to-b from-slate-200/40 via-sky-100/25 to-transparent'
            : isFoggy
              ? 'bg-gradient-to-b from-amber-50/50 via-slate-100/40 to-transparent'
              : 'bg-gradient-to-b from-sky-50/40 to-transparent'
        }`}
      />

      {/* Atmospheric Fog / Haze Overlay Layer */}
      {isFoggy && (
        <div
          className="pointer-events-none absolute inset-0 backdrop-blur-[0.5px] transition-opacity duration-500"
          style={{
            backgroundColor: `rgba(235, 230, 220, ${fogOpacity})`,
            backgroundImage:
              'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.45) 0%, transparent 80%)',
          }}
        />
      )}

      {/* Dynamic Animated Wind Streams */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="windGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#181715" stopOpacity="0" />
            <stop offset="40%" stopColor="#181715" stopOpacity={0.15 + windIntensity * 0.25} />
            <stop offset="90%" stopColor="#181715" stopOpacity={0.25 + windIntensity * 0.35} />
            <stop offset="100%" stopColor="#181715" stopOpacity="0" />
          </linearGradient>
        </defs>

        {windStreams.map((s, idx) => (
          <path
            key={idx}
            d={`M -30 ${s.y} Q 50 ${s.y - 6 + (idx % 2) * 12} 120 ${s.y} T 210 ${s.y - 3}`}
            fill="none"
            stroke="url(#windGrad)"
            strokeWidth={1.4 + (idx % 2)}
            strokeDasharray="16 10"
            className="animate-[dash_linear_infinite]"
            style={{
              animationDuration: `${s.speed}s`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}

        {/* Rain streaks when precipitation is active */}
        {isRaining &&
          rainDrops.map((drop, idx) => (
            <line
              key={`rain-${idx}`}
              x1={drop.x + windIntensity * 8}
              y1="-10"
              x2={drop.x - 12 - windIntensity * 10}
              y2={drop.len}
              stroke="#2563EB"
              strokeWidth="1.5"
              strokeOpacity={0.45 + rainIntensity * 0.4}
              strokeLinecap="round"
              className="animate-[rainFall_linear_infinite]"
              style={{
                animationDuration: `${drop.speed}s`,
                animationDelay: `${drop.delay}s`,
              }}
            />
          ))}
      </svg>

      {/* Main Weatherman Animated GIF */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-0.5">
        <div className="relative flex items-center justify-center">
          <img
            src={weathermanGif}
            alt="Weather and wind reporter animation"
            className="h-20 sm:h-22 w-auto max-w-[160px] object-contain select-none transition-all duration-300 mix-blend-multiply"
            style={{
              transform: `skewX(${windIntensity * -5}deg) rotate(${windIntensity * 1.5}deg)`,
              filter: isFoggy ? `blur(${Math.min(0.6, fogOpacity * 0.9)}px)` : 'none',
            }}
          />

          {/* Wind Gust Whirlpool / Speed Lines */}
          <div
            className="pointer-events-none absolute -right-2 top-0 h-10 w-10 rounded-full border border-dashed border-[#1F4E43]/25 animate-spin"
            style={{
              animationDuration: `${Math.max(0.8, 3.2 - windIntensity * 2.5)}s`,
              transform: `rotate(${umbrellaWobble}deg)`,
            }}
          />
        </div>

        {/* Live Weather Mood Tagline below figure */}
        <div className="mt-1 flex items-center gap-1.5 rounded-full border border-[#E2DDD3] bg-white/95 px-2.5 py-0.5 text-[10px] font-medium text-[#181715] shadow-2xs backdrop-blur-xs">
          <span className="font-mono tabular-nums text-[#1F4E43] font-semibold">
            {windSpeed} km/h wind
          </span>
          <span aria-hidden="true" className="text-[#847F75]">·</span>
          <span className="text-[#5E5A52]">
            {isRaining
              ? `${rainMm} mm rain`
              : isFoggy
                ? 'Hazy / Foggy'
                : windSpeed > 15
                  ? 'Breezy'
                  : 'Calm'}
          </span>
        </div>
      </div>
    </div>
  );
}
