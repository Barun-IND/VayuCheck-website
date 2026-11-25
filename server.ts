import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  DEFAULT_LOCATION,
  fetchAtmosphericData,
  reverseGeocode,
  searchCities,
} from './server/openMeteo.ts';
import {
  generateBriefingActions,
  generateBriefingSummary,
  generateDailyBriefing,
} from './server/geminiBriefing.ts';
import {
  checkSupabaseConnection,
  getUserState,
  logAirObservation,
  saveHouseholdProfile,
  toggleHackCommit,
} from './server/supabase.ts';
import type { AtmosphericSnapshot, HouseholdProfile, LocationInfo } from './src/types/air.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatGeminiError(err: unknown): { status: number; error: string } {
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

function parseQueryString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseLocationFromQuery(query: Record<string, unknown>): LocationInfo {
  const latStr = parseQueryString(query.lat);
  const lonStr = parseQueryString(query.lon);
  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (!latStr || !lonStr || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return DEFAULT_LOCATION;
  }
  return {
    name: parseQueryString(query.name) || `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
    admin1: parseQueryString(query.admin1) || undefined,
    country: parseQueryString(query.country) || 'Local Coordinates',
    latitude: lat,
    longitude: lon,
  };
}

function sendError(res: express.Response, status: number, err: unknown, fallback: string): void {
  const message = err instanceof Error ? err.message : fallback;
  res.status(status).json({ error: message });
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self)');
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    const supabase = await checkSupabaseConnection();
    res.json({ status: 'ok', supabase });
  });

  app.get('/api/user-state', async (req, res) => {
    try {
      const sessionId = parseQueryString(req.query.sessionId);
      const date = parseQueryString(req.query.date) || new Date().toISOString().slice(0, 10);
      if (sessionId.length < 8) {
        res.status(400).json({ error: 'Valid sessionId is required.' });
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
      if (!sessionId || sessionId.length < 8 || !location || !profile) {
        res.status(400).json({ error: 'sessionId, location, and profile are required.' });
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
      if (!sessionId || sessionId.length < 8 || !hackId || typeof committed !== 'boolean') {
        res.status(400).json({ error: 'sessionId, hackId, and committed boolean are required.' });
        return;
      }
      const commitDate = date || new Date().toISOString().slice(0, 10);
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
      if (!latStr || !lonStr || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        res.status(400).json({ error: 'Valid numeric lat and lon query parameters are required.' });
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
      const location = parseLocationFromQuery(req.query as Record<string, unknown>);
      const bypassCache = req.query.refresh === '1';
      const snapshot = await fetchAtmosphericData(location, bypassCache);
      void logAirObservation(snapshot);
      res.json(snapshot);
    } catch (err) {
      sendError(res, 502, err, 'Unable to fetch Open-Meteo air quality data.');
    }
  });

  registerBriefingRoute(app, '/api/briefing/summary', generateBriefingSummary);
  registerBriefingRoute(app, '/api/briefing/actions', generateBriefingActions);
  registerBriefingRoute(app, '/api/briefing', generateDailyBriefing);

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VayuCheck server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VayuCheck server:', err);
  process.exit(1);
});
