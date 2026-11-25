import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, RefreshCw, SlidersHorizontal } from 'lucide-react';
import type {
  DailyBriefing,
  HouseholdProfile,
  RecommendationCategory,
} from '../types/air';
import { CATEGORY_LABELS, PROFILE_DISPLAY } from '../lib/airStyle';

interface DailyBriefingLedgerProps {
  locationName: string;
  briefing: DailyBriefing | null;
  loading: boolean;
  error: string | null;
  profile: HouseholdProfile;
  committedIds: string[];
  onToggleCommit: (id: string) => void;
  onRetry: () => void;
  onOpenProfile: () => void;
}

type FilterCategory = 'all' | RecommendationCategory;

export function DailyBriefingLedger({
  locationName,
  briefing,
  loading,
  error,
  profile,
  committedIds,
  onToggleCommit,
  onRetry,
  onOpenProfile,
}: DailyBriefingLedgerProps) {
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const recommendations = briefing?.recommendations ?? [];

  const filtered = useMemo(() => {
    if (filter === 'all') return recommendations;
    return recommendations.filter((r) => r.category === filter);
  }, [recommendations, filter]);

  const impactStats = useMemo(() => {
    const committed = recommendations.filter((r) => committedIds.includes(r.id));
    const totalCo2 = committed.reduce((sum, r) => sum + r.estimatedCo2KgSaved, 0);
    // Diminishing-returns combined exposure drop so percentage remains scientifically honest (capped <= 68%)
    const remainingExposureFactor = committed.reduce(
      (prod, r) => prod * (1 - r.estimatedExposureDropPct / 100),
      1
    );
    const combinedExposureDrop = Math.min(
      68,
      Math.round((1 - remainingExposureFactor) * 100)
    );

    return {
      committedCount: committed.length,
      totalCount: recommendations.length,
      totalCo2: Math.round(totalCo2 * 10) / 10,
      combinedExposureDrop,
    };
  }, [recommendations, committedIds]);

  return (
    <section
      id="briefing"
      className="scroll-mt-20 rounded-md border border-[#E2DDD3] bg-white p-6"
    >
      {/* Header & Profile Context */}
      <div className="flex flex-col gap-4 border-b border-[#EFECE6] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#181715]">
            Daily Hacks &amp; Quick Routines
          </h2>
          <p className="mt-1 text-xs text-[#5E5A52]">
            Tailored, low-effort actions to protect indoor air and cut exposure today. Calibrated for:{' '}
            <span className="font-medium text-[#181715]">
              {PROFILE_DISPLAY.sensitivity[profile.sensitivity]}
            </span>
            <span aria-hidden="true" className="mx-1.5 text-[#C2BBB0]">
              ·
            </span>
            <span>{PROFILE_DISPLAY.commute[profile.commute]}</span>
            <span aria-hidden="true" className="mx-1.5 text-[#C2BBB0]">
              ·
            </span>
            <span>{PROFILE_DISPLAY.heatingCooking[profile.heatingCooking]}</span>
            <span aria-hidden="true" className="mx-1.5 text-[#C2BBB0]">
              ·
            </span>
            <span>{PROFILE_DISPLAY.indoorSetup[profile.indoorSetup]}</span>
            <span aria-hidden="true" className="mx-1.5 text-[#C2BBB0]">
              ·
            </span>
            <span className="font-mono tabular-nums">{profile.householdSize} people</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenProfile}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#D7D1C5] bg-white px-3 py-1.5 text-xs font-medium text-[#181715] whitespace-nowrap shrink-0 transition-colors duration-150 hover:bg-[#F7F5F0] cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#1F4E43]" aria-hidden="true" />
            <span>Adjust profile</span>
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#D7D1C5] bg-white px-3 py-1.5 text-xs font-medium text-[#5E5A52] whitespace-nowrap shrink-0 transition-colors duration-150 hover:bg-[#F7F5F0] hover:text-[#181715] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{loading ? 'Updating...' : 'Regenerate'}</span>
          </button>
        </div>
      </div>

      {/* Cumulative Direct Impact Strip */}
      <div
        aria-live="polite"
        className="grid grid-cols-1 gap-4 border-b border-[#EFECE6] py-5 sm:grid-cols-3"
      >
        <div>
          <p className="text-xs text-[#5E5A52]">Daily Hacks Completed</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#181715]">
            {impactStats.committedCount}
            <span className="ml-1 text-sm font-normal text-[#847F75]">
              / {impactStats.totalCount || 6} completed
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-[#5E5A52]">Direct Household Emissions Avoided</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#1F4E43]">
            {impactStats.totalCo2.toFixed(1)}
            <span className="ml-1.5 text-xs font-normal text-[#5E5A52]">kg CO₂e today</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-[#5E5A52]">Estimated Indoor PM2.5 Exposure Drop</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#1F4E43]">
            {impactStats.combinedExposureDrop}%
            <span className="ml-1.5 text-xs font-normal text-[#5E5A52]">
              combined reduction
            </span>
          </p>
        </div>
      </div>

      {/* Category Filter Sliding Tabs */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter recommendations by category"
          className="relative inline-flex flex-wrap items-center gap-1 rounded-lg border border-[#E2DDD3] bg-[#EFECE6] p-1 shadow-inner"
        >
          {(
            [
              { id: 'all', label: 'All Hacks' },
              { id: 'routine', label: 'Low-Emission Routines' },
              { id: 'indoor_hack', label: 'Indoor Air Hacks' },
              { id: 'sustainable_alternative', label: 'Sustainable Swaps' },
            ] as const
          ).map((tab) => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="daily-hacks-panel"
                onClick={() => setFilter(tab.id)}
                className={`relative rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#181715] shadow-xs font-semibold'
                    : 'text-[#5E5A52] hover:text-[#181715] hover:bg-white/40'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-[#847F75]">
          Slide tabs to filter hacks, then check items to track your household&apos;s direct impact.
        </p>
      </div>

      {/* Content States: Error / Loading / List */}
      {error ? (
        <div
          role="alert"
          className="mt-6 rounded-md border border-[#E2BDBD] bg-[#F9EFEF] p-5"
        >
          <p className="text-sm font-semibold text-[#7F1D1D]">
            Unable to generate tailored guidance
          </p>
          <p className="mt-1 text-xs text-[#5E5A52]">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex h-9 items-center rounded-md bg-[#181715] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#33312E] cursor-pointer"
          >
            Retry briefing
          </button>
        </div>
      ) : loading && recommendations.length === 0 ? (
        <div className="mt-5" aria-label={`Generating tailored guidance for ${locationName}`}>
          <p className="pb-3 text-xs font-medium text-[#5E5A52]">
            Generating routines, indoor air hacks, and impact estimates for {locationName}...
          </p>
          <div className="divide-y divide-[#EFECE6]">
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className="py-5 space-y-2.5">
                <div className="h-4 w-2/5 rounded bg-[#EFECE6]" />
                <div className="h-3 w-4/5 rounded bg-[#F7F5F0]" />
                <div className="h-3 w-3/5 rounded bg-[#F7F5F0]" />
              </div>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#5E5A52]">
          No hacks match this category. Switch to All Hacks to view the full plan.
        </div>
      ) : (
        <div id="daily-hacks-panel" role="tabpanel" className="mt-4 space-y-2">
          {filtered.map((rec) => {
            const isCommitted = committedIds.includes(rec.id);
            const isExpanded = Boolean(expandedIds[rec.id]);
            return (
              <article
                key={rec.id}
                className={`group relative rounded-lg border p-4.5 my-2.5 transition-all duration-300 ${
                  isCommitted
                    ? 'border-[#C8DFD3] bg-[#F4F9F6] shadow-xs'
                    : 'border-[#E2DDD3] bg-white hover:border-[#D0C9BD] hover:shadow-2xs'
                }`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Interactive slide-toggle / switch checkbox */}
                    <div className="pt-0.5 shrink-0">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isCommitted}
                        aria-label={`Mark "${rec.title}" as completed`}
                        onClick={() => onToggleCommit(rec.id)}
                        className={`group/switch relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-250 ease-in-out cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4E43] ${
                          isCommitted ? 'bg-[#1F4E43]' : 'bg-[#D7D1C5] hover:bg-[#C2BBB0]'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow-sm ring-0 transition-transform duration-250 ease-in-out ${
                            isCommitted ? 'translate-x-5.5' : 'translate-x-0.5'
                          }`}
                        >
                          {isCommitted ? (
                            <Check className="h-3 w-3 text-[#1F4E43]" aria-hidden="true" />
                          ) : (
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#847F75]/40" />
                          )}
                        </span>
                      </button>
                      <span
                        aria-hidden="true"
                        className="block text-[10px] text-center font-medium mt-1 text-[#847F75] select-none"
                      >
                        {isCommitted ? 'Done' : 'To do'}
                      </span>
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Unboxed quiet metadata kicker */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#847F75]">
                        <span className="font-medium text-[#1F4E43]">
                          {CATEGORY_LABELS[rec.category]}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{rec.effort}</span>
                        <span aria-hidden="true">·</span>
                        <span>{rec.timeframe}</span>
                      </div>

                      {/* Title with animated straight cut line */}
                      <div className="relative inline-block max-w-full">
                        <h3
                          className={`text-base font-semibold transition-colors duration-300 ${
                            isCommitted ? 'text-[#5E5A52]' : 'text-[#181715]'
                          }`}
                        >
                          {rec.title}
                        </h3>
                        {/* Straight strike cut-line with smooth expansion animation */}
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute left-0 top-[52%] h-[2px] rounded-full bg-[#1F4E43] transition-all duration-350 ease-out ${
                            isCommitted ? 'w-full opacity-85' : 'w-0 opacity-0'
                          }`}
                        />
                      </div>

                      {/* Direct Impact Summary Pair */}
                      <div
                        className={`grid grid-cols-1 gap-3 pt-1.5 sm:grid-cols-2 max-w-3xl transition-opacity duration-300 ${
                          isCommitted ? 'opacity-75' : 'opacity-100'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-medium text-[#5E5A52]">Direct Health Impact</p>
                          <p className="mt-0.5 text-sm leading-relaxed text-[#181715]">
                            {rec.directHealthImpact}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[#5E5A52]">
                            Direct Emission Impact
                          </p>
                          <p className="mt-0.5 text-sm leading-relaxed text-[#181715]">
                            {rec.directEmissionImpact}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quantified Tabular Right Column & Expand Affordance */}
                  <div className="flex flex-row items-center justify-between gap-4 pl-15 md:flex-col md:items-end md:pl-0 shrink-0">
                    <div className="text-left md:text-right">
                      <p className="font-mono text-xs font-semibold tabular-nums text-[#1F4E43]">
                        −{rec.estimatedCo2KgSaved.toFixed(1)} kg CO₂e/day
                      </p>
                      <p className="mt-0.5 font-mono text-xs tabular-nums text-[#5E5A52]">
                        −{rec.estimatedExposureDropPct}% exposure
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpand(rec.id)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#5E5A52] hover:bg-[#EFECE6]/70 hover:text-[#181715] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                    >
                      <span>{isExpanded ? 'Hide steps' : 'Steps & rationale'}</span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Action Steps & Scientific Mechanism */}
                {isExpanded && (
                  <div className="mt-4 grid grid-cols-1 gap-5 border-t border-[#E2DDD3]/70 pt-4 pl-15 md:grid-cols-12">
                    <div className="md:col-span-7">
                      <p className="text-xs font-medium text-[#5E5A52]">Practical Steps</p>
                      <ol className="mt-2 space-y-1.5 text-sm text-[#181715]">
                        {rec.steps.map((step, i) => (
                          <li key={i} className="flex items-baseline gap-2.5">
                            <span className="font-mono text-xs tabular-nums text-[#847F75]">
                              0{i + 1}.
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="md:col-span-5">
                      <p className="text-xs font-medium text-[#5E5A52]">Why This Choice Matters</p>
                      <p className="mt-2 text-sm leading-relaxed text-[#5E5A52]">
                        {rec.scientificMechanism}
                      </p>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
