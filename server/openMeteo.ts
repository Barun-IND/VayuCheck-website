import type {
  ActivityRating,
  ActivityWindow,
  AqiBand,
  AtmosphericSnapshot,
  HourlyPoint,
  InversionRiskLevel,
  LocationInfo,
  PollutantBreakdown,
} from '../src/types/air.ts';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const airCache = new Map<string, CacheEntry<AtmosphericSnapshot>>();
const CACHE_TTL_MS = 15 * 60 * 1000;

async function fetchWithRetry(url: string, retries = 1): Promise<Response> {
  const res = await fetch(url);
  if (res.status === 429 && retries > 0) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return fetchWithRetry(url, retries - 1);
  }
  return res;
}

export const DEFAULT_LOCATION: LocationInfo = {
  name: 'New Delhi',
  admin1: 'Delhi',
  country: 'India',
  latitude: 28.6139,
  longitude: 77.209,
  timezone: 'Asia/Kolkata',
};

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

/** Computes a 0–100 fog/mist severity score from visibility (km) and relative humidity (%). */
function computeFogIndex(visibilityKm: number, humidity: number): number {
  if (visibilityKm <= 1.0) {
    return Math.min(100, Math.round(80 + (1.0 - visibilityKm) * 20));
  }
  if (visibilityKm <= 3.5) {
    return Math.round(40 + ((3.5 - visibilityKm) / 2.5) * 40 * (humidity >= 75 ? 1 : 0.7));
  }
  if (visibilityKm <= 6.0 && humidity >= 85) {
    return Math.round(((6.0 - visibilityKm) / 2.5) * 35);
  }
  return 0;
}

function classifyAqi(usAqi: number): { band: AqiBand; label: string; summary: string } {
  if (usAqi <= 50) {
    return {
      band: 'good',
      label: 'Good',
      summary: 'Air quality is satisfactory with low particulate burden for outdoor routines.',
    };
  }
  if (usAqi <= 100) {
    return {
      band: 'moderate',
      label: 'Moderate',
      summary: 'Acceptable for most people; sensitive individuals should monitor prolonged outdoor exertion.',
    };
  }
  if (usAqi <= 150) {
    return {
      band: 'sensitive',
      label: 'Unhealthy for Sensitive Groups',
      summary: 'Children, older adults, and people with asthma should shorten vigorous outdoor activity.',
    };
  }
  if (usAqi <= 200) {
    return {
      band: 'unhealthy',
      label: 'Unhealthy',
      summary: 'Everyone may experience respiratory irritation; shift exercise indoors and seal drafts.',
    };
  }
  if (usAqi <= 300) {
    return {
      band: 'very_unhealthy',
      label: 'Very Unhealthy',
      summary: 'Elevated smog alert: limit outdoor travel to essentials and wear a fitted N95/FFP2 respirator.',
    };
  }
  return {
    band: 'hazardous',
    label: 'Hazardous',
    summary: 'Severe winter smog episode: remain indoors with active filtration and avoid outdoor exertion.',
  };
}

function formatHour(isoTime: string): string {
  const timePart = isoTime.split('T')[1] ?? '00:00';
  return timePart.slice(0, 5);
}

function getHourNumber(isoTime: string): number {
  const timePart = isoTime.split('T')[1] ?? '00:00';
  return Number.parseInt(timePart.slice(0, 2), 10) || 0;
}

