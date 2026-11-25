import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import type express from 'express';
import { createApp } from '../server/app.ts';
import { DEFAULT_CITY, DEFAULT_PROFILE } from '../src/lib/airStyle.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

interface MockResponseResult {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
  json<T = unknown>(): T;
}

/** Dispatches an HTTP request directly through an Express app in-memory without opening TCP ports. */
async function invokeApp(
  app: express.Express,
  method: string,
  url: string,
  body?: unknown,
  ip = '127.0.0.1'
): Promise<MockResponseResult> {
  const payloadStr = body !== undefined ? JSON.stringify(body) : '';
  const reqStream = Readable.from(payloadStr ? [Buffer.from(payloadStr, 'utf8')] : []);
  const headersIn: Record<string, string> = {};
  if (payloadStr) {
    headersIn['content-type'] = 'application/json';
    headersIn['content-length'] = String(Buffer.byteLength(payloadStr));
  }

  const req = Object.assign(reqStream, {
    method,
    url,
    headers: headersIn,
    ip,
    socket: { remoteAddress: ip },
    connection: { remoteAddress: ip },
  });

  const headersOut: Record<string, string> = {};
  const chunks: Buffer[] = [];
  let statusCode = 200;

  return new Promise<MockResponseResult>((resolve, reject) => {
    const res = Object.assign(new EventEmitter(), {
      statusCode,
      headersSent: false,
      setHeader(name: string, val: string | number | readonly string[]) {
        headersOut[name.toLowerCase()] = Array.isArray(val) ? val.join(', ') : String(val);
        return res;
      },
      getHeader(name: string) {
        return headersOut[name.toLowerCase()];
      },
      removeHeader(name: string) {
        delete headersOut[name.toLowerCase()];
      },
      writeHead(code: number, hdrs?: Record<string, string | number | readonly string[]>) {
        statusCode = code;
        res.statusCode = code;
        if (hdrs) {
          for (const [k, v] of Object.entries(hdrs)) {
            res.setHeader(k, v);
          }
        }
        return res;
      },
      write(chunk: Buffer | string) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
      },
      end(chunk?: Buffer | string) {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        res.headersSent = true;
        const bodyText = Buffer.concat(chunks).toString('utf8');
        resolve({
          status: res.statusCode,
          headers: headersOut,
          bodyText,
          json<T = unknown>() {
            return JSON.parse(bodyText) as T;
          },
        });
        return res;
      },
    });

    (app as unknown as (r: unknown, s: unknown, next: (err?: unknown) => void) => void)(
      req,
      res,
      (err?: unknown) => {
        if (err) reject(err);
        else resolve({ status: 404, headers: headersOut, bodyText: '', json: () => ({}) as never });
      }
    );
  });
}

