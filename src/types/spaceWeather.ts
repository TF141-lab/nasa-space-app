export type SpaceWeatherStatus = 'live' | 'stale' | 'fallback';

export type SunMood = 'Quiet' | 'Busy' | 'Stormy';

export interface DonkiInstrumentRaw {
  displayName?: string | null;
}

export interface DonkiFlareRaw {
  flrID?: string | null;
  beginTime?: string | null;
  peakTime?: string | null;
  endTime?: string | null;
  classType?: string | null;
  sourceLocation?: string | null;
  activeRegionNum?: number | null;
  link?: string | null;
}

export interface DonkiCmeAnalysisRaw {
  isMostAccurate?: boolean | null;
  speed?: number | null;
  halfAngle?: number | null;
  type?: string | null;
  link?: string | null;
}

export interface DonkiCmeRaw {
  activityID?: string | null;
  startTime?: string | null;
  activeRegionNum?: number | null;
  cmeAnalyses?: DonkiCmeAnalysisRaw[] | null;
  link?: string | null;
}

export interface DonkiKpIndexRaw {
  kpIndex?: number | null;
  observedTime?: string | null;
  source?: string | null;
}

export interface DonkiGstRaw {
  gstID?: string | null;
  startTime?: string | null;
  allKpIndex?: DonkiKpIndexRaw[] | null;
  link?: string | null;
}

export interface DonkiSepRaw {
  sepID?: string | null;
  eventTime?: string | null;
  instruments?: DonkiInstrumentRaw[] | null;
  link?: string | null;
}

export interface NormalizedFlare {
  id: string;
  classType: string;
  peakTime: string;
  activeRegion?: number;
  link: string;
}

export interface NormalizedCme {
  id: string;
  startTime: string;
  speedKmPerSec?: number;
  link: string;
}

export interface NormalizedStorm {
  id: string;
  startTime: string;
  maxKp?: number;
  link: string;
}

export interface NormalizedSepEvent {
  id: string;
  eventTime: string;
  link: string;
}

export interface SpaceWeatherSource {
  name: string;
  via: string;
  url: string;
}

export interface SpaceWeatherSummary {
  status: SpaceWeatherStatus;
  stale?: boolean;
  fetchedAt: string;
  windowDays: number;
  source: SpaceWeatherSource;
  flares: NormalizedFlare[];
  cmes: NormalizedCme[];
  storms: NormalizedStorm[];
  sepEvents: NormalizedSepEvent[];
}

export interface OsdrStudyHighlight {
  status: SpaceWeatherStatus;
  fetchedAt: string;
  id: string;
  title: string;
  link: string;
  creditLine: string;
}

export type ShieldingMaterialId =
  | 'bare_aluminum'
  | 'polyethylene_liner'
  | 'water_wall'
  | 'sintered_regolith';

export interface RadLabInstrumentRecord {
  detectorId: string;
  instrumentName: string;
  location: string;
  absorbedDoseRateMicroGyPerHour: number;
  dailyEquivalentMsv: number;
  solarActivityState: 'Quiet' | 'Busy' | 'Stormy';
  recordedWindow: string;
  sourceUrl: string;
}

export interface OsdrMusculoskeletalStudyRecord {
  studyId: string;
  title: string;
  unmitigatedBoneDensityLossPctPerMonth: number;
  unmitigatedMuscleMassLossPctPerMonth: number;
  recommendedResistiveMinPerDay: number;
  recommendedSleepHoursPerDay: number;
  sourceUrl: string;
}

export interface TraineeCombinedFeedPayload {
  schemaVersion: string;
  generatedAt: string;
  parameters: {
    absorbedDoseRate: {
      parameterName: 'Absorbed Dose Rate';
      sourceDataset: 'RadLab (OSDR Radiation Dosimetry Database)';
      safeMissionDoseLimitMsv: number;
      dailyOperationalSafeLimitMsv: number;
      issInstruments: RadLabInstrumentRecord[];
    };
    solarFlareAndCmeAlerts: {
      parameterName: 'Solar Flare & Coronal Mass Ejection (CME) Alerts';
      sourceDataset: 'Space Weather Database of Notifications, Knowledge, Information (DONKI)';
      sunMood: SunMood;
      activeAlertLevel: 'NOMINAL' | 'ELEVATED' | 'RED_ALERT';
      latestFlare: NormalizedFlare | null;
      latestCme: NormalizedCme | null;
      latestStorm: NormalizedStorm | null;
    };
    boneAndMuscleLossRates: {
      parameterName: 'Bone Density and Muscle Mass Loss Rates';
      sourceDataset: 'NASA Open Science Data Repository (OSDR)';
      referenceStudies: OsdrMusculoskeletalStudyRecord[];
    };
  };
}

