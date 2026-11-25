import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LOCATION,
  fetchAtmosphericData,
  reverseGeocode,
  searchCities,
} from '../server/openMeteo.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function buildMockHourlyTimes(): string[] {
  const times: string[] = [];
  for (let d = 0; d < 2; d++) {
    const day = d === 0 ? '2026-11-25' : '2026-11-26';
    for (let h = 0; h < 24; h++) {
      times.push(`${day}T${String(h).padStart(2, '0')}:00`);
    }
  }
  return times;
}

describe('Open-Meteo Telemetry & Geocoding', () => {
  it('fetches and normalizes atmospheric snapshot, pollutants, inversion, and activity windows', async () => {
    const times = buildMockHourlyTimes();
    const aqPayload = {
      timezone: 'Asia/Kolkata',
      current: {
        time: '2026-11-25T14:00',
        us_aqi: 168,
        european_aqi: 112,
        pm2_5: 78.4,
        pm10: 142.1,
        nitrogen_dioxide: 48.2,
        ozone: 32.0,
        sulphur_dioxide: 12.5,
        carbon_monoxide: 950,
      },
      hourly: {
        time: times,
        us_aqi: times.map((_, i) => (i >= 13 && i <= 15 ? 95 : 185)),
        european_aqi: times.map(() => 95),
        pm2_5: times.map((_, i) => (i >= 13 && i <= 15 ? 35 : 85)),
        pm10: times.map(() => 130),
        nitrogen_dioxide: times.map(() => 45),
        ozone: times.map(() => 30),
        sulphur_dioxide: times.map(() => 10),
        carbon_monoxide: times.map(() => 900),
      },
    };

    const weatherPayload = {
      timezone: 'Asia/Kolkata',
      current: {
        time: '2026-11-25T14:00',
        temperature_2m: 18.5,
        relative_humidity_2m: 78,
        wind_speed_10m: 4.2,
        wind_direction_10m: 290,
        surface_pressure: 1016,
        rain: 0,
        precipitation: 0,
      },
      hourly: {
        time: times,
        temperature_2m: times.map((_, i) => 12 + (i % 24) * 0.4),
        relative_humidity_2m: times.map(() => 76),
        wind_speed_10m: times.map(() => 5.0),
        wind_direction_10m: times.map(() => 280),
        visibility: times.map(() => 2200),
        rain: times.map(() => 0),
        precipitation: times.map(() => 0),
      },
    };

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('air-quality-api.open-meteo.com')) {
        return new Response(JSON.stringify(aqPayload), { status: 200 });
      }
      return new Response(JSON.stringify(weatherPayload), { status: 200 });
    }) as typeof fetch;

    const snapshot = await fetchAtmosphericData(DEFAULT_LOCATION, true);

    assert.equal(snapshot.location.name, 'New Delhi');
    assert.equal(snapshot.current.usAqi, 168);
    assert.equal(snapshot.current.band, 'unhealthy');
    assert.equal(snapshot.current.pm25, 78.4);
    assert.equal(snapshot.current.whoPm25Multiple, 5.2);
    assert.equal(snapshot.hourly.length, 48);
    assert.equal(snapshot.pollutants.length, 6);
    assert.ok(snapshot.activities.length > 0);
    assert.ok(snapshot.bestVentilationWindow.windowLabel.includes('–'));
  });

  it('serves stale cached snapshot when Open-Meteo returns HTTP 429', async () => {
    const testLoc = {
      name: 'RateLimitTestCity',
      country: 'Testland',
      latitude: 12.34,
      longitude: 56.78,
    };
    const times = buildMockHourlyTimes();

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('air-quality-api')) {
        return new Response(
          JSON.stringify({
            timezone: 'UTC',
            current: {
              time: '2026-11-25T14:00',
              us_aqi: 55,
              european_aqi: 40,
              pm2_5: 14,
              pm10: 25,
              nitrogen_dioxide: 12,
              ozone: 28,
              sulphur_dioxide: 4,
              carbon_monoxide: 200,
            },
            hourly: {
              time: times,
              us_aqi: times.map(() => 55),
              european_aqi: times.map(() => 40),
              pm2_5: times.map(() => 14),
              pm10: times.map(() => 25),
              nitrogen_dioxide: times.map(() => 12),
              ozone: times.map(() => 28),
              sulphur_dioxide: times.map(() => 4),
              carbon_monoxide: times.map(() => 200),
            },
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          timezone: 'UTC',
          current: {
            time: '2026-11-25T14:00',
            temperature_2m: 20,
            relative_humidity_2m: 50,
            wind_speed_10m: 10,
            surface_pressure: 1012,
          },
          hourly: {
            time: times,
            temperature_2m: times.map(() => 20),
            relative_humidity_2m: times.map(() => 50),
            wind_speed_10m: times.map(() => 10),
            visibility: times.map(() => 10000),
          },
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const fresh = await fetchAtmosphericData(testLoc, true);
    assert.equal(fresh.current.usAqi, 55);

    // Now simulate HTTP 429 rate-limit on refresh — should fall back to cached data
    globalThis.fetch = (async () => new Response('Too Many Requests', { status: 429 })) as typeof fetch;

    const fallback = await fetchAtmosphericData(testLoc, true);
    assert.equal(fallback.current.usAqi, 55);
    assert.equal(fallback.location.name, 'RateLimitTestCity');
  });

  it('searchCities skips short queries and maps geocoding results', async () => {
    assert.deepEqual(await searchCities('a'), []);

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              name: 'London',
              admin1: 'England',
              country: 'United Kingdom',
              latitude: 51.5072,
              longitude: -0.1276,
              timezone: 'Europe/London',
            },
          ],
        }),
        { status: 200 }
      )) as typeof fetch;

    const cities = await searchCities('London');
    assert.equal(cities.length, 1);
    assert.equal(cities[0].name, 'London');
    assert.equal(cities[0].country, 'United Kingdom');
  });

  it('reverseGeocode falls back gracefully when Nominatim fails', async () => {
    globalThis.fetch = (async () => new Response('Error', { status: 503 })) as typeof fetch;

    const loc = await reverseGeocode(28.61, 77.21);
    assert.equal(loc.name, 'Current Location');
    assert.ok(loc.country.includes('28.61°N'));
  });
});