describe('Express API Routes, Validation & Security Headers', () => {
  const app = createApp({ rateLimit: { maxRequests: 100, windowMs: 60_000 } });

  it('GET /api/health returns 200 and enforces security headers', async () => {
    const res = await invokeApp(app, 'GET', '/api/health');
    assert.equal(res.status, 200);

    assert.equal(res.headers['x-powered-by'], undefined);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
    assert.ok(res.headers['x-ratelimit-limit']);

    const body = res.json<{ status: string; supabase: { connected: boolean } }>();
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.supabase.connected, 'boolean');
  });

  it('validates sessionId and ISO date on /api/user-state', async () => {
    const badSess = await invokeApp(app, 'GET', '/api/user-state?sessionId=bad');
    assert.equal(badSess.status, 400);

    const badDate = await invokeApp(
      app,
      'GET',
      '/api/user-state?sessionId=valid-session-123&date=invalid'
    );
    assert.equal(badDate.status, 400);

    const valid = await invokeApp(
      app,
      'GET',
      '/api/user-state?sessionId=valid-session-123&date=2026-11-26'
    );
    assert.equal(valid.status, 200);
    const body = valid.json<{ state: unknown }>();
    assert.ok('state' in body);
  });

  it('validates payloads on PUT /api/user-state/profile and POST /api/user-state/commit', async () => {
    const badProfile = await invokeApp(app, 'PUT', '/api/user-state/profile', {
      sessionId: 'valid-session-123',
      location: { ...DEFAULT_CITY, latitude: 999 },
      profile: DEFAULT_PROFILE,
    });
    assert.equal(badProfile.status, 400);

    const badCommit = await invokeApp(app, 'POST', '/api/user-state/commit', {
      sessionId: 'short',
      hackId: 'h1',
      committed: true,
    });
    assert.equal(badCommit.status, 400);
  });

  it('validates WGS84 bounds on /api/reverse-geocode and /api/air-data', async () => {
    const badReverse = await invokeApp(app, 'GET', '/api/reverse-geocode?lat=120&lon=77');
    assert.equal(badReverse.status, 400);

    const badAir = await invokeApp(app, 'GET', '/api/air-data?lat=28.6&lon=-250');
    assert.equal(badAir.status, 400);
  });

  it('GET /api/geocode returns mapped cities from Open-Meteo', async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              name: 'Delhi',
              admin1: 'Delhi',
              country: 'India',
              latitude: 28.6139,
              longitude: 77.209,
            },
          ],
        }),
        { status: 200 }
      )) as typeof fetch;

    const res = await invokeApp(app, 'GET', '/api/geocode?q=Delhi');
    assert.equal(res.status, 200);
    const data = res.json<{ results: Array<{ name: string }> }>();
    assert.equal(data.results.length, 1);
    assert.equal(data.results[0].name, 'Delhi');
  });

  it('POST /api/briefing/summary and /actions validate request body and return fallback responses', async () => {
    const badSummary = await invokeApp(app, 'POST', '/api/briefing/summary', {});
    assert.equal(badSummary.status, 400);

    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const mockSnapshot = {
        location: DEFAULT_CITY,
        fetchedAt: '2026-11-26T00:00:00Z',
        timezone: 'Asia/Kolkata',
        current: {
          time: '2026-11-26T09:00',
          usAqi: 155,
          europeanAqi: 110,
          band: 'unhealthy',
          bandLabel: 'Unhealthy',
          advisorySummary: 'Avoid prolonged outdoor exertion.',
          dominantPollutant: 'PM2.5',
          pm25: 72,
          pm10: 130,
          no2: 45,
          o3: 30,
          so2: 10,
          co: 850,
          whoPm25Multiple: 4.8,
          temperature: 16,
          humidity: 78,
          windSpeed: 3.5,
          windDirection: 280,
          visibilityKm: 2.0,
          surfacePressure: 1016,
          rainMm: 0,
          fogIndex: 60,
        },
        inversion: {
          risk: 'high',
          label: 'High Inversion Trap Risk',
          summary: 'Calm morning air traps particulate emissions.',
        },
        bestVentilationWindow: {
          windowLabel: '13:00–15:00',
          avgAqi: 115,
          avgPm25: 48,
          advisable: true,
        },
        pollutants: [],
        hourly: [],
        activities: [],
      };

      const summaryRes = await invokeApp(app, 'POST', '/api/briefing/summary', {
        snapshot: mockSnapshot,
        profile: DEFAULT_PROFILE,
      });
      assert.equal(summaryRes.status, 200);
      const summaryBody = summaryRes.json<{ headlineSummary: string }>();
      assert.ok(summaryBody.headlineSummary.includes('New Delhi'));

      const actionsRes = await invokeApp(app, 'POST', '/api/briefing/actions', {
        snapshot: mockSnapshot,
        profile: DEFAULT_PROFILE,
      });
      assert.equal(actionsRes.status, 200);
      const actionsBody = actionsRes.json<{ recommendations: unknown[] }>();
      assert.equal(actionsBody.recommendations.length, 9);
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    }
  });

  it('enforces API rate limit with HTTP 429 and Retry-After header', async () => {
    const tightApp = createApp({ rateLimit: { maxRequests: 2, windowMs: 60_000 } });
    assert.equal((await invokeApp(tightApp, 'GET', '/api/health')).status, 200);
    assert.equal((await invokeApp(tightApp, 'GET', '/api/health')).status, 200);
    const limited = await invokeApp(tightApp, 'GET', '/api/health');
    assert.equal(limited.status, 429);
    assert.ok(limited.headers['retry-after']);
  });
});
