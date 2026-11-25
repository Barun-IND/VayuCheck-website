import type {
  BriefingRecommendation,
  CommuteMode,
  HeatingCookingSetup,
  HouseholdProfile,
  IndoorAirSetup,
  SensitivityGroup,
} from '../src/types/air.ts';

export const SENSITIVITIES: SensitivityGroup[] = ['general', 'children', 'seniors', 'respiratory'];
export const COMMUTES: CommuteMode[] = ['car', 'two_wheeler', 'transit', 'walk_cycle'];
export const HEATINGS: HeatingCookingSetup[] = ['gas', 'electric', 'solid_fuel'];
export const INDOOR_SETUPS: IndoorAirSetup[] = ['hepa_purifier', 'ac_filter', 'natural_ventilation'];

const SENSITIVITY_DETAIL: Record<
  SensitivityGroup,
  {
    label: string;
    protect: string;
    routineFocus: string;
    indoorFocus: string;
    symptomWatch: string;
    dropBoost: number;
  }
> = {
  general: {
    label: 'General adult household',
    protect: 'Maintain baseline cardiovascular & respiratory protection during peak haze.',
    routineFocus: 'Keep prolonged outdoor exertion within peak afternoon dispersion hours.',
    indoorFocus: 'Maintain clean sleeping-zone air overnight so lungs recover from daytime exposure.',
    symptomWatch: 'Watch for throat dryness or eye irritation when PM2.5 exceeds 2× WHO limits.',
    dropBoost: 0,
  },
  children: {
    label: 'With children',
    protect: 'Shield children (higher breathing rate per body weight) from afternoon/evening smog.',
    routineFocus: 'Schedule school commutes and playground time strictly inside lowest-AQI slots.',
    indoorFocus: 'Prioritize children’s study and bedroom air quality with floor-level dust control.',
    symptomWatch: 'Keep pediatric inhalers/saline sprays ready if coughing follows outdoor play.',
    dropBoost: 4,
  },
  seniors: {
    label: 'With seniors (65+)',
    protect: 'Protect older adults from fine-particulate blood-pressure & cardiac stress.',
    routineFocus: 'Shift morning walks to warmer midday hours to avoid cold-air inversion smog.',
    indoorFocus: 'Keep bedrooms draft-free and warm without unvented combustion heaters.',
    symptomWatch: 'Monitor shortness of breath or unusual fatigue on stagnant high-humidity mornings.',
    dropBoost: 4,
  },
  respiratory: {
    label: 'Asthma / respiratory',
    protect: 'Enforce strict PM2.5 and NO₂ thresholds to prevent airway inflammation.',
    routineFocus: 'Wear a fitted N95/FFP2 respirator whenever US AQI exceeds 100 outdoors.',
    indoorFocus: 'Maintain a dedicated low-PM2.5 sanctuary room with zero indoor smoke or sprays.',
    symptomWatch: 'Keep prescribed controller and rescue inhalers accessible during smog spikes.',
    dropBoost: 6,
  },
};

const COMMUTE_DETAIL: Record<
  CommuteMode,
  {
    title: string;
    steps: string[];
    emission: string;
    altTitle: string;
    altSteps: string[];
    altHealth: string;
    altEmission: string;
    co2: number;
    drop: number;
  }
