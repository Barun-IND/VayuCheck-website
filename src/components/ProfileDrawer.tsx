import { useEffect, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import type {
  CommuteMode,
  HeatingCookingSetup,
  HouseholdProfile,
  IndoorAirSetup,
  SensitivityGroup,
} from '../types/air';

interface ProfileDrawerProps {
  open: boolean;
  profile: HouseholdProfile;
  isOnboarding?: boolean;
  onClose: () => void;
  onSave: (next: HouseholdProfile) => void;
}

const SENSITIVITY_OPTIONS: Array<{ value: SensitivityGroup; label: string; detail: string }> = [
  { value: 'general', label: 'General adult household', detail: 'Standard adult respiratory baseline' },
  { value: 'children', label: 'Young or school-age children', detail: 'Higher breathing rate per body weight' },
  { value: 'seniors', label: 'Older adults (65+)', detail: 'Elevated cardiovascular smog sensitivity' },
  { value: 'respiratory', label: 'Asthma or respiratory condition', detail: 'Strict PM2.5 and NO₂ thresholds' },
];

const COMMUTE_OPTIONS: Array<{ value: CommuteMode; label: string }> = [
  { value: 'car', label: 'Private car' },
  { value: 'two_wheeler', label: 'Two-wheeler / scooter' },
  { value: 'transit', label: 'Public transit / rail' },
  { value: 'walk_cycle', label: 'Walking or cycling' },
];

const HEATING_OPTIONS: Array<{ value: HeatingCookingSetup; label: string }> = [
  { value: 'gas', label: 'Gas stove / LPG' },
  { value: 'electric', label: 'Electric / induction' },
  { value: 'solid_fuel', label: 'Wood / biomass nearby' },
];

const INDOOR_OPTIONS: Array<{ value: IndoorAirSetup; label: string }> = [
  { value: 'hepa_purifier', label: 'Dedicated HEPA purifier' },
  { value: 'ac_filter', label: 'Split AC / HVAC filter' },
  { value: 'natural_ventilation', label: 'Natural windows only' },
];

export function ProfileDrawer({
  open,
  profile,
  isOnboarding = false,
  onClose,
  onSave,
}: ProfileDrawerProps) {
  const [draft, setDraft] = useState<HouseholdProfile>(profile);

  useEffect(() => {
    if (open) {
      setDraft(profile);
    }
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#181715]/30 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-drawer-title"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-[#E2DDD3] bg-[#F7F5F0]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E2DDD3] bg-white px-6 py-4">
          <div>
            <h2 id="profile-drawer-title" className="text-base font-semibold text-[#181715]">
              {isOnboarding ? 'Set Up Your Household Profile' : 'Household Profile Calibration'}
            </h2>
            <p className="text-xs text-[#5E5A52]">
              {isOnboarding
                ? 'Welcome to VayuCheck — choose your preferences to tailor daily routines & air hacks.'
                : 'Tailors daily routines, indoor air hacks, and emission impact estimates.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close household profile"
            className="flex h-9 w-9 items-center justify-center rounded-md text-[#5E5A52] hover:bg-[#EFECE6] hover:text-[#181715] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between overflow-y-auto">
          <div className="space-y-6 p-6">
            {/* Sensitivity Group */}
            <fieldset className="space-y-2.5">
              <legend className="text-xs font-semibold text-[#181715]">
                Primary Health Sensitivity
              </legend>
              <div className="space-y-2">
                {SENSITIVITY_OPTIONS.map((opt) => {
                  const selected = draft.sensitivity === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDraft((d) => ({ ...d, sensitivity: opt.value }))}
                      className={`w-full rounded-md border px-3.5 py-2.5 text-left transition-colors duration-150 cursor-pointer ${
                        selected
                          ? 'border-[#1F4E43] bg-white text-[#181715]'
                          : 'border-[#E2DDD3] bg-white/60 text-[#5E5A52] hover:bg-white'
                      }`}
                    >
                      <p className="text-sm font-medium text-[#181715]">{opt.label}</p>
                      <p className="text-xs text-[#5E5A52]">{opt.detail}</p>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Primary Commute */}
            <fieldset className="space-y-2.5">
              <legend className="text-xs font-semibold text-[#181715]">
                Daily Commute Mode
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {COMMUTE_OPTIONS.map((opt) => {
                  const selected = draft.commute === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDraft((d) => ({ ...d, commute: opt.value }))}
                      className={`h-10 rounded-md border px-3 text-xs font-medium whitespace-nowrap transition-colors duration-150 cursor-pointer ${
                        selected
                          ? 'border-[#1F4E43] bg-[#1F4E43] text-white'
                          : 'border-[#E2DDD3] bg-white text-[#181715] hover:bg-[#EFECE6]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Cooking & Heating */}
            <fieldset className="space-y-2.5">
              <legend className="text-xs font-semibold text-[#181715]">
                Home Cooking &amp; Heating Fuel
              </legend>
              <div className="grid grid-cols-1 gap-2">
                {HEATING_OPTIONS.map((opt) => {
                  const selected = draft.heatingCooking === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDraft((d) => ({ ...d, heatingCooking: opt.value }))}
                      className={`h-10 rounded-md border px-3.5 text-left text-xs font-medium transition-colors duration-150 cursor-pointer ${
                        selected
                          ? 'border-[#1F4E43] bg-[#1F4E43] text-white'
                          : 'border-[#E2DDD3] bg-white text-[#181715] hover:bg-[#EFECE6]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Indoor Filtration */}
            <fieldset className="space-y-2.5">
              <legend className="text-xs font-semibold text-[#181715]">
                Indoor Air Filtration Setup
              </legend>
              <div className="grid grid-cols-1 gap-2">
                {INDOOR_OPTIONS.map((opt) => {
                  const selected = draft.indoorSetup === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDraft((d) => ({ ...d, indoorSetup: opt.value }))}
                      className={`h-10 rounded-md border px-3.5 text-left text-xs font-medium transition-colors duration-150 cursor-pointer ${
                        selected
                          ? 'border-[#1F4E43] bg-[#1F4E43] text-white'
                          : 'border-[#E2DDD3] bg-white text-[#181715] hover:bg-[#EFECE6]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Household Size */}
            <div className="flex items-center justify-between rounded-md border border-[#E2DDD3] bg-white px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-[#181715]">Household Members</p>
                <p className="text-xs text-[#5E5A52]">Used for exposure &amp; routine scaling</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Decrease household size"
                  onClick={() =>
                    setDraft((d) => ({ ...d, householdSize: Math.max(1, d.householdSize - 1) }))
                  }
                  className="flex h-8 w-8 items-center justify-center rounded border border-[#D7D1C5] bg-[#F7F5F0] text-[#181715] hover:bg-[#EFECE6] cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <span className="w-6 text-center font-mono text-sm font-semibold tabular-nums text-[#181715]">
                  {draft.householdSize}
                </span>
                <button
                  type="button"
                  aria-label="Increase household size"
                  onClick={() =>
                    setDraft((d) => ({ ...d, householdSize: Math.min(12, d.householdSize + 1) }))
                  }
                  className="flex h-8 w-8 items-center justify-center rounded border border-[#D7D1C5] bg-[#F7F5F0] text-[#181715] hover:bg-[#EFECE6] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E2DDD3] bg-white px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-md border border-[#D7D1C5] bg-white px-4 py-2 text-sm font-medium text-[#5E5A52] hover:bg-[#F7F5F0] hover:text-[#181715] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-10 rounded-md bg-[#1F4E43] px-4 py-2 text-sm font-medium text-white hover:bg-[#173C33] cursor-pointer"
            >
              Save &amp; Update Briefing
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
