import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  ActivityGuidanceNote,
  AtmosphericSnapshot,
  BriefingRecommendation,
  DailyBriefing,
  HouseholdProfile,
} from '../src/types/air.ts';
import { generateProfileRecommendations } from './profileTaskCatalog.ts';

export interface BriefingSummaryPayload {
  generatedAt: string;
  headlineSummary: string;
  inversionExplanation: string;
  alert: DailyBriefing['alert'];
  activityNotes: ActivityGuidanceNote[];
}

export interface BriefingActionsPayload {
  generatedAt: string;
  recommendations: BriefingRecommendation[];
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const summaryCache = new Map<string, CacheEntry<BriefingSummaryPayload>>();
const actionsCache = new Map<string, CacheEntry<BriefingActionsPayload>>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const SENSITIVITY_LABELS: Record<HouseholdProfile['sensitivity'], string> = {
  general: 'General adult household',
  children: 'Family with young or school-age children',
  seniors: 'Household with older adults (65+)',
  respiratory: 'Household member with asthma or respiratory sensitivity',
};

const COMMUTE_LABELS: Record<HouseholdProfile['commute'], string> = {
  car: 'Private car commuter',
  two_wheeler: 'Two-wheeler / scooter commuter',
  transit: 'Public transit / metro / bus commuter',
  walk_cycle: 'Walking or cycling commuter',
};

const HEATING_LABELS: Record<HouseholdProfile['heatingCooking'], string> = {
  gas: 'LPG / natural gas cooking & heating',
  electric: 'Electric / induction cooking & heat pump',
  solid_fuel: 'Wood, coal, or biomass nearby/indoors',
};

const INDOOR_LABELS: Record<HouseholdProfile['indoorSetup'], string> = {
  hepa_purifier: 'HEPA air purifier at home',
  ac_filter: 'Split AC / HVAC filter without HEPA',
  natural_ventilation: 'Natural window ventilation only',
};

function makeCacheKey(snapshot: AtmosphericSnapshot, profile: HouseholdProfile): string {
  const lat = snapshot.location.latitude.toFixed(2);
  const lon = snapshot.location.longitude.toFixed(2);
  const aqiBucket = Math.round(snapshot.current.usAqi / 5) * 5;
  return `${lat},${lon}|${snapshot.location.name}|${aqiBucket}|${profile.sensitivity}|${profile.commute}|${profile.heatingCooking}|${profile.indoorSetup}|${profile.householdSize}`;
}

function buildContextHeader(snapshot: AtmosphericSnapshot, profile: HouseholdProfile): {
  locationLabel: string;
  contextText: string;
} {
  const locationLabel = `${snapshot.location.name}${snapshot.location.admin1 ? `, ${snapshot.location.admin1}` : ''}, ${snapshot.location.country}`;
  const todayActivities = snapshot.activities
    .filter((a) => a.dayIndex === 0)
    .map((a) => `${a.id}: ${a.bestWindow} (AQI ${a.windowAvgAqi}, ${a.ratingLabel})`)
    .join('; ');

  const contextText = `City: ${locationLabel} (${snapshot.current.time} ${snapshot.timezone})
Air: US AQI ${snapshot.current.usAqi} (${snapshot.current.bandLabel}), Dominant ${snapshot.current.dominantPollutant}, PM2.5 ${snapshot.current.pm25} µg/m³ (${snapshot.current.whoPm25Multiple}x WHO), PM10 ${snapshot.current.pm10}, NO2 ${snapshot.current.no2}, O3 ${snapshot.current.o3}
Weather: ${snapshot.current.temperature}°C, RH ${snapshot.current.humidity}%, Wind ${snapshot.current.windSpeed} km/h, Vis ${snapshot.current.visibilityKm} km, Inversion: ${snapshot.inversion.label}
Ventilation slot: ${snapshot.bestVentilationWindow.windowLabel} (AQI ${snapshot.bestVentilationWindow.avgAqi}, advisable=${snapshot.bestVentilationWindow.advisable})
Activity windows: ${todayActivities}
Household: ${SENSITIVITY_LABELS[profile.sensitivity]}, ${profile.householdSize} people, ${COMMUTE_LABELS[profile.commute]}, ${HEATING_LABELS[profile.heatingCooking]}, ${INDOOR_LABELS[profile.indoorSetup]}.`;

  return { locationLabel, contextText };
}

// Ordered model fallback chain: try fastest current models first, then fall back on 404/503/UNAVAILABLE
const MODEL_CHAIN = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
] as const;

