import { useMemo, useState } from 'react';
import type { HourlyPoint } from '../types/air';

interface ForecastChartProps {
  hourly: HourlyPoint[];
  currentTime: string;
}

type ChartMode = 'aqi_pm25' | 'gases' | 'dispersion' | 'rain_fog';

const SVG_WIDTH = 960;
const SVG_HEIGHT = 270;
const PAD = { top: 20, right: 20, bottom: 34, left: 46 };
const PLOT_W = SVG_WIDTH - PAD.left - PAD.right;
const PLOT_H = SVG_HEIGHT - PAD.top - PAD.bottom;

function buildPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  return points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');
}

export function ForecastChart({ hourly, currentTime }: ForecastChartProps) {
  const [mode, setMode] = useState<ChartMode>('aqi_pm25');

  const initialIndex = useMemo(() => {
    const prefix = currentTime.slice(0, 13);
    const found = hourly.findIndex((h) => h.time.startsWith(prefix));
    return found >= 0 ? found : 0;
  }, [hourly, currentTime]);

  const [activeIndex, setActiveIndex] = useState<number>(initialIndex);
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(hourly.length - 1, 0));
  const selected = hourly[safeIndex];

  const dayBoundaryIndex = useMemo(
    () => hourly.findIndex((h) => h.dayIndex === 1),
    [hourly]
  );

  const chartData = useMemo(() => {
    if (hourly.length === 0) {
      return { maxY: 100, ticks: [0, 50, 100], series: [] as Array<{ id: string; label: string; color: string; dashed?: boolean; path: string; points: Array<{ x: number; y: number }> }> };
    }

    const xFor = (i: number) =>
      PAD.left + (hourly.length > 1 ? (i / (hourly.length - 1)) * PLOT_W : 0);

    if (mode === 'aqi_pm25') {
      const maxVal = Math.max(
        100,
        ...hourly.map((h) => Math.max(h.usAqi, h.pm25))
      );
      const maxY = Math.ceil(maxVal / 50) * 50;
      const yFor = (v: number) => PAD.top + PLOT_H - (Math.min(v, maxY) / maxY) * PLOT_H;

      const aqiPts = hourly.map((h, i) => ({ x: xFor(i), y: yFor(h.usAqi) }));
      const pm25Pts = hourly.map((h, i) => ({ x: xFor(i), y: yFor(h.pm25) }));

      return {
        maxY,
        ticks: [0, Math.round(maxY * 0.25), Math.round(maxY * 0.5), Math.round(maxY * 0.75), maxY],
        whoLineY: yFor(15),
        series: [
          {
            id: 'usAqi',
            label: 'US AQI',
            color: '#181715',
            path: buildPath(aqiPts),
            points: aqiPts,
          },
          {
            id: 'pm25',
            label: 'PM2.5 (µg/m³)',
            color: '#B84A27',
            dashed: true,
            path: buildPath(pm25Pts),
            points: pm25Pts,
          },
        ],
      };
    }

    if (mode === 'gases') {
      const maxVal = Math.max(
        80,
        ...hourly.map((h) => Math.max(h.pm10, h.no2, h.o3))
      );
      const maxY = Math.ceil(maxVal / 40) * 40;
      const yFor = (v: number) => PAD.top + PLOT_H - (Math.min(v, maxY) / maxY) * PLOT_H;

      const pm10Pts = hourly.map((h, i) => ({ x: xFor(i), y: yFor(h.pm10) }));
      const no2Pts = hourly.map((h, i) => ({ x: xFor(i), y: yFor(h.no2) }));
      const o3Pts = hourly.map((h, i) => ({ x: xFor(i), y: yFor(h.o3) }));

      return {
        maxY,
        ticks: [0, Math.round(maxY * 0.25), Math.round(maxY * 0.5), Math.round(maxY * 0.75), maxY],
        whoLineY: undefined,
        series: [
          {
            id: 'pm10',
            label: 'PM10 (µg/m³)',
            color: '#181715',
            path: buildPath(pm10Pts),
            points: pm10Pts,
          },
          {
            id: 'no2',
            label: 'NO₂ (µg/m³)',
            color: '#1F4E43',
            path: buildPath(no2Pts),
            points: no2Pts,
          },
          {
            id: 'o3',
            label: 'O₃ (µg/m³)',
            color: '#9A6B16',
            dashed: true,
            path: buildPath(o3Pts),
            points: o3Pts,
          },
        ],
      };
    }

    if (mode === 'dispersion') {
      const maxWind = Math.max(25, ...hourly.map((h) => h.windSpeed));
      const maxY = Math.max(100, Math.ceil(maxWind / 20) * 20);
      const yFor = (v: number) => PAD.top + PLOT_H - (Math.min(v, maxY) / maxY) * PLOT_H;

      const humPts = hourly.map((h, i) => ({ x: xFor(i), y: yFor(h.humidity) }));
      const windPts = hourly.map((h, i) => ({ x: xFor(i), y: yFor(h.windSpeed) }));

      return {
        maxY,
        ticks: [0, 25, 50, 75, 100],
        whoLineY: undefined,
        series: [
          {
            id: 'wind',
            label: 'Wind Speed (km/h)',
            color: '#1F4E43',
            path: buildPath(windPts),
            points: windPts,
          },
          {
            id: 'humidity',
            label: 'Relative Humidity (%)',
            color: '#847F75',
            dashed: true,
            path: buildPath(humPts),
            points: humPts,
          },
        ],
      };
    }

    // rain_fog mode: dedicated dual line graph of Rain (mm) and Fog Index (0-100)
    const maxRain = Math.max(5, ...hourly.map((h) => h.rainMm ?? 0));
    const yFor = (v: number) => PAD.top + PLOT_H - (Math.min(v, 100) / 100) * PLOT_H;

    // Rain points: map rain mm into 0-100 range (e.g. 10mm = 100%) for visual parity with fog index
    const rainMultiplier = 100 / Math.max(8, maxRain);
    const rainPts = hourly.map((h, i) => ({ x: xFor(i), y: yFor((h.rainMm ?? 0) * rainMultiplier) }));
    const fogPts = hourly.map((h, i) => ({ x: xFor(i), y: yFor(h.fogIndex ?? 0) }));

    return {
      maxY: 100,
      ticks: [0, 25, 50, 75, 100],
      whoLineY: undefined,
      series: [
        {
          id: 'fog',
          label: 'Fog / Mist Index (0–100%)',
          color: '#9A6B16',
          path: buildPath(fogPts),
          points: fogPts,
        },
        {
          id: 'rain',
          label: `Rain Precipitation (max ${maxRain.toFixed(1)} mm)`,
          color: '#2563EB',
          dashed: true,
          path: buildPath(rainPts),
          points: rainPts,
        },
      ],
    };
  }, [hourly, mode]);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (hourly.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * SVG_WIDTH;
    const clamped = Math.min(Math.max(relX - PAD.left, 0), PLOT_W);
    const idx = Math.round((clamped / PLOT_W) * (hourly.length - 1));
    setActiveIndex(idx);
  };

  const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, hourly.length - 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  const xPos = (i: number) =>
    PAD.left + (hourly.length > 1 ? (i / (hourly.length - 1)) * PLOT_W : 0);

  if (hourly.length === 0) {
    return null;
  }

  return (
    <section
      id="forecast"
      className="scroll-mt-20 rounded-md border border-[#E2DDD3] bg-white p-6"
    >
      <div className="flex flex-col gap-4 border-b border-[#EFECE6] pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#181715]">
            48-Hour Pollution &amp; Dispersion Forecast
          </h2>
          <p className="mt-0.5 text-xs text-[#5E5A52]">
            Move pointer or use arrow keys across the timeline to inspect exact hourly Open-Meteo readings.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Forecast metric view"
          className="inline-flex items-center gap-1 self-start rounded-md bg-[#EFECE6] p-1"
        >
          {(
            [
              { id: 'aqi_pm25', label: 'AQI & PM2.5' },
              { id: 'gases', label: 'Dust & Gases' },
              { id: 'dispersion', label: 'Wind & Humidity' },
              { id: 'rain_fog', label: 'Rain & Fog' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mode === tab.id}
              onClick={() => setMode(tab.id)}
              className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer ${
                mode === tab.id
                  ? 'bg-white text-[#181715] shadow-xs'
                  : 'text-[#5E5A52] hover:text-[#181715]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Snapped Crosshair Tabular Inspection Bar */}
      {selected && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-b border-[#EFECE6] pb-4">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-xs">
            <div>
              <span className="text-[#847F75]">Selected Hour</span>
              <p className="font-mono text-sm font-semibold tabular-nums text-[#181715]">
                {selected.dayIndex === 0 ? 'Today' : 'Tomorrow'} {selected.hourLabel}
              </p>
            </div>
            <div>
              <span className="text-[#847F75]">US AQI</span>
              <p className="font-mono text-sm font-semibold tabular-nums text-[#181715]">
                {selected.usAqi}
              </p>
            </div>
            <div>
              <span className="text-[#847F75]">PM2.5</span>
              <p className="font-mono text-sm font-medium tabular-nums text-[#B84A27]">
                {selected.pm25} µg/m³
              </p>
            </div>
            <div>
              <span className="text-[#847F75]">PM10</span>
              <p className="font-mono text-sm font-medium tabular-nums text-[#181715]">
                {selected.pm10} µg/m³
              </p>
            </div>
            <div>
              <span className="text-[#847F75]">NO₂</span>
              <p className="font-mono text-sm font-medium tabular-nums text-[#1F4E43]">
                {selected.no2} µg/m³
              </p>
            </div>
            <div>
              <span className="text-[#847F75]">Wind</span>
              <p className="font-mono text-sm font-medium tabular-nums text-[#181715]">
                {selected.windSpeed} km/h
              </p>
            </div>
            <div>
              <span className="text-[#847F75]">Temp / RH</span>
              <p className="font-mono text-sm font-medium tabular-nums text-[#181715]">
                {selected.temperature}°C · {selected.humidity}%
              </p>
            </div>
            <div>
              <span className="text-[#847F75]">Rain / Fog</span>
              <p className="font-mono text-sm font-medium tabular-nums text-[#2563EB]">
                {selected.rainMm ?? 0} mm ·{' '}
                <span className="text-[#9A6B16]">
                  {(selected.fogIndex ?? 0) >= 70
                    ? 'Dense Fog'
                    : (selected.fogIndex ?? 0) >= 35
                      ? 'Mist / Haze'
                      : 'Clear'}
                </span>
              </p>
            </div>
          </div>

          {/* Inline Series Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#5E5A52]">
            {chartData.series.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <svg width="16" height="8" aria-hidden="true">
                  <line
                    x1="0"
                    y1="4"
                    x2="16"
                    y2="4"
                    stroke={s.color}
                    strokeWidth="2"
                    strokeDasharray={s.dashed ? '3 2' : undefined}
                  />
                </svg>
                <span>{s.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Precision SVG Plot */}
      <div className="mt-4 w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          role="img"
          aria-label="48 hour air quality and dispersion line chart"
          tabIndex={0}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerMove}
          onKeyDown={handleKeyDown}
          className="h-auto w-full min-w-[600px] cursor-crosshair select-none focus-visible:outline-2 focus-visible:outline-[#1F4E43]"
        >
          {/* Horizontal gridlines & Y ticks */}
          {chartData.ticks.map((tick) => {
            const y = PAD.top + PLOT_H - (tick / chartData.maxY) * PLOT_H;
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={SVG_WIDTH - PAD.right}
                  y2={y}
                  stroke="#EFECE6"
                  strokeWidth="1"
                />
                <text
                  x={PAD.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[#847F75] font-mono text-[10px]"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* WHO 15 µg/m³ Reference Line on AQI & PM2.5 view */}
          {chartData.whoLineY !== undefined && (
            <g>
              <line
                x1={PAD.left}
                y1={chartData.whoLineY}
                x2={SVG_WIDTH - PAD.right}
                y2={chartData.whoLineY}
                stroke="#2D6A4F"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.7"
              />
              <text
                x={SVG_WIDTH - PAD.right - 4}
                y={chartData.whoLineY - 4}
                textAnchor="end"
                className="fill-[#2D6A4F] font-mono text-[10px]"
              >
                WHO 24h PM2.5 limit (15 µg/m³)
              </text>
            </g>
          )}

          {/* Day separator (Today | Tomorrow) */}
          {dayBoundaryIndex > 0 && (
            <g>
              <line
                x1={xPos(dayBoundaryIndex)}
                y1={PAD.top}
                x2={xPos(dayBoundaryIndex)}
                y2={PAD.top + PLOT_H}
                stroke="#D7D1C5"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x={xPos(dayBoundaryIndex) + 6}
                y={PAD.top + 11}
                className="fill-[#847F75] font-mono text-[10px]"
              >
                Tomorrow
              </text>
            </g>
          )}

          {/* Data Series */}
          {chartData.series.map((s) => (
            <path
              key={s.id}
              d={s.path}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? '5 3' : undefined}
            />
          ))}

          {/* Snapped Crosshair & Data Vertices */}
          {selected && (
            <g>
              <line
                x1={xPos(safeIndex)}
                y1={PAD.top}
                x2={xPos(safeIndex)}
                y2={PAD.top + PLOT_H}
                stroke="#181715"
                strokeWidth="1"
                opacity="0.35"
              />
              {chartData.series.map((s) => {
                const pt = s.points[safeIndex];
                if (!pt) return null;
                return (
                  <circle
                    key={s.id}
                    cx={pt.x}
                    cy={pt.y}
                    r="3.5"
                    fill="#FFFFFF"
                    stroke={s.color}
                    strokeWidth="2"
                  />
                );
              })}
            </g>
          )}

          {/* X-axis ticks every 6 hours */}
          {hourly.map((pt, idx) => {
            if (idx % 6 !== 0 && idx !== hourly.length - 1) return null;
            return (
              <text
                key={pt.time}
                x={xPos(idx)}
                y={SVG_HEIGHT - 10}
                textAnchor="middle"
                className="fill-[#847F75] font-mono text-[10px]"
              >
                {pt.hourLabel}
              </text>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