function formatWindowRange(startIso: string, endHourCount = 2): string {
  const startHour = getHourNumber(startIso);
  const endHour = (startHour + endHourCount) % 24;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(startHour)}:00–${pad(endHour)}:00`;
}

function rateWindow(avgAqi: number): {
  rating: ActivityRating;
  ratingLabel: string;
  protectionNote: string;
} {
  if (avgAqi <= 60) {
    return {
      rating: 'recommended',
      ratingLabel: 'Recommended',
      protectionNote: 'No respirator needed; standard outdoor comfort.',
    };
  }
  if (avgAqi <= 110) {
    return {
      rating: 'caution',
      ratingLabel: 'Caution',
      protectionNote: 'Keep exertion moderate; sensitive groups carry inhaler or mask.',
    };
  }
  if (avgAqi <= 165) {
    return {
      rating: 'limit',
      ratingLabel: 'Limit & Mask',
      protectionNote: 'Wear a well-fitted N95/FFP2 mask and keep duration under 30 min.',
    };
  }
  return {
    rating: 'avoid',
    ratingLabel: 'Avoid Outdoors',
    protectionNote: 'Keep indoors with sealed windows and indoor HEPA or DIY air filtration.',
  };
}

function evaluatePollutants(current: {
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  so2: number;
  co: number;
}): { pollutants: PollutantBreakdown[]; dominantPollutant: string } {
  const specs: Array<{
    key: PollutantBreakdown['key'];
    label: string;
    formula: string;
    value: number;
    unit: string;
    whoLimit: number;
    whoNote: string;
  }> = [
    {
      key: 'pm25',
      label: 'Fine Particulates',
      formula: 'PM2.5',
      value: round1(current.pm25),
      unit: 'µg/m³',
      whoLimit: 15,
      whoNote: 'WHO 24h limit',
    },
    {
      key: 'pm10',
      label: 'Coarse Dust',
      formula: 'PM10',
      value: round1(current.pm10),
      unit: 'µg/m³',
      whoLimit: 45,
      whoNote: 'WHO 24h limit',
    },
    {
      key: 'no2',
      label: 'Nitrogen Dioxide',
      formula: 'NO₂',
      value: round1(current.no2),
      unit: 'µg/m³',
      whoLimit: 25,
      whoNote: 'WHO 24h limit',
    },
    {
      key: 'o3',
      label: 'Surface Ozone',
      formula: 'O₃',
      value: round1(current.o3),
      unit: 'µg/m³',
      whoLimit: 100,
      whoNote: 'WHO 8h limit',
    },
    {
      key: 'so2',
      label: 'Sulphur Dioxide',
      formula: 'SO₂',
      value: round1(current.so2),
      unit: 'µg/m³',
      whoLimit: 40,
      whoNote: 'WHO 24h limit',
    },
    {
      key: 'co',
      label: 'Carbon Monoxide',
      formula: 'CO',
      value: Math.round(current.co),
      unit: 'µg/m³',
      whoLimit: 4000,
      whoNote: 'WHO 24h limit',
    },
  ];

  const pollutants: PollutantBreakdown[] = specs.map((item) => {
    const ratio = round1(item.value / item.whoLimit);
    let status: PollutantBreakdown['status'] = 'within';
    if (ratio > 4) status = 'severe';
    else if (ratio > 2) status = 'high';
    else if (ratio > 1) status = 'elevated';
    return {
      ...item,
      ratioToWho: ratio,
      status,
    };
  });

  const sorted = [...pollutants].sort((a, b) => b.ratioToWho - a.ratioToWho);
  const dominantPollutant = sorted[0]?.formula ?? 'PM2.5';

  return { pollutants, dominantPollutant };
}

function evaluateInversion(
  windSpeed: number,
  humidity: number,
  pm25: number,
  tempRange: number
): { risk: InversionRiskLevel; label: string; summary: string } {
  if ((windSpeed < 7 && pm25 >= 35) || (windSpeed < 5 && humidity >= 70)) {
    return {
      risk: 'high',
      label: 'High Inversion Trapping',
      summary: `Calm surface winds (${round1(windSpeed)} km/h) and ${Math.round(humidity)}% relative humidity are trapping emissions near ground level; vertical mixing typically improves after midday.`,
    };
  }
  if (windSpeed < 12 && (pm25 >= 18 || tempRange >= 10)) {
    return {
      risk: 'moderate',
      label: 'Moderate Dispersion Lag',
      summary: `Light breezes (${round1(windSpeed)} km/h) slow horizontal clearing during early morning and late evening hours; afternoon warmth offers the cleanest dispersion window.`,
    };
  }
  return {
    risk: 'low',
    label: 'Active Dispersion',
    summary: `Steady airflow (${round1(windSpeed)} km/h) is actively dispersing urban particulates and traffic exhaust across the boundary layer.`,
  };
}

function buildActivityWindows(hourly: HourlyPoint[]): ActivityWindow[] {
  const templates: Array<{
    id: string;
    activity: string;
    startHour: number;
    endHour: number;
    rationalePrefix: string;
    isVentilation?: boolean;
  }> = [
    {
      id: 'school-commute',
      activity: 'School & Work Commute',
      startHour: 6,
      endHour: 10,
      rationalePrefix: 'Lowest morning particulate exposure window',
    },
    {
      id: 'outdoor-walk',
      activity: 'Outdoor Walk & Exercise',
      startHour: 6,
      endHour: 20,
      rationalePrefix: 'Peak atmospheric dispersion period for breathing rate',
    },
    {
      id: 'cross-ventilation',
      activity: 'Home Cross-Ventilation',
      startHour: 10,
      endHour: 17,
      rationalePrefix: 'Best midday air-exchange slot to flush indoor CO₂',
      isVentilation: true,
    },
    {
      id: 'children-play',
      activity: 'Children Outdoor Play',
      startHour: 9,
      endHour: 18,
      rationalePrefix: 'Safest daytime recess and playground window',
    },
    {
      id: 'evening-errands',
      activity: 'Evening Errands & Transit',
      startHour: 16,
      endHour: 21,
      rationalePrefix: 'Before nocturnal cooling traps evening traffic exhaust',
    },
  ];

  const windows: ActivityWindow[] = [];

  for (const dayIndex of [0, 1] as const) {
    const dayPoints = hourly.filter((p) => p.dayIndex === dayIndex);
    if (dayPoints.length === 0) continue;

    for (const tpl of templates) {
      const candidates = dayPoints.filter((p) => {
        const h = getHourNumber(p.time);
        return h >= tpl.startHour && h <= tpl.endHour - 1;
      });

      const pool = candidates.length > 0 ? candidates : dayPoints;
      let bestStart = pool[0];
      let bestAvgAqi = Number.POSITIVE_INFINITY;
      let bestAvgPm25 = Number.POSITIVE_INFINITY;

      for (let i = 0; i < pool.length; i++) {
        const p1 = pool[i];
        const p2 = pool[i + 1] ?? p1;
        const avgAqi = (p1.usAqi + p2.usAqi) / 2;
        const avgPm25 = (p1.pm25 + p2.pm25) / 2;
        if (avgAqi < bestAvgAqi) {
          bestAvgAqi = avgAqi;
          bestAvgPm25 = avgPm25;
          bestStart = p1;
        }
      }

      const roundedAqi = Math.round(bestAvgAqi);
      const roundedPm25 = round1(bestAvgPm25);
      const assessment = rateWindow(roundedAqi);

      let protectionNote = assessment.protectionNote;
      if (tpl.isVentilation) {
        if (roundedAqi <= 80) {
          protectionNote = 'Open opposite windows for 15–20 min to refresh indoor air.';
        } else if (roundedAqi <= 140) {
          protectionNote = 'Limit cross-ventilation to 10 min, then run indoor filtration.';
        } else {
          protectionNote = 'Keep windows sealed; rely on mechanical filtration and exhaust fans briefly.';
        }
      }

      windows.push({
        id: tpl.id,
        activity: tpl.activity,
        dayIndex,
        bestWindow: formatWindowRange(bestStart.time, 2),
        windowAvgAqi: roundedAqi,
        windowAvgPm25: roundedPm25,
        rating: assessment.rating,
        ratingLabel: assessment.ratingLabel,
        protectionNote,
        rationale: `${tpl.rationalePrefix} (avg US AQI ${roundedAqi}, PM2.5 ${roundedPm25} µg/m³).`,
      });
    }
  }

  return windows;
}

export async function searchCities(query: string): Promise<LocationInfo[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    trimmed
  )}&count=7&language=en&format=json`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo geocoding returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    results?: Array<{
      name: string;
      admin1?: string;
      country?: string;
      latitude: number;
      longitude: number;
      timezone?: string;
    }>;
  };

  return (payload.results ?? []).map((item) => ({
    name: item.name,
    admin1: item.admin1,
    country: item.country ?? 'Unknown',
    latitude: item.latitude,
    longitude: item.longitude,
    timezone: item.timezone,
  }));
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<LocationInfo> {
  const fallback: LocationInfo = {
    name: 'Current Location',
    country: `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? 'N' : 'S'}, ${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? 'E' : 'W'}`,
    latitude,
    longitude,
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(
      String(latitude)
    )}&lon=${encodeURIComponent(String(longitude))}&format=jsonv2&zoom=10`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'VayuCheck/1.0 (civic-air-dashboard)',
        'Accept-Language': 'en',
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return fallback;
    }

    const data = (await res.json()) as {
      name?: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        suburb?: string;
        state_district?: string;
        county?: string;
        state?: string;
        country?: string;
      };
    };

    const addr = data.address;
    const cityName =
      addr?.city ||
      addr?.town ||
      addr?.village ||
      addr?.municipality ||
      addr?.state_district ||
      addr?.suburb ||
      addr?.county ||
      data.name;

    if (!cityName) {
      return fallback;
    }

    return {
      name: cityName,
      admin1: addr?.state,
      country: addr?.country || 'Unknown',
      latitude,
      longitude,
    };
  } catch {
    return fallback;
  }
}

export async function fetchAtmosphericData(
  location: LocationInfo,
  bypassCache = false
): Promise<AtmosphericSnapshot> {
  const cacheKey = `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;
  const cached = airCache.get(cacheKey);
  if (!bypassCache && cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.data,
      location: { ...cached.data.location, name: location.name, country: location.country, admin1: location.admin1 },
    };
  }

  const aqUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${location.latitude}&longitude=${location.longitude}` +
    `&current=us_aqi,european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide` +
    `&hourly=us_aqi,european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide` +
    `&timezone=auto&forecast_days=2`;

  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${location.latitude}&longitude=${location.longitude}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure,rain,precipitation` +
    `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,visibility,rain,precipitation` +
    `&timezone=auto&forecast_days=2`;

  const [aqRes, weatherRes] = await Promise.all([
    fetchWithRetry(aqUrl),
    fetchWithRetry(weatherUrl),
  ]);

  if (!aqRes.ok || !weatherRes.ok) {
    if (cached) {
      return {
        ...cached.data,
        location: {
          ...cached.data.location,
          name: location.name,
          country: location.country,
          admin1: location.admin1,
        },
      };
    }
    if (!aqRes.ok) {
      throw new Error(`Open-Meteo Air Quality API failed with HTTP ${aqRes.status}`);
    }
    throw new Error(`Open-Meteo Weather API failed with HTTP ${weatherRes.status}`);
  }

  const aqData = (await aqRes.json()) as {
    timezone: string;
    current: {
      time: string;
      us_aqi: number;
      european_aqi: number;
      pm2_5: number;
      pm10: number;
      nitrogen_dioxide: number;
      ozone: number;
      sulphur_dioxide: number;
      carbon_monoxide: number;
    };
    hourly: {
      time: string[];
      us_aqi: Array<number | null>;
      european_aqi: Array<number | null>;
      pm2_5: Array<number | null>;
      pm10: Array<number | null>;
      nitrogen_dioxide: Array<number | null>;
      ozone: Array<number | null>;
      sulphur_dioxide: Array<number | null>;
      carbon_monoxide: Array<number | null>;
    };
  };

  const weatherData = (await weatherRes.json()) as {
    timezone: string;
    current: {
      time: string;
      temperature_2m: number;
      relative_humidity_2m: number;
      wind_speed_10m: number;
      wind_direction_10m?: number;
      surface_pressure: number;
      rain?: number;
      precipitation?: number;
    };
    hourly: {
      time: string[];
      temperature_2m: Array<number | null>;
      relative_humidity_2m: Array<number | null>;
      wind_speed_10m: Array<number | null>;
      wind_direction_10m?: Array<number | null>;
      visibility: Array<number | null>;
      rain?: Array<number | null>;
      precipitation?: Array<number | null>;
    };
  };

  const firstDayDate = (aqData.hourly.time[0] ?? '').split('T')[0];

  const hourly: HourlyPoint[] = aqData.hourly.time.slice(0, 48).map((isoTime, idx) => {
    const datePart = isoTime.split('T')[0];
    const dayIndex: 0 | 1 = datePart === firstDayDate ? 0 : 1;
    const visMeters = weatherData.hourly.visibility?.[idx] ?? 10000;
    const visKm = round1(visMeters / 1000);
    const rain = round1(weatherData.hourly.rain?.[idx] ?? weatherData.hourly.precipitation?.[idx] ?? 0);
    const rh = Math.round(weatherData.hourly.relative_humidity_2m?.[idx] ?? weatherData.current.relative_humidity_2m);
    const fogIndex = computeFogIndex(visKm, rh);

    return {
      time: isoTime,
      hourLabel: formatHour(isoTime),
      dayIndex,
      usAqi: Math.round(aqData.hourly.us_aqi?.[idx] ?? 0),
      europeanAqi: Math.round(aqData.hourly.european_aqi?.[idx] ?? 0),
      pm25: round1(aqData.hourly.pm2_5?.[idx] ?? 0),
      pm10: round1(aqData.hourly.pm10?.[idx] ?? 0),
      no2: round1(aqData.hourly.nitrogen_dioxide?.[idx] ?? 0),
      o3: round1(aqData.hourly.ozone?.[idx] ?? 0),
      so2: round1(aqData.hourly.sulphur_dioxide?.[idx] ?? 0),
      co: Math.round(aqData.hourly.carbon_monoxide?.[idx] ?? 0),
      temperature: round1(weatherData.hourly.temperature_2m?.[idx] ?? weatherData.current.temperature_2m),
      humidity: rh,
      windSpeed: round1(weatherData.hourly.wind_speed_10m?.[idx] ?? weatherData.current.wind_speed_10m),
      visibilityKm: visKm,
      rainMm: rain,
      fogIndex,
    };
  });

  // Match current hour visibility if available
  const currentTimePrefix = aqData.current.time.slice(0, 13);
  const matchingHour = hourly.find((h) => h.time.startsWith(currentTimePrefix)) ?? hourly[0];
  const currentVisibilityKm = matchingHour?.visibilityKm ?? 8.0;

  const currentPm25 = round1(aqData.current.pm2_5 ?? matchingHour?.pm25 ?? 0);
  const currentPm10 = round1(aqData.current.pm10 ?? matchingHour?.pm10 ?? 0);
  const currentNo2 = round1(aqData.current.nitrogen_dioxide ?? matchingHour?.no2 ?? 0);
  const currentO3 = round1(aqData.current.ozone ?? matchingHour?.o3 ?? 0);
  const currentSo2 = round1(aqData.current.sulphur_dioxide ?? matchingHour?.so2 ?? 0);
  const currentCo = Math.round(aqData.current.carbon_monoxide ?? matchingHour?.co ?? 0);
  const currentUsAqi = Math.round(aqData.current.us_aqi ?? matchingHour?.usAqi ?? 0);
  const currentEuAqi = Math.round(aqData.current.european_aqi ?? matchingHour?.europeanAqi ?? 0);

  const aqiMeta = classifyAqi(currentUsAqi);
  const { pollutants, dominantPollutant } = evaluatePollutants({
    pm25: currentPm25,
    pm10: currentPm10,
    no2: currentNo2,
    o3: currentO3,
    so2: currentSo2,
    co: currentCo,
  });

  const day0Temps = hourly.filter((h) => h.dayIndex === 0).map((h) => h.temperature);
  const tempRange =
    day0Temps.length > 0 ? Math.max(...day0Temps) - Math.min(...day0Temps) : 6;

  const inversion = evaluateInversion(
    weatherData.current.wind_speed_10m,
    weatherData.current.relative_humidity_2m,
    currentPm25,
    tempRange
  );

  const activities = buildActivityWindows(hourly);
  const todayVent = activities.find((a) => a.id === 'cross-ventilation' && a.dayIndex === 0);

  const currentRain = round1(weatherData.current.rain ?? weatherData.current.precipitation ?? matchingHour?.rainMm ?? 0);
  const currentFogIndex = computeFogIndex(currentVisibilityKm, weatherData.current.relative_humidity_2m);

  const snapshot: AtmosphericSnapshot = {
    location: {
      ...location,
      timezone: aqData.timezone || weatherData.timezone || location.timezone,
    },
    fetchedAt: new Date().toISOString(),
    timezone: aqData.timezone || weatherData.timezone || 'UTC',
    current: {
      time: aqData.current.time,
      usAqi: currentUsAqi,
      europeanAqi: currentEuAqi,
      band: aqiMeta.band,
      bandLabel: aqiMeta.label,
      advisorySummary: aqiMeta.summary,
      dominantPollutant,
      pm25: currentPm25,
      pm10: currentPm10,
      no2: currentNo2,
      o3: currentO3,
      so2: currentSo2,
      co: currentCo,
      whoPm25Multiple: round1(currentPm25 / 15),
      temperature: round1(weatherData.current.temperature_2m),
      humidity: Math.round(weatherData.current.relative_humidity_2m),
      windSpeed: round1(weatherData.current.wind_speed_10m),
      windDirection: Math.round(weatherData.current.wind_direction_10m ?? 180),
      visibilityKm: currentVisibilityKm,
      surfacePressure: Math.round(weatherData.current.surface_pressure),
      rainMm: currentRain,
      fogIndex: currentFogIndex,
    },
    inversion,
    bestVentilationWindow: {
      windowLabel: todayVent?.bestWindow ?? '13:00–15:00',
      avgAqi: todayVent?.windowAvgAqi ?? currentUsAqi,
      avgPm25: todayVent?.windowAvgPm25 ?? currentPm25,
      advisable: (todayVent?.windowAvgAqi ?? currentUsAqi) <= 135,
    },
    pollutants,
    hourly,
    activities,
  };

  airCache.set(cacheKey, {
    data: snapshot,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return snapshot;
}