function shouldFallbackToNextModel(msg: string): boolean {
  return (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('429') ||
    msg.includes('404') ||
    msg.includes('NOT_FOUND') ||
    msg.includes('no longer available') ||
    msg.includes('overloaded') ||
    msg.includes('high demand')
  );
}

async function callWithModelFallback<T>(
  fn: (model: string) => Promise<T>,
  maxRetriesPerModel = 1
): Promise<T> {
  let lastError: unknown;

  for (const model of MODEL_CHAIN) {
    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      try {
        return await fn(model);
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);

        // Auth/bad-request errors — fail immediately regardless of model
        const isAuthOrBadRequest =
          msg.includes('API_KEY_INVALID') ||
          msg.includes('PERMISSION_DENIED') ||
          msg.includes('400') ||
          msg.includes('403');
        if (isAuthOrBadRequest) {
          throw err;
        }

        // If the model itself is unavailable, retired (404), or rate-limited, move immediately to next model
        if (shouldFallbackToNextModel(msg)) {
          console.warn(
            `[VayuCheck] Model ${model} unavailable (attempt ${attempt + 1}): ${msg.slice(0, 120)}. ${
              MODEL_CHAIN.indexOf(model) < MODEL_CHAIN.length - 1
                ? 'Falling back to next model...'
                : 'No more fallback models.'
            }`
          );
          break;
        }

        // Other transient error — retry with exponential backoff
        if (attempt < maxRetriesPerModel) {
          const delay = 400 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  throw lastError;
}

function buildFallbackSummary(
  snapshot: AtmosphericSnapshot,
  profile: HouseholdProfile
): BriefingSummaryPayload {
  const { current, location, inversion, bestVentilationWindow } = snapshot;
  const sensitivityNote =
    profile.sensitivity === 'respiratory'
      ? 'Keep rescue medication handy and filter indoor air.'
      : profile.sensitivity === 'children'
        ? 'Limit prolonged vigorous outdoor play during peak haze.'
        : profile.sensitivity === 'seniors'
          ? 'Prefer indoor routines during stagnant morning and evening hours.'
          : 'Schedule outdoor errands during peak midday dispersion.';

  return {
    generatedAt: new Date().toISOString(),
    headlineSummary: `${location.name} currently records US AQI ${current.usAqi} (${current.bandLabel}) with PM2.5 at ${current.pm25} µg/m³ (${current.whoPm25Multiple}× WHO limit). ${sensitivityNote}`,
    inversionExplanation: inversion.summary,
    alert: {
      active: current.usAqi >= 101 || inversion.risk === 'high',
      severityLabel: current.bandLabel,
      headline: current.advisorySummary,
      immediateActions: [
        bestVentilationWindow.advisable
          ? `Ventilate briefly around ${bestVentilationWindow.windowLabel}`
          : 'Keep exterior doors and windows sealed',
        profile.commute === 'two_wheeler' || profile.commute === 'walk_cycle'
          ? 'Wear a fitted N95/FFP2 respirator outdoors'
          : 'Switch vehicle cabin air to recirculate mode',
        'Run kitchen exhaust or indoor filtration while cooking',
      ],
    },
    activityNotes: [
      {
        activityId: 'school-commute',
        tailoredTip: `Plan departure inside the lowest-exposure morning slot (${bestVentilationWindow.windowLabel} or pre-rush hours).`,
      },
      {
        activityId: 'outdoor-walk',
        tailoredTip:
          current.usAqi > 120
            ? 'Shift brisk exercise indoors until particulate levels drop.'
            : 'Keep outdoor walks moderate and avoid main traffic corridors.',
      },
      {
        activityId: 'cross-ventilation',
        tailoredTip: bestVentilationWindow.advisable
          ? `Open opposite windows for 15 min around ${bestVentilationWindow.windowLabel}.`
          : 'Keep windows closed and use mechanical filtration instead.',
      },
      {
        activityId: 'children-play',
        tailoredTip:
          current.usAqi > 110
            ? 'Move active play indoors to protect developing lungs.'
            : 'Stick to sheltered parks away from idling vehicles.',
      },
      {
        activityId: 'evening-errands',
        tailoredTip: 'Combine trips before dusk when boundary-layer cooling traps exhaust.',
      },
    ],
  };
}

function buildFallbackRecommendations(
  snapshot: AtmosphericSnapshot,
  profile: HouseholdProfile
): BriefingRecommendation[] {
  return generateProfileRecommendations(
    profile,
    snapshot.location.name,
    snapshot.bestVentilationWindow.windowLabel
  );
}

export async function generateBriefingSummary(
  snapshot: AtmosphericSnapshot,
  profile: HouseholdProfile,
  forceRefresh = false
): Promise<BriefingSummaryPayload> {
  const cacheKey = makeCacheKey(snapshot, profile);
  const cached = summaryCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  let ai: GoogleGenAI;
  try {
    ai = getAiClient();
  } catch (err) {
    console.warn('[VayuCheck] Using fallback summary (no API client):', err);
    return buildFallbackSummary(snapshot, profile);
  }

  const { locationLabel, contextText } = buildContextHeader(snapshot, profile);

  const prompt = `Return concise civic air summary JSON strictly for ${locationLabel}.
${contextText}

Rules (plain English, no emojis, no markdown, concise):
- headlineSummary: 2 crisp sentences referencing ${snapshot.location.name}'s exact AQI/PM2.5 and household priority.
- inversionExplanation: 1-2 short sentences on wind, humidity, and dispersion right now.
- alert.active: true if US AQI >= 101 or inversion is high, else false. alert.immediateActions: 3 brief actionable phrases.
- activityNotes: 1 short sentence each for "school-commute", "outdoor-walk", "cross-ventilation", "children-play", "evening-errands".`;

  try {
    const response = await callWithModelFallback((model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          systemInstruction:
            'You are a concise environmental health and urban meteorology advisor. Ground every sentence strictly in the provided city telemetry. Plain English only.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headlineSummary: { type: Type.STRING },
              inversionExplanation: { type: Type.STRING },
              alert: {
                type: Type.OBJECT,
                properties: {
                  active: { type: Type.BOOLEAN },
                  severityLabel: { type: Type.STRING },
                  headline: { type: Type.STRING },
                  immediateActions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['active', 'severityLabel', 'headline', 'immediateActions'],
              },
              activityNotes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    activityId: { type: Type.STRING },
                    tailoredTip: { type: Type.STRING },
                  },
                  required: ['activityId', 'tailoredTip'],
                },
              },
            },
            required: ['headlineSummary', 'inversionExplanation', 'alert', 'activityNotes'],
          },
        },
      })
    );

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      throw new Error('Gemini returned an empty summary response.');
    }

    const parsed = JSON.parse(rawText) as Omit<BriefingSummaryPayload, 'generatedAt'>;
    const result: BriefingSummaryPayload = {
      generatedAt: new Date().toISOString(),
      headlineSummary: parsed.headlineSummary,
      inversionExplanation: parsed.inversionExplanation,
      alert: {
        active: Boolean(parsed.alert?.active),
        severityLabel: parsed.alert?.severityLabel || snapshot.current.bandLabel,
        headline: parsed.alert?.headline || snapshot.current.advisorySummary,
        immediateActions: Array.isArray(parsed.alert?.immediateActions)
          ? parsed.alert.immediateActions.slice(0, 3)
          : [],
      },
      activityNotes: Array.isArray(parsed.activityNotes) ? parsed.activityNotes : [],
    };

    summaryCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (err) {
    console.warn('[VayuCheck] Gemini summary failed, serving telemetry fallback:', err);
    const fallback = buildFallbackSummary(snapshot, profile);
    summaryCache.set(cacheKey, { data: fallback, expiresAt: Date.now() + 60_000 });
    return fallback;
  }
}