> = {
  car: {
    title: 'Recirculate cabin air & bundle car errands into midday dispersion',
    steps: [
      'Switch vehicle HVAC to recirculate mode on arterial roads to block tailpipe NO₂ and soot.',
      'Combine school, office, and grocery car trips into a single midday loop when traffic clears.',
      'Check and replace your vehicle cabin air filter with an activated-carbon filter every 6 months.',
    ],
    emission: 'Cuts cold-start fuel burn and urban exhaust idling.',
    altTitle: 'Swap one short solo car trip for transit, carpool, or errand chaining',
    altSteps: [
      'Replace one short trip under 3 km with public transit, walking (when AQI ≤ 100), or carpooling.',
      'Coordinate school/office drop-offs with a neighbor or household member twice a week.',
      'Switch off the engine at signals or waits longer than 30 seconds to eliminate curb idling.',
    ],
    altHealth: 'Lowers cumulative roadside PM2.5 and NO₂ buildup inside the cabin.',
    altEmission: 'Cuts cold-engine tailpipe emissions in residential neighborhood streets.',
    co2: 1.8,
    drop: 18,
  },
  two_wheeler: {
    title: 'Wear a fitted N95/FFP2 respirator & shift two-wheeler rides off-peak',
    steps: [
      'Seal a certified N95/FFP2 mask snugly under your helmet before entering congested intersections.',
      'Choose parallel residential lanes to avoid riding directly behind diesel buses and trucks.',
      'Wash face and rinse nasal passages with saline after returning from heavy traffic rides.',
    ],
    emission: 'Maintains low-footprint two-wheeler mobility without acute particulate spikes.',
    altTitle: 'Shift high-smog rides to metro/covered transit or carpool',
    altSteps: [
      'Use enclosed metro/rail or shared transit on days when US AQI climbs above 150.',
      'Consolidate market and pharmacy errands into one off-peak daytime loop.',
      'Keep helmet visors closed and tires properly inflated to minimize rolling fuel burn.',
    ],
    altHealth: 'Prevents direct inhalation of concentrated tailpipe exhaust at breathing height.',
    altEmission: 'Reduces urban two-stroke/four-stroke hydrocarbon emissions during peak jams.',
    co2: 1.1,
    drop: 28,
  },
  transit: {
    title: 'Prefer enclosed metro/bus cabins & time station walks off-peak',
    steps: [
      'Wait inside covered station concourses rather than curbside bus bays during peak traffic.',
      'Carry a pocket N95/FFP2 mask for last-mile walks along busy intersections.',
      'Board mid-train or air-conditioned coaches where doors open away from kerbside exhaust.',
    ],
    emission: 'Displaces solo car travel and reduces per-passenger tailpipe NOₓ.',
    altTitle: 'Pair transit passes with low-traffic greenway last-mile routes',
    altSteps: [
      'Walk last-mile segments through parks or side streets at least 100 m off main arterials.',
      'Shift non-urgent transit trips outside the 08:00–10:00 and 18:00–20:00 rush peaks.',
      'Encourage car-owning colleagues to join shared metro/bus commutes on smog-alert days.',
    ],
    altHealth: 'Cuts kerbside diesel particulate exposure while walking to and from stops.',
    altEmission: 'Supports high-occupancy transit efficiency and lower neighborhood traffic.',
    co2: 2.6,
    drop: 20,
  },
  walk_cycle: {
    title: 'Route walks & cycling along greenways during lowest-AQI window',
    steps: [
      'Shift active commuting to parks or low-traffic lanes at least 100 m away from main roads.',
      'Keep breathing pace moderate when US AQI > 100 or wear a breathable valved FFP2 mask.',
      'Time outdoor rides for midday dispersion hours rather than foggy dawn or dusk inversions.',
    ],
    emission: 'Zero-tailpipe daily commute avoiding urban road dust.',
    altTitle: 'Use enclosed transit on severe smog days while keeping zero-emission habits',
    altSteps: [
      'Switch to enclosed metro/transit whenever local US AQI exceeds 150 or visibility drops below 2 km.',
      'Use shaded, tree-lined corridors that physically intercept coarse road dust.',
      'Shower or change outer layers after high-haze commutes before sitting in bedrooms.',
    ],
    altHealth: 'Prevents elevated exercise breathing rates from pulling PM2.5 deep into alveoli.',
    altEmission: 'Maintains near-zero personal transport carbon footprint all week.',
    co2: 3.1,
    drop: 24,
  },
};

const COOKING_DETAIL: Record<
  HeatingCookingSetup,
  {
    title: string;
    steps: string[];
    health: string;
    emission: string;
    altTitle: string;
    altSteps: string[];
    co2: number;
    drop: number;
  }
