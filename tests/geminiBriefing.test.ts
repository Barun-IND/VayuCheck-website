import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateBriefingActions,
  generateBriefingSummary,
} from '../server/geminiBriefing.ts';
import {
  CATEGORY_LABELS,
  DEFAULT_CITY,
  DEFAULT_PROFILE,
  getAqiTone,
  getInversionTone,
  PRESET_CITIES,
} from '../src/lib/airStyle.ts';
import type { AtmosphericSnapshot } from '../src/types/air.ts';

const originalGeminiKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  if (originalGeminiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiKey;
  }
});

const mockSnapshot: AtmosphericSnapshot = {
  location: DEFAULT_CITY,
  fetchedAt: '2026-11-25T12:00:00.000Z',
  timezone: 'Asia/Kolkata',
  current: {
    time: '2026-11-25T12:00',
    usAqi: 182,
    europeanAqi: 120,
    band: 'unhealthy',
    bandLabel: 'Unhealthy',
    advisorySummary: 'Everyone may experience respiratory irritation.',
    dominantPollutant: 'PM2.5',
    pm25: 92.4,
    pm10: 158.0,
    no2: 52.1,
    o3: 34.0,
    so2: 14.0,
    co: 1100,
    whoPm25Multiple: 6.2,
    temperature: 17.2,
    humidity: 79,
    windSpeed: 3.4,
    windDirection: 285,
    visibilityKm: 1.8,
    surfacePressure: 1018,
    rainMm: 0,
    fogIndex: 68,
  },
  inversion: {
    risk: 'high',
    label: 'High Inversion Trap Risk',
    summary: 'Calm winds and shallow mixing trap particulates near ground level.',
  },
  bestVentilationWindow: {
    windowLabel: '13:00–15:00',
    avgAqi: 125,
    avgPm25: 55.0,
    advisable: true,
  },
  pollutants: [],
  hourly: [],
  activities: [],
};

describe('Gemini Briefing Fallbacks & UI Style Constants', () => {
  it('returns structured fallback summary when GEMINI_API_KEY is unset', async () => {
    delete process.env.GEMINI_API_KEY;

    const summary = await generateBriefingSummary(mockSnapshot, DEFAULT_PROFILE, true);

    assert.ok(summary.headlineSummary.includes('New Delhi'));
    assert.equal(summary.alert.active, true);
    assert.ok(summary.alert.immediateActions.length >= 2);
    assert.ok(summary.activityNotes.length >= 2);
  });

  it('returns profile-tailored fallback recommendations when GEMINI_API_KEY is unset', async () => {
    delete process.env.GEMINI_API_KEY;

    const actions = await generateBriefingActions(mockSnapshot, DEFAULT_PROFILE, true);

    assert.ok(actions.recommendations.length >= 6);
    assert.ok(actions.recommendations.every((r) => r.estimatedCo2KgSaved > 0));
  });

  it('exposes complete AQI tone helpers, category labels, and preset cities', () => {
    assert.equal(getAqiTone('good').glyph, '●');
    assert.equal(getAqiTone('hazardous').glyph, '■');
    assert.ok(getInversionTone('high').textClass.length > 0);
    assert.equal(Object.keys(CATEGORY_LABELS).length, 3);
    assert.ok(PRESET_CITIES.length >= 5);
    assert.equal(DEFAULT_CITY.name, 'New Delhi');
  });
});
