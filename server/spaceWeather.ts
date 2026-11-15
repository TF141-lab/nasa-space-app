import fs from 'node:fs';
import path from 'node:path';
import type {
  DonkiCmeRaw,
  DonkiFlareRaw,
  DonkiGstRaw,
  DonkiSepRaw,
  NormalizedCme,
  NormalizedFlare,
  NormalizedSepEvent,
  NormalizedStorm,
  OsdrStudyHighlight,
  SpaceWeatherSummary,
  SunMood,
} from '../src/types/spaceWeather';

const DONKI_BASE_URL = 'https://api.nasa.gov/DONKI';
const DONKI_SOURCE_URL = 'https://ccmc.gsfc.nasa.gov/tools/DONKI/';

export const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const STALE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
export const RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
export const UPSTREAM_TIMEOUT_MS = 8000; // 8 seconds
export const MIN_REMAINING_RATE_LIMIT = 50;
export const WINDOW_DAYS = 30;

const DEFAULT_SNAPSHOT: SpaceWeatherSummary = (() => {
  try {
    const snapPath = path.join(process.cwd(), 'src', 'data', 'donki-snapshot.json');
    const raw = JSON.parse(fs.readFileSync(snapPath, 'utf8')) as SpaceWeatherSummary;
    return {
      ...raw,
      status: 'fallback',
      windowDays: WINDOW_DAYS,
      source: {
        name: 'NASA DONKI',
        via: 'api.nasa.gov',
        url: DONKI_SOURCE_URL,
      },
    };
  } catch {
    return {
      status: 'fallback',
      fetchedAt: '2026-11-14T13:31:00Z',
      windowDays: WINDOW_DAYS,
      source: {
        name: 'NASA DONKI',
        via: 'api.nasa.gov',
        url: DONKI_SOURCE_URL,
      },
      flares: [],
      cmes: [],
      storms: [],
      sepEvents: [],
    };
  }
})();

function toUtcDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function parseTimestampMs(iso: unknown): number {
  if (typeof iso !== 'string' || !iso.trim()) return 0;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeString(val: unknown, fallback = ''): string {
  return typeof val === 'string' && val.trim() ? val.trim() : fallback;
}

function safeHttpsLink(val: unknown): string {
  if (typeof val === 'string' && val.startsWith('https://')) {
    return val;
  }
  return DONKI_SOURCE_URL;
}

export interface NormalizeDonkiInput {
  flares?: unknown;
  cmes?: unknown;
  storms?: unknown;
  sepEvents?: unknown;
  fetchedAt?: string;
  status?: 'live' | 'stale' | 'fallback';
  stale?: boolean;
}

export function normalizeDonkiPayload(input: NormalizeDonkiInput): SpaceWeatherSummary {
  const rawFlares = Array.isArray(input.flares) ? (input.flares as DonkiFlareRaw[]) : [];
  const rawCmes = Array.isArray(input.cmes) ? (input.cmes as DonkiCmeRaw[]) : [];
  const rawStorms = Array.isArray(input.storms) ? (input.storms as DonkiGstRaw[]) : [];
  const rawSeps = Array.isArray(input.sepEvents) ? (input.sepEvents as DonkiSepRaw[]) : [];

  const flares: NormalizedFlare[] = rawFlares
    .filter((f): f is DonkiFlareRaw => Boolean(f && typeof f === 'object'))
    .map((f) => {
      const peakTime = safeString(f.peakTime) || safeString(f.beginTime);
      const id = safeString(f.flrID, peakTime ? `FLR-${peakTime}` : 'FLR-UNKNOWN');
      const classType = safeString(f.classType, 'Unknown');
      const activeRegion =
        typeof f.activeRegionNum === 'number' && Number.isFinite(f.activeRegionNum)
          ? f.activeRegionNum
          : undefined;
      return {
        id,
        classType,
        peakTime,
        ...(activeRegion !== undefined ? { activeRegion } : {}),
        link: safeHttpsLink(f.link),
      };
    })
    .filter((f) => Boolean(f.id && f.peakTime))
    .sort((a, b) => parseTimestampMs(b.peakTime) - parseTimestampMs(a.peakTime))
    .slice(0, 5);

  const cmes: NormalizedCme[] = rawCmes
    .filter((c): c is DonkiCmeRaw => Boolean(c && typeof c === 'object'))
    .map((c) => {
      const startTime = safeString(c.startTime);
      const id = safeString(c.activityID, startTime ? `CME-${startTime}` : 'CME-UNKNOWN');
      const analyses = Array.isArray(c.cmeAnalyses) ? c.cmeAnalyses : [];
      const preferred =
        analyses.find((a) => a && a.isMostAccurate === true) || analyses[0];
      const speedKmPerSec =
        preferred && typeof preferred.speed === 'number' && Number.isFinite(preferred.speed)
          ? Math.round(preferred.speed)
          : undefined;
      return {
        id,
        startTime,
        ...(speedKmPerSec !== undefined ? { speedKmPerSec } : {}),
        link: safeHttpsLink(c.link),
      };
    })
    .filter((c) => Boolean(c.id && c.startTime))
    .sort((a, b) => parseTimestampMs(b.startTime) - parseTimestampMs(a.startTime))
    .slice(0, 5);

  const storms: NormalizedStorm[] = rawStorms
    .filter((g): g is DonkiGstRaw => Boolean(g && typeof g === 'object'))
    .map((g) => {
      const startTime = safeString(g.startTime);
      const id = safeString(g.gstID, startTime ? `GST-${startTime}` : 'GST-UNKNOWN');
      const kpList = Array.isArray(g.allKpIndex)
        ? g.allKpIndex
            .map((k) => (k && typeof k.kpIndex === 'number' && Number.isFinite(k.kpIndex) ? k.kpIndex : NaN))
            .filter((n) => !Number.isNaN(n))
        : [];
      const maxKp = kpList.length > 0 ? Math.max(...kpList) : undefined;
      return {
        id,
        startTime,
        ...(maxKp !== undefined ? { maxKp } : {}),
        link: safeHttpsLink(g.link),
      };
    })
    .filter((g) => Boolean(g.id && g.startTime))
    .sort((a, b) => parseTimestampMs(b.startTime) - parseTimestampMs(a.startTime))
    .slice(0, 5);

  const sepEvents: NormalizedSepEvent[] = rawSeps
    .filter((s): s is DonkiSepRaw => Boolean(s && typeof s === 'object'))
    .map((s) => {
      const eventTime = safeString(s.eventTime);
      const id = safeString(s.sepID, eventTime ? `SEP-${eventTime}` : 'SEP-UNKNOWN');
      return {
        id,
        eventTime,
        link: safeHttpsLink(s.link),
      };
    })
    .filter((s) => Boolean(s.id && s.eventTime))
    .sort((a, b) => parseTimestampMs(b.eventTime) - parseTimestampMs(a.eventTime))
    .slice(0, 5);

  return {
    status: input.status ?? 'live',
    ...(input.stale ? { stale: true } : {}),
    fetchedAt: input.fetchedAt ?? new Date().toISOString(),
    windowDays: WINDOW_DAYS,
    source: {
      name: 'NASA DONKI',
      via: 'api.nasa.gov',
      url: DONKI_SOURCE_URL,
    },
    flares,
    cmes,
    storms,
    sepEvents,
  };
}

export function computeSunMood(
  weather: SpaceWeatherSummary | null | undefined,
  nowMs: number = Date.now()
): SunMood {
  if (!weather) return 'Quiet';
  const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;

  const recentFlares = (weather.flares || []).filter(
    (f) => parseTimestampMs(f.peakTime) >= sevenDaysAgo
  );
  const recentStorms = (weather.storms || []).filter(
    (s) => parseTimestampMs(s.startTime) >= sevenDaysAgo
  );

  const hasXFlare = recentFlares.some((f) => f.classType.toUpperCase().startsWith('X'));
  const hasSevereStorm = recentStorms.some((s) => (s.maxKp ?? 0) >= 5);
  if (hasXFlare || hasSevereStorm) return 'Stormy';

  const hasMFlare = recentFlares.some((f) => f.classType.toUpperCase().startsWith('M'));
  if (hasMFlare) return 'Busy';

  return 'Quiet';
}

export function formatLiveWeatherOneLiner(
  weather: SpaceWeatherSummary | null | undefined,
  nowMs: number = Date.now()
): string {
  if (!weather) {
    return 'Latest reported space weather: unavailable (offline training mode).';
  }
  const mood = computeSunMood(weather, nowMs);
  const latestFlare = weather.flares?.[0];
  const latestCme = weather.cmes?.[0];
  const latestStorm = weather.storms?.[0];
  const parts: string[] = [
    `Sun mood is ${mood} (${weather.status} data from NASA DONKI, updated ${weather.fetchedAt})`,
  ];
  if (latestFlare) {
    parts.push(`latest reported flare ${latestFlare.classType} at ${latestFlare.peakTime}`);
  }
  if (latestCme) {
    parts.push(
      `latest reported CME at ${latestCme.startTime}${
        latestCme.speedKmPerSec ? ` (${latestCme.speedKmPerSec} km/s)` : ''
      }`
    );
  }
  if (latestStorm) {
    parts.push(
      `latest geomagnetic storm at ${latestStorm.startTime}${
        latestStorm.maxKp !== undefined ? ` (Kp ${latestStorm.maxKp})` : ''
      }`
    );
  }
  return `Latest reported space weather: ${parts.join('; ')}.`;
}

export interface SpaceWeatherServiceDeps {
  fetchFn?: typeof fetch;
  nowFn?: () => number;
  getApiKey?: () => string | undefined;
  fallbackSnapshot?: SpaceWeatherSummary;
  timeoutMs?: number;
}

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

class HeaderAuthRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HeaderAuthRejectedError';
  }
}

