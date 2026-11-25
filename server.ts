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
      const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
      const date =
        typeof req.query.date === 'string' && req.query.date.trim()
          ? req.query.date.trim()
          : new Date().toISOString().slice(0, 10);
      if (sessionId.length < 8) {
        res.status(400).json({ error: 'Valid sessionId is required.' });
        return;
      }
      const state = await getUserState(sessionId, date);
      res.json({ state });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load user state.';
      res.status(500).json({ error: message });
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
      const message = err instanceof Error ? err.message : 'Unable to save profile.';
      res.status(500).json({ error: message });
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
      const message = err instanceof Error ? err.message : 'Unable to update hack commit.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/geocode', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const results = await searchCities(q);
      res.json({ results });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to search locations.';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/reverse-geocode', async (req, res) => {
    try {
      const latStr = typeof req.query.lat === 'string' ? req.query.lat.trim() : '';
      const lonStr = typeof req.query.lon === 'string' ? req.query.lon.trim() : '';
      const lat = Number(latStr);
      const lon = Number(lonStr);
      if (!latStr || !lonStr || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        res.status(400).json({ error: 'Valid numeric lat and lon query parameters are required.' });
        return;
      }
      const location = await reverseGeocode(lat, lon);
      res.json({ location });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to resolve coordinates.';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/air-data', async (req, res) => {
    try {
      const latStr = typeof req.query.lat === 'string' ? req.query.lat.trim() : '';
      const lonStr = typeof req.query.lon === 'string' ? req.query.lon.trim() : '';
      const latRaw = Number(latStr);
      const lonRaw = Number(lonStr);
      const hasCoords =
        latStr.length > 0 &&
        lonStr.length > 0 &&
        Number.isFinite(latRaw) &&
        Number.isFinite(lonRaw);

      const location: LocationInfo = hasCoords
        ? {
            name:
              typeof req.query.name === 'string' && req.query.name.trim()
                ? req.query.name.trim()
                : `${latRaw.toFixed(2)}, ${lonRaw.toFixed(2)}`,
            admin1:
              typeof req.query.admin1 === 'string' && req.query.admin1.trim()
                ? req.query.admin1.trim()
                : undefined,
            country:
              typeof req.query.country === 'string' && req.query.country.trim()
                ? req.query.country.trim()
                : 'Local Coordinates',
            latitude: latRaw,
            longitude: lonRaw,
          }
        : DEFAULT_LOCATION;

      const bypassCache = req.query.refresh === '1';
      const snapshot = await fetchAtmosphericData(location, bypassCache);
      void logAirObservation(snapshot);
      res.json(snapshot);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to fetch Open-Meteo air quality data.';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/briefing/summary', async (req, res) => {
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
      const summary = await generateBriefingSummary(snapshot, profile, Boolean(forceRefresh));
      res.json(summary);
    } catch (err) {
      const { status, error } = formatGeminiError(err);
      res.status(status).json({ error });
    }
  });

  app.post('/api/briefing/actions', async (req, res) => {
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
      const actions = await generateBriefingActions(snapshot, profile, Boolean(forceRefresh));
      res.json(actions);
    } catch (err) {
      const { status, error } = formatGeminiError(err);
      res.status(status).json({ error });
    }
  });

  app.post('/api/briefing', async (req, res) => {
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

      const briefing = await generateDailyBriefing(snapshot, profile, Boolean(forceRefresh));
      res.json(briefing);
    } catch (err) {
      const { status, error } = formatGeminiError(err);
      res.status(status).json({ error });
    }
  });

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
