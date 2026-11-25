import express from 'express';
import {
  DEFAULT_LOCATION,
  fetchAtmosphericData,
  reverseGeocode,
  searchCities,
} from './openMeteo.ts';
import {
  generateBriefingActions,
  generateBriefingSummary,
  generateDailyBriefing,
} from './geminiBriefing.ts';
import {
  checkSupabaseConnection,
  getUserState,
  logAirObservation,
  saveHouseholdProfile,
  toggleHackCommit,
} from './supabase.ts';
import type { AtmosphericSnapshot, HouseholdProfile, LocationInfo } from '../src/types/air.ts';

const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,128}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates that latitude and longitude lie within standard WGS84 bounds. */
export function isValidCoordinates(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/** Validates session identifiers before forwarding them to storage or Supabase. */
export function isValidSessionId(sessionId: string): boolean {
  return SESSION_ID_RE.test(sessionId);
}

/** Validates ISO calendar date strings (YYYY-MM-DD). */
export function isValidIsoDate(date: string): boolean {
  return ISO_DATE_RE.test(date);
}

/** Trims a string query parameter, returning an empty string for non-string values. */
export function parseQueryString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Parses optional location query parameters, falling back to DEFAULT_LOCATION when coords are omitted. */
export function parseLocationFromQuery(
  query: Record<string, unknown>
): { location: LocationInfo; error?: string } {
  const latStr = parseQueryString(query.lat);
  const lonStr = parseQueryString(query.lon);
  if (!latStr && !lonStr) {
    return { location: DEFAULT_LOCATION };
  }
  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (!latStr || !lonStr || !isValidCoordinates(lat, lon)) {
    return {
      location: DEFAULT_LOCATION,
      error: 'Valid latitude (-90..90) and longitude (-180..180) are required.',
    };
  }
  return {
    location: {
      name: parseQueryString(query.name) || `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
      admin1: parseQueryString(query.admin1) || undefined,
      country: parseQueryString(query.country) || 'Local Coordinates',
      latitude: lat,
      longitude: lon,
    },
  };
}

/** Maps Gemini SDK and transient quota errors into safe, user-friendly HTTP responses. */
export function formatGeminiError(err: unknown): { status: number; error: string } {
  const rawMessage = err instanceof Error ? err.message : 'Failed to generate daily briefing.';
  if (rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      error: 'Gemini API key error. Please verify your API key in Settings > Secrets.',
    };
  }
  if (
    rawMessage.includes('RESOURCE_EXHAUSTED') ||
    rawMessage.includes('429') ||
    rawMessage.includes('503') ||
    rawMessage.includes('UNAVAILABLE') ||
    rawMessage.includes('overloaded') ||
    rawMessage.includes('high demand')
  ) {
    return {
      status: 503,
      error:
        'All Gemini models are temporarily overloaded. This is a transient issue — please tap "Retry briefing" or "Regenerate" in a few seconds.',
    };
  }
  if (rawMessage.includes('GEMINI_API_KEY is not configured')) {
    return { status: 503, error: rawMessage };
  }
  return { status: 500, error: rawMessage };
}

function sendError(res: express.Response, status: number, err: unknown, fallback: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  const message =
    !isProd && err instanceof Error
      ? err.message
      : status >= 500 && isProd
        ? fallback
        : err instanceof Error
          ? err.message
          : fallback;
  res.status(status).json({ error: message });
}

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

/** Lightweight sliding-window IP rate limiter middleware for /api/* routes. */
export function createApiRateLimiter(
  options: RateLimitOptions = { maxRequests: 120, windowMs: 60_000 }
): express.RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'local';
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(options.maxRequests - 1));
      next();
      return;
    }

    entry.count += 1;
    const remaining = Math.max(0, options.maxRequests - entry.count);
    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (entry.count > options.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({ error: 'Too many API requests. Please wait a moment and try again.' });
      return;
    }

    next();
  };
}

function registerBriefingRoute<T>(
  app: express.Express,
  routePath: string,
  handler: (snapshot: AtmosphericSnapshot, profile: HouseholdProfile, forceRefresh: boolean) => Promise<T>
): void {
  app.post(routePath, async (req, res) => {
    try {
      const { snapshot, profile, forceRefresh } = req.body as {
        snapshot?: AtmosphericSnapshot;
        profile?: HouseholdProfile;
        forceRefresh?: boolean;
      };
      if (!snapshot || !snapshot.current || !profile) {
        res.status(400).json({ error: 'Both atmospheric snapshot and household profile are required.' });
        return;
      }
      const payload = await handler(snapshot, profile, Boolean(forceRefresh));
      res.json(payload);
    } catch (err) {
      const { status, error } = formatGeminiError(err);
      res.status(status).json({ error });
    }
  });
}

export interface CreateAppOptions {
  rateLimit?: RateLimitOptions | false;
}

/** Creates and configures the Express application with security headers and API routes. */
export function createApp(options: CreateAppOptions = {}): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self)');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  if (options.rateLimit !== false) {
    app.use('/api', createApiRateLimiter(options.rateLimit));
  }

  app.get('/api/health', async (_req, res) => {
    const supabase = await checkSupabaseConnection();
    res.json({ status: 'ok', supabase });
  });

  app.get('/api/user-state', async (req, res) => {
    try {
      const sessionId = parseQueryString(req.query.sessionId);
      const date = parseQueryString(req.query.date) || new Date().toISOString().slice(0, 10);
      if (!isValidSessionId(sessionId)) {
        res.status(400).json({ error: 'Valid sessionId is required.' });
        return;
      }
      if (!isValidIsoDate(date)) {
        res.status(400).json({ error: 'Valid YYYY-MM-DD date is required.' });
        return;
      }
      const state = await getUserState(sessionId, date);
      res.json({ state });
    } catch (err) {
      sendError(res, 500, err, 'Unable to load user state.');
    }
  });

  app.put('/api/user-state/profile', async (req, res) => {
    try {
      const { sessionId, location, profile } = req.body as {
        sessionId?: string;
        location?: LocationInfo;
        profile?: HouseholdProfile;
      };
      if (
        !sessionId ||
        !isValidSessionId(sessionId) ||
        !location ||
        !isValidCoordinates(location.latitude, location.longitude) ||
        !profile
      ) {
        res.status(400).json({ error: 'Valid sessionId, location coordinates, and profile are required.' });
        return;
      }
      await saveHouseholdProfile(sessionId, location, profile);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, 500, err, 'Unable to save profile.');
    }
  });

  app.post('/api/user-state/commit', async (req, res) => {
    try {
      const { sessionId, date, hackId, committed, meta } = req.body as {
        sessionId?: string;
        date?: string;
        hackId?: string;
        committed?: boolean;
        meta?: {
          title?: string;
          estimatedCo2KgSaved?: number;
          estimatedExposureDropPct?: number;
        };
      };
      const commitDate = date || new Date().toISOString().slice(0, 10);
      if (
        !sessionId ||
        !isValidSessionId(sessionId) ||
        !isValidIsoDate(commitDate) ||
        !hackId ||
        typeof committed !== 'boolean'
      ) {
        res.status(400).json({ error: 'Valid sessionId, date, hackId, and committed boolean are required.' });
        return;
      }
      await toggleHackCommit(sessionId, commitDate, hackId, committed, meta);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, 500, err, 'Unable to update hack commit.');
    }
  });

  app.get('/api/geocode', async (req, res) => {
    try {
      const results = await searchCities(parseQueryString(req.query.q));
      res.json({ results });
    } catch (err) {
      sendError(res, 502, err, 'Unable to search locations.');
    }
  });

  app.get('/api/reverse-geocode', async (req, res) => {
    try {
      const latStr = parseQueryString(req.query.lat);
      const lonStr = parseQueryString(req.query.lon);
      const lat = Number(latStr);
      const lon = Number(lonStr);
      if (!latStr || !lonStr || !isValidCoordinates(lat, lon)) {
        res.status(400).json({ error: 'Valid numeric lat (-90..90) and lon (-180..180) are required.' });
        return;
      }
      const location = await reverseGeocode(lat, lon);
      res.json({ location });
    } catch (err) {
      sendError(res, 502, err, 'Unable to resolve coordinates.');
    }
  });

  app.get('/api/air-data', async (req, res) => {
    try {
      const parsed = parseLocationFromQuery(req.query as Record<string, unknown>);
      if (parsed.error) {
        res.status(400).json({ error: parsed.error });
        return;
      }
      const bypassCache = req.query.refresh === '1';
      const snapshot = await fetchAtmosphericData(parsed.location, bypassCache);
      void logAirObservation(snapshot);
      res.json(snapshot);
    } catch (err) {
      sendError(res, 502, err, 'Unable to fetch Open-Meteo air quality data.');
    }
  });

  registerBriefingRoute(app, '/api/briefing/summary', generateBriefingSummary);
  registerBriefingRoute(app, '/api/briefing/actions', generateBriefingActions);
  registerBriefingRoute(app, '/api/briefing', generateDailyBriefing);

  return app;
}
