import type {
  ActivityRating,
  AqiBand,
  HouseholdProfile,
  InversionRiskLevel,
  LocationInfo,
  PollutantBreakdown,
  RecommendationCategory,
} from '../types/air';

export const DEFAULT_CITY: LocationInfo = {
  name: 'New Delhi',
  admin1: 'Delhi',
  country: 'India',
  latitude: 28.6139,
  longitude: 77.209,
  timezone: 'Asia/Kolkata',
};

export const PRESET_CITIES: LocationInfo[] = [
  DEFAULT_CITY,
  {
    name: 'Kolkata',
    admin1: 'West Bengal',
    country: 'India',
    latitude: 22.5726,
    longitude: 88.3639,
  },
  {
    name: 'Lahore',
    admin1: 'Punjab',
    country: 'Pakistan',
    latitude: 31.5204,
    longitude: 74.3587,
  },
  {
    name: 'Beijing',
    admin1: 'Beijing',
    country: 'China',
    latitude: 39.9042,
    longitude: 116.4074,
  },
  {
    name: 'Milan',
    admin1: 'Lombardy',
    country: 'Italy',
    latitude: 45.4642,
    longitude: 9.19,
  },
  {
    name: 'London',
    admin1: 'England',
    country: 'United Kingdom',
    latitude: 51.5072,
    longitude: -0.1276,
  },
  {
    name: 'Los Angeles',
    admin1: 'California',
    country: 'United States',
    latitude: 34.0522,
    longitude: -118.2437,
  },
];

export const DEFAULT_PROFILE: HouseholdProfile = {
  sensitivity: 'children',
  commute: 'car',
  heatingCooking: 'gas',
  indoorSetup: 'natural_ventilation',
  householdSize: 4,
};

export function getAqiTone(band: AqiBand): {
  textClass: string;
  glyph: string;
  stroke: string;
  surfaceTint: string;
  borderTint: string;
} {
  switch (band) {
    case 'good':
      return {
        textClass: 'text-[#2D6A4F]',
        glyph: '●',
        stroke: '#2D6A4F',
        surfaceTint: 'bg-[#F2F7F4]',
        borderTint: 'border-[#C8DFD3]',
      };
    case 'moderate':
      return {
        textClass: 'text-[#9A6B16]',
        glyph: '◆',
        stroke: '#9A6B16',
        surfaceTint: 'bg-[#FAF6EC]',
        borderTint: 'border-[#E6D7B5]',
      };
    case 'sensitive':
      return {
        textClass: 'text-[#B84A27]',
        glyph: '▲',
        stroke: '#B84A27',
        surfaceTint: 'bg-[#FBF3EF]',
        borderTint: 'border-[#E9CBC0]',
      };
    case 'unhealthy':
      return {
        textClass: 'text-[#B84A27]',
        glyph: '▲',
        stroke: '#B84A27',
        surfaceTint: 'bg-[#FAF1ED]',
        borderTint: 'border-[#E5BFB1]',
      };
    case 'very_unhealthy':
    case 'hazardous':
      return {
        textClass: 'text-[#7F1D1D]',
        glyph: '■',
        stroke: '#7F1D1D',
        surfaceTint: 'bg-[#F9EFEF]',
        borderTint: 'border-[#E2BDBD]',
      };
  }
}

export function getInversionTone(risk: InversionRiskLevel): {
  textClass: string;
  glyph: string;
} {
  switch (risk) {
    case 'high':
      return { textClass: 'text-[#7F1D1D]', glyph: '■' };
    case 'moderate':
      return { textClass: 'text-[#9A6B16]', glyph: '▲' };
    case 'low':
      return { textClass: 'text-[#2D6A4F]', glyph: '●' };
  }
}

export function getActivityTone(rating: ActivityRating): {
  textClass: string;
  glyph: string;
} {
  switch (rating) {
    case 'recommended':
      return { textClass: 'text-[#2D6A4F]', glyph: '●' };
    case 'caution':
      return { textClass: 'text-[#9A6B16]', glyph: '◆' };
    case 'limit':
      return { textClass: 'text-[#B84A27]', glyph: '▲' };
    case 'avoid':
      return { textClass: 'text-[#7F1D1D]', glyph: '■' };
  }
}

export function getPollutantStatusTone(status: PollutantBreakdown['status']): {
  label: string;
  textClass: string;
} {
  switch (status) {
    case 'within':
      return { label: 'Within WHO', textClass: 'text-[#2D6A4F]' };
    case 'elevated':
      return { label: 'Above WHO', textClass: 'text-[#9A6B16]' };
    case 'high':
      return { label: 'High', textClass: 'text-[#B84A27]' };
    case 'severe':
      return { label: 'Severe', textClass: 'text-[#7F1D1D]' };
  }
}

export const CATEGORY_LABELS: Record<RecommendationCategory, string> = {
  routine: 'Low-Emission Routine',
  indoor_hack: 'Indoor Air Hack',
  sustainable_alternative: 'Sustainable Alternative',
};

export const PROFILE_DISPLAY = {
  sensitivity: {
    general: 'General household',
    children: 'With children',
    seniors: 'With seniors (65+)',
    respiratory: 'Asthma / respiratory',
  },
  commute: {
    car: 'Car commute',
    two_wheeler: 'Two-wheeler',
    transit: 'Public transit',
    walk_cycle: 'Walk or cycle',
  },
  heatingCooking: {
    gas: 'Gas stove / heating',
    electric: 'Electric / induction',
    solid_fuel: 'Wood / biomass nearby',
  },
  indoorSetup: {
    hepa_purifier: 'HEPA purifier',
    ac_filter: 'AC filter only',
    natural_ventilation: 'Natural ventilation',
  },
} as const;

export function formatLocalObsTime(isoLike: string): string {
  if (!isoLike) return '—';
  const [datePart, timePart] = isoLike.split('T');
  if (!timePart) return isoLike;
  return `${datePart} · ${timePart.slice(0, 5)} local`;
}