> = {
  gas: {
    title: 'Run kitchen exhaust & lid pots to cut indoor gas NO₂ and PM2.5',
    steps: [
      'Switch on the range hood (or crack a kitchen window) 2 minutes before lighting gas burners.',
      'Cook on rear burners with fitted lids to capture steam, oil aerosols, and NO₂ at the source.',
      'Leave exhaust running for 10 minutes after turning off the stove to clear residual gases.',
    ],
    health: 'Prevents indoor NO₂ and ultrafine cooking aerosols from irritating airways.',
    emission: 'Lidded cooking cuts LPG/natural gas fuel draw by ~25%.',
    altTitle: 'Shift water boiling & reheating from open gas flame to electric kettle/induction',
    altSteps: [
      'Use an electric kettle or induction hotplate instead of open gas flames for boiling water and tea.',
      'Batch-cook lentils, rice, or stews in a pressure cooker to cut total burner runtime in half.',
      'Avoid indoor incense, scented candles, or mosquito coils during stagnant winter evenings.',
    ],
    co2: 0.7,
    drop: 19,
  },
  electric: {
    title: 'Use lids and low-smoke oils on induction/electric cooktops',
    steps: [
      'Cover pans while boiling or simmering to trap fine lipid droplets at the source.',
      'Choose high-smoke-point oils and medium heat settings to minimize pan aerosol generation.',
      'Run brief kitchen exhaust during high-heat searing to clear ultrafine cooking particles.',
    ],
    health: 'Keeps indoor PM2.5 near background levels with zero combustion NO₂.',
    emission: 'Minimizes electric thermal losses during daily meal preparation.',
    altTitle: 'Eliminate indoor incense/candles & run heavy electric appliances off-peak',
    altSteps: [
      'Skip incense sticks, paraffin candles, and aerosol sprays while outdoor dispersion is weak.',
      'Use thermal flasks or slow/pressure cookers to retain heat without repeated reheating.',
      'Keep outdoor yard waste unburnt; compost leaves instead of open burning.',
    ],
    co2: 0.4,
    drop: 14,
  },
  solid_fuel: {
    title: 'Eliminate indoor smoke leakage & transition boiling to electric kettle',
    steps: [
      'Seal window frames, vents, and door gaps facing nearby wood, coal, or biomass smoke.',
      'Move water boiling, tea, and infant-food warming to a covered electric kettle indoors.',
      'Keep a wet cloth barrier along exterior door thresholds during evening neighbourhood burning.',
    ],
    health: 'Sharply reduces carcinogenic wood-smoke PM2.5, PAHs, and carbon monoxide indoors.',
    emission: 'Cuts residential biomass soot and black carbon emissions.',
    altTitle: 'Transition cooking/heating tasks toward clean LPG, induction, or solar thermal',
    altSteps: [
      'Replace open biomass/coal heating with layered warm clothing, hot-water bottles, or electric heaters.',
      'Use clean-burning LPG or induction for daily meals instead of smoky solid fuels.',
      'Coordinate with neighbors to compost dry leaves rather than burning garden waste at dusk.',
    ],
    co2: 2.2,
    drop: 32,
  },
};

const INDOOR_DETAIL: Record<
  IndoorAirSetup,
  {
    title: string;
    steps: string[];
    health: string;
    hack2Title: string;
    hack2Steps: string[];
    drop: number;
  }
> = {
  hepa_purifier: {
    title: 'Run HEPA purifier continuously on medium-high in occupied rooms',
    steps: [
      'Keep bedroom/living doors shut so the HEPA unit cycles room air 4–5× per hour effectively.',
      'Position the purifier away from corners and curtains for unobstructed 360° intake airflow.',
      'Vacuum the outer pre-filter mesh weekly to sustain full Clean Air Delivery Rate (CADR).',
    ],
    health: 'Captures >99% of infiltrated PM2.5, soot, and allergens.',
    hack2Title: 'Pair HEPA filtration with damp-dusting & sealed overnight thresholds',
    hack2Steps: [
      'Wipe surfaces and mop floors with a damp microfiber cloth so settled particles stay captured.',
      'Check filter-life indicators monthly and replace saturated activated-carbon/HEPA cartridges.',
      'Drop purifier fan speed to sleep mode at night only after daytime particles have cleared.',
    ],
    drop: 34,
  },
  ac_filter: {
    title: 'Set split AC/HVAC fan to recirculate with cleaned high-MERV filters',
    steps: [
      'Ensure fresh-air intake dampers are closed during smog peaks and run fan circulation on medium.',
      'Rinse or replace split AC mesh filters every 2 weeks during winter haze episodes.',
      'Consider adding a DIY MERV-13 box-fan filter in the main bedroom for fine PM2.5 capture.',
    ],
    health: 'Traps coarse dust and reduces outdoor haze infiltration.',
    hack2Title: 'Seal window-frame drafts & damp-mop bedrooms before bedtime',
    hack2Steps: [
      'Apply foam weatherstripping along loose sliding window tracks to stop cold smog seepage.',
      'Damp-mop hard floors in the late afternoon instead of dry sweeping.',
      'Keep bedroom doors closed at night to isolate sleeping air from hallway infiltration.',
    ],
    drop: 20,
  },
  natural_ventilation: {
    title: 'Create a clean-air room using damp-mopping and door draft seals',
    steps: [
      'Damp-mop hard floors daily instead of dry sweeping or vacuuming without a HEPA bag.',
      'Place rolled damp towels or silicone sweeps along leaky exterior door thresholds overnight.',
      'Hang heavy curtains across leaky glass windows at dusk to slow cold-air smog infiltration.',
    ],
    health: 'Reduces indoor particle resuspension and overnight smog seepage.',
    hack2Title: 'Build a low-cost indoor clean-air zone & track humidity indoors',
    hack2Steps: [
      'Keep one primary bedroom tightly sealed during night inversions for cleaner sleep recovery.',
      'Remove outdoor shoes and dusty jackets at the entryway before walking inside.',
      'Avoid drying smoky outdoor-exposed laundry indoors without brief midday venting.',
    ],
    drop: 16,
  },
};

