import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  createOsdrStudyService,
  createSimpleIpRateLimiter,
  createSpaceWeatherService,
  formatLiveWeatherOneLiner,
} from './server/spaceWeather.ts';
import { buildTraineeCombinedFeedPayload } from './src/game/rules.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  const spaceWeatherService = createSpaceWeatherService();
  const osdrStudyService = createOsdrStudyService();
  const allowSpaceWeatherIp = createSimpleIpRateLimiter(30, 60 * 1000);

  // Handler for space weather payload
  const handleSpaceWeatherRequest = async (req: express.Request, res: express.Response) => {
    const clientIp =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ||
      req.ip ||
      'unknown';

    if (!allowSpaceWeatherIp(clientIp)) {
      res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message: 'Space weather refresh rate limit reached. Please wait a minute and try again.',
      });
      return;
    }

    const summary = await spaceWeatherService.getSpaceWeather();
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(summary);
  };

  // Space weather endpoints (both legacy and dedicated /api/nasa namespace)
  app.get('/api/space-weather', handleSpaceWeatherRequest);
  app.get('/api/nasa/space-weather', handleSpaceWeatherRequest);

  // NASA API configuration and connection telemetry status
  app.get('/api/nasa/status', (_req, res) => {
    res.json(spaceWeatherService.getStatus());
  });

  // Featured NASA OSDR plant biology / Veggie experiment data
  app.get('/api/osdr-study', async (_req, res) => {
    const study = await osdrStudyService();
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(study);
  });

  // Combined trainee telemetry feed (RadLab, DONKI, OSDR)
  app.get('/api/trainee-telemetry', async (_req, res) => {
    const summary =
      spaceWeatherService.getCachedSummary() || (await spaceWeatherService.getSpaceWeather());
    const combined = buildTraineeCombinedFeedPayload(summary);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(combined);
  });

  // Flight Director & Engineering Advisor endpoint (Gemini API with local fallback)
  app.post('/api/mission-advisor', async (req, res) => {
    try {
      const {
        query,
        siteId,
        siteName,
        timeUnit,
        sol,
        power,
        lifeSupport,
        shielding,
        activeEventTitle,
      } = req.body || {};

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Please provide a tactical question for Capcom.' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'PASTE_YOUR_GEMINI_API_KEY_HERE') {
        res.status(503).json({
          error: 'API_KEY_MISSING',
          message:
            'Gemini API key is not configured in .env. You can use the built-in deterministic Engineering Calculator below for real-time tactical advice!',
        });
        return;
      }

      const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const ai = new GoogleGenAI({ apiKey });

      const isMars =
        siteId === 'mars_jezero' ||
        (typeof siteName === 'string' && siteName.toLowerCase().includes('mars'));
      const resolvedUnit =
        timeUnit === 'Day' || timeUnit === 'Sol' ? timeUnit : isMars ? 'Sol' : 'Day';

      const liveSummary =
        spaceWeatherService.getCachedSummary() || (await spaceWeatherService.getSpaceWeather());
      const liveWeatherLine = formatLiveWeatherOneLiner(liveSummary);

      const prompt = `Junior Astronaut Question: "${query}"
Current Outpost Telemetry:
- Site: ${siteName || 'Artemis Lunar Base'}
- Mission ${resolvedUnit}: ${sol ?? 1} / 10
- Electrical Power: ${power ?? 80}%
- Life Support (O2 & Hydroponics): ${lifeSupport ?? 80}%
- Radiation Shielding Integrity: ${shielding ?? 80}%
- Active Outpost Scenario: ${activeEventTitle || 'Nominal Quiet Sun'}
- ${liveWeatherLine}

Analyze the genuine engineering trade-offs between Power, Life Support, and Radiation Shielding using authentic space-weather, biology, and planetary science principles. Respond in warm, encouraging language suitable for an aspiring Junior Astronaut in 3 short, clear bullet points.`;

      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: prompt,
        config: {
          systemInstruction:
            'You are Capcom / Mission Advisor, an experienced, supportive flight controller communicating with a Junior Astronaut Commander. Keep explanations grounded in authentic space science: planetary diurnal cycles (Earth Days on the Moon, Sols on Mars), cosmic radiation, solar flare dynamics, and closed-loop life support. Explain engineering trade-offs with clarity, warmth, and encouraging teamwork. Keep responses concise (approx. 90-130 words).',
        },
      });

      res.json({
        advice:
          response.text ||
          'Keep your power reserves balanced and monitor space weather telemetry closely, Commander!',
        model: geminiModel,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Mission Advisor API Error:', msg);
      res.status(500).json({
        error: 'ADVISOR_CALL_FAILED',
        message: msg,
      });
    }
  });

  // Client asset serving and SPA routing
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Starbound Outpost mission control online at http://localhost:${PORT}`);
  });
}

startServer();
