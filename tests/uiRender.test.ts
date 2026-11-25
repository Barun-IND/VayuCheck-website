import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GoogleAuthGate } from '../src/components/GoogleAuthGate.tsx';
import { TopBar } from '../src/components/TopBar.tsx';
import { LocationToolbar } from '../src/components/LocationToolbar.tsx';
import { ActivityPlanner } from '../src/components/ActivityPlanner.tsx';
import { DailyBriefingLedger } from '../src/components/DailyBriefingLedger.tsx';
import { ProfileDrawer } from '../src/components/ProfileDrawer.tsx';
import { ForecastChart } from '../src/components/ForecastChart.tsx';
import { DEFAULT_CITY, DEFAULT_PROFILE } from '../src/lib/airStyle.ts';
import { generateProfileRecommendations } from '../server/profileTaskCatalog.ts';

describe('UI Components SSR Render & Accessibility', () => {
  it('renders GoogleAuthGate with main landmark, H1, and accessible Google sign-in button', () => {
    const html = renderToStaticMarkup(
      React.createElement(GoogleAuthGate, {
        darkMode: false,
        onToggleDarkMode: () => {},
      })
    );

    assert.ok(html.includes('<main'));
    assert.ok(html.includes('Sign in to VayuCheck'));
    assert.ok(html.includes('Continue with Google'));
    assert.ok(html.includes('aria-pressed="false"'));
  });

  it('renders TopBar with primary navigation and signed-in user controls', () => {
    const html = renderToStaticMarkup(
      React.createElement(TopBar, {
        user: {
          id: 'u1',
          email: 'barun@example.com',
          user_metadata: { full_name: 'Barun' },
        } as never,
        darkMode: true,
        onToggleDarkMode: () => {},
        onOpenAuth: () => {},
        onSignOut: () => {},
        onOpenProfile: () => {},
      })
    );

    assert.ok(html.includes('aria-label="Primary sections"'));
    assert.ok(html.includes('Daily Hacks'));
    assert.ok(html.includes('aria-pressed="true"'));
    assert.ok(html.includes('Barun'));
    assert.ok(html.includes('aria-label="Sign out"'));
  });

  it('renders LocationToolbar with search input, presets, and geolocation trigger', () => {
    const html = renderToStaticMarkup(
      React.createElement(LocationToolbar, {
        location: DEFAULT_CITY,
        observationTime: '2026-11-26T09:00',
        timezone: 'Asia/Kolkata',
        isLoading: false,
        onSelectLocation: () => {},
        onUseGeolocation: () => {},
        isLocating: false,
        geoError: null,
        onRefresh: () => {},
      })
    );

    assert.ok(html.includes('aria-label="Search city"'));
    assert.ok(html.includes('Use my location'));
    assert.ok(html.includes('New Delhi'));
  });

  it('renders ActivityPlanner with tablist and activity guidance', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActivityPlanner, {
        activities: [
          {
            id: 'cross-ventilation',
            dayIndex: 0,
            activity: 'Cross-Ventilation Window',
            rating: 'caution',
            ratingLabel: 'Caution',
            bestWindow: '13:00–15:00',
            windowAvgAqi: 98,
            windowAvgPm25: 34,
            protectionNote: 'Air rooms briefly during midday dispersion.',
            rationale: 'Boundary layer mixing lowers surface particulate build-up.',
          },
        ],
        activityNotes: [
          {
            activityId: 'cross-ventilation',
            tailoredTip: 'Open opposite windows for 15 minutes at 13:00–15:00.',
          },
        ],
      })
    );

    assert.ok(html.includes('role="tablist"'));
    assert.ok(html.includes('Cross-Ventilation Window'));
    assert.ok(html.includes('13:00–15:00'));
  });

  it('renders DailyBriefingLedger with live impact metrics, category tabs, and switch toggles', () => {
    const recs = generateProfileRecommendations(DEFAULT_PROFILE, 'New Delhi', '13:00–15:00');
    const html = renderToStaticMarkup(
      React.createElement(DailyBriefingLedger, {
        locationName: 'New Delhi',
        briefing: {
          generatedAt: '2026-11-26T09:00:00Z',
          headlineSummary: 'Elevated morning PM2.5.',
          inversionExplanation: 'Calm inversion layer.',
          alert: {
            active: true,
            severityLabel: 'Unhealthy',
            headline: 'Limit outdoor exertion.',
            immediateActions: ['Keep windows shut'],
          },
          activityNotes: [],
          recommendations: recs,
        },
        loading: false,
        error: null,
        profile: DEFAULT_PROFILE,
        committedIds: [recs[0].id],
        onToggleCommit: () => {},
        onRetry: () => {},
        onOpenProfile: () => {},
      })
    );

    assert.ok(html.includes('Daily Hacks &amp; Quick Routines'));
    assert.ok(html.includes('aria-live="polite"'));
    assert.ok(html.includes('role="switch"'));
    assert.ok(html.includes('aria-checked="true"'));
    assert.ok(html.includes('role="tabpanel"'));
    assert.ok(html.includes('/ 9 completed'));
    assert.ok(html.includes('kg CO₂e today'));
  });

  it('renders ForecastChart with SVG chart and mode switcher tabs', () => {
    const html = renderToStaticMarkup(
      React.createElement(ForecastChart, {
        currentTime: '2026-11-26T09:00',
        hourly: [
          {
            time: '2026-11-26T09:00',
            hourLabel: '09:00',
            dayIndex: 0,
            usAqi: 155,
            europeanAqi: 110,
            pm25: 72,
            pm10: 130,
            no2: 45,
            o3: 30,
            so2: 10,
            co: 850,
            temperature: 16,
            humidity: 78,
            windSpeed: 3.5,
            visibilityKm: 2.0,
            rainMm: 0,
            fogIndex: 60,
          },
          {
            time: '2026-11-26T10:00',
            hourLabel: '10:00',
            dayIndex: 0,
            usAqi: 140,
            europeanAqi: 98,
            pm25: 62,
            pm10: 115,
            no2: 40,
            o3: 34,
            so2: 9,
            co: 800,
            temperature: 17.5,
            humidity: 72,
            windSpeed: 5.0,
            visibilityKm: 3.2,
            rainMm: 0,
            fogIndex: 35,
          },
        ],
      })
    );

    assert.ok(html.includes('<svg'));
    assert.ok(html.includes('role="tablist"'));
    assert.ok(html.includes('48-Hour'));
  });

  it('renders ProfileDrawer dialog with aria-modal, fieldsets, and aria-pressed buttons', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProfileDrawer, {
        open: true,
        profile: DEFAULT_PROFILE,
        isOnboarding: true,
        onClose: () => {},
        onSave: () => {},
      })
    );

    assert.ok(html.includes('role="dialog"'));
    assert.ok(html.includes('aria-modal="true"'));
    assert.ok(html.includes('Set Up Your Household Profile'));
    assert.ok(html.includes('aria-pressed="true"'));
    assert.ok(html.includes('Save &amp; Update Briefing'));
  });
});