export function generateProfileRecommendations(
  profile: Omit<HouseholdProfile, 'householdSize'> & { householdSize?: number },
  cityLabel = 'your city',
  ventWindow = '13:00–15:00'
): BriefingRecommendation[] {
  const sens = SENSITIVITY_DETAIL[profile.sensitivity];
  const comm = COMMUTE_DETAIL[profile.commute];
  const cook = COOKING_DETAIL[profile.heatingCooking];
  const indoor = INDOOR_DETAIL[profile.indoorSetup];
  const keyPrefix = `${profile.sensitivity}-${profile.commute}-${profile.heatingCooking}-${profile.indoorSetup}`;

  return [
    {
      id: `${keyPrefix}-r1`,
      category: 'routine',
      title: comm.title,
      effort: 'Low effort',
      timeframe: `Today · ${ventWindow}`,
      steps: comm.steps,
      directHealthImpact: `${sens.protect} ${sens.routineFocus}`,
      directEmissionImpact: comm.emission,
      scientificMechanism:
        'Midday boundary-layer mixing dilutes traffic exhaust before evening inversions form.',
      estimatedCo2KgSaved: comm.co2,
      estimatedExposureDropPct: Math.min(45, comm.drop + sens.dropBoost),
    },
    {
      id: `${keyPrefix}-r2`,
      category: 'routine',
      title: cook.title,
      effort: 'Low effort',
      timeframe: 'Every meal today',
      steps: cook.steps,
      directHealthImpact: `${cook.health} (${sens.label}).`,
      directEmissionImpact: cook.emission,
      scientificMechanism:
        'Source capture prevents indoor NO₂ and cooking aerosols from compounding outdoor PM2.5.',
      estimatedCo2KgSaved: cook.co2,
      estimatedExposureDropPct: Math.min(45, cook.drop + sens.dropBoost),
    },
    {
      id: `${keyPrefix}-r3`,
      category: 'routine',
      title: `Daily respiratory & hydration check for ${sens.label.toLowerCase()}`,
      effort: 'Low effort',
      timeframe: 'Morning & evening',
      steps: [
        sens.symptomWatch,
        'Rinse eyes and nasal passages with clean water/saline after returning from outdoor commutes.',
        'Keep indoor humidity balanced (40–55%) and hydrate well to support mucociliary clearance.',
      ],
      directHealthImpact: `${sens.protect} Supports airway clearance across the household.`,
      directEmissionImpact: 'Preventative daily habit with zero added energy footprint.',
      scientificMechanism:
        'Hydrated nasal mucosa traps coarse particles before they reach the lower bronchial tract.',
      estimatedCo2KgSaved: 0.2,
      estimatedExposureDropPct: Math.min(45, 10 + sens.dropBoost),
    },
    {
      id: `${keyPrefix}-ih1`,
      category: 'indoor_hack',
      title: indoor.title,
      effort: 'Low effort',
      timeframe: 'Continuous today',
      steps: indoor.steps,
      directHealthImpact: `${indoor.health} ${sens.indoorFocus}`,
      directEmissionImpact: 'Optimizes existing home hardware with minimal extra power draw.',
      scientificMechanism:
        'Maintaining slight positive pressure or sealed filtration prevents fine particulates settling indoors.',
      estimatedCo2KgSaved: 0.3,
      estimatedExposureDropPct: Math.min(45, indoor.drop + sens.dropBoost),
    },
    {
      id: `${keyPrefix}-ih2`,
      category: 'indoor_hack',
      title: indoor.hack2Title,
      effort: 'Low effort',
      timeframe: 'Late afternoon & night',
      steps: indoor.hack2Steps,
      directHealthImpact: `Keeps sleeping zones cleaner for ${sens.label.toLowerCase()} overnight.`,
      directEmissionImpact: 'Zero-emission physical barrier and wet-cleaning method.',
      scientificMechanism:
        'Damp wiping binds ultrafine soot rather than kicking settled dust back into breathing height.',
      estimatedCo2KgSaved: 0.2,
      estimatedExposureDropPct: 14 + Math.round(sens.dropBoost / 2),
    },
    {
      id: `${keyPrefix}-ih3`,
      category: 'indoor_hack',
      title: `Timed 15-minute cross-ventilation in ${cityLabel} during ${ventWindow}`,
      effort: 'Low effort',
      timeframe: ventWindow,
      steps: [
        `Open opposite windows briefly during ${ventWindow} when AQI dips, then re-seal tightly.`,
        'Wipe window sills with a damp cloth afterward to remove deposited roadside dust.',
        'Check the 48-hour Forecast Chart before reopening windows in the evening.',
      ],
      directHealthImpact: `Flushes indoor CO₂ while shielding ${sens.label.toLowerCase()} from morning/night smog.`,
      directEmissionImpact: 'Reduces mechanical cooling/heating runtime.',
      scientificMechanism:
        'Short midday cross-breezes purge stale indoor air without letting peak-hour haze accumulate.',
      estimatedCo2KgSaved: 0.4,
      estimatedExposureDropPct: 14 + Math.round(sens.dropBoost / 2),
    },
    {
      id: `${keyPrefix}-sa1`,
      category: 'sustainable_alternative',
      title: comm.altTitle,
      effort: 'Habit shift',
      timeframe: 'Today & this week',
      steps: comm.altSteps,
      directHealthImpact: `${comm.altHealth} Protects ${sens.label.toLowerCase()}.`,
      directEmissionImpact: comm.altEmission,
      scientificMechanism:
        'Cold catalytic converters emit disproportionately high hydrocarbons during short urban trips.',
      estimatedCo2KgSaved: comm.co2 + 0.5,
      estimatedExposureDropPct: 14,
    },
    {
      id: `${keyPrefix}-sa2`,
      category: 'sustainable_alternative',
      title: cook.altTitle,
      effort: 'Medium effort',
      timeframe: 'Daily household swap',
      steps: cook.altSteps,
      directHealthImpact: `Removes indoor combustion particulates and VOCs for ${sens.label.toLowerCase()}.`,
      directEmissionImpact: 'Lowers household fossil/biomass burn and neighborhood smoke.',
      scientificMechanism:
        'Electric heating eliminates direct indoor NO₂, CO, and ultrafine soot release.',
      estimatedCo2KgSaved: profile.heatingCooking === 'solid_fuel' ? 2.4 : 1.1,
      estimatedExposureDropPct: 18,
    },
    {
      id: `${keyPrefix}-sa3`,
      category: 'sustainable_alternative',
      title: 'Join zero-burning neighborhood waste & shared-errand practices',
      effort: 'Habit shift',
      timeframe: 'Weekly community habit',
      steps: [
        'Compost or bag dry leaves and garden trimmings instead of burning them at dusk.',
        'Consolidate online deliveries and grocery orders into fewer weekly drop-offs.',
        'Share daily VayuCheck peak-haze alerts with family and nearby schools.',
      ],
      directHealthImpact: `Prevents local hyper-local PM2.5 plumes around ${sens.label.toLowerCase()}.`,
      directEmissionImpact: 'Cuts neighborhood black carbon and delivery van idling.',
      scientificMechanism:
        'Open biomass burning emits concentrated fine smoke that settles directly into ground-floor homes.',
      estimatedCo2KgSaved: 1.5,
      estimatedExposureDropPct: 12,
    },
  ];
}