async function generateBatchRecommendations(
  ai: GoogleGenAI,
  locationLabel: string,
  contextText: string,
  batchSpec: Array<{ category: BriefingRecommendation['category']; focus: string }>,
  batchTag: string
): Promise<BriefingRecommendation[]> {
  const specLines = batchSpec
    .map((item, i) => `${i + 1}. category="${item.category}": ${item.focus}`)
    .join('\n');

  const prompt = `Return exactly ${batchSpec.length} ultra-concise air-quality recommendations in strict JSON for ${locationLabel}:
${specLines}

Context:
${contextText}

Rules (plain English, no emojis, no markdown):
- Every string under 16 words. steps: 2 short steps.
- Use exact category values from the list above, effort="Low effort"|"Medium effort"|"Habit shift", realistic estimatedCo2KgSaved (0.2-8.0), estimatedExposureDropPct (5-45).`;

  const response = await callWithModelFallback((model) =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        systemInstruction:
          'You are a concise environmental health advisor. Return brief, practical JSON recommendations grounded strictly in the provided city and household.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  category: { type: Type.STRING },
                  title: { type: Type.STRING },
                  effort: { type: Type.STRING },
                  timeframe: { type: Type.STRING },
                  steps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  directHealthImpact: { type: Type.STRING },
                  directEmissionImpact: { type: Type.STRING },
                  scientificMechanism: { type: Type.STRING },
                  estimatedCo2KgSaved: { type: Type.NUMBER },
                  estimatedExposureDropPct: { type: Type.NUMBER },
                },
                required: [
                  'id',
                  'category',
                  'title',
                  'effort',
                  'timeframe',
                  'steps',
                  'directHealthImpact',
                  'directEmissionImpact',
                  'scientificMechanism',
                  'estimatedCo2KgSaved',
                  'estimatedExposureDropPct',
                ],
              },
            },
          },
          required: ['recommendations'],
        },
      },
    })
  );

  const rawText = (response.text ?? '').trim();
  if (!rawText) return [];
  const parsed = JSON.parse(rawText) as { recommendations?: BriefingRecommendation[] };
  const validEfforts = new Set(['Low effort', 'Medium effort', 'Habit shift']);

  return (parsed.recommendations ?? []).slice(0, batchSpec.length).map((rec, idx) => {
    const expectedCategory = batchSpec[idx]?.category ?? 'routine';
    return {
      ...rec,
      id: `${batchTag}-${idx + 1}-${(rec.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 10) || idx}`,
      category: expectedCategory,
      effort: (validEfforts.has(rec.effort)
        ? rec.effort
        : 'Low effort') as BriefingRecommendation['effort'],
      estimatedCo2KgSaved: Math.max(
        0,
        Math.round((Number(rec.estimatedCo2KgSaved) || 0.5) * 10) / 10
      ),
      estimatedExposureDropPct: Math.min(
        60,
        Math.max(2, Math.round(Number(rec.estimatedExposureDropPct) || 10))
      ),
      steps: Array.isArray(rec.steps) ? rec.steps.slice(0, 3) : [],
    };
  });
}