export function createSpaceWeatherService(deps: SpaceWeatherServiceDeps = {}) {
  const fetchFn = deps.fetchFn ?? fetch;
  const nowFn = deps.nowFn ?? (() => Date.now());
  const getApiKey = deps.getApiKey ?? (() => process.env.NASA_API_KEY);
  const fallbackBase = deps.fallbackSnapshot ?? DEFAULT_SNAPSHOT;
  const timeoutMs = deps.timeoutMs ?? UPSTREAM_TIMEOUT_MS;

  let cachedLive: SpaceWeatherSummary | null = null;
  let cachedLiveAtMs = 0;
  let lastGood: SpaceWeatherSummary | null = null;
  let lastGoodAtMs = 0;
  let rateLimitedUntilMs = 0;
  let inFlight: Promise<SpaceWeatherSummary> | null = null;
  let useQueryParamFallback = false;

  const buildFallback = (): SpaceWeatherSummary => ({
    ...fallbackBase,
    status: 'fallback',
    stale: undefined,
    windowDays: WINDOW_DAYS,
    source: {
      name: 'NASA DONKI',
      via: 'api.nasa.gov',
      url: DONKI_SOURCE_URL,
    },
  });

  const buildStaleOrFallback = (nowMs: number): SpaceWeatherSummary => {
    if (lastGood && nowMs - lastGoodAtMs <= STALE_MAX_AGE_MS) {
      return {
        ...lastGood,
        status: 'stale',
        stale: true,
      };
    }
    return buildFallback();
  };

  async function fetchSingleEndpoint(
    endpoint: 'FLR' | 'CME' | 'GST' | 'SEP',
    startDate: string,
    endDate: string,
    apiKey: string,
    preferQueryParam: boolean
  ): Promise<unknown[]> {
    const baseQuery = `startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    const url = preferQueryParam
      ? `${DONKI_BASE_URL}/${endpoint}?${baseQuery}&api_key=${encodeURIComponent(apiKey)}`
      : `${DONKI_BASE_URL}/${endpoint}?${baseQuery}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (!preferQueryParam) {
      headers['X-Api-Key'] = apiKey;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchFn(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const remainingHeader = response.headers?.get?.('x-ratelimit-remaining');
    if (remainingHeader !== null && remainingHeader !== undefined) {
      const remaining = Number(remainingHeader);
      if (Number.isFinite(remaining) && remaining < MIN_REMAINING_RATE_LIMIT) {
        rateLimitedUntilMs = nowFn() + RATE_LIMIT_COOLDOWN_MS;
      }
    }

    if (response.status === 429) {
      rateLimitedUntilMs = nowFn() + RATE_LIMIT_COOLDOWN_MS;
      throw new RateLimitError('NASA DONKI rate limit reached (HTTP 429)');
    }

    if ((response.status === 401 || response.status === 403) && !preferQueryParam) {
      throw new HeaderAuthRejectedError(`X-Api-Key auth status ${response.status}`);
    }

    if (!response.ok) {
      throw new Error(`NASA DONKI upstream status ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async function fetchAllFromUpstream(apiKey: string, nowMs: number): Promise<SpaceWeatherSummary> {
    const endDate = toUtcDateString(nowMs);
    const startDate = toUtcDateString(nowMs - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const runBatch = (useQuery: boolean) =>
      Promise.all([
        fetchSingleEndpoint('FLR', startDate, endDate, apiKey, useQuery),
        fetchSingleEndpoint('CME', startDate, endDate, apiKey, useQuery),
        fetchSingleEndpoint('GST', startDate, endDate, apiKey, useQuery),
        fetchSingleEndpoint('SEP', startDate, endDate, apiKey, useQuery),
      ]);

    let flaresRaw: unknown[];
    let cmesRaw: unknown[];
    let stormsRaw: unknown[];
    let sepRaw: unknown[];

    try {
      [flaresRaw, cmesRaw, stormsRaw, sepRaw] = await runBatch(useQueryParamFallback);
    } catch (err) {
      if (err instanceof HeaderAuthRejectedError && !useQueryParamFallback) {
        useQueryParamFallback = true;
        [flaresRaw, cmesRaw, stormsRaw, sepRaw] = await runBatch(true);
      } else {
        throw err;
      }
    }

    return normalizeDonkiPayload({
      flares: flaresRaw,
      cmes: cmesRaw,
      storms: stormsRaw,
      sepEvents: sepRaw,
      fetchedAt: new Date(nowMs).toISOString(),
      status: 'live',
      stale: false,
    });
  }

  async function getSpaceWeather(): Promise<SpaceWeatherSummary> {
    const nowMs = nowFn();
    const rawKey = getApiKey()?.trim();
    if (!rawKey || rawKey === 'MY_NASA_API_KEY' || rawKey === 'PASTE_YOUR_NASA_API_KEY_HERE') {
      return buildFallback();
    }

    if (cachedLive && nowMs - cachedLiveAtMs < CACHE_TTL_MS) {
      return cachedLive;
    }

    if (nowMs < rateLimitedUntilMs) {
      return buildStaleOrFallback(nowMs);
    }

    if (inFlight) {
      return inFlight;
    }

    inFlight = (async () => {
      try {
        const fresh = await fetchAllFromUpstream(rawKey, nowMs);
        cachedLive = fresh;
        cachedLiveAtMs = nowFn();
        lastGood = fresh;
        lastGoodAtMs = cachedLiveAtMs;
        return fresh;
      } catch {
        return buildStaleOrFallback(nowFn());
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  }

  function getCachedSummary(): SpaceWeatherSummary | null {
    return cachedLive ?? lastGood;
  }

  function getStatus() {
    const rawKey = getApiKey()?.trim();
    const isConfigured = Boolean(
      rawKey &&
      rawKey !== 'MY_NASA_API_KEY' &&
      rawKey !== 'PASTE_YOUR_NASA_API_KEY_HERE'
    );
    const nowMs = nowFn();
    const currentSummary = cachedLive ?? lastGood ?? fallbackBase;
    const mode = cachedLive ? 'live' : lastGood ? 'stale' : 'fallback';
    return {
      configured: isConfigured,
      keyMasked: isConfigured && rawKey ? `${rawKey.slice(0, 4)}...${rawKey.slice(-4)}` : null,
      mode,
      isRateLimited: nowMs < rateLimitedUntilMs,
      rateLimitedUntil: nowMs < rateLimitedUntilMs ? new Date(rateLimitedUntilMs).toISOString() : null,
      lastUpdated: cachedLive
        ? new Date(cachedLiveAtMs).toISOString()
        : lastGood
        ? new Date(lastGoodAtMs).toISOString()
        : currentSummary.fetchedAt,
      flaresCount: currentSummary.flares?.length ?? 0,
      cmesCount: currentSummary.cmes?.length ?? 0,
      stormsCount: currentSummary.storms?.length ?? 0,
      sepCount: currentSummary.sepEvents?.length ?? 0,
    };
  }

  return {
    getSpaceWeather,
    getCachedSummary,
    getStatus,
  };
}

export function createSimpleIpRateLimiter(maxRequests = 30, windowMs = 60 * 1000) {
  const hits = new Map<string, number[]>();

  return function allowRequest(ip: string, nowMs: number = Date.now()): boolean {
    const key = ip || 'unknown';
    const cutoff = nowMs - windowMs;
    const prev = (hits.get(key) || []).filter((ts) => ts > cutoff);
    if (prev.length >= maxRequests) {
      hits.set(key, prev);
      return false;
    }
    prev.push(nowMs);
    hits.set(key, prev);
    if (hits.size > 500) {
      for (const [k, list] of hits.entries()) {
        const active = list.filter((ts) => ts > cutoff);
        if (active.length === 0) hits.delete(k);
        else hits.set(k, active);
      }
    }
    return true;
  };
}

// Phase 2: Optional OSDR Featured Plant/Veggie Study (cached 24h, bundled fallback, no NASA API key sent)
const OSDR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const BUNDLED_OSDR_FALLBACK: OsdrStudyHighlight = {
  status: 'fallback',
  fetchedAt: '2026-11-14T13:31:00Z',
  id: 'OSD-412',
  title:
    'Spatial characterization of microbial communities on multi-species leafy greens grown simultaneously in the Veggie vegetable production systems on the International Space Station VEG-03D',
  link: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-412',
  creditLine: 'GeneLab data are courtesy of the NASA GeneLab Data Repository.',
};

export function createOsdrStudyService(deps: { fetchFn?: typeof fetch; nowFn?: () => number } = {}) {
  const fetchFn = deps.fetchFn ?? fetch;
  const nowFn = deps.nowFn ?? (() => Date.now());
  let cached: OsdrStudyHighlight | null = null;
  let cachedAtMs = 0;

  return async function getOsdrStudy(): Promise<OsdrStudyHighlight> {
    const nowMs = nowFn();
    if (cached && nowMs - cachedAtMs < OSDR_CACHE_TTL_MS) {
      return cached;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
      let resp: Response;
      try {
        resp = await fetchFn('https://osdr.nasa.gov/osdr/data/osd/meta/412', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!resp.ok) throw new Error(`OSDR status ${resp.status}`);
      const json = (await resp.json()) as {
        study?: { 'OSD-412'?: { studies?: Array<{ title?: string }> } };
      };
      const title = json?.study?.['OSD-412']?.studies?.[0]?.title;
      if (typeof title === 'string' && title.trim()) {
        cached = {
          status: 'live',
          fetchedAt: new Date(nowMs).toISOString(),
          id: 'OSD-412',
          title: title.trim(),
          link: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-412',
          creditLine: 'GeneLab data are courtesy of the NASA GeneLab Data Repository.',
        };
        cachedAtMs = nowMs;
        return cached;
      }
    } catch {
      // Fall through to bundled fallback
    }
    return BUNDLED_OSDR_FALLBACK;
  };
}
