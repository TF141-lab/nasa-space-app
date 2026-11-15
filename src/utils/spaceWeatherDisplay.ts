import type { SpaceWeatherSummary, SunMood } from '../types/spaceWeather';

function parseIsoMs(iso: string | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

export function computeSunMood(
  weather: SpaceWeatherSummary | null | undefined,
  nowMs: number = Date.now()
): SunMood {
  if (!weather) return 'Quiet';
  const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;

  const recentFlares = (weather.flares || []).filter(
    (f) => parseIsoMs(f.peakTime) >= sevenDaysAgo
  );
  const recentStorms = (weather.storms || []).filter(
    (s) => parseIsoMs(s.startTime) >= sevenDaysAgo
  );

  const hasXFlare = recentFlares.some((f) => f.classType.toUpperCase().startsWith('X'));
  const hasSevereStorm = recentStorms.some((s) => (s.maxKp ?? 0) >= 5);
  if (hasXFlare || hasSevereStorm) return 'Stormy';

  const hasMFlare = recentFlares.some((f) => f.classType.toUpperCase().startsWith('M'));
  if (hasMFlare) return 'Busy';

  return 'Quiet';
}

export function describeFlareSize(classType: string | undefined): string {
  if (!classType) return 'unknown size';
  const letter = classType.trim().toUpperCase().charAt(0);
  if (letter === 'X') return 'big';
  if (letter === 'M') return 'medium';
  if (letter === 'A' || letter === 'B' || letter === 'C') return 'small';
  return 'measured';
}

export function formatReportedAgo(iso: string | undefined, nowMs: number = Date.now()): string {
  const ms = parseIsoMs(iso);
  if (!ms) return 'recently';
  const diffSec = Math.max(0, Math.floor((nowMs - ms) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 48) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
}

export function formatSavedDate(iso: string | undefined): string {
  const ms = parseIsoMs(iso);
  if (!ms) return '2026-11-14';
  return new Date(ms).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
