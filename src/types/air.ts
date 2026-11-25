export interface LocationInfo {
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export type AqiBand =
  | 'good'
  | 'moderate'
  | 'sensitive'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous';

export type InversionRiskLevel = 'low' | 'moderate' | 'high';

export interface HourlyPoint {
  time: string;
  hourLabel: string;
  dayIndex: 0 | 1;
  usAqi: number;
  europeanAqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  so2: number;
  co: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  visibilityKm: number;
  rainMm: number;
  fogIndex: number; // 0 (clear) to 100 (dense fog) derived from visibility and RH
}

export interface PollutantBreakdown {
  key: 'pm25' | 'pm10' | 'no2' | 'o3' | 'so2' | 'co';
  label: string;
  formula: string;
  value: number;
  unit: string;
  whoLimit: number;
  whoNote: string;
  ratioToWho: number;
  status: 'within' | 'elevated' | 'high' | 'severe';
}

export type ActivityRating = 'recommended' | 'caution' | 'limit' | 'avoid';

export interface ActivityWindow {
  id: string;
  activity: string;
  dayIndex: 0 | 1;
  bestWindow: string;
  windowAvgAqi: number;
  windowAvgPm25: number;
  rating: ActivityRating;
  ratingLabel: string;
  protectionNote: string;
  rationale: string;
}

export interface AtmosphericSnapshot {
  location: LocationInfo;
  fetchedAt: string;
  timezone: string;
  current: {
    time: string;
    usAqi: number;
    europeanAqi: number;
    band: AqiBand;
    bandLabel: string;
    advisorySummary: string;
    dominantPollutant: string;
    pm25: number;
    pm10: number;
    no2: number;
    o3: number;
    so2: number;
    co: number;
    whoPm25Multiple: number;
    temperature: number;
    humidity: number;
    windSpeed: number;
    windDirection?: number; // degrees 0-360
    visibilityKm: number;
    surfacePressure: number;
    rainMm: number;
    fogIndex: number;
  };
  inversion: {
    risk: InversionRiskLevel;
    label: string;
    summary: string;
  };
  bestVentilationWindow: {
    windowLabel: string;
    avgAqi: number;
    avgPm25: number;
    advisable: boolean;
  };
  pollutants: PollutantBreakdown[];
  hourly: HourlyPoint[];
  activities: ActivityWindow[];
}

export type SensitivityGroup = 'general' | 'children' | 'seniors' | 'respiratory';
export type CommuteMode = 'car' | 'two_wheeler' | 'transit' | 'walk_cycle';
export type HeatingCookingSetup = 'gas' | 'electric' | 'solid_fuel';
export type IndoorAirSetup = 'hepa_purifier' | 'ac_filter' | 'natural_ventilation';

export interface HouseholdProfile {
  sensitivity: SensitivityGroup;
  commute: CommuteMode;
  heatingCooking: HeatingCookingSetup;
  indoorSetup: IndoorAirSetup;
  householdSize: number;
}

export type RecommendationCategory =
  | 'routine'
  | 'indoor_hack'
  | 'sustainable_alternative';

export interface BriefingRecommendation {
  id: string;
  category: RecommendationCategory;
  title: string;
  effort: 'Low effort' | 'Medium effort' | 'Habit shift';
  timeframe: string;
  steps: string[];
  directHealthImpact: string;
  directEmissionImpact: string;
  scientificMechanism: string;
  estimatedCo2KgSaved: number;
  estimatedExposureDropPct: number;
}

export interface ActivityGuidanceNote {
  activityId: string;
  tailoredTip: string;
}

export interface DailyBriefing {
  generatedAt: string;
  headlineSummary: string;
  inversionExplanation: string;
  alert: {
    active: boolean;
    severityLabel: string;
    headline: string;
    immediateActions: string[];
  };
  activityNotes: ActivityGuidanceNote[];
  recommendations: BriefingRecommendation[];
}