export async function generateBriefingActions(
  snapshot: AtmosphericSnapshot,
  profile: HouseholdProfile,
  forceRefresh = false
): Promise<BriefingActionsPayload> {
  const cacheKey = makeCacheKey(snapshot, profile);
  const cached = actionsCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const ai = getAiClient();
    const { locationLabel, contextText } = buildContextHeader(snapshot, profile);

    const [batchA, batchB] = await Promise.all([
      generateBatchRecommendations(
        ai,
        locationLabel,
        contextText,
        [
          {
            category: 'routine',
            focus: 'Low-emission daily commute or errand timing routine for today',
          },
          {
            category: 'routine',
            focus: 'Low-emission home cooking or energy routine that cuts indoor NO2 and PM2.5',
          },
          {
            category: 'indoor_hack',
            focus: 'Affordable immediate indoor air quality hack matched to their filtration setup',
          },
        ],
        'a'
      ),
      generateBatchRecommendations(
        ai,
        locationLabel,
        contextText,
        [
          {
            category: 'indoor_hack',
            focus: 'Practical draft-sealing, wet-cleaning, or ventilation timing indoor hack',
          },
          {
            category: 'sustainable_alternative',
            focus: 'Lower-emission transport alternative suited to their commute and city',
          },
          {
            category: 'sustainable_alternative',
            focus: 'Sustainable household fuel, appliance, or community carpool alternative',
          },
        ],
        'b'
      ),
    ]);

    const normalizedRecs = [...batchA, ...batchB];
    if (normalizedRecs.length === 0) {
      throw new Error('Gemini returned an empty recommendations response.');
    }

    const result: BriefingActionsPayload = {
      generatedAt: new Date().toISOString(),
      recommendations: normalizedRecs,
    };

    actionsCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (err) {
    console.warn('[VayuCheck] Gemini actions failed, serving telemetry fallback:', err);
    const fallback: BriefingActionsPayload = {
      generatedAt: new Date().toISOString(),
      recommendations: buildFallbackRecommendations(snapshot, profile),
    };
    actionsCache.set(cacheKey, { data: fallback, expiresAt: Date.now() + 60_000 });
    return fallback;
  }
}

export async function generateDailyBriefing(
  snapshot: AtmosphericSnapshot,
  profile: HouseholdProfile,
  forceRefresh = false
): Promise<DailyBriefing> {
  const [summary, actions] = await Promise.all([
    generateBriefingSummary(snapshot, profile, forceRefresh),
    generateBriefingActions(snapshot, profile, forceRefresh),
  ]);

  return {
    generatedAt: summary.generatedAt,
    headlineSummary: summary.headlineSummary,
    inversionExplanation: summary.inversionExplanation,
    alert: summary.alert,
    activityNotes: summary.activityNotes,
    recommendations: actions.recommendations,
  };
}
