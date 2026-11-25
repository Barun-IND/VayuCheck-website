import { useState } from 'react';
import type { ActivityGuidanceNote, ActivityWindow } from '../types/air';
import { getActivityTone } from '../lib/airStyle';

interface ActivityPlannerProps {
  activities: ActivityWindow[];
  activityNotes: ActivityGuidanceNote[];
}

export function ActivityPlanner({ activities, activityNotes }: ActivityPlannerProps) {
  const [selectedDay, setSelectedDay] = useState<0 | 1>(0);

  const visible = activities.filter((a) => a.dayIndex === selectedDay);
  const noteById = new Map(activityNotes.map((n) => [n.activityId, n.tailoredTip]));

  return (
    <section
      id="planner"
      className="scroll-mt-20 rounded-md border border-[#E2DDD3] bg-white p-6"
    >
      <div className="flex flex-col gap-3 border-b border-[#EFECE6] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#181715]">
            Safe Activity Window Planner
          </h2>
          <p className="mt-0.5 text-xs text-[#5E5A52]">
            Lowest-exposure 2-hour slots computed directly from hourly Open-Meteo AQI and particulate forecasts.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Planner day selection"
          className="inline-flex items-center gap-1 self-start rounded-md bg-[#EFECE6] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedDay === 0}
            onClick={() => setSelectedDay(0)}
            className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer ${
              selectedDay === 0
                ? 'bg-white text-[#181715] shadow-xs'
                : 'text-[#5E5A52] hover:text-[#181715]'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={selectedDay === 1}
            onClick={() => setSelectedDay(1)}
            className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer ${
              selectedDay === 1
                ? 'bg-white text-[#181715] shadow-xs'
                : 'text-[#5E5A52] hover:text-[#181715]'
            }`}
          >
            Tomorrow
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#5E5A52]">
          No hourly activity windows available for this forecast period.
        </p>
      ) : (
        <div className="divide-y divide-[#EFECE6]">
          {visible.map((item) => {
            const tone = getActivityTone(item.rating);
            const tailoredNote = selectedDay === 0 ? noteById.get(item.id) : undefined;
            return (
              <div
                key={`${item.dayIndex}-${item.id}`}
                className="grid grid-cols-1 gap-3 py-4 md:grid-cols-12 md:items-start md:gap-4"
              >
                <div className="md:col-span-3">
                  <p className="text-sm font-semibold text-[#181715]">{item.activity}</p>
                  <p className={`mt-1 text-xs font-medium ${tone.textClass}`}>
                    {tone.glyph} {item.ratingLabel}
                  </p>
                </div>

                <div className="md:col-span-3">
                  <p className="text-xs text-[#847F75]">Lowest-exposure slot</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#181715]">
                    {item.bestWindow}
                  </p>
                  <p className="mt-0.5 font-mono text-xs tabular-nums text-[#5E5A52]">
                    Avg AQI {item.windowAvgAqi} · PM2.5 {item.windowAvgPm25} µg/m³
                  </p>
                </div>

                <div className="md:col-span-6 space-y-1">
                  <p className="text-sm text-[#181715]">
                    {tailoredNote || item.protectionNote}
                  </p>
                  <p className="text-xs text-[#5E5A52]">{item.rationale}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
