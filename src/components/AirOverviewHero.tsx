import type { AtmosphericSnapshot, DailyBriefing } from '../types/air';
import { getAqiTone, getInversionTone, getPollutantStatusTone } from '../lib/airStyle';
import { WeatherHeroIllustration } from './WeatherHeroIllustration';
import { WindFogRadarMap } from './WindFogRadarMap';

interface AirOverviewHeroProps {
  snapshot: AtmosphericSnapshot;
  briefing: DailyBriefing | null;
  briefingLoading: boolean;
}

export function AirOverviewHero({
  snapshot,
  briefing,
  briefingLoading,
}: AirOverviewHeroProps) {
  const { current, inversion, bestVentilationWindow, pollutants } = snapshot;
  const aqiTone = getAqiTone(current.band);
  const inversionTone = getInversionTone(inversion.risk);

  const showAlert = current.usAqi >= 101 || inversion.risk === 'high' || briefing?.alert.active;

  return (
    <section id="overview" className="scroll-mt-20 space-y-6">
      {/* Real-Time Smog & Inversion Alert Notice (flat hairline surface, no border-l-4) */}
      {showAlert && (
        <div
          role="region"
          aria-label="Active air quality advisory"
          className={`rounded-md border px-5 py-4 ${aqiTone.surfaceTint} ${aqiTone.borderTint}`}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                <span className={aqiTone.textClass}>
                  {aqiTone.glyph} {briefing?.alert.severityLabel || current.bandLabel} Advisory
                </span>
                <span aria-hidden="true" className="text-[#B8B1A5]">
                  ·
                </span>
                <span className="text-[#5E5A52]">
                  Primary driver: {current.dominantPollutant} ({current.pm25} µg/m³ PM2.5)
                </span>
                <span aria-hidden="true" className="text-[#B8B1A5]">
                  ·
                </span>
                <span className={inversionTone.textClass}>
                  {inversionTone.glyph} {inversion.label}
                </span>
              </div>
              <p className="text-sm font-medium text-[#181715] max-w-3xl">
                {briefing?.alert.headline || current.advisorySummary}
              </p>
              {briefing?.alert.immediateActions && briefing.alert.immediateActions.length > 0 && (
                <ul className="flex flex-wrap gap-x-6 gap-y-1 pt-1 text-xs text-[#5E5A52]">
                  {briefing.alert.immediateActions.map((act, i) => (
                    <li key={i} className="flex items-baseline gap-1.5">
                      <span className="font-mono text-[11px] text-[#847F75]">0{i + 1}.</span>
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="shrink-0 text-left md:text-right">
              <p className="text-xs text-[#5E5A52]">Best ventilation slot today</p>
              <p className="font-mono text-sm font-semibold tabular-nums text-[#181715]">
                {bestVentilationWindow.windowLabel}
              </p>
              <p className="text-xs text-[#5E5A52]">
                {bestVentilationWindow.advisable
                  ? `Brief airing (avg AQI ${bestVentilationWindow.avgAqi})`
                  : `Keep sealed (avg AQI ${bestVentilationWindow.avgAqi})`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Primary Asymmetric Instrument Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        {/* Left Dominant Focal Anchor: Live AQI & Atmospheric State */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-md border border-[#E2DDD3] bg-white p-6 sm:p-7">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFECE6] pb-4">
              <div>
                <p className="text-xs font-medium text-[#5E5A52]">
                  Live Open-Meteo Atmospheric Reading
                </p>
                <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[#181715] [text-wrap:balance]">
                  {snapshot.location.name} Air &amp; Dispersion Report
                </h1>
              </div>
              <div className={`text-sm font-semibold ${aqiTone.textClass}`}>
                {aqiTone.glyph} {current.bandLabel}
              </div>
            </div>

            {/* Horizontal 3-Column Instrument Row: US AQI, Briefing Summary, Animated Weatherman */}
            <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-12 sm:items-stretch">
              {/* Col 1: US Air Quality Index */}
              <div className="sm:col-span-4 flex flex-col justify-between rounded-md border border-[#E2DDD3]/80 bg-[#FAF9F6]/80 p-3.5">
                <div>
                  <p className="text-xs font-medium text-[#5E5A52]">US Air Quality Index</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-mono text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums text-[#181715]">
                      {current.usAqi}
                    </span>
                    <span className="font-mono text-xs text-[#847F75]">US AQI</span>
                  </div>
                </div>

                <div className="mt-2.5 border-t border-[#EFECE6] pt-2 text-xs text-[#5E5A52]">
                  <p>
                    EU AQI <span className="font-mono tabular-nums text-[#181715]">{current.europeanAqi}</span>
                  </p>
                  <p className="mt-0.5">
                    PM2.5 is{' '}
                    <span className={`font-mono font-medium tabular-nums ${aqiTone.textClass}`}>
                      {current.whoPm25Multiple}×
                    </span>{' '}
                    WHO limit
                  </p>
                </div>
              </div>

              {/* Col 2: Today's Briefing Summary */}
              <div className="sm:col-span-5 flex flex-col justify-between rounded-md border border-[#E2DDD3]/80 bg-[#FAF9F6]/50 p-3.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#181715]">Today&apos;s Briefing Summary</p>
                    {briefingLoading && (
                      <span className="text-[10px] text-[#847F75]">
                        Updating...
                      </span>
                    )}
                  </div>
                  {briefingLoading && !briefing ? (
                    <div className="space-y-1.5" aria-label={`Generating summary for ${snapshot.location.name}`}>
                      <div className="h-3 w-full rounded bg-[#EFECE6]" />
                      <div className="h-3 w-10/12 rounded bg-[#EFECE6]" />
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-[#181715] line-clamp-4">
                      {briefing?.headlineSummary || current.advisorySummary}
                    </p>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-[#EFECE6] pt-1.5 text-[11px] text-[#847F75]">
                  <span>AI Meteorological Advisory</span>
                  <span className="font-mono text-[10px] text-[#1F4E43] font-medium">Live</span>
                </div>
              </div>

              {/* Col 3: Animated Weatherman Character Visual */}
              <div className="sm:col-span-3 flex flex-col justify-stretch">
                <WeatherHeroIllustration
                  windSpeed={current.windSpeed}
                  rainMm={current.rainMm}
                  visibilityKm={current.visibilityKm}
                  humidity={current.humidity}
                />
              </div>
            </div>

            {/* Horizontal Wind & Fog Radar Map: Fills the previously blank void completely across the full width */}
            <div className="mt-3.5">
              <WindFogRadarMap
                location={snapshot.location}
                windSpeed={current.windSpeed}
                windDirection={current.windDirection}
                visibilityKm={current.visibilityKm}
                fogIndex={current.fogIndex}
                humidity={current.humidity}
              />
            </div>
          </div>

          {/* 4-Column Meteorological Dispersion Strip */}
          <div className="mt-7 grid grid-cols-2 gap-4 border-t border-[#EFECE6] pt-5 sm:grid-cols-4">
            <div>
              <p className="text-xs text-[#5E5A52]">Temperature</p>
              <p className="mt-1 font-mono text-lg font-medium tabular-nums text-[#181715]">
                {current.temperature}
                <span className="ml-1 text-xs font-normal text-[#847F75]">°C</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-[#5E5A52]">Wind Dispersion</p>
              <p className="mt-1 font-mono text-lg font-medium tabular-nums text-[#181715]">
                {current.windSpeed}
                <span className="ml-1 text-xs font-normal text-[#847F75]">km/h</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-[#5E5A52]">Relative Humidity</p>
              <p className="mt-1 font-mono text-lg font-medium tabular-nums text-[#181715]">
                {current.humidity}
                <span className="ml-1 text-xs font-normal text-[#847F75]">%</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-[#5E5A52]">Visibility</p>
              <p className="mt-1 font-mono text-lg font-medium tabular-nums text-[#181715]">
                {current.visibilityKm}
                <span className="ml-1 text-xs font-normal text-[#847F75]">km</span>
              </p>
            </div>
          </div>
        </div>

        {/* Right Structural Panel: 6-Pollutant Specification Table & Inversion Analysis */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-md border border-[#E2DDD3] bg-white p-6">
          <div>
            <div className="flex items-baseline justify-between border-b border-[#EFECE6] pb-3.5">
              <h2 className="text-base font-semibold text-[#181715]">Pollutant Composition</h2>
              <span className="text-xs text-[#847F75]">WHO 2021 reference</span>
            </div>

            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#EFECE6] text-xs font-medium text-[#847F75]">
                    <th className="py-2 pr-3 font-medium">Pollutant</th>
                    <th className="py-2 px-2 text-right font-medium">Current</th>
                    <th className="py-2 px-2 text-right font-medium">WHO Limit</th>
                    <th className="py-2 pl-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE6]">
                  {pollutants.map((item) => {
                    const tone = getPollutantStatusTone(item.status);
                    return (
                      <tr key={item.key} className="hover:bg-[#FAF9F6] transition-colors duration-100">
                        <td className="py-2.5 pr-3">
                          <span className="font-mono text-xs font-semibold text-[#181715]">
                            {item.formula}
                          </span>
                          <span className="ml-2 text-xs text-[#5E5A52]">{item.label}</span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-xs font-medium tabular-nums text-[#181715] whitespace-nowrap">
                          {item.value}{' '}
                          <span className="text-[11px] font-normal text-[#847F75]">
                            {item.unit}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-xs tabular-nums text-[#847F75] whitespace-nowrap">
                          {item.whoLimit}
                        </td>
                        <td
                          className={`py-2.5 pl-2 text-right text-xs font-medium whitespace-nowrap ${tone.textClass}`}
                        >
                          {tone.label}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-5 border-t border-[#EFECE6] pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[#5E5A52]">Boundary-Layer Dispersion</p>
              <span className={`text-xs font-semibold ${inversionTone.textClass}`}>
                {inversionTone.glyph} {inversion.label}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#5E5A52]">
              {briefing?.inversionExplanation || inversion.summary}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
