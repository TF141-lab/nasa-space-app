import {
  computeMiniGameEventDeltas,
  DIFFICULTY_CONFIGS,
  getEventByCode,
  NASA_SPACE_EVENTS,
} from './rules.ts';
import type {
  DifficultyLevel,
  MiniGameResourceDelta,
  SpaceWeatherEvent,
} from './rules.ts';
import { soundFX } from './sound.ts';

export interface MiniGameTelemetrySnapshot {
  eventCode: string;
  eventTitle: string;
  taskTitle: string;
  taskInstruction: string;
  timeRemainingSec: number;
  totalDurationSec: number;
  performanceRatio: number;
  deltas: MiniGameResourceDelta;
  isCompleted: boolean;
  // Extended telemetry for ECLSS-O2-SEAL-404 ("Plasma Arc Welder & Valve Isolation")
  valveRotationDeg?: number;
  inSafeWeldingZone?: boolean;
  pressurePsi?: number;
  fracturesSealedCount?: number;
  totalFracturesCount?: number;
  overheatShieldPenalty?: number;
  statusBannerText?: string;
  // Extended telemetry for DONKI-FLR-2026-X2.4 ("Magnetosphere Phase-Lock & Array Gimbal")
  shieldAngleDeg?: number;
  solarArraysFeathered?: boolean;
  protonsDeflected?: number;
  protonsTotal?: number;
  protonsHitHull?: number;
  // Extended telemetry for DONKI-SEP-2026-M8.1 ("Overhead Water-Bladder Hydraulic Routing")
  bladdersFilledCount?: number;
  totalBladdersCount?: number;
  potablePumpPct?: number;
  hydroponicPumpPct?: number;
  openJunctionsCount?: number;
  // Extended telemetry for OSDR-OSD-379-BIO ("Zeolite Sieve & UV Sterilization Tuning")
  waveformMatchPct?: number;
  sporesSterilizedCount?: number;
  totalSporesCount?: number;
  dehumidifierFreqPct?: number;
  uvPhaseSliderPct?: number;
  // Extended telemetry for DONKI-QUIET-SUN-SOL ("Dual-Track Mission Console")
  scienceTrackPct?: number;
  maintenanceTrackPct?: number;
  drillHeatPct?: number;
  greywaterMembraneInstalled?: boolean;
  hullPitsSealedCount?: number;
  totalHullPitsCount?: number;
  // Extended telemetry for ARTEMIS-DUST-LEV-09 ("Electrostatic Dielectric Brush & Pulse Capacitor")
  dustClearedCount?: number;
  totalDustCount?: number;
  capacitorChargePct?: number;
  capacitorInGreenPeak?: boolean;
  repellerPulsesFired?: number;
  arcShockCount?: number;
  // Extended telemetry for LRO-IMPACT-SWARM-12 ("Active Whipple Shutter Sequencer")
  activeShuttersCount?: number;
  maxActiveShutters?: number;
  activeShutterLabels?: string[];
  meteorsBlocked?: number;
  meteorsTotal?: number;
  meteorsHitHull?: number;
  // Extended telemetry for ARTEMIS-LRO-CRATER-89S ("Thermal Bus Balancing & Regolith Berms")
  o2HeaterSliderPct?: number;
  batteryHeaterSliderPct?: number;
  heaterStrategyPct?: number;
  regolithBermsPackedCount?: number;
  totalRegolithBerms?: number;
  regolithStrategyPct?: number;
  externalTempC?: number;
  // Extended telemetry for MARS-MEDA-DUST-88 ("MOXIE Intake Purge & Power Load Shedding")
  moxieFiltersPurgedCount?: number;
  totalMoxieFilters?: number;
  windSpeedKmh?: number;
  inWindTrough?: boolean;
  wastedGustBlasts?: number;
  breakersTrippedCount?: number;
  totalBreakersCount?: number;
  reserveO2Active?: boolean;
  // Extended telemetry for MARS-JEZERO-FROST-19 ("Vortex Tracking & Cryo-Valve De-Icing")
  cryoValvesDeIcedCount?: number;
  totalCryoValves?: number;
  thermalCoilPct?: number;
  chiselChippingPct?: number;
  vortexHitsCount?: number;
}

export interface MiniGameCompletionPayload {
  eventCode: string;
  performanceRatio: number;
  deltas: MiniGameResourceDelta;
}

interface MiniGameTargetNode {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  progress: number; // 0.0 to 1.0
  angle: number;
}

interface FractureSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  mx: number;
  my: number;
  sealed: number; // 0.0 to 1.0
  overheated: boolean;
}

interface FractureLine {
  id: number;
  label: string;
  centerX: number;
  centerY: number;
  segments: FractureSegment[];
}

interface ProtonWaveCluster {
  id: number;
  vectorAngleRad: number;
  distanceFromCore: number; // starts at 105, moves inward to 24
  speedPxPerSec: number;
  spawnDelaySec: number;
  state: 'incoming' | 'deflected' | 'hit_hull';
}

interface OverheadShieldBladder {
  id: number;
  label: string;
  x: number;
  y: number;
  junctionY: number;
  junctionAligned: boolean; // false = 90° closed bypass, true = 0° open vertical flow
  fillLevel: number; // 0.0 to 1.0
  gcrAngleRad: number;
  hotspotMsv: number;
}

interface FungalSporeCluster {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  sterilized: number; // 0.0 to 1.0
}

interface HullMicroPit {
  id: number;
  label: string;
  x: number;
  y: number;
  sealed: boolean;
}

interface RegolithDustCluster {
  id: number;
  label: string;
  x: number;
  y: number;
  radius: number;
  cleared: number; // 0.0 (heavily dust-choked) to 1.0 (clean solar cell)
  clearedByRepeller: boolean;
  hasActiveArc: boolean;
}

interface WhippleShutterSector {
  id: number; // 0..5 (S1..S6)
  label: string;
  shortLabel: string;
  startAngleRad: number;
  endAngleRad: number;
  midAngleRad: number;
  buttonX: number;
  buttonY: number;
  powered: boolean;
  slamFlashTimer: number;
}

interface MicrometeoroidTrajectory {
  id: number;
  sectorId: number; // 0..5
  angleRad: number;
  distanceFromCenter: number; // starts at 96 on Doppler radar ring, moves inward to 56 (shutter) / 32 (hull)
  speedPxPerSec: number;
  spawnDelaySec: number;
  state: 'incoming' | 'blocked' | 'hit_hull';
}

interface RegolithBermWall {
  id: number; // 0..3 (N, E, S, W perimeter walls)
  label: string;
  shortLabel: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  packed: number; // 0.0 to 1.0 insulating lunar regolith blanket thickness
}

interface MoxieIntakeFilterCell {
  id: number; // 0..5 (MESH #1..#6)
  label: string;
  x: number;
  y: number;
  radius: number;
  purged: number; // 0.0 (clogged with iron-oxide dust) to 1.0 (purged clean)
}

interface HabitatLoadBreaker {
  id: number; // 0..2
  label: string;
  subLabel: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tripped: boolean; // false = NORMAL LOAD, true = SHED / RESERVE O2 ACTIVE
}

interface CryoVentValve {
  id: number; // 0..4 (VENT #1..#5)
  label: string;
  subLabel: string;
  x: number;
  y: number;
  radius: number;
  thermalMelted: number; // 0.0 to 1.0 melted via electrical Thermal Coil
  chiselShattered: number; // 0.0 to 1.0 chipped via manual Acoustic Chisel
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  isVapor?: boolean;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export type MiniGameMechanicType =
  | 'weld_seal'
  | 'dust_brush'
  | 'whipple_intercept'
  | 'filter_purge'
  | 'frost_melt'
  | 'dipole_align'
  | 'uv_sterilize'
  | 'thermal_conduit'
  | 'water_bladder'
  | 'core_spectrometer';

export interface PerGameDifficultyPreset {
  targetCount: number;
  targetRadius: number;
  speedMultiplier: number;
  greenZoneWidth: number;
  enableHazards: boolean;
  enableSecondaryAction: boolean;
  mistakePenalty: 'none' | 'mild' | 'full';
  autoHelpAfterSec: number;
  showIntroHandSec: number;
  starCount: number;
}

export const MINI_GAME_SETTINGS: Record<
  MiniGameMechanicType,
  Record<DifficultyLevel, PerGameDifficultyPreset>
> = {
  weld_seal: {
    easy: {
      targetCount: 3,
      targetRadius: 38,
      speedMultiplier: 0.55,
      greenZoneWidth: 1.0,
      enableHazards: false,
      enableSecondaryAction: false,
      mistakePenalty: 'none',
      autoHelpAfterSec: 4,
      showIntroHandSec: 3,
      starCount: 3,
    },
    normal: {
      targetCount: 3,
      targetRadius: 32,
      speedMultiplier: 0.8,
      greenZoneWidth: 0.6,
      enableHazards: false,
      enableSecondaryAction: true,
      mistakePenalty: 'mild',
      autoHelpAfterSec: 6,
      showIntroHandSec: 2,
      starCount: 5,
    },
    hard: {
      targetCount: 3,
      targetRadius: 26,
      speedMultiplier: 1.0,
      greenZoneWidth: 0.35,
      enableHazards: true,
      enableSecondaryAction: true,
      mistakePenalty: 'full',
      autoHelpAfterSec: 999,
      showIntroHandSec: 0,
      starCount: 5,
    },
  },
  dust_brush: {
    easy: {
      targetCount: 3,
      targetRadius: 42,
      speedMultiplier: 0.5,
      greenZoneWidth: 1.0,
      enableHazards: false,
      enableSecondaryAction: false,
      mistakePenalty: 'none',
      autoHelpAfterSec: 4,
      showIntroHandSec: 3,
      starCount: 3,
    },
    normal: {
      targetCount: 6,
      targetRadius: 34,
      speedMultiplier: 0.72,
      greenZoneWidth: 0.44,
      enableHazards: true,
      enableSecondaryAction: true,
      mistakePenalty: 'mild',
      autoHelpAfterSec: 6,
      showIntroHandSec: 2,
      starCount: 5,
    },
    hard: {
      targetCount: 6,
      targetRadius: 30,
      speedMultiplier: 1.0,
      greenZoneWidth: 0.26,
      enableHazards: true,
      enableSecondaryAction: true,
      mistakePenalty: 'full',
      autoHelpAfterSec: 999,
      showIntroHandSec: 0,
      starCount: 5,
    },
  },
  whipple_intercept: {
    easy: {
      targetCount: 3,
      targetRadius: 38,
      speedMultiplier: 0.52,
      greenZoneWidth: 1.0,
      enableHazards: false,
      enableSecondaryAction: false,
      mistakePenalty: 'none',
      autoHelpAfterSec: 4,
      showIntroHandSec: 3,
      starCount: 3,
    },
    normal: {
      targetCount: 5,
      targetRadius: 32,
      speedMultiplier: 0.76,
      greenZoneWidth: 0.65,
      enableHazards: true,
      enableSecondaryAction: true,
      mistakePenalty: 'mild',
      autoHelpAfterSec: 6,
      showIntroHandSec: 2,
      starCount: 5,
    },
    hard: {
      targetCount: 5,
      targetRadius: 28,
      speedMultiplier: 1.0,
      greenZoneWidth: 0.4,
      enableHazards: true,
      enableSecondaryAction: true,
      mistakePenalty: 'full',
      autoHelpAfterSec: 999,
      showIntroHandSec: 0,
      starCount: 5,
    },
  },
  filter_purge: {
    easy: {
      targetCount: 3,
      targetRadius: 40,
      speedMultiplier: 0.5,
      greenZoneWidth: 1.0,
      enableHazards: false,
      enableSecondaryAction: false,
      mistakePenalty: 'none',
      autoHelpAfterSec: 4,
      showIntroHandSec: 3,
      starCount: 3,
    },
    normal: {
      targetCount: 6,
      targetRadius: 28,
      speedMultiplier: 0.74,
      greenZoneWidth: 0.45,
      enableHazards: true,
      enableSecondaryAction: true,
      mistakePenalty: 'mild',
      autoHelpAfterSec: 6,
      showIntroHandSec: 2,
      starCount: 5,
    },
    hard: {
      targetCount: 6,
      targetRadius: 22,
      speedMultiplier: 1.0,
      greenZoneWidth: 0.34,
      enableHazards: true,
      enableSecondaryAction: true,
      mistakePenalty: 'full',
      autoHelpAfterSec: 999,
      showIntroHandSec: 0,
      starCount: 5,
    },
  },
  frost_melt: {
    easy: {
      targetCount: 3,
      targetRadius: 38,
      speedMultiplier: 0.5,
      greenZoneWidth: 1.0,
      enableHazards: false,
      enableSecondaryAction: false,
      mistakePenalty: 'none',
      autoHelpAfterSec: 4,
      showIntroHandSec: 3,
      starCount: 3,
    },
    normal: {
      targetCount: 5,
      targetRadius: 28,
      speedMultiplier: 0.72,
      greenZoneWidth: 0.6,
      enableHazards: true,
      enableSecondaryAction: true,
      mistakePenalty: 'mild',
      autoHelpAfterSec: 6,
      showIntroHandSec: 2,
      starCount: 5,
    },
    hard: {
      targetCount: 5,
      targetRadius: 23,
      speedMultiplier: 1.0,
      greenZoneWidth: 0.4,
      enableHazards: true,
      enableSecondaryAction: true,
      mistakePenalty: 'full',
      autoHelpAfterSec: 999,
      showIntroHandSec: 0,
      starCount: 5,
    },
  },
  dipole_align: {
    easy: {
      targetCount: 3,
      targetRadius: 38,
      speedMultiplier: 0.52,
      greenZoneWidth: 1.0,
      enableHazards: false,
      enableSecondaryAction: false,
      mistakePenalty: 'none',
      autoHelpAfterSec: 4,
      showIntroHandSec: 3,
      starCount: 3,
    },
    normal: {
      targetCount: 5,
      targetRadius: 30,
      speedMultiplier: 0.76,
      greenZoneWidth: 0.65,
      enableHazards: true,
      enableSecondaryAction: true,
      mistakePenalty: 'mild',
      autoHelpAfterSec: 6,
      showIntroHandSec: 2,
      starCount: 5,
    },
    hard: {
      targetCount: 5,
      targetRadius: 24,
      speedMultiplier: 1.0,
      greenZoneWidth: 0.45,
      enableHazards: true,
      enableSecondaryAction: true,
      mistakePenalty: 'full',
      autoHelpAfterSec: 999,
      showIntroHandSec: 0,
      starCount: 5,
    },
  },
  uv_sterilize: {
    easy: {
      targetCount: 3,
      targetRadius: 36,
      speedMultiplier: 0.5,
      greenZoneWidth: 1.0,
      enableHazards: false,
      enableSecondaryAction: false,
      mistakePenalty: 'none',
      autoHelpAfterSec: 4,
      showIntroHandSec: 3,
      starCount: 3,
    },
    normal: {
      targetCount: 4,
      targetRadius: 28,
      speedMultiplier: 0.75,
      greenZoneWidth: 0.5,
      enableHazards: false,
      enableSecondaryAction: true,
      mistakePenalty: 'mild',
      autoHelpAfterSec: 6,
      showIntroHandSec: 2,
      starCount: 5,
    },
    hard: {
      targetCount: 4,
      targetRadius: 22,
      speedMultiplier: 1.0,
      greenZoneWidth: 0.25,
      enableHazards: true,
      enableSecondaryAction: true,
      mistakePenalty: 'full',
      autoHelpAfterSec: 999,
      showIntroHandSec: 0,
      starCount: 5,
    },
  },
  thermal_conduit: {
    easy: {
      targetCount: 3,
      targetRadius: 38,
      speedMultiplier: 0.6,
      greenZoneWidth: 1.0,
      enableHazards: false,
      enableSecondaryAction: false,
      mistakePenalty: 'none',
      autoHelpAfterSec: 4,
      showIntroHandSec: 3,
      starCount: 3,
    },
    normal: {
      targetCount: 4,
      targetRadius: 30,
      speedMultiplier: 0.82,
      greenZoneWidth: 0.6,
      enableHazards: false,
      enableSecondaryAction: true,
      mistakePenalty: 'mild',
      autoHelpAfterSec: 6,
      showIntroHandSec: 2,
      starCount: 5,
    },
    hard: {
      targetCount: 4,
      targetRadius: 26,
      speedMultiplier: 1.0,
      greenZoneWidth: 0.4,
      enableHazards: true,
      enableSecondaryAction: true,
      mistakePenalty: 'full',
      autoHelpAfterSec: 999,
      showIntroHandSec: 0,
      starCount: 5,
    },
  },
  water_bladder: {
    easy: {
      targetCount: 3,
      targetRadius: 40,
      speedMultiplier: 0.65,
      greenZoneWidth: 1.0,
      enableHazards: false,
      enableSecondaryAction: false,
      mistakePenalty: 'none',
      autoHelpAfterSec: 4,
      showIntroHandSec: 3,
      starCount: 3,
    },
    normal: {
      targetCount: 4,
      targetRadius: 30,
      speedMultiplier: 0.85,
      greenZoneWidth: 0.65,
      enableHazards: false,
      enableSecondaryAction: true,
      mistakePenalty: 'mild',
      autoHelpAfterSec: 6,
      showIntroHandSec: 2,
      starCount: 5,
    },
    hard: {
      targetCount: 4,
      targetRadius: 26,
      speedMultiplier: 1.0,
      greenZoneWidth: 0.4,
      enableHazards: true,
      enableSecondaryAction: true,
      mistakePenalty: 'full',
      autoHelpAfterSec: 999,
      showIntroHandSec: 0,
      starCount: 5,
    },
  },
  core_spectrometer: {
    easy: {
      targetCount: 3,
      targetRadius: 38,
      speedMultiplier: 0.6,
      greenZoneWidth: 1.0,
      enableHazards: false,
      enableSecondaryAction: false,
      mistakePenalty: 'none',
      autoHelpAfterSec: 4,
      showIntroHandSec: 3,
      starCount: 3,
    },
    normal: {
      targetCount: 3,
      targetRadius: 28,
      speedMultiplier: 0.78,
      greenZoneWidth: 0.55,
      enableHazards: false,
      enableSecondaryAction: true,
      mistakePenalty: 'mild',
      autoHelpAfterSec: 6,
      showIntroHandSec: 2,
      starCount: 5,
    },
    hard: {
      targetCount: 3,
      targetRadius: 22,
      speedMultiplier: 1.0,
      greenZoneWidth: 0.35,
      enableHazards: true,
      enableSecondaryAction: true,
      mistakePenalty: 'full',
      autoHelpAfterSec: 999,
      showIntroHandSec: 0,
      starCount: 5,
    },
  },
};

export interface RealLifeSolutionChoice {
  label: string;
  isCorrect: boolean;
  explanation: string;
}

export interface RealLifeEngineeringSolution {
  solutionTitle: string;
  nasaSystemCode: string;
  realWorldPrinciple: string;
  primaryActionLabel: string;
  secondaryActionLabel?: string;
  fieldQuestion: string;
  solutionChoices: [RealLifeSolutionChoice, RealLifeSolutionChoice];
}

export interface MiniGameDescriptor {
  eventCode: string;
  taskTitle: string;
  goalBanner: string;
  goalIcon: string;
  taskInstruction: string;
  telemetryDataPoints: [string, string, string];
  howToSolveSteps: [string, string, string];
  controlsSummary: string;
  proTip: string;
  nasaFunFact: string;
  realLifeSolution: RealLifeEngineeringSolution;
  zeroPctLabel: string;
  hundredPctLabel: string;
  mechanicType: MiniGameMechanicType;
  accentColor: string;
  secondaryColor: string;
}

export const MINI_GAME_DESCRIPTORS: Record<string, MiniGameDescriptor> = {
  'ECLSS-O2-SEAL-404': {
    eventCode: 'ECLSS-O2-SEAL-404',
    taskTitle: 'ISS Ultrasonic Leak Isolation & Kapton-Epoxy Patch',
    goalBanner: 'Isolate valve and apply Kapton-epoxy patches!',
    goalIcon: '🔧',
    taskInstruction:
      'Use the real ISS leak protocol: turn the green Bulkhead Isolation Valve to drop cabin pressure, then cure Kapton-epoxy elastomer patches over each micro-fracture!',
    telemetryDataPoints: [
      'Micro-fractures in the aluminum hull are venting 14.7 PSI cabin oxygen into vacuum.',
      'Real Solution Step 1: Throttling the bulkhead isolation valve lowers air-jet force so the patch adheres.',
      'Real Solution Step 2: Curing Kapton tape + two-part vacuum epoxy seals the hull breach permanently.',
    ],
    howToSolveSteps: [
      'STEP 1: 🟢 Tap the Bulkhead Isolation Valve until pressure enters the green zone.',
      'STEP 2: 🔥 Swipe across each micro-fracture to cure the Kapton-epoxy vacuum patch.',
      'STEP 3: ⭐ Seal all 3 hull cracks without overheating the aluminum skin!',
    ],
    controlsSummary: 'Tap the isolation valve wheel, then drag across each glowing hull fracture.',
    proTip:
      'On the real ISS, astronauts lower module airflow first so escaping air does not blow wet epoxy out of the crack!',
    nasaFunFact:
      'In 2018 and 2020 on the International Space Station, astronauts pinpointed tiny 2-millimeter hull cracks using ultrasonic microphones and floating tea leaves, then sealed them with Kapton tape and two-part epoxy resin!',
    realLifeSolution: {
      solutionTitle: 'Bulkhead Pressure Isolation & Kapton-Epoxy Elastomer Patch',
      nasaSystemCode: 'ISS ECLSS Pressure Shell Repair Kit (Soyuz MS-09 / Zvezda Protocol)',
      realWorldPrinciple:
        'In vacuum, 14.7 PSI cabin air rushes out of a crack at supersonic speed. Astronauts isolate the duct valve first to reduce airflow, then apply flexible Kapton polyimide tape and vacuum-curing epoxy resin that hardens into an airtight plug.',
      primaryActionLabel: '🔧 Cure Kapton-Epoxy Patch',
      secondaryActionLabel: '🟢 Turn Isolation Valve',
      fieldQuestion:
        'Why do ISS astronauts throttle the air valve and use flexible Kapton-epoxy instead of welding bare metal at full pressure?',
      solutionChoices: [
        {
          label: 'Throttling air pressure stops escaping gas from blowing out the epoxy, and flexible polymer prevents thermal cracks.',
          isCorrect: true,
          explanation:
            'Correct! Lowering differential pressure lets vacuum epoxy cure inside the micro-crack without outgassing or warping thin aluminum hull plates.',
        },
        {
          label: 'Opening all fans to maximum blows extra oxygen into space to cool the crack.',
          isCorrect: false,
          explanation:
            'Not quite—high airflow blows sealant out of the breach and wastes precious breathable O2. Isolating the valve first is the real ISS procedure!',
        },
      ],
    },
    zeroPctLabel: 'Unsealed Breach',
    hundredPctLabel: 'Epoxy Sealed!',
    mechanicType: 'weld_seal',
    accentColor: '#38bdf8',
    secondaryColor: '#f59e0b',
  },
  'ARTEMIS-DUST-LEV-09': {
    eventCode: 'ARTEMIS-DUST-LEV-09',
    taskTitle: 'Electrodynamic Dust Shield (EDS) & Charge Brush',
    goalBanner: 'Fire EDS waves to repel clingy moon dust!',
    goalIcon: '☀️',
    taskInstruction:
      'Use NASA Kennedy’s real Electrodynamic Dust Shield (EDS): fire the 3-phase travelling-wave capacitor at green resonance, or sweep discharged cells with a carbon-fiber brush!',
    telemetryDataPoints: [
      'Solar UV rays give jagged lunar dust an electrostatic charge that clings to solar glass.',
      'Real Solution 1: Transparent ITO electrodes fire an AC travelling-wave pulse (EDS) that levitates and flips dust off.',
      'Real Solution 2: Conductive carbon-fiber bristles safely ground and sweep panels when no voltage arc is present.',
    ],
    howToSolveSteps: [
      'STEP 1: ⚡ Watch the EDS Capacitor charge bar reach the green resonance window.',
      'STEP 2: 🌟 Fire the EDS Travelling-Wave Pulse to levitate dust off 2 panels at once!',
      'STEP 3: ✨ Or swipe calm solar panels with the grounded carbon-fiber brush (avoid blue static arcs).',
    ],
    controlsSummary: 'Tap the EDS Pulse button in the green zone, or swipe non-arcing solar panels.',
    proTip:
      'Mechanical wiping alone scratches solar glass because lunar regolith is made of jagged volcanic glass shards—firing the EDS electric wave lifts dust without touching!',
    nasaFunFact:
      'NASA’s Electrodynamic Dust Shield (EDS), tested on the Moon in 2024–2025 aboard Artemis CLPS landers, uses transparent electrodes to send an invisible electric wave across solar panels and camera lenses, shaking off 90%+ of moon dust in seconds!',
    realLifeSolution: {
      solutionTitle: 'NASA Electrodynamic Dust Shield (EDS) Travelling-Wave Repeller',
      nasaSystemCode: 'KSC Electrostatic Lab EDS-ITO Transparent Electrode Array',
      realWorldPrinciple:
        'Because lunar dust is electrically charged by sunlight, applying a 3-phase alternating high-voltage wave across transparent Indium Tin Oxide (ITO) wires creates a travelling dielectrophoretic force that surfs dust grains right off the panel.',
      primaryActionLabel: '⚡ Fire EDS Wave Pulse',
      secondaryActionLabel: '🧹 Grounded Carbon Brush',
      fieldQuestion:
        'Why did NASA invent the Electrodynamic Dust Shield (EDS) instead of using windshield wipers on lunar solar panels?',
      solutionChoices: [
        {
          label: 'Moon dust is jagged crushed glass with static charge; EDS electric waves lift dust without scratching panels.',
          isCorrect: true,
          explanation:
            'Spot on! Apollo astronauts found that brushing sharp lunar dust scratched visors and gauges, whereas EDS repels charged dust contact-free.',
        },
        {
          label: 'Windshield wipers only work when it rains liquid water on the Moon.',
          isCorrect: false,
          explanation:
            'While the Moon has no rain, the real engineering danger is abrasion: rubbing sharp silicate dust scratches anti-reflective solar coatings!',
        },
      ],
    },
    zeroPctLabel: 'Dust-Choked Array',
    hundredPctLabel: 'EDS Cleared!',
    mechanicType: 'dust_brush',
    accentColor: '#facc15',
    secondaryColor: '#38bdf8',
  },
  'LRO-IMPACT-SWARM-12': {
    eventCode: 'LRO-IMPACT-SWARM-12',
    taskTitle: 'Stuffed Whipple Bumper Shield Sequencer',
    goalBanner: 'Raise Whipple bumpers to vaporize meteoroids!',
    goalIcon: '🪨',
    taskInstruction:
      'Use the real ISS Whipple Shield solution: track hypervelocity micrometeoroids on Doppler radar and raise multi-layer Nextel/Kevlar Whipple bumpers on threatened sectors!',
    telemetryDataPoints: [
      'Micrometeoroids hit at 20 km/s—faster than a rifle bullet—where solid metal hulls would crack.',
      'Real Solution: An outer "Whipple Bumper" spaced away from the hull shatters the rock into a dispersed plasma cloud.',
      'Inner Nextel ceramic and Kevlar fabric layers catch the vaporized debris cloud harmlessly!',
    ],
    howToSolveSteps: [
      'STEP 1: 👀 Watch Doppler radar for orange incoming micrometeoroid trajectories.',
      'STEP 2: 🛡️ Tap the threatened dome sector to deploy its Nextel/Kevlar Whipple Bumper.',
      'STEP 3: 💥 Vaporize >80% of hypervelocity impacts before they reach the pressure wall!',
    ],
    controlsSummary: 'Tap any glowing radar sector or Whipple shutter button around the habitat.',
    proTip:
      'Power buses can hold 2 active Whipple shutters at once—sequence them onto the closest orange radar tracks!',
    nasaFunFact:
      'Invented by astronomer Fred Whipple and upgraded by NASA with Nextel ceramic fabric and Kevlar (bulletproof vest material), a thin spaced Whipple bumper stops hypervelocity space pebbles that would punch right through a solid steel plate!',
    realLifeSolution: {
      solutionTitle: 'Multi-Wall Stuffed Whipple Bumper Shield (Aluminum + Nextel + Kevlar)',
      nasaSystemCode: 'ISS / Gateway Hypervelocity Impact Protection System (HVIPS)',
      realWorldPrinciple:
        'Instead of one thick heavy wall, a Whipple shield places a thin sacrificial aluminum bumper 10–20 cm outside the hull. The 20 km/s impactor shocks and vaporizes on the outer bumper, and the expanding cloud is absorbed by Nextel/Kevlar blankets.',
      primaryActionLabel: '🛡️ Deploy Whipple Bumper',
      fieldQuestion:
        'How does a real NASA Whipple Shield stop a 20 km/s micrometeoroid without needing foot-thick steel armor?',
      solutionChoices: [
        {
          label: 'A spaced outer bumper shatters the pebble into a vapor cloud that Kevlar/Nextel layers safely absorb.',
          isCorrect: true,
          explanation:
            'Exactly right! Breaking the hypervelocity particle on a stand-off bumper spreads the momentum over a wide area of Kevlar fabric.',
        },
        {
          label: 'It uses giant rubber trampolines to bounce the intact rock back into deep space.',
          isCorrect: false,
          explanation:
            'At 20 km/s, any solid impactor liquefies and vaporizes on contact—spacing an outer sacrificial bumper is the key!',
        },
      ],
    },
    zeroPctLabel: 'Hull Pitted',
    hundredPctLabel: 'Whipple Protected!',
    mechanicType: 'whipple_intercept',
    accentColor: '#fb923c',
    secondaryColor: '#fde047',
  },
  'MARS-MEDA-DUST-88': {
    eventCode: 'MARS-MEDA-DUST-88',
    taskTitle: 'MOXIE Reverse-Pulse HEPA Purge & Load Shedding',
    goalBanner: 'Back-flush MOXIE filters during calm wind troughs!',
    goalIcon: '💨',
    taskInstruction:
      'Apply NASA’s Perseverance MOXIE solution: wait for the MEDA wind sensor to hit a calm green trough, then fire compressed CO2 reverse-pulse jets to clear the HEPA intake filters!',
    telemetryDataPoints: [
      'MOXIE makes breathable O2 by splitting Martian CO2 gas at 800°C inside a solid-oxide electrolyzer.',
      'Real Solution 1: Reverse-pulse gas jets blow iron-oxide dust off the HEPA filter during calm wind troughs.',
      'Real Solution 2: Shedding non-essential habitat loads protects battery buses while compressors cycle.',
    ],
    howToSolveSteps: [
      'STEP 1: 🌬️ Watch the MEDA Anemometer bar drop into the calm green wind trough.',
      'STEP 2: 💨 Tap clogged orange HEPA filter meshes to fire a reverse-pulse back-flush!',
      'STEP 3: 🔋 Or trip non-essential Load Shed Breakers to conserve habitat power.',
    ],
    controlsSummary: 'Tap clogged MOXIE filter meshes during green wind troughs, or flip load breakers.',
    proTip:
      'Firing a back-flush during a peak red dust gust wastes compressed gas because the storm immediately re-clogs the intake!',
    nasaFunFact:
      'Aboard NASA’s Perseverance rover in Jezero Crater, the real MOXIE instrument successfully generated breathable oxygen from Mars’s thin CO2 atmosphere 16 times—proving future astronauts can make their own air and rocket oxidizer on Mars!',
    realLifeSolution: {
      solutionTitle: 'MOXIE Solid-Oxide Electrolyzer HEPA Reverse-Pulse Back-Flush',
      nasaSystemCode: 'Mars 2020 Perseverance MOXIE + MEDA Wind Sensor Integration',
      realWorldPrinciple:
        'Martian dust contains toxic perchlorates and fine iron oxide that clog SOXE (Solid Oxide Electrolysis) pores. Timed pneumatic reverse-pulses during low dynamic wind pressure clear the sintered metal HEPA filter without drawing dust back in.',
      primaryActionLabel: '💨 Fire Reverse-Pulse Flush',
      secondaryActionLabel: '⚡ Shed Auxiliary Load',
      fieldQuestion:
        'How does NASA’s MOXIE system produce breathable oxygen on Mars, and why must its intake filters stay clean?',
      solutionChoices: [
        {
          label: 'It electrochemically splits Martian CO2 into O2 at 800°C, requiring clean HEPA intakes so dust does not foul the cells.',
          isCorrect: true,
          explanation:
            'Correct! MOXIE compresses Martian CO2 and splits off oxygen ions across a ceramic membrane at 800°C.',
        },
        {
          label: 'It scoops underground liquid lakes and boils them into steam.',
          isCorrect: false,
          explanation:
            'MOXIE harvests oxygen directly from the carbon dioxide (CO2) gas in the Martian atmosphere!',
        },
      ],
    },
    zeroPctLabel: 'Reserve O2 Loop',
    hundredPctLabel: 'MOXIE Purged!',
    mechanicType: 'filter_purge',
    accentColor: '#f97316',
    secondaryColor: '#38bdf8',
  },
  'MARS-JEZERO-FROST-19': {
    eventCode: 'MARS-JEZERO-FROST-19',
    taskTitle: 'Kapton Sublimation Heaters & Piezo De-Icing',
    goalBanner: 'Sublimate CO2 dry-ice frost on manifold valves!',
    goalIcon: '❄️',
    taskInstruction:
      'Use NASA’s Mars lander de-icing solution: energize Kapton resistive sublimation heaters OR trigger piezoelectric ultrasonic actuators on frozen valves while dodging convective dust devils!',
    telemetryDataPoints: [
      'At -85°C on Mars, atmospheric CO2 freezes solid into dry-ice frost that locks O2 manifold valves.',
      'Real Solution 1: Kapton resistive strip heaters warm valves above -78.5°C so dry ice sublimates into gas.',
      'Real Solution 2: Piezoelectric ultrasonic vibrations shatter brittle CO2 frost using minimal battery power!',
    ],
    howToSolveSteps: [
      'STEP 1: 🔥 Hold the Kapton Sublimation Heater button to warm all 5 cryo-valves evenly.',
      'STEP 2: ❄️ Or tap frozen blue valves to fire ultrasonic piezo vibrations (saves battery power!).',
      'STEP 3: 🌪️ Do not tap a valve while the spinning Dust Devil vortex is directly over it!',
    ],
    controlsSummary: 'Hold the orange Sublimation Heater button, or tap clear blue cryo-valves.',
    proTip:
      'Combining brief Kapton heater pulses with ultrasonic piezo taps clears dry-ice frost while preserving overnight battery charge!',
    nasaFunFact:
      'Because Mars’s atmosphere is 95% carbon dioxide at very low pressure, frost on Mars does not melt into liquid—when warmed by NASA lander strip heaters, solid CO2 dry ice sublimates (turns straight into gas)!',
    realLifeSolution: {
      solutionTitle: 'Kapton Polyimide Strip Heaters & Piezoelectric Ultrasonic De-Icing',
      nasaSystemCode: 'Mars Surface Thermal Control & Piezo Actuator Valve Assembly',
      realWorldPrinciple:
        'At Martian surface pressure (6 mbar), CO2 frost sublimates directly from solid to gas at -78.5°C. Spacecraft bond thin Kapton foil heaters and ultrasonic piezoelectric transducers to valve seats to shed frost without heavy mechanical motors.',
      primaryActionLabel: '🔥 Pulse Kapton Heater',
      secondaryActionLabel: '🔨 Fire Piezo Ultrasonic Tap',
      fieldQuestion:
        'What happens when NASA strip heaters warm frozen carbon dioxide (CO2) frost on a Mars lander valve?',
      solutionChoices: [
        {
          label: 'The solid dry-ice frost sublimates directly into harmless CO2 gas without forming liquid slush.',
          isCorrect: true,
          explanation:
            'Correct! At Mars’s low atmospheric pressure, CO2 has no liquid phase—warming it above -78.5°C turns frost straight into gas.',
        },
        {
          label: 'It melts into salty puddles that must be mopped up by rover wipers.',
          isCorrect: false,
          explanation:
            'Under low Martian pressure, CO2 frost sublimates directly from solid crystal to gas!',
        },
      ],
    },
    zeroPctLabel: 'Piezo De-Iced',
    hundredPctLabel: 'Sublimation Heated!',
    mechanicType: 'frost_melt',
    accentColor: '#7dd3fc',
    secondaryColor: '#f59e0b',
  },
  'DONKI-FLR-2026-X2.4': {
    eventCode: 'DONKI-FLR-2026-X2.4',
    taskTitle: 'Solar Array Feathering & Magnetic Dipole Shield',
    goalBanner: 'Feather solar wings and align magnetic shield!',
    goalIcon: '🛡️',
    taskInstruction:
      'Execute NASA’s real Solar Particle Event procedure: gimbal the Solar Array Wings 90° edge-on ("feathering") to prevent voltage arcs, then align the active Magnetic Dipole Shield with incoming CME proton waves!',
    telemetryDataPoints: [
      'An X2.4 solar flare and fast CME are hurling high-energy protons toward the outpost.',
      'Real Solution Step 1: Feathering solar wings edge-on minimizes cross-section and stops electrostatic arcing.',
      'Real Solution Step 2: Aligning an active magnetic dipole field deflects charged protons via the Lorentz force!',
    ],
    howToSolveSteps: [
      'STEP 1: 🪽 Tap the Solar Array Gimbal button to feather the wings 90° into safe mode.',
      'STEP 2: 🟣 Drag or tap around the perimeter ring to aim the purple Magnetic Dipole Shield.',
      'STEP 3: 🛡️ Deflect all incoming red CME proton clusters before they strike the habitat core!',
    ],
    controlsSummary: 'Tap the Solar Gimbal button to feather wings, then drag around the radar circle.',
    proTip:
      'Always feather the solar wings first—leaving arrays flat during an X-class flare causes differential charging and arc damage!',
    nasaFunFact:
      'During intense solar storms and thruster plumes, ISS flight controllers rotate the station’s giant Solar Alpha Rotary Joints (SARJ) to "feather" the solar wings edge-on, while NASA’s NIAC program studies superconducting magnetic shields to deflect protons just like Earth’s magnetosphere!',
    realLifeSolution: {
      solutionTitle: 'SARJ Edge-On Array Feathering & Active Lorentz Magnetic Shielding',
      nasaSystemCode: 'ISS SARJ Gimbal Protocol + NIAC Active Dipolar Magnetosphere',
      realWorldPrinciple:
        'Charged solar protons experience the Lorentz force (F = qv × B) when entering a magnetic field, curving away from the habitat. Meanwhile, rotating solar panels edge-on to the sun ("feathering") prevents high-voltage plasma arcing across solar cells.',
      primaryActionLabel: '🛡️ Align Magnetic Dipole',
      secondaryActionLabel: '🪽 Feather Solar Wings 90°',
      fieldQuestion:
        'Why do spacecraft controllers "feather" (rotate edge-on) solar arrays during severe solar proton storms?',
      solutionChoices: [
        {
          label: 'To minimize exposed panel area and prevent high-voltage electrostatic arcing and solar cell degradation.',
          isCorrect: true,
          explanation:
            'Correct! Edge-on feathering slashes proton flux interception and prevents destructive voltage spikes on the main power bus.',
        },
        {
          label: 'To make the spacecraft spin like a windmill in the solar wind.',
          isCorrect: false,
          explanation:
            'Feathering is done to protect delicate photovoltaic junctions from proton bombardment and electrostatic discharge!',
        },
      ],
    },
    zeroPctLabel: 'Unshielded Flux',
    hundredPctLabel: 'Dipole Deflected!',
    mechanicType: 'dipole_align',
    accentColor: '#c084fc',
    secondaryColor: '#f43f5e',
  },
  'OSDR-OSD-379-BIO': {
    eventCode: 'OSDR-OSD-379-BIO',
    taskTitle: 'Zeolite Desiccant Sieve & 254nm UV-C Sterilization',
    goalBanner: 'Tune Zeolite dryers and zap spores with UV-C!',
    goalIcon: '🦠',
    taskInstruction:
      'Use NASA’s real ISS bio-contamination solution: tune the Zeolite 5A desiccant dehumidifier and 254nm UV-C phase sliders into the green zone, then irradiate airborne fungal spores!',
    telemetryDataPoints: [
      'High greenhouse humidity lets spaceflight fungal spores (Aspergillus) form corrosive bio-films on vents.',
      'Real Solution Step 1: Zeolite 5A molecular sieve beds scrub excess moisture from cabin air without chemicals.',
      'Real Solution Step 2: 254 nm UV-C germicidal LEDs scramble spore DNA so mold cannot reproduce!',
    ],
    howToSolveSteps: [
      'STEP 1: 🎚️ Drag the Zeolite Dehumidifier & UV-C Phase sliders into the green target boxes.',
      'STEP 2: 🦠 Tap each floating green fungal spore cluster in the air duct.',
      'STEP 3: 💜 Irradiate all spores with 254 nm UV-C light to protect the Veggie crop dome!',
    ],
    controlsSummary: 'Slide both scrubbers into the green zone, then tap floating fungal spores.',
    proTip:
      'On the ISS, astronauts never spray toxic bleach in closed cabin air—drying the air with Zeolite and zapping spores with UV-C light keeps air safe to breathe!',
    nasaFunFact:
      'NASA’s OSDR studies (like OSD-379) show that microgravity changes how microbes grow; on the ISS, astronauts use Zeolite molecular sieves (porous volcanic-style crystals) and UV-C LEDs to keep air and water 99.99% pure without harsh chemicals!',
    realLifeSolution: {
      solutionTitle: 'Zeolite 5A Molecular Sieve Dehumidification & 254 nm UV-C LEDs',
      nasaSystemCode: 'ISS ECLSS CDRA / Veggie Bio-Isolation Scrubber (OSDR OSD-379)',
      realWorldPrinciple:
        'In a sealed spacecraft, chemical disinfectants would poison the crew’s air loop. Instead, regenerable Zeolite 5A crystal beds trap water vapor to starve mold of moisture, while 254-nanometer UV-C photons dimerize fungal DNA.',
      primaryActionLabel: '💜 Fire 254nm UV-C Beam',
      fieldQuestion:
        'Why do spacecraft use Zeolite desiccant beds and 254 nm UV-C light instead of spraying chemical bleach in the cabin?',
      solutionChoices: [
        {
          label: 'In a closed air loop, chemical sprays would be inhaled by the crew, whereas UV-C and Zeolite clean air residue-free.',
          isCorrect: true,
          explanation:
            'Exactly! UV-C light neutralizes pathogen DNA optically and Zeolite traps moisture physically, leaving zero toxic fumes in the habitat.',
        },
        {
          label: 'Bleach freezes solid at room temperature in microgravity.',
          isCorrect: false,
          explanation:
            'The real reason is crew toxicology: any volatile chemical sprayed inside a sealed spacecraft stays in the breathing loop!',
        },
      ],
    },
    zeroPctLabel: 'Bio-Fouled Vent',
    hundredPctLabel: 'UV-C Sterilized!',
    mechanicType: 'uv_sterilize',
    accentColor: '#34d399',
    secondaryColor: '#c084fc',
  },
  'ARTEMIS-LRO-CRATER-89S': {
    eventCode: 'ARTEMIS-LRO-CRATER-89S',
    taskTitle: 'Sintered Regolith Thermal Berm & Glycol Heat Loop',
    goalBanner: 'Balance glycol heaters or pack regolith berms!',
    goalIcon: '🔥',
    taskInstruction:
      'Use NASA’s Artemis South Pole thermal solution: throttle internal Glycol/Battery Heat Loops OR pilot the autonomous bulldozer rover to pack 50 cm of insulating lunar regolith berms around the habitat walls!',
    telemetryDataPoints: [
      'Shackleton Crater shadow drops to -203°C, draining habitat batteries through radiative heat loss.',
      'Real Solution Option A: Active internal glycol/ammonia heater loops warm O2 pipes rapidly (high power draw).',
      'Real Solution Option B: Fluffy lunar regolith has ultra-low thermal conductivity—piling soil berms insulates the hull like a thermos!',
    ],
    howToSolveSteps: [
      'STEP 1: 🔥 Slide the orange Glycol & Battery Heater bars right for rapid internal heating.',
      'STEP 2: 🚜 Or tap/drag the Chariot Rover around the 4 perimeter walls to pile insulating regolith berms.',
      'STEP 3: 🏠 Balance electric heating vs. passive regolith insulation before the -203°C cold wave peaks!',
    ],
    controlsSummary: 'Drag the orange heater sliders OR tap the 4 habitat perimeter walls to pile regolith.',
    proTip:
      'Lunar soil (regolith) in vacuum is 10x more insulating than fiberglass—packing regolith berms saves battery power and earns bonus NASA Science!',
    nasaFunFact:
      'NASA’s Lunar Reconnaissance Orbiter (LRO) Diviner instrument measured -203°C to -246°C in South Pole craters, yet just 50 cm beneath the fluffy lunar regolith soil, the temperature stays stable because lunar dust in a vacuum barely conducts heat at all!',
    realLifeSolution: {
      solutionTitle: 'ISRU Regolith Thermal Berm Blanketing & Closed-Loop Glycol Bus',
      nasaSystemCode: 'Artemis Base Camp ISRU Thermal & Radiation Overburden System',
      realWorldPrinciple:
        'Unconsolidated lunar regolith in a vacuum has an extremely low thermal conductivity (~0.002 W/m·K) because heat can only cross point contacts between grains. Piling regolith berms around a habitat slashes radiative heat loss and blocks cosmic rays.',
      primaryActionLabel: '🔥 Boost Glycol Heat Loop',
      secondaryActionLabel: '🚜 Pack Regolith Berm',
      fieldQuestion:
        'Why is loose lunar regolith (moon soil) in a vacuum such a powerful thermal insulator for Artemis habitats?',
      solutionChoices: [
        {
          label: 'With no air between the tiny jagged soil grains, heat can barely conduct across them—acting like a vacuum thermos.',
          isCorrect: true,
          explanation:
            'Correct! Without gas molecules to transfer heat between grains, lunar regolith in vacuum is one of nature’s best thermal insulators.',
        },
        {
          label: 'Moon soil generates its own volcanic lava heat on the surface.',
          isCorrect: false,
          explanation:
            'The Moon’s surface is cold, not volcanic—regolith works by trapping the habitat’s warmth inside like a vacuum flask!',
        },
      ],
    },
    zeroPctLabel: 'Regolith Insulated',
    hundredPctLabel: 'Active Heat Loop',
    mechanicType: 'thermal_conduit',
    accentColor: '#38bdf8',
    secondaryColor: '#f59e0b',
  },
  'DONKI-SEP-2026-M8.1': {
    eventCode: 'DONKI-SEP-2026-M8.1',
    taskTitle: 'Orion/Gateway Hydrogen Water-Wall Storm Shelter',
    goalBanner: 'Open manifold valves to fill H2O shield bags!',
    goalIcon: '💧',
    taskInstruction:
      'Execute the real Orion & Lunar Gateway radiation shelter solution: align 90° hydraulic manifold valves and pump hydrogen-rich potable/hydroponic water into overhead storm-shelter bladders!',
    telemetryDataPoints: [
      'An M8.1 Solar Energetic Particle (SEP) storm is bombarding the hull with relativistic protons.',
      'Why not lead or metal? Heavy metal atoms shatter into dangerous secondary neutron shrapnel when hit by cosmic rays.',
      'Real Solution: Water (H2O) is packed with light hydrogen protons that brake solar radiation cleanly with zero secondary scatter!',
    ],
    howToSolveSteps: [
      'STEP 1: 🔧 Tap each yellow Hydraulic Manifold Valve to rotate it 0° open.',
      'STEP 2: 💧 Slide up the Potable & Hydroponic Water Pumps at the bottom.',
      'STEP 3: 🛡️ Tap the 4 overhead shelter bladders to fill a 25 g/cm² hydrogen water wall!',
    ],
    controlsSummary: 'Tap pipe valves and overhead roof bladders, or slide the water pump bars.',
    proTip:
      'Tap directly on any overhead bladder to align its valve and pump hydrogen-rich water into the storm shelter wall!',
    nasaFunFact:
      'On NASA’s Orion spacecraft (Artemis II) and the ISS, astronauts build their emergency radiation storm shelter out of drinking-water bags and food packs because hydrogen atoms in water stop solar protons better than aluminum or steel!',
    realLifeSolution: {
      solutionTitle: 'Dual-Use ECLSS Potable Water-Bag Hydrogen Radiation Shielding',
      nasaSystemCode: 'Orion Crew Module / Gateway Habitable Element Storm Shelter Protocol',
      realWorldPrinciple:
        'High-energy protons collide like billiard balls: hitting a heavy metal nucleus ejects a shower of secondary neutrons (spallation), whereas hitting a light hydrogen nucleus (1 proton) in water (H2O) transfers maximum kinetic energy cleanly without secondary radiation.',
      primaryActionLabel: '💧 Pump H2O Shield Bladder',
      fieldQuestion:
        'Why does NASA use bags of drinking water (H2O) instead of thick metal plates to shield astronauts from solar proton storms?',
      solutionChoices: [
        {
          label: 'Light hydrogen atoms in water absorb proton energy cleanly without creating dangerous secondary neutron scatter—and double as drinking water!',
          isCorrect: true,
          explanation:
            'Spot on! Proton-on-proton collisions in H2O slow solar particles efficiently while avoiding the secondary spallation radiation caused by heavy metals.',
        },
        {
          label: 'Water is heavier than lead so it sinks radiation to the floor.',
          isCorrect: false,
          explanation:
            'Water is much lighter than lead—its secret superpower is its high density of single-proton hydrogen nuclei!',
        },
      ],
    },
    zeroPctLabel: 'Water in Greenhouse',
    hundredPctLabel: 'H2O Shelter Full!',
    mechanicType: 'water_bladder',
    accentColor: '#38bdf8',
    secondaryColor: '#a855f7',
  },
  'DONKI-QUIET-SUN-SOL': {
    eventCode: 'DONKI-QUIET-SUN-SOL',
    taskTitle: 'TRIDENT Percussion-Pause Drill & ECLSS Brine Filter',
    goalBanner: 'Pulse-drill regolith cores or swap ECLSS filters!',
    goalIcon: '🚀',
    taskInstruction:
      'Use real Artemis & ISS field procedures during a Quiet Sun window: pulse-and-pause the Honeybee TRIDENT core drill (preventing vacuum bit overheat) OR install the Forward-Osmosis Greywater Membrane & RTV hull patches!',
    telemetryDataPoints: [
      'In a vacuum, there is no air to cool a spinning drill bit—continuous drilling melts the bit and bakes out water ice!',
      'Real Solution A: NASA’s TRIDENT drill uses "percussion-pause" pecking cycles so the bit cools while Raman spectrometers scan cores.',
      'Real Solution B: Swapping ECLSS forward-osmosis membranes recycles 98% of crew water while RTV silicone seals micro-pits.',
    ],
    howToSolveSteps: [
      'STEP 1: 💎 Hold/tap the blue TRIDENT Core Drill—pause briefly if the vacuum heat bar turns orange!',
      'STEP 2: 🩹 Or tap the green ECLSS Greywater Membrane & red RTV Silicone hull patches on the right.',
      'STEP 3: 🌟 Choose 100% Science, 100% ECLSS Maintenance, or a balanced Hybrid engineering split!',
    ],
    controlsSummary: 'Tap/hold the left blue TRIDENT drill console or tap the right green ECLSS repair console.',
    proTip:
      'In space vacuum, heat cannot convect into air—release the drill throttle before 85% heat just like NASA’s real PRIME-1 lunar drill!',
    nasaFunFact:
      'NASA’s Honeybee Robotics TRIDENT drill (designed for Artemis polar ice prospecting) drills in short "bite-and-pull" steps with a temperature sensor in the tip so friction heat never sublimates precious lunar water ice before the spectrometer measures it!',
    realLifeSolution: {
      solutionTitle: 'TRIDENT Bite-and-Pause Vacuum Drilling & ECLSS 98% Water Recovery Loop',
      nasaSystemCode: 'Artemis PRIME-1 / VIPER TRIDENT Drill + ISS ECLSS Brine Processor',
      realWorldPrinciple:
        'Without atmospheric air for convective cooling, a lunar drill bit only loses heat by slow conduction into cold regolith. Pulsing the drill prevents thermal runaway that would vaporize volatile ice samples before Raman spectroscopy.',
      primaryActionLabel: '💎 Pulse TRIDENT Core Drill',
      secondaryActionLabel: '🛠️ Swap ECLSS Membrane & Patch',
      fieldQuestion:
        'Why must NASA’s lunar core drills pause periodically while drilling in the Moon’s vacuum?',
      solutionChoices: [
        {
          label: 'With no air for convective cooling, pausing stops friction heat from melting the bit and vaporizing water-ice samples.',
          isCorrect: true,
          explanation:
            'Correct! In a vacuum, friction heat stays trapped in the drill bit—pulsing lets the bit stay cool and preserves ice volatiles.',
        },
        {
          label: 'To let lunar earthworms crawl out of the way of the drill bit.',
          isCorrect: false,
          explanation:
            'There are no worms on the Moon—the pause is essential thermal engineering to prevent vacuum overheating and ice loss!',
        },
      ],
    },
    zeroPctLabel: 'ECLSS Repairs',
    hundredPctLabel: 'TRIDENT Science',
    mechanicType: 'core_spectrometer',
    accentColor: '#38bdf8',
    secondaryColor: '#34d399',
  },
};

export function getMiniGameDescriptor(eventCode: string): MiniGameDescriptor {
  if (MINI_GAME_DESCRIPTORS[eventCode]) {
    return MINI_GAME_DESCRIPTORS[eventCode];
  }
  const matched = getEventByCode(eventCode);
  if (matched && MINI_GAME_DESCRIPTORS[matched.donkiCode]) {
    return MINI_GAME_DESCRIPTORS[matched.donkiCode];
  }
  return MINI_GAME_DESCRIPTORS['ECLSS-O2-SEAL-404'];
}

function normalizeAngleDiff(a: number, b: number): number {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff);
}

/**
 * Modular MiniGameManager class that accepts an eventCode (e.g. 'ECLSS-O2-SEAL-404' or 'DONKI-FLR-2026-X2.4'),
 * mounts an interactive HTML5 Canvas overlay, plays procedural Web Audio soundscapes
 * + visual animations, and runs a countdown timer once started.
 */
export class MiniGameManager {
  public readonly eventCode: string;
  public readonly event: SpaceWeatherEvent;
  public readonly descriptor: MiniGameDescriptor;
  public readonly difficulty: DifficultyLevel;
  public readonly totalDurationSec: number;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private sfxIntervalId: number | null = null;
  private lastFrameTimeMs = 0;
  private elapsedSec = 0;
  private lastTickSecond = 12;
  private completed = false;
  private paused = false;

  private performanceRatio = 0;
  private nodes: MiniGameTargetNode[] = [];
  private sparks: SparkParticle[] = [];
  private confetti: ConfettiParticle[] = [];
  private inactivitySec = 0;
  private wrongTapTimer = 0;
  private wrongTapX = 320;
  private wrongTapY = 150;
  private encouragementText = '';
  private encouragementTimer = 0;
  private encouragementX = 320;
  private encouragementY = 120;

  // Special state for ECLSS-O2-SEAL-404 ("Fix the Leaky Pipe!")
  private readonly valveCenterX = 102;
  private readonly valveCenterY = 178;
  private readonly valveRadius = 44;
  private valveRotationDeg = 0; // 0 to 180 degrees
  private lastValvePointerAngle: number | null = null;
  private fractures: FractureLine[] = [];
  private hullHeat = 0; // 0.0 to 1.0 when holding torch too slow
  private overheatShieldPenalty = 0;
  private statusBannerText = 'Tap the glowing cracks to fix the pipe!';
  private statusBannerColor = '#facc15';

  // Special state for DONKI-FLR-2026-X2.4 ("Shield Against the Sun Storm!")
  private readonly radarCenterX = 320;
  private readonly radarCenterY = 160;
  private readonly shieldArcRadius = 68;
  private shieldAngleRad = -Math.PI / 2; // Adjustable 90-degree shield arc center
  private solarArraysFeathered = false; // false = COLLECT, true = FEATHER / FOLD
  private protonWaves: ProtonWaveCluster[] = [];
  private protonsDeflected = 0;
  private protonsHitHull = 0;

  // Special state for DONKI-SEP-2026-M8.1 ("Fill the Water Shields!")
  private waterBladders: OverheadShieldBladder[] = [];
  private potablePumpSlider = 0.45; // 0.0 to 1.0 (Crew Potable Water Tank pump)
  private hydroponicPumpSlider = 0.35; // 0.0 to 1.0 (Hydroponic Crop Tank pump)

  // Special state for OSDR-OSD-379-BIO ("Zap the Space Germs!")
  private fungalSpores: FungalSporeCluster[] = [];
  private dehumidifierFreqSlider = 0.25; // target 0.75
  private uvPhaseSlider = 0.3; // target 0.80
  private readonly targetDehumidifierFreq = 0.75;
  private readonly targetUvPhase = 0.8;
  private uvBeamTargetX: number | null = null;
  private uvBeamTargetY: number | null = null;
  private uvBeamTimer = 0;

  // Special state for DONKI-QUIET-SUN-SOL ("Science and Repairs!")
  private scienceTrackProgress = 0; // 0.0 to 1.0 (Left Console: Core Drill & Spectrometer)
  private maintenanceTrackProgress = 0; // 0.0 to 1.0 (Right Console: Greywater Filter & Hull Patch)
  private drillThrottleActive = false;
  private drillBitHeat = 0.18; // 0.0 to 1.0 (Redline at 0.85)
  private drillOverheated = false;
  private greywaterMembraneInstalled = false;
  private membraneDragX = 382;
  private membraneDragY = 114;
  private readonly recyclerSlotX = 532;
  private readonly recyclerSlotY = 114;
  private hullMicroPits: HullMicroPit[] = [];

  // Special state for ARTEMIS-DUST-LEV-09 ("Clean the Dusty Solar Panels!")
  private regolithClusters: RegolithDustCluster[] = [];
  private capacitorCharge = 0.82; // 0.0 to 1.0 (Green Peak Zone is 0.70..0.95)
  private capacitorChargeDir = 1;
  private repellerPulsesFired = 0;
  private arcShockCount = 0;
  private pulseWaveRadius = 0;
  private pulseWaveCenterX = 246;
  private pulseWaveCenterY = 152;

  // Special state for LRO-IMPACT-SWARM-12 ("Block the Space Rocks!")
  private readonly whippleDomeCenterX = 216;
  private readonly whippleDomeCenterY = 152;
  private readonly whippleShutterRadius = 58;
  private readonly whippleRadarRadius = 96;
  private readonly maxActiveShutters = 2;
  private whippleSectors: WhippleShutterSector[] = [];
  private activeShutterQueue: number[] = [];
  private meteorTrajectories: MicrometeoroidTrajectory[] = [];
  private meteorsBlocked = 0;
  private meteorsHitHull = 0;

  // Special state for ARTEMIS-LRO-CRATER-89S ("Keep the Base Warm!")
  private readonly thermalMapCenterX = 457;
  private readonly thermalMapCenterY = 152;
  private o2PipeHeaterSlider = 0; // 0.0 to 1.0 (Internal Heater Slider #1: O2 Manifold Pipes)
  private batteryBankHeaterSlider = 0; // 0.0 to 1.0 (Internal Heater Slider #2: Kilopower Battery Banks)
  private regolithBermWalls: RegolithBermWall[] = [];
  private roverDozerX = 457;
  private roverDozerY = 82;
  private roverDozerAngleRad = 0;
  private externalShadowTempC = -192; // Plummets toward -200°C

  // Special state for MARS-MEDA-DUST-88 ("Clear the Air Filters!")
  private moxieFilterCells: MoxieIntakeFilterCell[] = [];
  private loadShedBreakers: HabitatLoadBreaker[] = [];
  private windSpeedKmh = 32; // Oscillates between 24 km/h (Wind Trough) and 95 km/h (Peak Gust)
  private windSpeedDir = 1;
  private compressorBackPurgeBlasts = 0;
  private wastedGustBlasts = 0;
  private backPurgeShockwaveRadius = 0;
  private backPurgeShockwaveX = 208;
  private backPurgeShockwaveY = 178;

  // Special state for MARS-JEZERO-FROST-19 ("Melt the Ice on the Valves!")
  private cryoVentValves: CryoVentValve[] = [];
  private vortexX = 435;
  private vortexY = 152;
  private vortexRadius = 28;
  private vortexHitsCount = 0;
  private thermalCoilActive = false;

  private pointerX = 320;
  private pointerY = 180;
  private prevPointerX = 320;
  private prevPointerY = 180;
  private pointerSpeedPxPerSec = 0;
  private isPointerDown = false;
  private lastSoundTimeMs = 0;

  private onTelemetryUpdate?: (snapshot: MiniGameTelemetrySnapshot) => void;
  private onComplete?: (payload: MiniGameCompletionPayload) => void;

  // Bound event listeners for clean teardown
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;

  constructor(options: {
    eventCode: string;
    difficulty?: DifficultyLevel;
    durationSec?: number;
    onTelemetryUpdate?: (snapshot: MiniGameTelemetrySnapshot) => void;
    onComplete?: (payload: MiniGameCompletionPayload) => void;
  }) {
    const resolvedEvent = getEventByCode(options.eventCode) || NASA_SPACE_EVENTS[0];
    this.event = resolvedEvent;
    this.eventCode = resolvedEvent.donkiCode;
    this.descriptor = getMiniGameDescriptor(this.eventCode);
    this.difficulty = options.difficulty || 'normal';
    this.totalDurationSec =
      options.durationSec ?? DIFFICULTY_CONFIGS[this.difficulty].miniGameDurationSec;
    this.lastTickSecond = Math.ceil(this.totalDurationSec);
    this.onTelemetryUpdate = options.onTelemetryUpdate;
    this.onComplete = options.onComplete;

    this.initTargets();

    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundTouchStart = this.handleTouchStart.bind(this);
    this.boundTouchMove = this.handleTouchMove.bind(this);
    this.boundTouchEnd = this.handleTouchEnd.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);
  }

  private getPreset(): PerGameDifficultyPreset {
    return MINI_GAME_SETTINGS[this.descriptor.mechanicType][this.difficulty];
  }

  private markActiveInput(): void {
    this.inactivitySec = 0;
  }

  private spawnConfetti(x: number, y: number, count = 14): void {
    const palette = ['#fde047', '#34d399', '#38bdf8', '#fb7185', '#c084fc', '#fb923c'];
    for (let i = 0; i < count; i++) {
      if (this.confetti.length >= 140) this.confetti.shift();
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const speed = 60 + Math.random() * 140;
      this.confetti.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 10,
        color: palette[i % palette.length],
        size: 5 + Math.random() * 4,
        life: 0,
        maxLife: 0.75 + Math.random() * 0.45,
      });
    }
  }

  private triggerEncouragement(text: string, x: number, y: number): void {
    this.encouragementText = text;
    this.encouragementX = Math.max(90, Math.min(550, x));
    this.encouragementY = Math.max(72, Math.min(220, y));
    this.encouragementTimer = 0.9;
    this.spawnConfetti(x, y, 14);
  }

  private triggerWrongTap(x: number, y: number): void {
    this.wrongTapTimer = 0.55;
    this.wrongTapX = Math.max(80, Math.min(560, x));
    this.wrongTapY = Math.max(74, Math.min(225, y));
  }

  private initTargets(): void {
    const preset = this.getPreset();
    this.nodes = [];
    this.sparks = [];
    this.confetti = [];
    this.inactivitySec = 0;
    this.wrongTapTimer = 0;
    this.encouragementTimer = 0;
    this.fractures = [];
    this.protonWaves = [];
    this.valveRotationDeg = preset.enableSecondaryAction ? 0 : 180;
    this.hullHeat = 0;
    this.overheatShieldPenalty = 0;
    this.protonsDeflected = 0;
    this.protonsHitHull = 0;
    this.solarArraysFeathered = !preset.enableSecondaryAction;
    this.shieldAngleRad = -Math.PI / 2;

    if (this.descriptor.mechanicType === 'weld_seal') {
      const fractureCenters = preset.enableSecondaryAction
        ? [
            { id: 0, label: 'LEAK 1', cx: 280, cy: 174 },
            { id: 1, label: 'LEAK 2', cx: 410, cy: 174 },
            { id: 2, label: 'LEAK 3', cx: 540, cy: 174 },
          ]
        : [
            { id: 0, label: 'LEAK 1', cx: 165, cy: 168 },
            { id: 1, label: 'LEAK 2', cx: 320, cy: 168 },
            { id: 2, label: 'LEAK 3', cx: 475, cy: 168 },
          ];

      const offsets = [
        { dx: -26, dy: -22 },
        { dx: -14, dy: -6 },
        { dx: -4, dy: -14 },
        { dx: 6, dy: 8 },
        { dx: 16, dy: 0 },
        { dx: 26, dy: 20 },
      ];

      for (const fc of fractureCenters) {
        const segs: FractureSegment[] = [];
        for (let s = 0; s < offsets.length - 1; s++) {
          const p1 = offsets[s];
          const p2 = offsets[s + 1];
          const x1 = fc.cx + p1.dx;
          const y1 = fc.cy + p1.dy;
          const x2 = fc.cx + p2.dx;
          const y2 = fc.cy + p2.dy;
          segs.push({
            x1,
            y1,
            x2,
            y2,
            mx: (x1 + x2) / 2,
            my: (y1 + y2) / 2,
            sealed: 0,
            overheated: false,
          });
        }
        this.fractures.push({
          id: fc.id,
          label: fc.label,
          centerX: fc.cx,
          centerY: fc.cy,
          segments: segs,
        });
      }
      this.statusBannerText = preset.enableSecondaryAction
        ? 'Turn the green wheel, then seal all 3 leaks!'
        : 'Tap each glowing crack to seal the pipe!';
      this.statusBannerColor = preset.enableSecondaryAction ? '#facc15' : '#34d399';
      return;
    }

    if (this.descriptor.mechanicType === 'dipole_align') {
      const allDegs = [-75, 25, 145, -155, -20];
      const count = preset.targetCount;
      const vectorAnglesDeg = allDegs.slice(0, count);
      vectorAnglesDeg.forEach((deg, idx) => {
        this.protonWaves.push({
          id: idx,
          vectorAngleRad: (deg * Math.PI) / 180,
          distanceFromCore: 102,
          speedPxPerSec: (16 + idx * 1.5) * preset.speedMultiplier,
          spawnDelaySec: idx * (this.difficulty === 'easy' ? 1.85 : 1.35),
          state: 'incoming',
        });
      });
      this.statusBannerText = this.descriptor.goalBanner;
      this.statusBannerColor = '#c084fc';
      return;
    }

    if (this.descriptor.mechanicType === 'water_bladder') {
      const allConfigs = [
        { id: 0, label: 'BAG 1', x: 102, gcrDeg: 72, msv: 1.85 },
        { id: 1, label: 'BAG 2', x: 247, gcrDeg: 104, msv: 2.15 },
        { id: 2, label: 'BAG 3', x: 393, gcrDeg: 78, msv: 1.95 },
        { id: 3, label: 'BAG 4', x: 538, gcrDeg: 108, msv: 2.35 },
      ];
      const easyConfigs = [
        { id: 0, label: 'BAG 1', x: 145, gcrDeg: 75, msv: 1.85 },
        { id: 1, label: 'BAG 2', x: 320, gcrDeg: 95, msv: 2.15 },
        { id: 2, label: 'BAG 3', x: 495, gcrDeg: 105, msv: 1.95 },
      ];
      const chosen = preset.targetCount === 3 ? easyConfigs : allConfigs;
      this.waterBladders = chosen.map((cfg) => ({
        id: cfg.id,
        label: cfg.label,
        x: cfg.x,
        y: preset.enableSecondaryAction ? 96 : 142,
        junctionY: 162,
        junctionAligned: !preset.enableSecondaryAction,
        fillLevel: 0,
        gcrAngleRad: (cfg.gcrDeg * Math.PI) / 180,
        hotspotMsv: cfg.msv,
      }));
      this.potablePumpSlider = preset.enableSecondaryAction ? 0.45 : 0.9;
      this.hydroponicPumpSlider = preset.enableSecondaryAction ? 0.35 : 0.9;
      this.statusBannerText = this.descriptor.goalBanner;
      this.statusBannerColor = '#38bdf8';
      return;
    }

    if (this.descriptor.mechanicType === 'uv_sterilize') {
      const allSpores = [
        { id: 0, x: 385, y: 118, vx: 18, vy: 12 },
        { id: 1, x: 472, y: 152, vx: 15, vy: -14 },
        { id: 2, x: 398, y: 196, vx: 20, vy: -10 },
        { id: 3, x: 510, y: 202, vx: 14, vy: 13 },
      ];
      const easySpores = [
        { id: 0, x: 165, y: 148, vx: 14, vy: 9 },
        { id: 1, x: 320, y: 126, vx: -12, vy: 10 },
        { id: 2, x: 475, y: 162, vx: 12, vy: -10 },
      ];
      const chosen = preset.targetCount === 3 ? easySpores : allSpores;
      this.fungalSpores = chosen.map((sp) => ({
        id: sp.id,
        x: sp.x,
        y: sp.y,
        vx: sp.vx * preset.speedMultiplier,
        vy: sp.vy * preset.speedMultiplier,
        radius: preset.targetRadius,
        sterilized: 0,
      }));
      this.dehumidifierFreqSlider = preset.enableSecondaryAction
        ? 0.25
        : this.targetDehumidifierFreq;
      this.uvPhaseSlider = preset.enableSecondaryAction ? 0.3 : this.targetUvPhase;
      this.uvBeamTargetX = null;
      this.uvBeamTargetY = null;
      this.uvBeamTimer = 0;
      this.statusBannerText = this.descriptor.goalBanner;
      this.statusBannerColor = '#34d399';
      return;
    }

    if (this.descriptor.mechanicType === 'core_spectrometer') {
      this.scienceTrackProgress = 0;
      this.maintenanceTrackProgress = 0;
      this.drillThrottleActive = false;
      this.drillBitHeat = 0.18;
      this.drillOverheated = false;
      this.greywaterMembraneInstalled = false;
      this.membraneDragX = 382;
      this.membraneDragY = 114;
      this.hullMicroPits = [
        { id: 0, label: 'DOT 1', x: 388, y: 206, sealed: false },
        { id: 1, label: 'DOT 2', x: 476, y: 206, sealed: false },
        { id: 2, label: 'DOT 3', x: 564, y: 206, sealed: false },
      ];
      this.performanceRatio = 0.5;
      this.statusBannerText = this.descriptor.goalBanner;
      this.statusBannerColor = '#38bdf8';
      return;
    }

    if (this.descriptor.mechanicType === 'dust_brush') {
      const fullPanelCoords = [
        { id: 0, label: 'PANEL 1', x: 104, y: 118, arc: preset.enableHazards },
        { id: 1, label: 'PANEL 2', x: 238, y: 118, arc: false },
        { id: 2, label: 'PANEL 3', x: 372, y: 118, arc: preset.enableHazards },
        { id: 3, label: 'PANEL 4', x: 104, y: 200, arc: false },
        { id: 4, label: 'PANEL 5', x: 238, y: 200, arc: preset.enableHazards },
        { id: 5, label: 'PANEL 6', x: 372, y: 200, arc: false },
      ];
      const easyPanelCoords = [
        { id: 0, label: 'PANEL 1', x: 145, y: 155, arc: false },
        { id: 1, label: 'PANEL 2', x: 320, y: 155, arc: false },
        { id: 2, label: 'PANEL 3', x: 495, y: 155, arc: false },
      ];
      const chosen = preset.targetCount === 3 ? easyPanelCoords : fullPanelCoords;
      this.regolithClusters = chosen.map((c) => ({
        id: c.id,
        label: c.label,
        x: c.x,
        y: c.y,
        radius: preset.targetRadius,
        cleared: 0,
        clearedByRepeller: false,
        hasActiveArc: c.arc,
      }));
      this.capacitorCharge = 0.82; // Starts in Green Peak
      this.capacitorChargeDir = 1;
      this.repellerPulsesFired = 0;
      this.arcShockCount = 0;
      this.pulseWaveRadius = 0;
      this.statusBannerText = this.descriptor.goalBanner;
      this.statusBannerColor = '#facc15';
      return;
    }

    if (this.descriptor.mechanicType === 'whipple_intercept') {
      this.whippleSectors = [];
      this.activeShutterQueue = [];
      this.meteorTrajectories = [];
      this.meteorsBlocked = 0;
      this.meteorsHitHull = 0;

      for (let i = 0; i < 6; i++) {
        const startDeg = -90 + i * 60;
        const endDeg = startDeg + 60;
        const midDeg = startDeg + 30;
        const col = i % 2;
        const row = Math.floor(i / 2);
        this.whippleSectors.push({
          id: i,
          label: `SLICE ${i + 1}`,
          shortLabel: `${i + 1}`,
          startAngleRad: (startDeg * Math.PI) / 180,
          endAngleRad: (endDeg * Math.PI) / 180,
          midAngleRad: (midDeg * Math.PI) / 180,
          buttonX: 478 + col * 86,
          buttonY: 122 + row * 44,
          powered: false,
          slamFlashTimer: 0,
        });
      }

      const fullSwarmSchedule = [
        { sectorId: 0, delaySec: 0.0, speed: 15.5 },
        { sectorId: 2, delaySec: 1.1, speed: 16.5 },
        { sectorId: 4, delaySec: 2.3, speed: 17.5 },
        { sectorId: 1, delaySec: 3.5, speed: 18.0 },
        { sectorId: 5, delaySec: 4.7, speed: 18.5 },
      ];
      const easySwarmSchedule = [
        { sectorId: 0, delaySec: 0.0, speed: 11.0 },
        { sectorId: 2, delaySec: 2.0, speed: 11.5 },
        { sectorId: 4, delaySec: 4.0, speed: 12.0 },
      ];
      const swarmSchedule =
        preset.targetCount === 3 ? easySwarmSchedule : fullSwarmSchedule;
      swarmSchedule.forEach((cfg, idx) => {
        const sector = this.whippleSectors[cfg.sectorId];
        this.meteorTrajectories.push({
          id: idx,
          sectorId: cfg.sectorId,
          angleRad: sector.midAngleRad,
          distanceFromCenter: this.whippleRadarRadius,
          speedPxPerSec: cfg.speed * preset.speedMultiplier,
          spawnDelaySec: cfg.delaySec,
          state: 'incoming',
        });
      });

      this.statusBannerText = this.descriptor.goalBanner;
      this.statusBannerColor = '#fb923c';
      return;
    }

    if (this.descriptor.mechanicType === 'thermal_conduit') {
      this.o2PipeHeaterSlider = 0;
      this.batteryBankHeaterSlider = 0;
      this.externalShadowTempC = -192;
      this.performanceRatio = 0.5;
      const cx = this.thermalMapCenterX;
      const cy = this.thermalMapCenterY;
      this.regolithBermWalls = [
        {
          id: 0,
          label: 'TOP WALL',
          shortLabel: 'TOP',
          cx,
          cy: cy - 52,
          w: 96,
          h: 20,
          packed: 0,
        },
        {
          id: 1,
          label: 'RIGHT WALL',
          shortLabel: 'RIGHT',
          cx: cx + 68,
          cy,
          w: 24,
          h: 74,
          packed: 0,
        },
        {
          id: 2,
          label: 'BOTTOM WALL',
          shortLabel: 'BOT',
          cx,
          cy: cy + 52,
          w: 96,
          h: 20,
          packed: 0,
        },
        {
          id: 3,
          label: 'LEFT WALL',
          shortLabel: 'LEFT',
          cx: cx - 68,
          cy,
          w: 24,
          h: 74,
          packed: 0,
        },
      ];
      this.roverDozerX = cx;
      this.roverDozerY = cy - 52;
      this.roverDozerAngleRad = 0;
      this.statusBannerText = this.descriptor.goalBanner;
      this.statusBannerColor = '#38bdf8';
      return;
    }

    if (this.descriptor.mechanicType === 'filter_purge') {
      this.windSpeedKmh = 32; // Starts in Wind Trough (<= 48 km/h)
      this.windSpeedDir = 1;
      this.compressorBackPurgeBlasts = 0;
      this.wastedGustBlasts = 0;
      this.backPurgeShockwaveRadius = 0;
      this.performanceRatio = 0;

      this.moxieFilterCells = [];
      if (preset.targetCount === 3) {
        for (let i = 0; i < 3; i++) {
          this.moxieFilterCells.push({
            id: i,
            label: `FILTER ${i + 1}`,
            x: 155 + i * 165,
            y: 162,
            radius: preset.targetRadius,
            purged: 0,
          });
        }
      } else {
        for (let i = 0; i < 6; i++) {
          const col = i % 3;
          const row = Math.floor(i / 3);
          this.moxieFilterCells.push({
            id: i,
            label: `FILTER ${i + 1}`,
            x: 92 + col * 116,
            y: 138 + row * 56,
            radius: preset.targetRadius,
            purged: 0,
          });
        }
      }

      this.loadShedBreakers = [
        {
          id: 0,
          label: 'LAB POWER',
          subLabel: 'Save battery',
          x: 426,
          y: 94,
          w: 188,
          h: 38,
          tripped: false,
        },
        {
          id: 1,
          label: 'AIR PUMP',
          subLabel: 'Pause pump',
          x: 426,
          y: 140,
          w: 188,
          h: 38,
          tripped: false,
        },
        {
          id: 2,
          label: 'BACKUP AIR',
          subLabel: 'Use extra air',
          x: 426,
          y: 186,
          w: 188,
          h: 38,
          tripped: false,
        },
      ];

      this.statusBannerText = this.descriptor.goalBanner;
      this.statusBannerColor = '#34d399';
      return;
    }

    if (this.descriptor.mechanicType === 'frost_melt') {
      this.vortexX = 435;
      this.vortexY = 152;
      this.vortexRadius = 28;
      this.vortexHitsCount = 0;
      this.thermalCoilActive = false;
      this.performanceRatio = 0.5;

      const fullVentConfigs = [
        { id: 0, label: 'VALVE 1', subLabel: 'DOOR', x: 314, y: 120 },
        { id: 1, label: 'VALVE 2', subLabel: 'PLANTS', x: 435, y: 108 },
        { id: 2, label: 'VALVE 3', subLabel: 'ROOF', x: 556, y: 120 },
        { id: 3, label: 'VALVE 4', subLabel: 'PIPE', x: 368, y: 192 },
        { id: 4, label: 'VALVE 5', subLabel: 'TANK', x: 502, y: 192 },
      ];
      const easyVentConfigs = [
        { id: 0, label: 'VALVE 1', subLabel: 'DOOR', x: 165, y: 160 },
        { id: 1, label: 'VALVE 2', subLabel: 'PLANTS', x: 320, y: 160 },
        { id: 2, label: 'VALVE 3', subLabel: 'TANK', x: 475, y: 160 },
      ];
      const chosen = preset.targetCount === 3 ? easyVentConfigs : fullVentConfigs;

      this.cryoVentValves = chosen.map((cfg) => ({
        id: cfg.id,
        label: cfg.label,
        subLabel: cfg.subLabel,
        x: cfg.x,
        y: cfg.y,
        radius: preset.targetRadius,
        thermalMelted: 0,
        chiselShattered: 0,
      }));

      this.statusBannerText = this.descriptor.goalBanner;
      this.statusBannerColor = '#38bdf8';
      return;
    }

    const count = 6;
    for (let i = 0; i < count; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      this.nodes.push({
        id: i,
        x: 155 + col * 165,
        y: 115 + row * 120,
        vx: 0,
        vy: 0,
        radius: 38,
        progress: 0,
        angle: 0,
      });
    }
  }

  public mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lastFrameTimeMs = performance.now();

    canvas.addEventListener('pointerdown', this.boundPointerDown);
    window.addEventListener('pointermove', this.boundPointerMove);
    window.addEventListener('pointerup', this.boundPointerUp);
    canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    window.addEventListener('touchend', this.boundTouchEnd);
    window.addEventListener('keydown', this.boundKeyDown);

    soundFX.playEventSound(this.event.id);
    if (typeof window !== 'undefined') {
      this.sfxIntervalId = window.setInterval(() => {
        if (!this.completed && !this.paused) {
          soundFX.playEventSound(this.event.id);
        }
      }, 4200);
    }

    this.emitTelemetry();
    this.rafId = requestAnimationFrame((ts) => this.loop(ts));
  }

  public pause(): void {
    this.paused = true;
    this.isPointerDown = false;
  }

  public resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.lastFrameTimeMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public unmount(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.sfxIntervalId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.sfxIntervalId);
      this.sfxIntervalId = null;
    }
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
      this.canvas.removeEventListener('touchstart', this.boundTouchStart);
      this.canvas.removeEventListener('touchmove', this.boundTouchMove);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', this.boundPointerMove);
      window.removeEventListener('pointerup', this.boundPointerUp);
      window.removeEventListener('touchend', this.boundTouchEnd);
      window.removeEventListener('keydown', this.boundKeyDown);
    }
    this.canvas = null;
    this.ctx = null;
  }

  public isValveInSafeZone(): boolean {
    return this.valveRotationDeg >= 175;
  }

  public getValveRotationDeg(): number {
    return Math.round(this.valveRotationDeg);
  }

  public getOverheatShieldPenalty(): number {
    return this.overheatShieldPenalty;
  }

  public isSolarArraysFeathered(): boolean {
    return this.solarArraysFeathered;
  }

  public toggleSolarArrayGimbal(): boolean {
    this.solarArraysFeathered = !this.solarArraysFeathered;
    soundFX.playArrayGimbalToggle(this.solarArraysFeathered);
    this.statusBannerText = this.solarArraysFeathered
      ? 'SOLAR ARRAYS FEATHERED — EDGE-ON FOR WAVE IMPACT!'
      : 'SOLAR ARRAYS IN COLLECT MODE — FOLD BEFORE IMPACT!';
    this.statusBannerColor = this.solarArraysFeathered ? '#34d399' : '#facc15';
    this.emitTelemetry();
    return this.solarArraysFeathered;
  }

  public rotateShieldArcByDeg(deltaDeg: number): void {
    this.shieldAngleRad += (deltaDeg * Math.PI) / 180;
    this.checkDipoleWaveInterceptions();
    this.emitTelemetry();
  }

  public togglePipeJunction(index: number): boolean {
    const bladder = this.waterBladders[index];
    if (!bladder) return false;
    bladder.junctionAligned = !bladder.junctionAligned;
    soundFX.playPipeJunctionRotate(bladder.junctionAligned);
    if (bladder.junctionAligned) {
      const pumpRate = index < 2 ? this.potablePumpSlider : this.hydroponicPumpSlider;
      bladder.fillLevel = Math.min(1, bladder.fillLevel + 0.35 + pumpRate * 0.25);
      this.statusBannerText = `JUNCTION J${index + 1} OPEN — PUMPING H2O INTO ${bladder.label}!`;
      this.statusBannerColor = '#38bdf8';
    } else {
      this.statusBannerText = `JUNCTION J${index + 1} CLOSED — WATER RETAINED IN TANK`;
      this.statusBannerColor = '#facc15';
    }
    this.recalculateRatio();
    this.emitTelemetry();
    if (this.performanceRatio >= 1) {
      this.finishMiniGame();
    }
    return bladder.junctionAligned;
  }

  public setWaterPumpSliders(potableRatio: number, hydroponicRatio: number): void {
    this.potablePumpSlider = Math.max(0, Math.min(1, potableRatio));
    this.hydroponicPumpSlider = Math.max(0, Math.min(1, hydroponicRatio));
    // Boost active open bladders when sliders are pumped
    for (const b of this.waterBladders) {
      if (b.junctionAligned && b.fillLevel < 1) {
        const rate = b.id < 2 ? this.potablePumpSlider : this.hydroponicPumpSlider;
        b.fillLevel = Math.min(1, b.fillLevel + rate * 0.35);
      }
    }
    this.recalculateRatio();
    soundFX.playHydraulicPumpFlow(this.performanceRatio);
    this.emitTelemetry();
    if (this.performanceRatio >= 1) {
      this.finishMiniGame();
    }
  }

  public getBladdersFilledCount(): number {
    return this.waterBladders.filter((b) => b.fillLevel >= 0.99).length;
  }

  public getWaveformMatchRatio(): number {
    const preset = this.getPreset();
    if (!preset.enableSecondaryAction) return 1;
    const band = this.difficulty === 'normal' ? 0.1 : 0.04;
    const err1 = Math.max(
      0,
      Math.abs(this.dehumidifierFreqSlider - this.targetDehumidifierFreq) - band
    );
    const err2 = Math.max(
      0,
      Math.abs(this.uvPhaseSlider - this.targetUvPhase) - band
    );
    const match1 = Math.max(0, Math.min(1, 1 - err1 / 0.5));
    const match2 = Math.max(0, Math.min(1, 1 - err2 / 0.5));
    return Number(((match1 + match2) / 2).toFixed(3));
  }

  public setScrubberFrequencySliders(dehumidifierFreq: number, uvPhase: number): void {
    this.dehumidifierFreqSlider = Math.max(0, Math.min(1, dehumidifierFreq));
    this.uvPhaseSlider = Math.max(0, Math.min(1, uvPhase));
    this.recalculateRatio();
    soundFX.playWaveformTune(this.getWaveformMatchRatio());
    const wavePct = Math.round(this.getWaveformMatchRatio() * 100);
    this.statusBannerText =
      wavePct >= 95
        ? '3-CHANNEL WAVEFORM LOCKED! CLICK FUNGAL SPORES TO UV-STERILIZE!'
        : `TUNING DEHUMIDIFIER & UV WAVEFORMS: ${wavePct}% PHASE MATCH`;
    this.statusBannerColor = wavePct >= 95 ? '#34d399' : '#38bdf8';
    this.emitTelemetry();
    if (this.performanceRatio >= 1) {
      this.finishMiniGame();
    }
  }

  public getSporesSterilizedCount(): number {
    return this.fungalSpores.filter((s) => s.sterilized >= 0.99).length;
  }

  public getScienceTrackProgress(): number {
    return Number(this.scienceTrackProgress.toFixed(3));
  }

  public getMaintenanceTrackProgress(): number {
    return Number(this.maintenanceTrackProgress.toFixed(3));
  }

  public getHullPitsSealedCount(): number {
    return this.hullMicroPits.filter((p) => p.sealed).length;
  }

  public boostScienceConsole(amount = 0.25): void {
    if (this.completed) return;
    this.drillThrottleActive = true;
    this.drillBitHeat = Math.min(0.78, this.drillBitHeat + 0.14);
    this.scienceTrackProgress = Math.min(
      1,
      Number((this.scienceTrackProgress + amount).toFixed(3))
    );
    this.pointerX = 164;
    this.pointerY = 148;
    this.spawnSparks(118, 172, '#38bdf8', 10);
    this.recalculateRatio();
    soundFX.playCoreDrillThrottle(this.scienceTrackProgress, this.drillBitHeat);
    this.statusBannerText = `LEFT SCIENCE CONSOLE: ${Math.round(
      this.scienceTrackProgress * 100
    )}% CORE EXTRACTED · FOCUS: ${Math.round(this.performanceRatio * 100)}% SCI`;
    this.statusBannerColor = '#38bdf8';
    this.emitTelemetry();
  }

  public boostMaintenanceConsole(amount = 0.25): void {
    if (this.completed) return;
    this.drillThrottleActive = false;
    if (!this.greywaterMembraneInstalled) {
      this.greywaterMembraneInstalled = true;
      this.membraneDragX = this.recyclerSlotX;
      this.membraneDragY = this.recyclerSlotY;
      this.pointerX = this.recyclerSlotX;
      this.pointerY = this.recyclerSlotY;
      this.spawnSparks(this.recyclerSlotX, this.recyclerSlotY, '#34d399', 12);
    } else {
      const nextPit = this.hullMicroPits.find((p) => !p.sealed);
      if (nextPit) {
        nextPit.sealed = true;
        this.pointerX = nextPit.x;
        this.pointerY = nextPit.y;
        this.spawnSparks(nextPit.x, nextPit.y, '#34d399', 12);
      }
    }
    this.maintenanceTrackProgress = Math.min(
      1,
      Number((this.maintenanceTrackProgress + amount).toFixed(3))
    );
    this.recalculateRatio();
    soundFX.playMaintenancePatch(this.maintenanceTrackProgress);
    this.statusBannerText = `RIGHT MAINT CONSOLE: ${Math.round(
      this.maintenanceTrackProgress * 100
    )}% PATCHED · FOCUS: ${Math.round((1 - this.performanceRatio) * 100)}% MAINT`;
    this.statusBannerColor = '#34d399';
    this.emitTelemetry();
  }

  public isCapacitorInGreenPeak(): boolean {
    const minPeak = this.difficulty === 'normal' ? 0.56 : 0.7;
    return this.capacitorCharge >= minPeak && this.capacitorCharge <= 0.96;
  }

  public getCapacitorChargePct(): number {
    return Math.round(this.capacitorCharge * 100);
  }

  public getDustClearedCount(): number {
    return this.regolithClusters.filter((c) => c.cleared >= 0.99).length;
  }

  public getArcShockCount(): number {
    return this.arcShockCount;
  }

  public fireCapacitorRepellerPulse(): boolean {
    if (this.completed) return false;
    const inGreenPeak = this.isCapacitorInGreenPeak();
    this.repellerPulsesFired++;

    if (inGreenPeak) {
      // Timed with the charge meter's green peak: clears a large radius (up to 2 panels per pulse) cleanly
      let clearedThisPulse = 0;
      for (const cluster of this.regolithClusters) {
        if (cluster.cleared < 1 && clearedThisPulse < 2) {
          cluster.cleared = 1;
          cluster.clearedByRepeller = true;
          cluster.hasActiveArc = false;
          clearedThisPulse++;
          this.pulseWaveCenterX = cluster.x;
          this.pulseWaveCenterY = cluster.y;
          this.spawnSparks(cluster.x, cluster.y, '#38bdf8', 12);
          this.spawnSparks(cluster.x, cluster.y, '#facc15', 8);
        }
      }
      this.pulseWaveRadius = 12;
      this.capacitorCharge = 0.84; // Reset into ready green peak band for next timed pulse
      this.recalculateRatio();
      soundFX.playCapacitorRepellerPulse(true);
      this.statusBannerText = `TIMED REPELLER PULSE! ${this.getDustClearedCount()}/${
        this.regolithClusters.length
      } SOLAR CELLS CLEARED (${Math.round(this.performanceRatio * 100)}%)!`;
      this.statusBannerColor = '#34d399';
      this.emitTelemetry();

      if (this.getDustClearedCount() >= this.regolithClusters.length) {
        this.finishMiniGame();
      }
      return true;
    }

    // Fired outside green peak: weak discharge
    const nextCluster = this.regolithClusters.find((c) => c.cleared < 1);
    if (nextCluster) {
      nextCluster.cleared = Math.min(1, nextCluster.cleared + 0.35);
      this.pulseWaveCenterX = nextCluster.x;
      this.pulseWaveCenterY = nextCluster.y;
      this.spawnSparks(nextCluster.x, nextCluster.y, '#facc15', 6);
    }
    this.capacitorCharge = 0.78;
    this.recalculateRatio();
    soundFX.playCapacitorRepellerPulse(false);
    this.statusBannerText =
      'WEAK CAPACITOR PULSE! WAIT FOR GREEN PEAK (70–95%) FOR FULL DIELECTRIC BLAST!';
    this.statusBannerColor = '#facc15';
    this.emitTelemetry();
    return false;
  }

  public swipeManualEvaBrush(clusterIndex?: number): void {
    if (this.completed) return;
    const target =
      typeof clusterIndex === 'number'
        ? this.regolithClusters[clusterIndex]
        : this.regolithClusters.find((c) => c.cleared < 1);
    if (!target) return;

    target.cleared = 1;
    this.pointerX = target.x;
    this.pointerY = target.y;

    if (target.hasActiveArc) {
      this.arcShockCount++;
      this.spawnSparks(target.x, target.y, '#f43f5e', 14);
      soundFX.playEvaBrushSwipe(true);
      this.statusBannerText = `EVA SUIT ARC SHOCK ON ${target.label}! SWIPED OVER ACTIVE LIGHTNING NODE (-SHIELDING)!`;
      this.statusBannerColor = '#f43f5e';
    } else {
      this.spawnSparks(target.x, target.y, '#facc15', 10);
      soundFX.playEvaBrushSwipe(false);
      this.statusBannerText = `MANUAL EVA BRUSH SWEPT ${target.label} (${this.getDustClearedCount()}/${
        this.regolithClusters.length
      })!`;
      this.statusBannerColor = '#38bdf8';
    }

    this.recalculateRatio();
    this.emitTelemetry();
    if (this.getDustClearedCount() >= this.regolithClusters.length) {
      this.finishMiniGame();
    }
  }

  public getActiveShutterIds(): number[] {
    return [...this.activeShutterQueue];
  }

  public getMeteorsBlockedCount(): number {
    return this.meteorsBlocked;
  }

  public getMeteorsHitHullCount(): number {
    return this.meteorsHitHull;
  }

  /**
   * Energizes the specified Whipple & Regolith Shutter sector (0..5 for S1..S6).
   * Enforces the strict 2-shutter grid limit: energizing a 3rd sector automatically
   * de-energizes the oldest active shutter sector.
   */
  public energizeWhippleShutter(sectorId: number, interceptImmediate = false): boolean {
    if (this.completed) return false;
    const sector = this.whippleSectors[sectorId];
    if (!sector) return false;

    const preset = this.getPreset();
    const limit = preset.enableSecondaryAction ? this.maxActiveShutters : 6;
    const existingIdx = this.activeShutterQueue.indexOf(sectorId);
    if (existingIdx !== -1) {
      this.activeShutterQueue.splice(existingIdx, 1);
    } else if (this.activeShutterQueue.length >= limit) {
      const oldestSectorId = this.activeShutterQueue.shift();
      if (oldestSectorId !== undefined && this.whippleSectors[oldestSectorId]) {
        this.whippleSectors[oldestSectorId].powered = false;
      }
    }

    this.activeShutterQueue.push(sectorId);
    this.whippleSectors.forEach((s) => {
      s.powered = this.activeShutterQueue.includes(s.id);
    });
    sector.slamFlashTimer = 0.35;

    const sx =
      this.whippleDomeCenterX + Math.cos(sector.midAngleRad) * this.whippleShutterRadius;
    const sy =
      this.whippleDomeCenterY + Math.sin(sector.midAngleRad) * this.whippleShutterRadius;
    this.pointerX = sx;
    this.pointerY = sy;

    soundFX.playWhippleShutterSlam(sectorId, true);

    // Check if an incoming meteor vector on this sector can be intercepted by this shutter slam
    const targetMeteor = this.meteorTrajectories.find(
      (m) =>
        m.state === 'incoming' &&
        m.sectorId === sectorId &&
        (interceptImmediate ||
          (this.elapsedSec >= m.spawnDelaySec && m.distanceFromCenter <= this.whippleRadarRadius))
    );

    if (targetMeteor) {
      targetMeteor.state = 'blocked';
      this.meteorsBlocked++;
      this.spawnSparks(sx, sy, '#fb923c', 14);
      this.spawnSparks(sx, sy, '#fde047', 8);
      this.triggerEncouragement('Blocked!', sx, sy - 18);
      soundFX.playMeteorShutterImpact(true);
      this.recalculateRatio();
      this.statusBannerText = `Shield blocked space rock ${this.meteorsBlocked}!`;
      this.statusBannerColor = '#34d399';
      this.emitTelemetry();

      if (this.meteorTrajectories.every((m) => m.state !== 'incoming')) {
        this.finishMiniGame();
      }
      return true;
    }

    this.statusBannerText = `Shield ${sector.shortLabel} ready!`;
    this.statusBannerColor = '#38bdf8';
    this.emitTelemetry();
    return true;
  }

  public toggleWhippleShutter(sectorId: number): boolean {
    if (this.completed) return false;
    const sector = this.whippleSectors[sectorId];
    if (!sector) return false;

    const hasIncomingThreat = this.meteorTrajectories.some(
      (m) => m.state === 'incoming' && m.sectorId === sectorId
    );

    if (sector.powered && !hasIncomingThreat) {
      this.activeShutterQueue = this.activeShutterQueue.filter((id) => id !== sectorId);
      sector.powered = false;
      soundFX.playWhippleShutterSlam(sectorId, false);
      this.statusBannerText = `SHUTTER ${sector.shortLabel} DE-ENERGIZED (${this.activeShutterQueue.length}/${this.maxActiveShutters} ACTIVE)`;
      this.statusBannerColor = '#facc15';
      this.emitTelemetry();
      return false;
    }

    return this.energizeWhippleShutter(sectorId, true);
  }

  public getHeaterStrategyProgress(): number {
    return Number(
      ((this.o2PipeHeaterSlider + this.batteryBankHeaterSlider) / 2).toFixed(3)
    );
  }

  public getRegolithBermProgress(): number {
    if (this.regolithBermWalls.length === 0) return 0;
    const sum = this.regolithBermWalls.reduce(
      (acc, w) => acc + Math.min(1, Math.max(0, w.packed)),
      0
    );
    return Number((sum / this.regolithBermWalls.length).toFixed(3));
  }

  public getRegolithBermsPackedCount(): number {
    return this.regolithBermWalls.filter((w) => w.packed >= 0.99).length;
  }

  public setThermalHeaterSliders(o2Ratio: number, batteryRatio: number): void {
    if (this.completed) return;
    this.o2PipeHeaterSlider = Math.max(0, Math.min(1, Number(o2Ratio.toFixed(3))));
    this.batteryBankHeaterSlider = Math.max(
      0,
      Math.min(1, Number(batteryRatio.toFixed(3)))
    );
    this.pointerX = 42 + this.o2PipeHeaterSlider * 210;
    this.pointerY = 122;
    this.spawnSparks(this.pointerX, this.pointerY, '#f59e0b', 8);
    this.recalculateRatio();
    soundFX.playThermalBusHeaterRoute(this.getHeaterStrategyProgress());
    this.statusBannerText = `INTERNAL HEATERS AT ${Math.round(
      this.getHeaterStrategyProgress() * 100
    )}% (O2: ${Math.round(this.o2PipeHeaterSlider * 100)}%, BAT: ${Math.round(
      this.batteryBankHeaterSlider * 100
    )}%) · STRATEGY: ${Math.round(this.performanceRatio * 100)}% HEATER`;
    this.statusBannerColor = '#f59e0b';
    this.emitTelemetry();
  }

  public boostThermalHeaters(amount = 0.25): void {
    if (this.completed) return;
    const nextO2 = Math.min(1, this.o2PipeHeaterSlider + amount);
    const nextBat = Math.min(1, this.batteryBankHeaterSlider + amount);
    this.setThermalHeaterSliders(nextO2, nextBat);
  }

  public packRegolithBerm(wallIndex?: number, amount = 1.0): void {
    if (this.completed) return;
    const targetWall =
      typeof wallIndex === 'number'
        ? this.regolithBermWalls[wallIndex]
        : this.regolithBermWalls.find((w) => w.packed < 1) ||
          this.regolithBermWalls[0];
    if (!targetWall) return;

    targetWall.packed = Math.min(
      1,
      Number((targetWall.packed + amount).toFixed(3))
    );
    this.roverDozerX = targetWall.cx;
    this.roverDozerY = targetWall.cy;
    this.roverDozerAngleRad = Math.atan2(
      targetWall.cy - this.thermalMapCenterY,
      targetWall.cx - this.thermalMapCenterX
    );
    this.pointerX = targetWall.cx;
    this.pointerY = targetWall.cy;
    this.spawnSparks(targetWall.cx, targetWall.cy, '#facc15', 10);
    this.spawnSparks(targetWall.cx, targetWall.cy, '#38bdf8', 6);
    this.recalculateRatio();
    soundFX.playEvaRoverRegolithDozer(this.getRegolithBermProgress());
    this.statusBannerText = `EVA ROVER DOZER PACKED ${targetWall.shortLabel} (${this.getRegolithBermsPackedCount()}/${
      this.regolithBermWalls.length
    } BERMS) · STRATEGY: ${Math.round((1 - this.performanceRatio) * 100)}% REGOLITH`;
    this.statusBannerColor = '#34d399';
    this.emitTelemetry();
  }

  public isWindInTrough(): boolean {
    const preset = this.getPreset();
    if (!preset.enableHazards) return true;
    const limit = this.difficulty === 'normal' ? 54 : 48;
    return this.windSpeedKmh <= limit;
  }

  public getWindSpeedKmh(): number {
    return Math.round(this.windSpeedKmh);
  }

  public setWindSpeedKmh(kmh: number): void {
    this.windSpeedKmh = Math.max(20, Math.min(95, kmh));
    this.emitTelemetry();
  }

  public getMoxieFiltersPurgedCount(): number {
    return this.moxieFilterCells.filter((c) => c.purged >= 0.99).length;
  }

  public getMoxieFilterPurgeProgress(): number {
    if (this.moxieFilterCells.length === 0) return 0;
    const sum = this.moxieFilterCells.reduce(
      (acc, c) => acc + Math.min(1, Math.max(0, c.purged)),
      0
    );
    return Number((sum / this.moxieFilterCells.length).toFixed(3));
  }

  public getBreakersTrippedCount(): number {
    return this.loadShedBreakers.filter((b) => b.tripped).length;
  }

  public getLoadShedBreakerProgress(): number {
    if (this.loadShedBreakers.length === 0) return 0;
    return Number(
      (this.getBreakersTrippedCount() / this.loadShedBreakers.length).toFixed(3)
    );
  }

  public getWastedGustBlastsCount(): number {
    return this.wastedGustBlasts;
  }

  /**
   * Fires a high-pressure Compressor Back-Purge Blast across the MOXIE intake filter mesh.
   * Firing when outside wind gusts dip into a trough (<= 48 km/h) cleanly purges 2 filter cells per blast.
   * Firing against a peak 95 km/h gust (> 48 km/h) wastes battery power against backpressure.
   */
  public fireCompressorBackPurgeBlast(): boolean {
    if (this.completed) return false;
    const inTrough = this.isWindInTrough();

    if (inTrough) {
      this.compressorBackPurgeBlasts++;
      let purgedThisBlast = 0;
      for (const cell of this.moxieFilterCells) {
        if (cell.purged < 1 && purgedThisBlast < 2) {
          cell.purged = 1;
          purgedThisBlast++;
          this.backPurgeShockwaveX = cell.x;
          this.backPurgeShockwaveY = cell.y;
          this.pointerX = cell.x;
          this.pointerY = cell.y;
          this.spawnSparks(cell.x, cell.y, '#38bdf8', 12);
          this.spawnSparks(cell.x, cell.y, '#f97316', 8);
        }
      }
      this.backPurgeShockwaveRadius = 10;
      this.windSpeedKmh = 34; // Keep ready in wind trough band for responsive sequential blasts
      this.recalculateRatio();
      soundFX.playCompressorBackPurge(true);
      this.statusBannerText = `TROUGH BACK-PURGE BLAST! ${this.getMoxieFiltersPurgedCount()}/${
        this.moxieFilterCells.length
      } MOXIE FILTERS CLEAN (${Math.round(this.performanceRatio * 100)}%)!`;
      this.statusBannerColor = '#34d399';
      this.emitTelemetry();

      if (this.getMoxieFiltersPurgedCount() >= this.moxieFilterCells.length) {
        this.finishMiniGame();
      }
      return true;
    }

    // Fired against a peak 95 km/h wind gust: wastes battery power and stalls back-purge
    this.wastedGustBlasts++;
    const partialCell = this.moxieFilterCells.find((c) => c.purged < 1);
    if (partialCell) {
      partialCell.purged = Math.min(1, Number((partialCell.purged + 0.15).toFixed(3)));
      this.backPurgeShockwaveX = partialCell.x;
      this.backPurgeShockwaveY = partialCell.y;
      this.spawnSparks(partialCell.x, partialCell.y, '#f43f5e', 10);
    }
    this.backPurgeShockwaveRadius = 8;
    this.recalculateRatio();
    soundFX.playCompressorBackPurge(false);
    this.statusBannerText = `PEAK ${Math.round(
      this.windSpeedKmh
    )} KM/H GUST! WAIT FOR GREEN TROUGH (<=48 KM/H)!`;
    this.statusBannerColor = '#f43f5e';
    this.emitTelemetry();
    return false;
  }

  /**
   * Flips a breaker on the Habitat Power Breaker & Reserve O2 Board to throttle
   * habitat systems and switch to reserve O2 tanks.
   */
  public flipLoadShedBreaker(breakerIndex?: number): boolean {
    if (this.completed) return false;
    const target =
      typeof breakerIndex === 'number'
        ? this.loadShedBreakers[breakerIndex]
        : this.loadShedBreakers.find((b) => !b.tripped) ||
          this.loadShedBreakers[0];
    if (!target) return false;

    target.tripped =
      typeof breakerIndex === 'number' ? !target.tripped : true;
    this.pointerX = target.x + target.w / 2;
    this.pointerY = target.y + target.h / 2;
    this.spawnSparks(this.pointerX, this.pointerY, '#facc15', 10);
    this.recalculateRatio();
    soundFX.playBreakerLoadShed(this.getBreakersTrippedCount());
    this.statusBannerText = `${target.label} ${
      target.tripped ? 'TRIPPED [LOAD SHED]' : 'RESET [NORMAL]'
    } (${this.getBreakersTrippedCount()}/${this.loadShedBreakers.length} BREAKERS)!`;
    this.statusBannerColor = '#facc15';
    this.emitTelemetry();
    return target.tripped;
  }

  /**
   * Returns how many of the 5 external airlock & hydroponic cryo-valves are 100% de-iced.
   */
  public getCryoValvesDeIcedCount(): number {
    return this.cryoVentValves.filter(
      (v) => v.thermalMelted + v.chiselShattered >= 0.99
    ).length;
  }

  /**
   * Returns average electrical Thermal Coil de-icing progress (0.0 to 1.0) across all 5 valves.
   */
  public getThermalCoilProgress(): number {
    if (this.cryoVentValves.length === 0) return 0;
    const sum = this.cryoVentValves.reduce(
      (acc, v) => acc + Math.min(1, Math.max(0, v.thermalMelted)),
      0
    );
    return Number((sum / this.cryoVentValves.length).toFixed(3));
  }

  /**
   * Returns average manual Acoustic Chisel frost-chipping progress (0.0 to 1.0) across all 5 valves.
   */
  public getAcousticChiselProgress(): number {
    if (this.cryoVentValves.length === 0) return 0;
    const sum = this.cryoVentValves.reduce(
      (acc, v) => acc + Math.min(1, Math.max(0, v.chiselShattered)),
      0
    );
    return Number((sum / this.cryoVentValves.length).toFixed(3));
  }

  /**
   * Returns how many times the player was caught in the convective dust devil vortex while chipping frost.
   */
  public getVortexHitsCount(): number {
    return this.vortexHitsCount;
  }

  /**
   * Sets the Convective Dust Devil Vortex position on the outpost grid (used by physics loop and deterministic tests).
   */
  public setVortexPosition(x: number, y: number): void {
    this.vortexX = x;
    this.vortexY = y;
    this.emitTelemetry();
  }

  /**
   * Checks whether a given cryo-valve index (0..4) is currently inside the spinning Dust Devil Vortex hazard zone.
   */
  public isValveInVortex(valveIndex: number): boolean {
    const valve = this.cryoVentValves[valveIndex];
    if (!valve) return false;
    return Math.hypot(this.vortexX - valve.x, this.vortexY - valve.y) <= this.vortexRadius + 10;
  }

  /**
   * Activates the electrical Thermal Coil De-Icer across all 5 frozen cryo-valves,
   * driving the outcome toward Thermal Coil De-Icing (1.0: -11% PWR, -5% O2, -2% SHD, +25 SCI).
   */
  public fireThermalCoilPulse(amount = 0.35): void {
    if (this.completed || this.cryoVentValves.length === 0) return;
    this.thermalCoilActive = true;
    const clampedAmount = Math.max(0.05, Math.min(1, amount));

    for (const valve of this.cryoVentValves) {
      const remaining = Math.max(0, 1 - (valve.thermalMelted + valve.chiselShattered));
      const add = Math.min(remaining, clampedAmount);
      valve.thermalMelted = Number((valve.thermalMelted + add).toFixed(3));
      this.spawnSparks(valve.x, valve.y, '#f59e0b', 4);
    }

    this.pointerX = 124;
    this.pointerY = 118;
    this.recalculateRatio();
    const now = performance.now();
    if (now - this.lastSoundTimeMs > 85) {
      this.lastSoundTimeMs = now;
      soundFX.playThermalCoilDeIce(this.getThermalCoilProgress());
    }
    this.statusBannerText = `THERMAL COIL DE-ICING: ${Math.round(
      this.getThermalCoilProgress() * 100
    )}% (${this.getCryoValvesDeIcedCount()}/5 VALVES CLEAN)!`;
    this.statusBannerColor = '#f59e0b';
    this.emitTelemetry();

    if (this.getCryoValvesDeIcedCount() >= this.cryoVentValves.length) {
      this.finishMiniGame();
    }
  }

  /**
   * Taps a frozen cryo-valve with the manual Acoustic Chisel Cursor, driving the outcome toward
   * Manual Frost Chipping & Vent Sealing (0.0: -5% PWR, -9% O2, -8% SHD, +20 SCI).
   * Getting caught in the spinning convective dust devil vortex damages Shielding and O2.
   */
  public tapAcousticChisel(valveIndex?: number, amount = 1.0): boolean {
    if (this.completed || this.cryoVentValves.length === 0) return false;
    this.thermalCoilActive = false;

    let target: CryoVentValve | undefined;
    if (typeof valveIndex === 'number') {
      target = this.cryoVentValves[valveIndex];
    } else {
      // Pick the first frozen valve that is NOT currently inside the vortex (or the first incomplete valve)
      target =
        this.cryoVentValves.find(
          (v) =>
            v.thermalMelted + v.chiselShattered < 0.99 &&
            !this.isValveInVortex(v.id)
        ) ||
        this.cryoVentValves.find(
          (v) => v.thermalMelted + v.chiselShattered < 0.99
        );
    }
    if (!target) return false;

    this.pointerX = target.x;
    this.pointerY = target.y;

    const preset = this.getPreset();
    const inVortex = preset.enableHazards && this.isValveInVortex(target.id);
    if (inVortex) {
      this.vortexHitsCount++;
      this.overheatShieldPenalty = Math.min(6, this.overheatShieldPenalty + (preset.mistakePenalty === 'full' ? 2 : 1));
      this.spawnSparks(target.x, target.y, '#f43f5e', 14);
      this.triggerWrongTap(target.x, target.y);
      soundFX.playAcousticChiselTap(true);
      this.statusBannerText = 'Watch out for the spinning dust cloud!';
      this.statusBannerColor = '#f43f5e';
      this.emitTelemetry();
      return false;
    }

    const remaining = Math.max(0, 1 - (target.thermalMelted + target.chiselShattered));
    const add = Math.min(remaining, Math.max(0.1, amount));
    target.chiselShattered = Number((target.chiselShattered + add).toFixed(3));
    this.spawnSparks(target.x, target.y, '#38bdf8', 10);
    this.triggerEncouragement('Melted!', target.x, target.y - 24);
    this.recalculateRatio();
    soundFX.playAcousticChiselTap(false);
    this.statusBannerText = `Nice! ${this.getCryoValvesDeIcedCount()} of ${this.cryoVentValves.length} valves melted!`;
    this.statusBannerColor = '#38bdf8';
    this.emitTelemetry();

    if (this.getCryoValvesDeIcedCount() >= this.cryoVentValves.length) {
      this.finishMiniGame();
    }
    return true;
  }

  public getPerformanceRatio(): number {
    return this.performanceRatio;
  }

  public getCurrentDeltas(): MiniGameResourceDelta {
    return computeMiniGameEventDeltas(
      this.event,
      this.performanceRatio,
      this.difficulty,
      this.overheatShieldPenalty
    );
  }

  public getSnapshot(): MiniGameTelemetrySnapshot {
    const isWeld = this.descriptor.mechanicType === 'weld_seal';
    const isDipole = this.descriptor.mechanicType === 'dipole_align';
    const isWaterBladder = this.descriptor.mechanicType === 'water_bladder';
    const isUvSterilize = this.descriptor.mechanicType === 'uv_sterilize';
    const isQuietSun = this.descriptor.mechanicType === 'core_spectrometer';
    const isDustBrush = this.descriptor.mechanicType === 'dust_brush';
    const isWhipple = this.descriptor.mechanicType === 'whipple_intercept';
    const isThermalConduit = this.descriptor.mechanicType === 'thermal_conduit';
    const isFilterPurge = this.descriptor.mechanicType === 'filter_purge';
    const isFrostMelt = this.descriptor.mechanicType === 'frost_melt';
    const safeZone = this.isValveInSafeZone();
    const basePsi = safeZone
      ? 34
      : Math.round(115 - (this.valveRotationDeg / 180) * 81);
    const fullySealedFractures = isWeld
      ? this.fractures.filter((f) => f.segments.every((s) => s.sealed >= 1)).length
      : 0;

    let normDeg = Math.round((this.shieldAngleRad * 180) / Math.PI) % 360;
    if (normDeg < 0) normDeg += 360;

    return {
      eventCode: this.eventCode,
      eventTitle: this.event.title,
      taskTitle: this.descriptor.taskTitle,
      taskInstruction: this.descriptor.taskInstruction,
      timeRemainingSec: Math.max(0, this.totalDurationSec - this.elapsedSec),
      totalDurationSec: this.totalDurationSec,
      performanceRatio: this.performanceRatio,
      deltas: this.getCurrentDeltas(),
      isCompleted: this.completed,
      valveRotationDeg: isWeld ? Math.round(this.valveRotationDeg) : undefined,
      inSafeWeldingZone: isWeld ? safeZone : undefined,
      pressurePsi: isWeld ? basePsi : undefined,
      fracturesSealedCount: isWeld ? fullySealedFractures : undefined,
      totalFracturesCount: isWeld ? this.fractures.length : undefined,
      overheatShieldPenalty:
        isWeld || isDipole || isFrostMelt ? this.overheatShieldPenalty : undefined,
      statusBannerText:
        isWeld ||
        isDipole ||
        isWaterBladder ||
        isUvSterilize ||
        isQuietSun ||
        isDustBrush ||
        isWhipple ||
        isThermalConduit ||
        isFilterPurge ||
        isFrostMelt
          ? this.statusBannerText
          : undefined,
      shieldAngleDeg: isDipole ? normDeg : undefined,
      solarArraysFeathered: isDipole ? this.solarArraysFeathered : undefined,
      protonsDeflected: isDipole ? this.protonsDeflected : undefined,
      protonsTotal: isDipole ? this.protonWaves.length : undefined,
      protonsHitHull: isDipole ? this.protonsHitHull : undefined,
      bladdersFilledCount: isWaterBladder ? this.getBladdersFilledCount() : undefined,
      totalBladdersCount: isWaterBladder ? this.waterBladders.length : undefined,
      potablePumpPct: isWaterBladder ? Math.round(this.potablePumpSlider * 100) : undefined,
      hydroponicPumpPct: isWaterBladder
        ? Math.round(this.hydroponicPumpSlider * 100)
        : undefined,
      openJunctionsCount: isWaterBladder
        ? this.waterBladders.filter((b) => b.junctionAligned).length
        : undefined,
      waveformMatchPct: isUvSterilize
        ? Math.round(this.getWaveformMatchRatio() * 100)
        : undefined,
      sporesSterilizedCount: isUvSterilize ? this.getSporesSterilizedCount() : undefined,
      totalSporesCount: isUvSterilize ? this.fungalSpores.length : undefined,
      dehumidifierFreqPct: isUvSterilize
        ? Math.round(this.dehumidifierFreqSlider * 100)
        : undefined,
      uvPhaseSliderPct: isUvSterilize
        ? Math.round(this.uvPhaseSlider * 100)
        : undefined,
      scienceTrackPct: isQuietSun ? Math.round(this.scienceTrackProgress * 100) : undefined,
      maintenanceTrackPct: isQuietSun
        ? Math.round(this.maintenanceTrackProgress * 100)
        : undefined,
      drillHeatPct: isQuietSun ? Math.round(this.drillBitHeat * 100) : undefined,
      greywaterMembraneInstalled: isQuietSun
        ? this.greywaterMembraneInstalled
        : undefined,
      hullPitsSealedCount: isQuietSun ? this.getHullPitsSealedCount() : undefined,
      totalHullPitsCount: isQuietSun ? this.hullMicroPits.length : undefined,
      dustClearedCount: isDustBrush ? this.getDustClearedCount() : undefined,
      totalDustCount: isDustBrush ? this.regolithClusters.length : undefined,
      capacitorChargePct: isDustBrush ? this.getCapacitorChargePct() : undefined,
      capacitorInGreenPeak: isDustBrush ? this.isCapacitorInGreenPeak() : undefined,
      repellerPulsesFired: isDustBrush ? this.repellerPulsesFired : undefined,
      arcShockCount: isDustBrush ? this.arcShockCount : undefined,
      activeShuttersCount: isWhipple ? this.activeShutterQueue.length : undefined,
      maxActiveShutters: isWhipple ? this.maxActiveShutters : undefined,
      activeShutterLabels: isWhipple
        ? this.activeShutterQueue.map((id) => `S${id + 1}`)
        : undefined,
      meteorsBlocked: isWhipple ? this.meteorsBlocked : undefined,
      meteorsTotal: isWhipple ? this.meteorTrajectories.length : undefined,
      meteorsHitHull: isWhipple ? this.meteorsHitHull : undefined,
      o2HeaterSliderPct: isThermalConduit
        ? Math.round(this.o2PipeHeaterSlider * 100)
        : undefined,
      batteryHeaterSliderPct: isThermalConduit
        ? Math.round(this.batteryBankHeaterSlider * 100)
        : undefined,
      heaterStrategyPct: isThermalConduit
        ? Math.round(this.getHeaterStrategyProgress() * 100)
        : undefined,
      regolithBermsPackedCount: isThermalConduit
        ? this.getRegolithBermsPackedCount()
        : undefined,
      totalRegolithBerms: isThermalConduit
        ? this.regolithBermWalls.length
        : undefined,
      regolithStrategyPct: isThermalConduit
        ? Math.round(this.getRegolithBermProgress() * 100)
        : undefined,
      externalTempC: isThermalConduit
        ? Math.round(this.externalShadowTempC)
        : undefined,
      moxieFiltersPurgedCount: isFilterPurge
        ? this.getMoxieFiltersPurgedCount()
        : undefined,
      totalMoxieFilters: isFilterPurge ? this.moxieFilterCells.length : undefined,
      windSpeedKmh: isFilterPurge ? this.getWindSpeedKmh() : undefined,
      inWindTrough: isFilterPurge ? this.isWindInTrough() : undefined,
      wastedGustBlasts: isFilterPurge ? this.wastedGustBlasts : undefined,
      breakersTrippedCount: isFilterPurge
        ? this.getBreakersTrippedCount()
        : undefined,
      totalBreakersCount: isFilterPurge
        ? this.loadShedBreakers.length
        : undefined,
      reserveO2Active: isFilterPurge
        ? Boolean(this.loadShedBreakers[2]?.tripped)
        : undefined,
      cryoValvesDeIcedCount: isFrostMelt
        ? this.getCryoValvesDeIcedCount()
        : undefined,
      totalCryoValves: isFrostMelt ? this.cryoVentValves.length : undefined,
      thermalCoilPct: isFrostMelt
        ? Math.round(this.getThermalCoilProgress() * 100)
        : undefined,
      chiselChippingPct: isFrostMelt
        ? Math.round(this.getAcousticChiselProgress() * 100)
        : undefined,
      vortexHitsCount: isFrostMelt ? this.vortexHitsCount : undefined,
    };
  }

  /**
   * Programmatically advances the active mini-game mechanic
   * when pressing [Space] or clicking the accessible Pulse action button.
   */
  public applyInteractionImpulse(amount = 0.25): void {
    if (this.completed) return;

    if (this.descriptor.mechanicType === 'weld_seal') {
      if (!this.isValveInSafeZone()) {
        this.valveRotationDeg = Math.min(180, this.valveRotationDeg + 90);
        this.pointerX = this.valveCenterX;
        this.pointerY = this.valveCenterY;
        soundFX.playValveTurn(this.valveRotationDeg / 180);
        this.spawnSparks(this.valveCenterX, this.valveCenterY, '#34d399', 8);

        if (this.isValveInSafeZone()) {
          this.statusBannerText =
            'SAFE WELDING ZONE LOCKED! DRAG PLASMA TORCH ALONG ALL 3 FRACTURES';
          this.statusBannerColor = '#34d399';
        } else {
          this.statusBannerText = `ROTATING SHUTOFF VALVE: ${Math.round(
            this.valveRotationDeg
          )}° / 180°`;
          this.statusBannerColor = '#facc15';
        }
        this.emitTelemetry();
        return;
      }

      const nextFracture = this.fractures.find((f) =>
        f.segments.some((s) => s.sealed < 1)
      );
      if (nextFracture) {
        for (const seg of nextFracture.segments) {
          seg.sealed = 1;
        }
        const lastSeg = nextFracture.segments[nextFracture.segments.length - 1];
        this.pointerX = lastSeg.mx;
        this.pointerY = lastSeg.my;
        this.spawnSparks(
          nextFracture.centerX,
          nextFracture.centerY,
          '#f59e0b',
          14
        );
        this.statusBannerText = `SEALED ${nextFracture.label} — OPTIMAL TORCH SPEED!`;
        this.statusBannerColor = '#38bdf8';
      }

      this.recalculateRatio();
      soundFX.playMiniGameAction(this.eventCode, this.performanceRatio);
      this.emitTelemetry();

      if (this.performanceRatio >= 1) {
        this.finishMiniGame();
      }
      return;
    }

    if (this.descriptor.mechanicType === 'dipole_align') {
      // Feather solar arrays for wave protection and snap 90-deg shield arc to next incoming proton wave
      if (!this.solarArraysFeathered) {
        this.solarArraysFeathered = true;
        soundFX.playArrayGimbalToggle(true);
      }
      const nextWave = this.protonWaves.find((w) => w.state === 'incoming');
      if (nextWave) {
        this.shieldAngleRad = nextWave.vectorAngleRad;
        nextWave.state = 'deflected';
        this.protonsDeflected++;
        const wx =
          this.radarCenterX + Math.cos(nextWave.vectorAngleRad) * this.shieldArcRadius;
        const wy =
          this.radarCenterY + Math.sin(nextWave.vectorAngleRad) * this.shieldArcRadius;
        this.pointerX = wx;
        this.pointerY = wy;
        this.spawnSparks(wx, wy, '#c084fc', 14);
        this.statusBannerText = `PHASE-LOCK DEFLECTED WAVE #${
          nextWave.id + 1
        } (${this.protonsDeflected}/${this.protonWaves.length} BLOCKED)!`;
        this.statusBannerColor = '#34d399';
      }

      this.recalculateRatio();
      soundFX.playProtonDeflect(this.performanceRatio);
      this.emitTelemetry();

      if (this.protonWaves.every((w) => w.state !== 'incoming')) {
        this.finishMiniGame();
      }
      return;
    }

    if (this.descriptor.mechanicType === 'water_bladder') {
      // Align next Pipe Junction Valve, boost tank pump sliders, and fill next overhead GCR bladder
      const nextBladder = this.waterBladders.find((b) => b.fillLevel < 1);
      if (nextBladder) {
        nextBladder.junctionAligned = true;
        nextBladder.fillLevel = 1;
        if (nextBladder.id < 2) {
          this.potablePumpSlider = Math.min(1, Math.max(0.85, this.potablePumpSlider + 0.25));
        } else {
          this.hydroponicPumpSlider = Math.min(
            1,
            Math.max(0.85, this.hydroponicPumpSlider + 0.25)
          );
        }
        this.pointerX = nextBladder.x;
        this.pointerY = nextBladder.y;
        this.spawnSparks(nextBladder.x, nextBladder.y, '#38bdf8', 14);
        this.statusBannerText = `JUNCTION J${nextBladder.id + 1} OPEN — ${
          nextBladder.label
        } 100% FILLED (GCR ABSORBED)!`;
        this.statusBannerColor = '#34d399';
      }

      this.recalculateRatio();
      soundFX.playHydraulicPumpFlow(this.performanceRatio);
      soundFX.playGcrDosimeterClick(true);
      this.emitTelemetry();

      if (this.performanceRatio >= 1) {
        this.finishMiniGame();
      }
      return;
    }

    if (this.descriptor.mechanicType === 'uv_sterilize') {
      // Advance the 2 frequency sliders toward 0.75 & 0.80 lock and UV-sterilize next drifting fungal spore
      this.dehumidifierFreqSlider = Math.min(
        this.targetDehumidifierFreq,
        this.dehumidifierFreqSlider + 0.25
      );
      this.uvPhaseSlider = Math.min(
        this.targetUvPhase,
        this.uvPhaseSlider + 0.25
      );

      const nextSpore = this.fungalSpores.find((s) => s.sterilized < 1);
      if (nextSpore) {
        nextSpore.sterilized = 1;
        this.pointerX = nextSpore.x;
        this.pointerY = nextSpore.y;
        this.uvBeamTargetX = nextSpore.x;
        this.uvBeamTargetY = nextSpore.y;
        this.uvBeamTimer = 0.35;
        this.spawnSparks(nextSpore.x, nextSpore.y, '#c084fc', 14);
        this.statusBannerText = `UV-C BEAM STERILIZED SPORE #${
          nextSpore.id + 1
        } (${this.getSporesSterilizedCount()}/${this.fungalSpores.length}) · WAVE: ${Math.round(
          this.getWaveformMatchRatio() * 100
        )}%`;
        this.statusBannerColor = '#34d399';
      }

      this.recalculateRatio();
      soundFX.playUvSporeZap(this.performanceRatio);
      this.emitTelemetry();

      if (this.performanceRatio >= 1) {
        this.finishMiniGame();
      }
      return;
    }

    if (this.descriptor.mechanicType === 'core_spectrometer') {
      this.boostScienceConsole(amount);
      return;
    }

    if (this.descriptor.mechanicType === 'dust_brush') {
      this.capacitorCharge = 0.85; // Lock into Green Peak Zone when using timed pulse action
      this.fireCapacitorRepellerPulse();
      return;
    }

    if (this.descriptor.mechanicType === 'whipple_intercept') {
      const nextMeteor = this.meteorTrajectories.find((m) => m.state === 'incoming');
      if (nextMeteor) {
        this.energizeWhippleShutter(nextMeteor.sectorId, true);
      }
      return;
    }

    if (this.descriptor.mechanicType === 'thermal_conduit') {
      this.boostThermalHeaters(amount);
      return;
    }

    if (this.descriptor.mechanicType === 'filter_purge') {
      this.windSpeedKmh = 32; // Lock into Green Wind Trough when using timed Compressor Back-Purge action
      this.fireCompressorBackPurgeBlast();
      return;
    }

    if (this.descriptor.mechanicType === 'frost_melt') {
      this.fireThermalCoilPulse(amount);
      return;
    }

    const incompleteNode = this.nodes.find((n) => n.progress < 1);
    if (incompleteNode) {
      this.pointerX = incompleteNode.x;
      this.pointerY = incompleteNode.y;
      incompleteNode.progress = Math.min(1, incompleteNode.progress + amount * 3);
      this.spawnSparks(
        incompleteNode.x,
        incompleteNode.y,
        this.descriptor.secondaryColor,
        10
      );
    }
    this.recalculateRatio();
    soundFX.playMiniGameAction(this.eventCode, this.performanceRatio);
    this.emitTelemetry();

    if (this.performanceRatio >= 1) {
      this.finishMiniGame();
    }
  }

  public forceCompleteWithRatio(ratio: number): MiniGameCompletionPayload {
    this.performanceRatio = Math.max(0, Math.min(1, ratio));
    if (this.descriptor.mechanicType === 'weld_seal') {
      for (const f of this.fractures) {
        for (const s of f.segments) {
          s.sealed = this.performanceRatio;
        }
      }
    } else if (this.descriptor.mechanicType === 'dipole_align') {
      const targetDeflected = Math.round(this.protonWaves.length * this.performanceRatio);
      this.protonsDeflected = targetDeflected;
      this.protonWaves.forEach((w, idx) => {
        w.state = idx < targetDeflected ? 'deflected' : 'hit_hull';
      });
    } else if (this.descriptor.mechanicType === 'water_bladder') {
      this.waterBladders.forEach((b) => {
        b.junctionAligned = this.performanceRatio > 0;
        b.fillLevel = this.performanceRatio;
      });
    } else if (this.descriptor.mechanicType === 'uv_sterilize') {
      this.dehumidifierFreqSlider =
        0.25 + (this.targetDehumidifierFreq - 0.25) * this.performanceRatio;
      this.uvPhaseSlider =
        0.3 + (this.targetUvPhase - 0.3) * this.performanceRatio;
      this.fungalSpores.forEach((s) => {
        s.sterilized = this.performanceRatio;
      });
    } else if (this.descriptor.mechanicType === 'core_spectrometer') {
      this.scienceTrackProgress = this.performanceRatio;
      this.maintenanceTrackProgress = Number((1 - this.performanceRatio).toFixed(3));
    } else if (this.descriptor.mechanicType === 'dust_brush') {
      this.regolithClusters.forEach((c) => {
        c.cleared = 1;
        c.clearedByRepeller = this.performanceRatio >= 0.5;
      });
    } else if (this.descriptor.mechanicType === 'whipple_intercept') {
      const targetBlocked = Math.round(this.meteorTrajectories.length * this.performanceRatio);
      this.meteorsBlocked = targetBlocked;
      this.meteorsHitHull = this.meteorTrajectories.length - targetBlocked;
      this.meteorTrajectories.forEach((m, idx) => {
        m.state = idx < targetBlocked ? 'blocked' : 'hit_hull';
      });
    } else if (this.descriptor.mechanicType === 'thermal_conduit') {
      this.o2PipeHeaterSlider = this.performanceRatio;
      this.batteryBankHeaterSlider = this.performanceRatio;
      const bermRatio = Number((1 - this.performanceRatio).toFixed(3));
      this.regolithBermWalls.forEach((w) => {
        w.packed = bermRatio;
      });
    } else if (this.descriptor.mechanicType === 'filter_purge') {
      this.moxieFilterCells.forEach((c) => {
        c.purged = this.performanceRatio;
      });
      this.loadShedBreakers.forEach((b) => {
        b.tripped = this.performanceRatio < 0.5;
      });
    } else if (this.descriptor.mechanicType === 'frost_melt') {
      const chRatio = Number((1 - this.performanceRatio).toFixed(3));
      this.cryoVentValves.forEach((v) => {
        v.thermalMelted = this.performanceRatio;
        v.chiselShattered = chRatio;
      });
    } else {
      this.nodes.forEach((n) => {
        n.progress = this.performanceRatio;
      });
    }
    return this.finishMiniGame();
  }

  private finishMiniGame(): MiniGameCompletionPayload {
    if (this.completed) {
      return {
        eventCode: this.eventCode,
        performanceRatio: this.performanceRatio,
        deltas: this.getCurrentDeltas(),
      };
    }
    this.completed = true;
    this.spawnConfetti(320, 150, 28);
    soundFX.playMiniGameResult(this.performanceRatio);
    this.emitTelemetry();

    const payload: MiniGameCompletionPayload = {
      eventCode: this.eventCode,
      performanceRatio: this.performanceRatio,
      deltas: this.getCurrentDeltas(),
    };
    if (this.onComplete) {
      this.onComplete(payload);
    }
    return payload;
  }

  private recalculateRatio(): void {
    if (this.descriptor.mechanicType === 'weld_seal') {
      let totalSegs = 0;
      let sealedSum = 0;
      for (const f of this.fractures) {
        for (const s of f.segments) {
          totalSegs++;
          sealedSum += Math.min(1, Math.max(0, s.sealed));
        }
      }
      this.performanceRatio =
        totalSegs > 0
          ? Math.max(0, Math.min(1, Number((sealedSum / totalSegs).toFixed(3))))
          : 0;
      return;
    }

    if (this.descriptor.mechanicType === 'dipole_align') {
      const total = this.protonWaves.length;
      this.performanceRatio =
        total > 0
          ? Math.max(0, Math.min(1, Number((this.protonsDeflected / total).toFixed(3))))
          : 0;
      return;
    }

    if (this.descriptor.mechanicType === 'water_bladder') {
      const total = this.waterBladders.length;
      const sum = this.waterBladders.reduce(
        (acc, b) => acc + Math.min(1, Math.max(0, b.fillLevel)),
        0
      );
      this.performanceRatio =
        total > 0 ? Math.max(0, Math.min(1, Number((sum / total).toFixed(3)))) : 0;
      return;
    }

    if (this.descriptor.mechanicType === 'uv_sterilize') {
      const waveMatch = this.getWaveformMatchRatio();
      const totalSpores = this.fungalSpores.length;
      const sporeSum =
        totalSpores > 0
          ? this.fungalSpores.reduce(
              (acc, s) => acc + Math.min(1, Math.max(0, s.sterilized)),
              0
            ) / totalSpores
          : 0;
      this.performanceRatio = Math.max(
        0,
        Math.min(1, Number((waveMatch * 0.5 + sporeSum * 0.5).toFixed(3)))
      );
      return;
    }

    if (this.descriptor.mechanicType === 'core_spectrometer') {
      const totalCombined = this.scienceTrackProgress + this.maintenanceTrackProgress;
      if (totalCombined <= 0) {
        this.performanceRatio = 0.5;
      } else {
        this.performanceRatio = Math.max(
          0,
          Math.min(1, Number((this.scienceTrackProgress / totalCombined).toFixed(3)))
        );
      }
      return;
    }

    if (this.descriptor.mechanicType === 'dust_brush') {
      const total = this.regolithClusters.length;
      if (total === 0) {
        this.performanceRatio = 0;
        return;
      }
      const clearedSum = this.regolithClusters.reduce(
        (acc, c) => acc + Math.min(1, Math.max(0, c.cleared)),
        0
      );
      const baseClearedRatio = clearedSum / total;
      // Each electrostatic arc shock from manual brushing over active lightning nodes penalizes the ratio toward 0.0 (Manual Brush Under Arcing Conditions)
      const shockPenalty = this.arcShockCount * (1 / 3);
      this.performanceRatio = Math.max(
        0,
        Math.min(1, Number((baseClearedRatio - shockPenalty).toFixed(3)))
      );
      return;
    }

    if (this.descriptor.mechanicType === 'whipple_intercept') {
      const total = this.meteorTrajectories.length;
      this.performanceRatio =
        total > 0
          ? Math.max(0, Math.min(1, Number((this.meteorsBlocked / total).toFixed(3))))
          : 0;
      return;
    }

    if (this.descriptor.mechanicType === 'thermal_conduit') {
      const heaterProg = this.getHeaterStrategyProgress();
      const bermProg = this.getRegolithBermProgress();
      const totalCombined = heaterProg + bermProg;
      if (totalCombined <= 0) {
        this.performanceRatio = 0.5;
      } else {
        this.performanceRatio = Math.max(
          0,
          Math.min(1, Number((heaterProg / totalCombined).toFixed(3)))
        );
      }
      return;
    }

    if (this.descriptor.mechanicType === 'filter_purge') {
      const rawPurge = this.getMoxieFilterPurgeProgress();
      const gustPenalty = this.wastedGustBlasts * 0.18;
      const effectivePurge = Math.max(0, rawPurge - gustPenalty);
      const shedProg = this.getLoadShedBreakerProgress();

      if (effectivePurge <= 0 && shedProg <= 0) {
        this.performanceRatio = 0;
      } else if (shedProg <= 0) {
        this.performanceRatio = Math.max(
          0,
          Math.min(1, Number(effectivePurge.toFixed(3)))
        );
      } else {
        this.performanceRatio = Math.max(
          0,
          Math.min(
            1,
            Number((effectivePurge / (effectivePurge + shedProg)).toFixed(3))
          )
        );
      }
      return;
    }

    if (this.descriptor.mechanicType === 'frost_melt') {
      const thermalProg = this.getThermalCoilProgress();
      const chiselProg = this.getAcousticChiselProgress();
      const totalCombined = thermalProg + chiselProg;
      if (totalCombined <= 0) {
        this.performanceRatio = 0.5;
      } else {
        this.performanceRatio = Math.max(
          0,
          Math.min(1, Number((thermalProg / totalCombined).toFixed(3)))
        );
      }
      return;
    }

    if (this.nodes.length === 0) {
      this.performanceRatio = 0;
      return;
    }
    const sum = this.nodes.reduce(
      (acc, n) => acc + Math.min(1, Math.max(0, n.progress)),
      0
    );
    this.performanceRatio = Math.max(
      0,
      Math.min(1, Number((sum / this.nodes.length).toFixed(3)))
    );
  }

  private emitTelemetry(): void {
    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate(this.getSnapshot());
    }
  }

  private mapClientToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    if (!this.canvas) return { x: 320, y: 180 };
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 320, y: 180 };
    const x = ((clientX - rect.left) / rect.width) * this.canvas.width;
    const y = ((clientY - rect.top) / rect.height) * this.canvas.height;
    return {
      x: Math.max(0, Math.min(this.canvas.width, x)),
      y: Math.max(0, Math.min(this.canvas.height, y)),
    };
  }

  private checkDipoleWaveInterceptions(): void {
    const preset = this.getPreset();
    const catchAng = preset.enableSecondaryAction ? Math.PI / 4 : Math.PI / 3;
    let anyDeflected = false;
    for (const wave of this.protonWaves) {
      if (wave.state !== 'incoming' || this.elapsedSec < wave.spawnDelaySec) continue;
      const angDiff = normalizeAngleDiff(this.shieldAngleRad, wave.vectorAngleRad);
      if (angDiff <= catchAng && wave.distanceFromCore <= this.shieldArcRadius + 28) {
        wave.state = 'deflected';
        this.protonsDeflected++;
        anyDeflected = true;
        const wx =
          this.radarCenterX + Math.cos(wave.vectorAngleRad) * this.shieldArcRadius;
        const wy =
          this.radarCenterY + Math.sin(wave.vectorAngleRad) * this.shieldArcRadius;
        this.spawnSparks(wx, wy, '#c084fc', 14);
        this.triggerEncouragement('Blocked!', wx, wy - 16);
        this.statusBannerText = `Great block! ${this.protonsDeflected} of ${this.protonWaves.length} stopped!`;
        this.statusBannerColor = '#34d399';
      }
    }

    if (anyDeflected) {
      this.recalculateRatio();
      soundFX.playProtonDeflect(this.performanceRatio);
      this.emitTelemetry();
      if (this.protonWaves.every((w) => w.state !== 'incoming')) {
        this.finishMiniGame();
      }
    }
  }

  private handleDipoleAlignPointer(x: number, y: number, isDownEvent: boolean): void {
    const preset = this.getPreset();
    // 1. Check if player clicked/tapped on the Left or Right Solar Array Wings (Normal/Hard only)
    if (preset.enableSecondaryAction) {
      const onLeftWing = x >= 24 && x <= 165 && Math.abs(y - this.radarCenterY) <= 58;
      const onRightWing = x >= 475 && x <= 616 && Math.abs(y - this.radarCenterY) <= 58;

      if (isDownEvent && (onLeftWing || onRightWing)) {
        this.toggleSolarArrayGimbal();
        this.spawnSparks(x, y, '#38bdf8', 10);
        return;
      }
    }

    // 2. Rotate the Shield Arc to match pointer angle around radar core
    const distFromRadar = Math.hypot(x - this.radarCenterX, y - this.radarCenterY);
    if (distFromRadar >= 14) {
      this.shieldAngleRad = Math.atan2(y - this.radarCenterY, x - this.radarCenterX);
      this.checkDipoleWaveInterceptions();
      this.emitTelemetry();
    }
  }

  private handleWeldSealPointer(x: number, y: number, isDownEvent: boolean): void {
    const preset = this.getPreset();

    if (preset.enableSecondaryAction) {
      const distToValve = Math.hypot(x - this.valveCenterX, y - this.valveCenterY);
      if (distToValve <= this.valveRadius + 28 && !this.isValveInSafeZone()) {
        const currentAngle = Math.atan2(y - this.valveCenterY, x - this.valveCenterX);
        if (isDownEvent) {
          this.valveRotationDeg = Math.min(180, this.valveRotationDeg + 60);
          this.lastValvePointerAngle = currentAngle;
        } else if (this.lastValvePointerAngle !== null) {
          let deltaRad = currentAngle - this.lastValvePointerAngle;
          if (deltaRad > Math.PI) deltaRad -= Math.PI * 2;
          if (deltaRad < -Math.PI) deltaRad += Math.PI * 2;
          const deltaDeg = Math.max(8, Math.abs((deltaRad * 180) / Math.PI) * 1.6);
          this.valveRotationDeg = Math.min(180, this.valveRotationDeg + deltaDeg);
          this.lastValvePointerAngle = currentAngle;
        } else {
          this.lastValvePointerAngle = currentAngle;
        }

        const now = performance.now();
        if (now - this.lastSoundTimeMs > 90) {
          this.lastSoundTimeMs = now;
          soundFX.playValveTurn(this.valveRotationDeg / 180);
        }

        if (this.isValveInSafeZone()) {
          this.valveRotationDeg = 180;
          this.triggerEncouragement('Safe!', this.valveCenterX, this.valveCenterY - 40);
          this.statusBannerText = 'Green! Now tap or trace the 3 pipe cracks!';
          this.statusBannerColor = '#34d399';
          this.spawnSparks(this.valveCenterX, this.valveCenterY, '#34d399', 12);
        } else {
          this.statusBannerText = 'Keep turning the wheel to green!';
          this.statusBannerColor = '#facc15';
        }
        this.emitTelemetry();
        return;
      }

      if (!this.isValveInSafeZone()) {
        const nearAnyFracture = this.fractures.some(
          (f) => Math.hypot(x - f.centerX, y - f.centerY) < 52
        );
        if (nearAnyFracture && isDownEvent) {
          this.triggerWrongTap(x, y);
          this.statusBannerText = 'Turn the wheel to green first!';
          this.statusBannerColor = '#f43f5e';
          this.spawnSparks(x, y, '#38bdf8', 5);
          this.emitTelemetry();
        }
        return;
      }
    }

    // Easy mode: 1 tap or swipe seals an entire fracture cleanly!
    if (!preset.enableSecondaryAction) {
      if (!isDownEvent && !this.isPointerDown) return;
      for (const fracture of this.fractures) {
        if (fracture.segments.every((s) => s.sealed >= 1)) continue;
        const distCenter = Math.hypot(x - fracture.centerX, y - fracture.centerY);
        if (distCenter <= preset.targetRadius + 14) {
          for (const seg of fracture.segments) {
            seg.sealed = 1;
          }
          this.spawnSparks(fracture.centerX, fracture.centerY, '#facc15', 14);
          this.triggerEncouragement('Fixed!', fracture.centerX, fracture.centerY - 30);
          this.recalculateRatio();
          soundFX.playMiniGameAction(this.eventCode, this.performanceRatio);
          this.statusBannerText = 'Great! Tap the next glowing crack!';
          this.statusBannerColor = '#34d399';
          this.emitTelemetry();
          if (this.performanceRatio >= 1) {
            this.finishMiniGame();
          }
          return;
        }
      }
      if (isDownEvent) {
        this.triggerWrongTap(x, y);
      }
      return;
    }

    const isTooFast = preset.enableHazards && this.pointerSpeedPxPerSec > 480;
    let sealedAny = false;

    for (const fracture of this.fractures) {
      const wasDone = fracture.segments.every((s) => s.sealed >= 1);
      for (let idx = 0; idx < fracture.segments.length; idx++) {
        const seg = fracture.segments[idx];
        const dist = Math.hypot(x - seg.mx, y - seg.my);
        if (dist <= 30 && seg.sealed < 1) {
          if (isTooFast && idx % 2 === 1) {
            this.statusBannerText = 'Go steady over the glowing crack!';
            this.statusBannerColor = '#facc15';
            continue;
          }
          seg.sealed = Math.min(1, seg.sealed + (isTooFast ? 0.45 : 0.85));
          sealedAny = true;
          this.spawnSparks(seg.mx, seg.my, '#f59e0b', 5);
        }
      }
      if (!wasDone && fracture.segments.every((s) => s.sealed >= 1)) {
        this.triggerEncouragement('Sealed!', fracture.centerX, fracture.centerY - 28);
      }
    }

    if (sealedAny) {
      this.hullHeat = Math.max(0, this.hullHeat - 0.15);
      if (!isTooFast) {
        this.statusBannerText = 'Awesome welding! Seal all cracks!';
        this.statusBannerColor = '#38bdf8';
      }
      this.recalculateRatio();
      const now = performance.now();
      if (now - this.lastSoundTimeMs > 85) {
        this.lastSoundTimeMs = now;
        soundFX.playMiniGameAction(this.eventCode, this.performanceRatio);
      }
      this.emitTelemetry();
      if (this.performanceRatio >= 1) {
        this.finishMiniGame();
      }
    }
  }

  private handleQuietSunDualConsolePointer(
    x: number,
    y: number,
    isDownEvent: boolean
  ): void {
    const preset = this.getPreset();

    // Easy mode: simplified 1-step taps on bright glowing targets across the screen (no drill heat!)
    if (!preset.enableSecondaryAction) {
      if (!isDownEvent) return;
      if (x < 320) {
        this.scienceTrackProgress = Math.min(
          1,
          Number((this.scienceTrackProgress + 0.34).toFixed(3))
        );
        this.spawnSparks(160, 160, '#38bdf8', 12);
        this.triggerEncouragement('Science!', 160, 120);
        this.recalculateRatio();
        soundFX.playCoreDrillThrottle(this.scienceTrackProgress, 0.2);
        this.statusBannerText = 'Awesome science! Tap either side!';
        this.statusBannerColor = '#38bdf8';
        this.emitTelemetry();
      } else {
        this.boostMaintenanceConsole(0.34);
        this.triggerEncouragement('Repaired!', 480, 120);
        this.statusBannerText = 'Nice repair! Tap either side!';
        this.statusBannerColor = '#34d399';
      }
      return;
    }

    // 1. LEFT CONSOLE (x < 320): Core Drill & Spectrometer
    if (x < 320) {
      this.drillThrottleActive = this.isPointerDown || isDownEvent;
      if (isDownEvent || this.isPointerDown) {
        if (preset.enableHazards && this.drillBitHeat >= 0.88) {
          this.drillOverheated = true;
          this.triggerWrongTap(160, 150);
          this.statusBannerText = 'Too hot! Let go a moment to cool!';
          this.statusBannerColor = '#f43f5e';
          soundFX.playHullOverheat();
          this.emitTelemetry();
          return;
        }
        const deltaSci = isDownEvent ? 0.24 : 0.04;
        this.scienceTrackProgress = Math.min(
          1,
          Number((this.scienceTrackProgress + deltaSci).toFixed(3))
        );
        if (preset.enableHazards) {
          this.drillBitHeat = Math.min(0.92, this.drillBitHeat + (isDownEvent ? 0.12 : 0.025));
        }
        this.spawnSparks(106, 174, '#38bdf8', isDownEvent ? 8 : 2);
        if (isDownEvent) this.triggerEncouragement('Digging!', 160, 118);
        this.recalculateRatio();
        const now = performance.now();
        if (now - this.lastSoundTimeMs > 90) {
          this.lastSoundTimeMs = now;
          soundFX.playCoreDrillThrottle(this.scienceTrackProgress, this.drillBitHeat);
        }
        this.statusBannerText = 'Great digging! Keep going!';
        this.statusBannerColor = '#38bdf8';
        this.emitTelemetry();
      }
      return;
    }

    // 2. RIGHT CONSOLE (x >= 320): Filter Pad & 3 Hull Dots
    this.drillThrottleActive = false;

    if (y >= 48 && y <= 158 && (isDownEvent || this.isPointerDown)) {
      if (!this.greywaterMembraneInstalled) {
        this.membraneDragX = Math.max(368, Math.min(this.recyclerSlotX, x));
        this.membraneDragY = 114;
        if (Math.abs(x - this.recyclerSlotX) <= 60 || isDownEvent) {
          this.greywaterMembraneInstalled = true;
          this.membraneDragX = this.recyclerSlotX;
          this.membraneDragY = this.recyclerSlotY;
          this.maintenanceTrackProgress = Math.min(
            1,
            Number((this.maintenanceTrackProgress + 0.4).toFixed(3))
          );
          this.spawnSparks(this.recyclerSlotX, this.recyclerSlotY, '#34d399', 12);
          this.triggerEncouragement('Fitted!', this.recyclerSlotX, this.recyclerSlotY - 22);
          this.recalculateRatio();
          soundFX.playMaintenancePatch(this.maintenanceTrackProgress);
          this.statusBannerText = 'Filter in! Now tap the 3 green dots below!';
          this.statusBannerColor = '#34d399';
          this.emitTelemetry();
        }
      }
      return;
    }

    for (const pit of this.hullMicroPits) {
      const dist = Math.hypot(x - pit.x, y - pit.y);
      if (dist <= 36 && !pit.sealed) {
        pit.sealed = true;
        this.maintenanceTrackProgress = Math.min(
          1,
          Number((this.maintenanceTrackProgress + 0.2).toFixed(3))
        );
        this.spawnSparks(pit.x, pit.y, '#34d399', 10);
        this.triggerEncouragement('Patched!', pit.x, pit.y - 22);
        this.recalculateRatio();
        soundFX.playMaintenancePatch(this.maintenanceTrackProgress);
        this.statusBannerText = 'Awesome repair!';
        this.statusBannerColor = '#34d399';
        this.emitTelemetry();
        return;
      }
    }
  }

  private handleDustBrushPointer(
    x: number,
    y: number,
    isDownEvent: boolean
  ): void {
    const preset = this.getPreset();

    // Normal/Hard: Right Panel (x >= 462) triggers Zap Pulse
    if (preset.enableSecondaryAction && x >= 462 && isDownEvent) {
      this.fireCapacitorRepellerPulse();
      return;
    }

    // Tap/Swipe dusty solar panels
    for (const cluster of this.regolithClusters) {
      const dist = Math.hypot(x - cluster.x, y - cluster.y);
      const hitRadius = preset.enableSecondaryAction ? cluster.radius + 16 : cluster.radius + 22;
      if (dist <= hitRadius && cluster.cleared < 1) {
        const gain = !preset.enableSecondaryAction ? 1 : isDownEvent ? 0.65 : 0.35;
        cluster.cleared = Math.min(1, cluster.cleared + gain);

        const now = performance.now();
        if (preset.enableHazards && cluster.hasActiveArc && isDownEvent) {
          this.arcShockCount++;
          this.spawnSparks(cluster.x, cluster.y, '#f43f5e', 12);
          this.triggerWrongTap(cluster.x, cluster.y);
          soundFX.playEvaBrushSwipe(true);
          this.statusBannerText = 'Zapped! Use the green Zap button for lightning panels!';
          this.statusBannerColor = '#f43f5e';
        } else {
          this.spawnSparks(cluster.x, cluster.y, '#facc15', 9);
          if (cluster.cleared >= 1) {
            this.triggerEncouragement('Shiny!', cluster.x, cluster.y - 26);
          }
          if (now - this.lastSoundTimeMs > 90) {
            this.lastSoundTimeMs = now;
            soundFX.playEvaBrushSwipe(false);
          }
          this.statusBannerText = `Sparkly clean! ${this.getDustClearedCount()} of ${this.regolithClusters.length} done!`;
          this.statusBannerColor = '#38bdf8';
        }

        this.recalculateRatio();
        this.emitTelemetry();
        if (this.getDustClearedCount() >= this.regolithClusters.length) {
          this.finishMiniGame();
        }
        return;
      }
    }
    if (isDownEvent && !preset.enableSecondaryAction) {
      this.triggerWrongTap(x, y);
    }
  }

  private interactAtPoint(x: number, y: number, strength: number, isDownEvent = false): void {
    if (this.completed) return;
    this.markActiveInput();
    this.pointerX = x;
    this.pointerY = y;

    if (this.descriptor.mechanicType === 'weld_seal') {
      this.handleWeldSealPointer(x, y, isDownEvent);
      return;
    }

    if (this.descriptor.mechanicType === 'dipole_align') {
      this.handleDipoleAlignPointer(x, y, isDownEvent);
      return;
    }

    if (this.descriptor.mechanicType === 'water_bladder') {
      this.handleWaterBladderPointer(x, y, isDownEvent);
      return;
    }

    if (this.descriptor.mechanicType === 'uv_sterilize') {
      this.handleUvSterilizePointer(x, y, isDownEvent);
      return;
    }

    if (this.descriptor.mechanicType === 'core_spectrometer') {
      this.handleQuietSunDualConsolePointer(x, y, isDownEvent);
      return;
    }

    if (this.descriptor.mechanicType === 'dust_brush') {
      this.handleDustBrushPointer(x, y, isDownEvent);
      return;
    }

    if (this.descriptor.mechanicType === 'whipple_intercept') {
      this.handleWhippleShutterPointer(x, y, isDownEvent);
      return;
    }

    if (this.descriptor.mechanicType === 'thermal_conduit') {
      this.handleThermalConduitPointer(x, y, isDownEvent);
      return;
    }

    if (this.descriptor.mechanicType === 'filter_purge') {
      this.handleMarsFilterPurgePointer(x, y, isDownEvent);
      return;
    }

    if (this.descriptor.mechanicType === 'frost_melt') {
      this.handleMarsFrostVortexPointer(x, y, isDownEvent);
      return;
    }

    let hitAny = false;
    for (const node of this.nodes) {
      const dx = x - node.x;
      const dy = y - node.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= node.radius + 18 && node.progress < 1) {
        node.progress = Math.min(1, node.progress + strength);
        hitAny = true;
        this.spawnSparks(node.x, node.y, this.descriptor.secondaryColor, 6);
      }
    }

    if (hitAny) {
      this.recalculateRatio();
      const now = performance.now();
      if (now - this.lastSoundTimeMs > 95) {
        this.lastSoundTimeMs = now;
        soundFX.playMiniGameAction(this.eventCode, this.performanceRatio);
      }
      this.emitTelemetry();
      if (this.performanceRatio >= 1) {
        this.finishMiniGame();
      }
    } else {
      this.spawnSparks(x, y, this.descriptor.accentColor, 2);
    }
  }

  private handlePointerDown(e: PointerEvent): void {
    this.isPointerDown = true;
    const pt = this.mapClientToCanvas(e.clientX, e.clientY);
    this.prevPointerX = pt.x;
    this.prevPointerY = pt.y;
    this.interactAtPoint(pt.x, pt.y, 0.55, true);
  }

  private handlePointerMove(e: PointerEvent): void {
    const pt = this.mapClientToCanvas(e.clientX, e.clientY);
    const dist = Math.hypot(pt.x - this.prevPointerX, pt.y - this.prevPointerY);
    this.pointerSpeedPxPerSec = dist * 60;
    this.prevPointerX = pt.x;
    this.prevPointerY = pt.y;
    this.pointerX = pt.x;
    this.pointerY = pt.y;

    this.interactAtPoint(pt.x, pt.y, this.isPointerDown ? 0.28 : 0.14, false);
  }

  private handlePointerUp(): void {
    this.isPointerDown = false;
    this.drillThrottleActive = false;
    this.lastValvePointerAngle = null;
    this.hullHeat = 0;
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    this.isPointerDown = true;
    if (e.touches.length > 0) {
      const t = e.touches[0];
      const pt = this.mapClientToCanvas(t.clientX, t.clientY);
      this.prevPointerX = pt.x;
      this.prevPointerY = pt.y;
      this.interactAtPoint(pt.x, pt.y, 0.55, true);
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length > 0) {
      const t = e.touches[0];
      const pt = this.mapClientToCanvas(t.clientX, t.clientY);
      const dist = Math.hypot(pt.x - this.prevPointerX, pt.y - this.prevPointerY);
      this.pointerSpeedPxPerSec = dist * 60;
      this.prevPointerX = pt.x;
      this.prevPointerY = pt.y;
      this.interactAtPoint(pt.x, pt.y, 0.28, false);
    }
  }

  private handleTouchEnd(): void {
    this.isPointerDown = false;
    this.drillThrottleActive = false;
    this.lastValvePointerAngle = null;
    this.hullHeat = 0;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.completed) return;
    this.markActiveInput();
    const key = e.key.toLowerCase();

    if (this.descriptor.mechanicType === 'dipole_align') {
      if (key === 'a' || key === 'arrowleft') {
        e.preventDefault();
        this.rotateShieldArcByDeg(-25);
        return;
      }
      if (key === 'd' || key === 'arrowright') {
        e.preventDefault();
        this.rotateShieldArcByDeg(25);
        return;
      }
      if (key === 'w' || key === 's' || key === 'f') {
        e.preventDefault();
        this.toggleSolarArrayGimbal();
        return;
      }
    }

    if (this.descriptor.mechanicType === 'water_bladder') {
      if (key === '1' || key === '2' || key === '3' || key === '4') {
        e.preventDefault();
        this.togglePipeJunction(Number(key) - 1);
        return;
      }
      if (key === 'a' || key === 'arrowleft') {
        e.preventDefault();
        this.setWaterPumpSliders(
          this.potablePumpSlider + 0.25,
          this.hydroponicPumpSlider
        );
        return;
      }
      if (key === 'd' || key === 'arrowright') {
        e.preventDefault();
        this.setWaterPumpSliders(
          this.potablePumpSlider,
          this.hydroponicPumpSlider + 0.25
        );
        return;
      }
    }

    if (this.descriptor.mechanicType === 'uv_sterilize') {
      if (key === 'a' || key === 'arrowleft') {
        e.preventDefault();
        this.setScrubberFrequencySliders(
          this.dehumidifierFreqSlider - 0.15,
          this.uvPhaseSlider
        );
        return;
      }
      if (key === 'd' || key === 'arrowright') {
        e.preventDefault();
        this.setScrubberFrequencySliders(
          this.dehumidifierFreqSlider + 0.25,
          this.uvPhaseSlider
        );
        return;
      }
      if (key === 'w' || key === 'arrowup') {
        e.preventDefault();
        this.setScrubberFrequencySliders(
          this.dehumidifierFreqSlider,
          this.uvPhaseSlider + 0.25
        );
        return;
      }
      if (key === 's' || key === 'arrowdown') {
        e.preventDefault();
        this.setScrubberFrequencySliders(
          this.dehumidifierFreqSlider,
          this.uvPhaseSlider - 0.15
        );
        return;
      }
    }

    if (this.descriptor.mechanicType === 'core_spectrometer') {
      if (key === 'q' || key === 'a' || key === 'arrowleft') {
        e.preventDefault();
        this.boostScienceConsole(0.25);
        return;
      }
      if (key === 'e' || key === 'd' || key === 'arrowright') {
        e.preventDefault();
        this.boostMaintenanceConsole(0.25);
        return;
      }
    }

    if (this.descriptor.mechanicType === 'dust_brush') {
      if (key === 'c') {
        e.preventDefault();
        this.fireCapacitorRepellerPulse();
        return;
      }
      if (key === 'b') {
        e.preventDefault();
        this.swipeManualEvaBrush();
        return;
      }
    }

    if (this.descriptor.mechanicType === 'whipple_intercept') {
      if (
        key === '1' ||
        key === '2' ||
        key === '3' ||
        key === '4' ||
        key === '5' ||
        key === '6'
      ) {
        e.preventDefault();
        this.energizeWhippleShutter(Number(key) - 1, true);
        return;
      }
    }

    if (this.descriptor.mechanicType === 'thermal_conduit') {
      if (key === 'q' || key === 'a' || key === 'arrowleft') {
        e.preventDefault();
        this.boostThermalHeaters(0.25);
        return;
      }
      if (key === 'e' || key === 'b' || key === 'd' || key === 'arrowright') {
        e.preventDefault();
        this.packRegolithBerm();
        return;
      }
      if (key === '1' || key === '2' || key === '3' || key === '4') {
        e.preventDefault();
        this.packRegolithBerm(Number(key) - 1, 1.0);
        return;
      }
    }

    if (this.descriptor.mechanicType === 'filter_purge') {
      if (key === 'q') {
        e.preventDefault();
        this.fireCompressorBackPurgeBlast();
        return;
      }
      if (key === 'b' || key === 'e') {
        e.preventDefault();
        this.flipLoadShedBreaker();
        return;
      }
      if (key === '1' || key === '2' || key === '3') {
        e.preventDefault();
        this.flipLoadShedBreaker(Number(key) - 1);
        return;
      }
    }

    if (this.descriptor.mechanicType === 'frost_melt') {
      if (key === 'q') {
        e.preventDefault();
        this.fireThermalCoilPulse(0.35);
        return;
      }
      if (key === 'b' || key === 'c' || key === 'e') {
        e.preventDefault();
        this.tapAcousticChisel();
        return;
      }
      if (
        key === '1' ||
        key === '2' ||
        key === '3' ||
        key === '4' ||
        key === '5'
      ) {
        e.preventDefault();
        this.tapAcousticChisel(Number(key) - 1, 1.0);
        return;
      }
    }

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.applyInteractionImpulse(0.35);
    }
  }

  private handleMarsFrostVortexPointer(
    x: number,
    y: number,
    isDownEvent: boolean
  ): void {
    const preset = this.getPreset();

    // Easy mode: tap any of the 3 big frozen valves to melt it right away!
    if (!preset.enableSecondaryAction) {
      if (!isDownEvent) return;
      for (const valve of this.cryoVentValves) {
        const dist = Math.hypot(x - valve.x, y - valve.y);
        if (dist <= valve.radius + 18 && valve.thermalMelted + valve.chiselShattered < 0.99) {
          valve.thermalMelted = 1;
          this.spawnSparks(valve.x, valve.y, '#fb923c', 12);
          this.triggerEncouragement('Melted!', valve.x, valve.y - 28);
          this.recalculateRatio();
          soundFX.playThermalCoilDeIce(this.performanceRatio);
          this.statusBannerText = `Awesome! ${this.getCryoValvesDeIcedCount()} of ${this.cryoVentValves.length} melted!`;
          this.statusBannerColor = '#fb923c';
          this.emitTelemetry();
          if (this.getCryoValvesDeIcedCount() >= this.cryoVentValves.length) {
            this.finishMiniGame();
          }
          return;
        }
      }
      this.triggerWrongTap(x, y);
      return;
    }

    // Normal/Hard: Left Console heats all valves; Right side chips individual valves
    if (x < 240 && (isDownEvent || this.isPointerDown)) {
      this.fireThermalCoilPulse(isDownEvent ? 0.35 : 0.08);
      return;
    }

    if (!isDownEvent) return;
    for (const valve of this.cryoVentValves) {
      const dist = Math.hypot(x - valve.x, y - valve.y);
      if (dist <= valve.radius + 16) {
        this.tapAcousticChisel(valve.id, 1.0);
        return;
      }
    }
  }

  private handleMarsFilterPurgePointer(
    x: number,
    y: number,
    isDownEvent: boolean
  ): void {
    if (!isDownEvent) return;
    const preset = this.getPreset();

    // Easy mode: tap any of the 3 big dusty filters to pop it clean!
    if (!preset.enableSecondaryAction) {
      for (const cell of this.moxieFilterCells) {
        const dist = Math.hypot(x - cell.x, y - cell.y);
        if (dist <= cell.radius + 18 && cell.purged < 1) {
          cell.purged = 1;
          this.backPurgeShockwaveX = cell.x;
          this.backPurgeShockwaveY = cell.y;
          this.backPurgeShockwaveRadius = 10;
          this.spawnSparks(cell.x, cell.y, '#34d399', 14);
          this.triggerEncouragement('Clean!', cell.x, cell.y - 26);
          this.recalculateRatio();
          soundFX.playCompressorBackPurge(true);
          this.statusBannerText = `Whoosh! ${this.getMoxieFiltersPurgedCount()} of ${this.moxieFilterCells.length} clean!`;
          this.statusBannerColor = '#34d399';
          this.emitTelemetry();
          if (this.getMoxieFiltersPurgedCount() >= this.moxieFilterCells.length) {
            this.finishMiniGame();
          }
          return;
        }
      }
      this.triggerWrongTap(x, y);
      return;
    }

    // Normal/Hard: Right Panel toggles power switches
    if (x >= 412) {
      for (const brk of this.loadShedBreakers) {
        if (
          x >= brk.x - 6 &&
          x <= brk.x + brk.w + 6 &&
          y >= brk.y - 4 &&
          y <= brk.y + brk.h + 4
        ) {
          this.flipLoadShedBreaker(brk.id);
          return;
        }
      }
      this.flipLoadShedBreaker();
      return;
    }

    // Left/Center Panel: Air Puff Blast
    this.fireCompressorBackPurgeBlast();
  }

  private handleThermalConduitPointer(
    x: number,
    y: number,
    isDownEvent: boolean
  ): void {
    const preset = this.getPreset();

    // Easy mode: simple 1-action warm-up! Tap/slide anywhere on the cozy heater slider or walls
    if (!preset.enableSecondaryAction) {
      if (!isDownEvent && !this.isPointerDown) return;
      if (y >= 90 && y <= 245) {
        const ratio = Math.max(0.2, Math.min(1, (x - 120) / 400));
        this.setThermalHeaterSliders(
          Math.max(this.o2PipeHeaterSlider + (isDownEvent ? 0.34 : 0.08), ratio),
          Math.max(this.batteryBankHeaterSlider + (isDownEvent ? 0.34 : 0.08), ratio)
        );
        if (isDownEvent) {
          this.triggerEncouragement('Cozy!', x, y - 24);
        }
        if (this.getHeaterStrategyProgress() >= 0.99) {
          this.finishMiniGame();
        }
      }
      return;
    }

    // 1. Left Console (x < 285): Internal Heater Sliders
    if (x < 285 && (isDownEvent || this.isPointerDown)) {
      const ratio = Math.max(0.05, Math.min(1, (x - 36) / 216));
      if (y <= 156) {
        this.setThermalHeaterSliders(ratio, this.batteryBankHeaterSlider);
      } else {
        this.setThermalHeaterSliders(this.o2PipeHeaterSlider, ratio);
      }
      return;
    }

    // 2. Right Console (x >= 285): Rover Dozer along 4 Perimeter Sand Walls
    if (x >= 285 && (isDownEvent || this.isPointerDown)) {
      this.roverDozerX = Math.max(310, Math.min(604, x));
      this.roverDozerY = Math.max(66, Math.min(242, y));
      this.roverDozerAngleRad = Math.atan2(
        y - this.thermalMapCenterY,
        x - this.thermalMapCenterX
      );

      for (const wall of this.regolithBermWalls) {
        const withinWall =
          Math.abs(x - wall.cx) <= wall.w / 2 + 28 &&
          Math.abs(y - wall.cy) <= wall.h / 2 + 28;
        if (withinWall && wall.packed < 1) {
          this.packRegolithBerm(wall.id, isDownEvent ? 0.65 : 0.35);
          if (wall.packed >= 1) {
            this.triggerEncouragement('Cozy!', wall.cx, wall.cy - 20);
          }
          return;
        }
      }
    }
  }

  private handleWhippleShutterPointer(
    x: number,
    y: number,
    isDownEvent: boolean
  ): void {
    if (!isDownEvent) return;
    const preset = this.getPreset();

    // Easy mode: center dome at (320, 155) — tap any slice around the dome!
    if (!preset.enableSecondaryAction) {
      const cx = 320;
      const cy = 155;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist >= 10 && dist <= 135) {
        const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
        let relDeg = (deg + 90) % 360;
        if (relDeg < 0) relDeg += 360;
        const sectorIdx = Math.min(5, Math.max(0, Math.floor(relDeg / 60)));
        this.energizeWhippleShutter(sectorIdx, true);
      } else {
        this.triggerWrongTap(x, y);
      }
      return;
    }

    // 1. Check Right-Hand Shield Buttons
    for (const sector of this.whippleSectors) {
      if (
        Math.abs(x - sector.buttonX) <= 40 &&
        Math.abs(y - sector.buttonY) <= 21
      ) {
        this.energizeWhippleShutter(sector.id, true);
        return;
      }
    }

    // 2. Check Radial Dome Sector Wedges (Left/Center)
    const dx = x - this.whippleDomeCenterX;
    const dy = y - this.whippleDomeCenterY;
    const dist = Math.hypot(dx, dy);
    if (dist >= 16 && dist <= this.whippleRadarRadius + 28) {
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      let relDeg = (deg + 90) % 360;
      if (relDeg < 0) relDeg += 360;
      const sectorIdx = Math.min(5, Math.max(0, Math.floor(relDeg / 60)));
      this.energizeWhippleShutter(sectorIdx, true);
    }
  }

  private handleUvSterilizePointer(x: number, y: number, isDownEvent: boolean): void {
    const preset = this.getPreset();

    if (preset.enableSecondaryAction) {
      // 1. Slider 1
      if (x >= 24 && x <= 316 && y >= 162 && y <= 204 && (isDownEvent || this.isPointerDown)) {
        const ratio = Math.max(0.05, Math.min(1, (x - 36) / 264));
        this.setScrubberFrequencySliders(ratio, this.uvPhaseSlider);
        return;
      }

      // 2. Slider 2
      if (x >= 24 && x <= 316 && y >= 205 && y <= 252 && (isDownEvent || this.isPointerDown)) {
        const ratio = Math.max(0.05, Math.min(1, (x - 36) / 264));
        this.setScrubberFrequencySliders(this.dehumidifierFreqSlider, ratio);
        return;
      }
    }

    // 3. Tap or sweep drifting space germs!
    for (const spore of this.fungalSpores) {
      const dist = Math.hypot(x - spore.x, y - spore.y);
      if (dist <= spore.radius + 22 && spore.sterilized < 1) {
        spore.sterilized = Math.min(1, spore.sterilized + (isDownEvent ? 1 : 0.55));
        this.uvBeamTargetX = spore.x;
        this.uvBeamTargetY = spore.y;
        this.uvBeamTimer = 0.35;
        this.spawnSparks(spore.x, spore.y, '#c084fc', 12);
        if (spore.sterilized >= 1) {
          this.triggerEncouragement('Zapped!', spore.x, spore.y - 24);
        }
        this.recalculateRatio();
        const now = performance.now();
        if (now - this.lastSoundTimeMs > 85) {
          this.lastSoundTimeMs = now;
          soundFX.playUvSporeZap(this.performanceRatio);
        }
        this.statusBannerText = `Zap! ${this.getSporesSterilizedCount()} of ${this.fungalSpores.length} clean!`;
        this.statusBannerColor = '#c084fc';
        this.emitTelemetry();
        if (this.performanceRatio >= 1) {
          this.finishMiniGame();
        }
        return;
      }
    }
    if (isDownEvent && !preset.enableSecondaryAction) {
      this.triggerWrongTap(x, y);
    }
  }

  private handleWaterBladderPointer(x: number, y: number, isDownEvent: boolean): void {
    const preset = this.getPreset();

    // Easy mode: 1-tap each of the 3 big water shields to fill them!
    if (!preset.enableSecondaryAction) {
      if (!isDownEvent && !this.isPointerDown) return;
      for (const bladder of this.waterBladders) {
        if (bladder.fillLevel >= 1) continue;
        const dist = Math.hypot(x - bladder.x, y - bladder.y);
        if (dist <= preset.targetRadius + 18) {
          bladder.junctionAligned = true;
          bladder.fillLevel = Math.min(1, bladder.fillLevel + (isDownEvent ? 1 : 0.45));
          this.spawnSparks(bladder.x, bladder.y, '#38bdf8', 12);
          if (bladder.fillLevel >= 1) {
            this.triggerEncouragement('Splash!', bladder.x, bladder.y - 34);
          }
          this.recalculateRatio();
          soundFX.playHydraulicPumpFlow(this.performanceRatio);
          this.statusBannerText = `Splash! ${this.getBladdersFilledCount()} of ${this.waterBladders.length} full!`;
          this.statusBannerColor = '#34d399';
          this.emitTelemetry();
          if (this.performanceRatio >= 1) {
            this.finishMiniGame();
          }
          return;
        }
      }
      if (isDownEvent) this.triggerWrongTap(x, y);
      return;
    }

    // Normal/Hard: Left/Right Pump Sliders
    if (x >= 24 && x <= 308 && y >= 188 && y <= 258 && (isDownEvent || this.isPointerDown)) {
      const ratio = Math.max(0.15, Math.min(1, (x - 42) / 240));
      this.potablePumpSlider = ratio;
      if (isDownEvent) {
        if (this.waterBladders[0]) this.waterBladders[0].junctionAligned = true;
        if (this.waterBladders[1]) this.waterBladders[1].junctionAligned = true;
      }
      this.setWaterPumpSliders(ratio, this.hydroponicPumpSlider);
      this.statusBannerText = 'Left water pump flowing!';
      this.statusBannerColor = '#38bdf8';
      return;
    }

    if (x >= 332 && x <= 616 && y >= 188 && y <= 258 && (isDownEvent || this.isPointerDown)) {
      const ratio = Math.max(0.15, Math.min(1, (x - 350) / 240));
      this.hydroponicPumpSlider = ratio;
      if (isDownEvent) {
        if (this.waterBladders[2]) this.waterBladders[2].junctionAligned = true;
        if (this.waterBladders[3]) this.waterBladders[3].junctionAligned = true;
      }
      this.setWaterPumpSliders(this.potablePumpSlider, ratio);
      this.statusBannerText = 'Right water pump flowing!';
      this.statusBannerColor = '#a855f7';
      return;
    }

    // 3. Pipe Valves or Overhead Water Bags
    for (const bladder of this.waterBladders) {
      const distJunction = Math.hypot(x - bladder.x, y - bladder.junctionY);
      const distBladder = Math.hypot(x - bladder.x, y - bladder.y);

      if (distJunction <= 34 || distBladder <= 48) {
        if (!bladder.junctionAligned) {
          bladder.junctionAligned = true;
          soundFX.playPipeJunctionRotate(true);
        }
        const pumpBoost = bladder.id < 2 ? this.potablePumpSlider : this.hydroponicPumpSlider;
        bladder.fillLevel = Math.min(
          1,
          bladder.fillLevel + (isDownEvent ? 0.5 : 0.22) + pumpBoost * 0.25
        );
        this.spawnSparks(bladder.x, bladder.y, '#38bdf8', 8);
        if (bladder.fillLevel >= 1) {
          this.triggerEncouragement('Full!', bladder.x, bladder.y - 24);
        }
        this.statusBannerText = 'Filling the water shields!';
        this.statusBannerColor = bladder.fillLevel >= 1 ? '#34d399' : '#38bdf8';
        this.recalculateRatio();
        const now = performance.now();
        if (now - this.lastSoundTimeMs > 90) {
          this.lastSoundTimeMs = now;
          soundFX.playHydraulicPumpFlow(this.performanceRatio);
        }
        this.emitTelemetry();
        if (this.performanceRatio >= 1) {
          this.finishMiniGame();
        }
        return;
      }
    }
  }

  private spawnSparks(
    x: number,
    y: number,
    color: string,
    count: number,
    isVapor = false
  ): void {
    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= 120) {
        this.sparks.shift();
      }
      const angle = isVapor
        ? -Math.PI / 2 + (Math.random() - 0.5) * 0.9
        : Math.random() * Math.PI * 2;
      const speed = isVapor ? 28 + Math.random() * 55 : 35 + Math.random() * 110;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: isVapor ? 0.55 + Math.random() * 0.35 : 0.25 + Math.random() * 0.25,
        color,
        size: isVapor ? 4 + Math.random() * 4 : 2 + Math.random() * 3,
        isVapor,
      });
    }
  }

  private loop(nowMs: number): void {
    if (this.completed) return;
    if (this.paused) {
      this.lastFrameTimeMs = nowMs;
      this.render(nowMs / 1000);
      window.setTimeout(() => {
        if (!this.completed && this.canvas) {
          this.rafId = requestAnimationFrame((ts) => this.loop(ts));
        }
      }, 60);
      return;
    }
    const rawDt = (nowMs - this.lastFrameTimeMs) / 1000;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));
    this.lastFrameTimeMs = nowMs;

    this.elapsedSec += dt;
    const remaining = Math.max(0, this.totalDurationSec - this.elapsedSec);
    const ceilRem = Math.ceil(remaining);
    if (ceilRem < this.lastTickSecond && ceilRem > 0) {
      this.lastTickSecond = ceilRem;
      soundFX.playMiniGameTick(ceilRem <= 4);
      this.emitTelemetry();
    }

    this.updatePhysics(dt);
    this.render(nowMs / 1000);

    if (remaining <= 0) {
      this.finishMiniGame();
      return;
    }

    window.setTimeout(() => {
      if (!this.completed && this.canvas) {
        this.rafId = requestAnimationFrame((ts) => this.loop(ts));
      }
    }, 45);
  }

  private updatePhysics(dt: number): void {
    const preset = this.getPreset();
    this.pointerSpeedPxPerSec *= 0.82;
    this.inactivitySec += dt;
    if (this.wrongTapTimer > 0) this.wrongTapTimer = Math.max(0, this.wrongTapTimer - dt);
    if (this.encouragementTimer > 0) {
      this.encouragementTimer = Math.max(0, this.encouragementTimer - dt);
    }

    if (this.descriptor.mechanicType === 'weld_seal') {
      for (const f of this.fractures) {
        for (const s of f.segments) {
          if (s.sealed < 1 && Math.random() < (this.isValveInSafeZone() ? 0.16 : 0.35)) {
            this.spawnSparks(s.mx, s.my, '#38bdf8', 1, true);
          }
        }
      }

      const onManifoldPipe =
        this.pointerX >= 220 &&
        this.pointerX <= 590 &&
        Math.abs(this.pointerY - 178) <= 42;

      if (
        preset.enableHazards &&
        this.isPointerDown &&
        this.isValveInSafeZone() &&
        onManifoldPipe &&
        this.pointerSpeedPxPerSec < 28
      ) {
        this.hullHeat += dt * 1.45;
        if (this.hullHeat >= 1) {
          this.hullHeat = 0.25;
          this.overheatShieldPenalty = Math.min(6, this.overheatShieldPenalty + 1);
          this.statusBannerText = 'Too hot! Keep moving gently!';
          this.statusBannerColor = '#f43f5e';
          soundFX.playHullOverheat();
          this.spawnSparks(this.pointerX, this.pointerY, '#f43f5e', 14);
          this.emitTelemetry();
        }
      } else {
        this.hullHeat = Math.max(0, this.hullHeat - dt * 1.8);
      }
    }

    if (this.descriptor.mechanicType === 'dipole_align') {
      const catchAng = preset.enableSecondaryAction ? Math.PI / 4 : Math.PI / 3;
      for (const wave of this.protonWaves) {
        if (wave.state !== 'incoming' || this.elapsedSec < wave.spawnDelaySec) continue;

        wave.distanceFromCore -= wave.speedPxPerSec * dt;

        const angDiff = normalizeAngleDiff(this.shieldAngleRad, wave.vectorAngleRad);
        if (
          angDiff <= catchAng &&
          wave.distanceFromCore <= this.shieldArcRadius + 14 &&
          wave.distanceFromCore >= this.shieldArcRadius - 18
        ) {
          wave.state = 'deflected';
          this.protonsDeflected++;
          const wx =
            this.radarCenterX + Math.cos(wave.vectorAngleRad) * this.shieldArcRadius;
          const wy =
            this.radarCenterY + Math.sin(wave.vectorAngleRad) * this.shieldArcRadius;
          this.spawnSparks(wx, wy, '#c084fc', 14);
          this.triggerEncouragement('Blocked!', wx, wy - 16);
          this.statusBannerText = `Awesome block! ${this.protonsDeflected} of ${this.protonWaves.length} stopped!`;
          this.statusBannerColor = '#34d399';
          this.recalculateRatio();
          soundFX.playProtonDeflect(this.performanceRatio);
          this.emitTelemetry();
          if (this.protonWaves.every((w) => w.state !== 'incoming')) {
            this.finishMiniGame();
            return;
          }
          continue;
        }

        if (wave.distanceFromCore <= 28) {
          wave.state = 'hit_hull';
          this.protonsHitHull++;
          const hx = this.radarCenterX + Math.cos(wave.vectorAngleRad) * 26;
          const hy = this.radarCenterY + Math.sin(wave.vectorAngleRad) * 26;
          this.spawnSparks(hx, hy, '#f43f5e', 16);
          this.triggerWrongTap(hx, hy);

          if (preset.enableHazards && !this.solarArraysFeathered) {
            this.overheatShieldPenalty = Math.min(8, this.overheatShieldPenalty + 2);
            this.statusBannerText = 'Fold the solar wings first!';
          } else {
            this.statusBannerText = 'Move the shield toward the bright beams!';
          }
          this.statusBannerColor = '#f43f5e';
          soundFX.playProtonHullHit(preset.enableHazards && !this.solarArraysFeathered);
          this.emitTelemetry();

          if (this.protonWaves.every((w) => w.state !== 'incoming')) {
            this.finishMiniGame();
            return;
          }
        }
      }
    }

    if (this.descriptor.mechanicType === 'water_bladder') {
      let changed = false;
      for (const bladder of this.waterBladders) {
        if (bladder.junctionAligned && bladder.fillLevel < 1) {
          const pumpRate =
            bladder.id < 2 ? this.potablePumpSlider : this.hydroponicPumpSlider;
          if (pumpRate > 0.05) {
            bladder.fillLevel = Math.min(1, bladder.fillLevel + dt * pumpRate * 0.42);
            changed = true;
          }
        }
      }
      if (changed) {
        this.recalculateRatio();
        this.emitTelemetry();
        if (this.performanceRatio >= 1) {
          this.finishMiniGame();
          return;
        }
      }
    }

    if (this.descriptor.mechanicType === 'uv_sterilize') {
      if (this.uvBeamTimer > 0) {
        this.uvBeamTimer = Math.max(0, this.uvBeamTimer - dt);
      }
      const minX = preset.enableSecondaryAction ? 358 : 72;
      const maxX = preset.enableSecondaryAction ? 576 : 568;
      const minY = preset.enableSecondaryAction ? 84 : 88;
      const maxY = preset.enableSecondaryAction ? 228 : 226;
      for (const spore of this.fungalSpores) {
        if (spore.sterilized >= 1) continue;
        spore.x += spore.vx * dt;
        spore.y += spore.vy * dt;
        if (spore.x < minX || spore.x > maxX) spore.vx *= -1;
        if (spore.y < minY || spore.y > maxY) spore.vy *= -1;
      }
    }

    if (this.descriptor.mechanicType === 'core_spectrometer') {
      if (
        preset.enableSecondaryAction &&
        this.isPointerDown &&
        this.pointerX < 320 &&
        !(preset.enableHazards && this.drillOverheated)
      ) {
        this.drillThrottleActive = true;
        if (preset.enableHazards) {
          this.drillBitHeat = Math.min(0.95, this.drillBitHeat + dt * 0.36);
        }
        if (preset.enableHazards && this.drillBitHeat >= 0.88) {
          this.drillOverheated = true;
          this.statusBannerText = 'Too hot! Let go a moment to cool!';
          this.statusBannerColor = '#f43f5e';
          soundFX.playHullOverheat();
        } else {
          this.scienceTrackProgress = Math.min(
            1,
            Number((this.scienceTrackProgress + dt * 0.28).toFixed(3))
          );
          this.recalculateRatio();
        }
        this.emitTelemetry();
      } else {
        this.drillThrottleActive = false;
        if (this.drillBitHeat > 0.16) {
          this.drillBitHeat = Math.max(0.16, this.drillBitHeat - dt * 0.42);
          if (this.drillBitHeat < 0.65) {
            this.drillOverheated = false;
          }
        }
      }
    }

    if (this.descriptor.mechanicType === 'dust_brush') {
      this.capacitorCharge += this.capacitorChargeDir * dt * 0.32 * preset.speedMultiplier;
      if (this.capacitorCharge >= 0.95) {
        this.capacitorCharge = 0.95;
        this.capacitorChargeDir = -1;
      } else if (this.capacitorCharge <= 0.52) {
        this.capacitorCharge = 0.52;
        this.capacitorChargeDir = 1;
      }

      if (this.pulseWaveRadius > 0) {
        this.pulseWaveRadius += dt * 340;
        if (this.pulseWaveRadius > 165) {
          this.pulseWaveRadius = 0;
        }
      }
    }

    if (this.descriptor.mechanicType === 'whipple_intercept') {
      for (const sector of this.whippleSectors) {
        if (sector.slamFlashTimer > 0) {
          sector.slamFlashTimer = Math.max(0, sector.slamFlashTimer - dt);
        }
      }

      const cx = preset.enableSecondaryAction ? this.whippleDomeCenterX : 320;
      const cy = preset.enableSecondaryAction ? this.whippleDomeCenterY : 155;
      for (const meteor of this.meteorTrajectories) {
        if (meteor.state !== 'incoming' || this.elapsedSec < meteor.spawnDelaySec) {
          continue;
        }

        meteor.distanceFromCenter -= meteor.speedPxPerSec * dt;
        const targetSector = this.whippleSectors[meteor.sectorId];

        if (
          targetSector?.powered &&
          meteor.distanceFromCenter <= this.whippleShutterRadius + 14 &&
          meteor.distanceFromCenter >= this.whippleShutterRadius - 16
        ) {
          meteor.state = 'blocked';
          this.meteorsBlocked++;
          const ix = cx + Math.cos(meteor.angleRad) * this.whippleShutterRadius;
          const iy = cy + Math.sin(meteor.angleRad) * this.whippleShutterRadius;
          this.spawnSparks(ix, iy, '#fb923c', 14);
          this.spawnSparks(ix, iy, '#fde047', 8);
          this.triggerEncouragement('Blocked!', ix, iy - 16);
          soundFX.playMeteorShutterImpact(true);
          this.recalculateRatio();
          this.statusBannerText = `Shield blocked space rock ${this.meteorsBlocked}!`;
          this.statusBannerColor = '#34d399';
          this.emitTelemetry();

          if (this.meteorTrajectories.every((m) => m.state !== 'incoming')) {
            this.finishMiniGame();
            return;
          }
          continue;
        }

        if (meteor.distanceFromCenter <= 32) {
          meteor.state = 'hit_hull';
          this.meteorsHitHull++;
          const hx = cx + Math.cos(meteor.angleRad) * 32;
          const hy = cy + Math.sin(meteor.angleRad) * 32;
          this.spawnSparks(hx, hy, '#f43f5e', 16);
          this.triggerWrongTap(hx, hy);
          soundFX.playMeteorShutterImpact(false);
          this.recalculateRatio();
          this.statusBannerText = 'Tap the glowing pie slice before the rock hits!';
          this.statusBannerColor = '#f43f5e';
          this.emitTelemetry();

          if (this.meteorTrajectories.every((m) => m.state !== 'incoming')) {
            this.finishMiniGame();
            return;
          }
        }
      }
    }

    if (this.descriptor.mechanicType === 'thermal_conduit') {
      const progressTime = Math.min(1, this.elapsedSec / Math.max(1, this.totalDurationSec));
      this.externalShadowTempC = -192 - progressTime * 8;
    }

    if (this.descriptor.mechanicType === 'filter_purge') {
      if (preset.enableHazards) {
        this.windSpeedKmh += this.windSpeedDir * dt * 26 * preset.speedMultiplier;
        if (this.windSpeedKmh >= 95) {
          this.windSpeedKmh = 95;
          this.windSpeedDir = -1;
        } else if (this.windSpeedKmh <= 24) {
          this.windSpeedKmh = 24;
          this.windSpeedDir = 1;
        }
      } else {
        this.windSpeedKmh = 32;
      }

      if (this.backPurgeShockwaveRadius > 0) {
        this.backPurgeShockwaveRadius += dt * 280;
        if (this.backPurgeShockwaveRadius > 140) {
          this.backPurgeShockwaveRadius = 0;
        }
      }
    }

    if (this.descriptor.mechanicType === 'frost_melt') {
      if (preset.enableHazards) {
        const s = preset.speedMultiplier;
        this.vortexX =
          435 +
          Math.sin(this.elapsedSec * 1.9 * s) * 115 +
          Math.cos(this.elapsedSec * 3.1 * s) * 22;
        this.vortexY =
          148 +
          Math.cos(this.elapsedSec * 1.45 * s) * 44 +
          Math.sin(this.elapsedSec * 2.7 * s) * 12;
      }

      if (preset.enableSecondaryAction && this.isPointerDown && this.pointerX < 240) {
        this.fireThermalCoilPulse(dt * 0.65);
      }
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.life += dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      if (sp.life >= sp.maxLife) {
        this.sparks.splice(i, 1);
      }
    }

    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.life += dt;
      c.vy += 170 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vrot * dt;
      if (c.life >= c.maxLife) {
        this.confetti.splice(i, 1);
      }
    }
  }

  private drawRoundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  private drawCartoonPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    stroke: string,
    r = 14,
    lineWidth = 3
  ): void {
    ctx.save();
    // Chunky cartoon drop-shadow
    this.drawRoundedRectPath(ctx, x + 2, y + 4, w, h, r);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.65)';
    ctx.fill();

    this.drawRoundedRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();

    // Subtle top highlight stripe
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    this.drawRoundedRectPath(ctx, x + 4, y + 3, Math.max(0, w - 8), Math.min(10, h * 0.28), Math.max(4, r - 4));
    ctx.fill();
    ctx.restore();
  }

  private drawCartoonBackdrop(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    skyTop: string,
    skyBot: string,
    hillColor: string,
    timeSec: number
  ): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, skyTop);
    grad.addColorStop(1, skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Friendly pixel-art twinkling stars
    const stars = [
      { x: 42, y: 66, s: 4 },
      { x: 118, y: 88, s: 3 },
      { x: 205, y: 62, s: 4 },
      { x: 290, y: 78, s: 3 },
      { x: 385, y: 64, s: 4 },
      { x: 472, y: 84, s: 3 },
      { x: 560, y: 66, s: 4 },
      { x: 604, y: 112, s: 3 },
      { x: 68, y: 128, s: 3 },
    ];
    for (let i = 0; i < stars.length; i++) {
      const st = stars[i];
      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(timeSec * 2.4 + i * 1.3));
      ctx.fillStyle = `rgba(254, 249, 195, ${twinkle.toFixed(2)})`;
      ctx.fillRect(st.x, st.y, st.s, st.s);
    }

    // Soft cartoon moon/planet horizon hills at bottom
    ctx.fillStyle = hillColor;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h - 54);
    ctx.quadraticCurveTo(w * 0.25, h - 82, w * 0.52, h - 56);
    ctx.quadraticCurveTo(w * 0.8, h - 32, w, h - 62);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  private drawGoalBanner(
    ctx: CanvasRenderingContext2D,
    w: number,
    icon: string,
    goalText: string,
    accent: string
  ): void {
    this.drawCartoonPanel(ctx, 14, 8, w - 28, 34, '#0f172a', accent, 14, 3);
    ctx.font = 'bold 16px "Plus Jakarta Sans", "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.fillText(`${icon}  ${goalText}`, w / 2, 26);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Shrinking color timer bar (NO numbers on canvas)
    const remainingRatio = Math.max(
      0,
      Math.min(1, (this.totalDurationSec - this.elapsedSec) / Math.max(1, this.totalDurationSec))
    );
    const barX = 28;
    const barY = 46;
    const barW = w - 56;
    const barH = 10;
    this.drawRoundedRectPath(ctx, barX, barY, barW, barH, 5);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    if (remainingRatio > 0) {
      const fillColor =
        remainingRatio > 0.45 ? '#22c55e' : remainingRatio > 0.2 ? '#facc15' : '#f43f5e';
      this.drawRoundedRectPath(ctx, barX + 1, barY + 1, Math.max(8, (barW - 2) * remainingRatio), barH - 2, 4);
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
  }

  private drawCartoonStar(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    outerR: number,
    filled: boolean
  ): void {
    const innerR = outerR * 0.48;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = filled ? '#facc15' : '#1e293b';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = filled ? '#fef08a' : '#475569';
    ctx.stroke();
  }

  private drawStarProgress(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    progressRatio: number,
    starCount: number
  ): void {
    const clamped = Math.max(0, Math.min(1, progressRatio));
    this.drawCartoonPanel(ctx, 18, h - 42, w - 36, 34, '#0f172a', '#38bdf8', 14, 2.5);

    // Rising rocket progress bar on left half
    const trackX = 36;
    const trackW = w - 210;
    const trackY = h - 25;
    this.drawRoundedRectPath(ctx, trackX, trackY - 6, trackW, 12, 6);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    if (clamped > 0) {
      this.drawRoundedRectPath(ctx, trackX, trackY - 6, Math.max(12, trackW * clamped), 12, 6);
      ctx.fillStyle = '#22c55e';
      ctx.fill();
    }
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚀', trackX + trackW * clamped, trackY);

    // Big gold cartoon stars on right half
    const filledStars = Math.round(clamped * starCount);
    const starsStartX = w - 34 - (starCount - 1) * 28;
    for (let i = 0; i < starCount; i++) {
      this.drawCartoonStar(ctx, starsStartX + i * 28, h - 25, 11, i < filledStars);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  private drawHintArrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    timeSec: number,
    extraBright = false
  ): void {
    const bounce = Math.sin(timeSec * (extraBright ? 9 : 5)) * 6;
    const scale = extraBright ? 1.25 : 1.0;
    ctx.save();
    ctx.translate(x, y - 36 + bounce);
    ctx.scale(scale, scale);

    if (extraBright) {
      ctx.beginPath();
      ctx.arc(0, 12, 22 + Math.sin(timeSec * 8) * 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.28)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(-14, 4);
    ctx.lineTo(-5, 4);
    ctx.lineTo(-5, -12);
    ctx.lineTo(5, -12);
    ctx.lineTo(5, 4);
    ctx.lineTo(14, 4);
    ctx.closePath();
    ctx.fillStyle = extraBright ? '#fde047' : '#22c55e';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();
    ctx.restore();
  }

  private drawIntroHandPointer(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    timeSec: number,
    mode: 'tap' | 'drag' = 'tap',
    x2 = x,
    y2 = y
  ): void {
    let hx = x;
    let hy = y;
    let tapScale = 1;
    if (mode === 'drag') {
      const t = (Math.sin(timeSec * 3.2) + 1) / 2;
      hx = x + (x2 - x) * t;
      hy = y + (y2 - y) * t;
    } else {
      const tapCycle = Math.sin(timeSec * 5.5);
      hy = y + (tapCycle > 0 ? 4 : -5);
      tapScale = tapCycle > 0 ? 0.92 : 1.04;
      if (tapCycle > 0.3) {
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    ctx.save();
    ctx.translate(hx + 10, hy + 16);
    ctx.scale(tapScale, tapScale);
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👆', 0, 0);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  private drawFeedbackAndProgress(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number,
    progressRatio: number,
    hintTarget?: { x: number; y: number } | null,
    introTarget?: { x: number; y: number; mode?: 'tap' | 'drag'; x2?: number; y2?: number } | null
  ): void {
    const preset = this.getPreset();

    // Sparks
    for (const sp of this.sparks) {
      const alpha = Math.max(0, 1 - sp.life / sp.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Confetti pieces
    for (const c of this.confetti) {
      const alpha = Math.max(0, 1 - c.life / c.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.75);
      ctx.restore();
    }

    // Hint arrow (Easy/Normal after inactivity delay, or gentle guide on Easy)
    if (hintTarget) {
      const extraBright = this.inactivitySec >= preset.autoHelpAfterSec;
      if (extraBright || this.difficulty === 'easy') {
        this.drawHintArrow(ctx, hintTarget.x, hintTarget.y, timeSec, extraBright);
      }
    }

    // Friendly intro hand during first N seconds
    if (introTarget && this.elapsedSec <= preset.showIntroHandSec) {
      this.drawIntroHandPointer(
        ctx,
        introTarget.x,
        introTarget.y,
        timeSec,
        introTarget.mode || 'tap',
        introTarget.x2,
        introTarget.y2
      );
    }

    // Wrong tap gentle wiggle ring
    if (this.wrongTapTimer > 0) {
      const wobble = Math.sin(timeSec * 45) * 6;
      ctx.save();
      ctx.translate(this.wrongTapX + wobble, this.wrongTapY);
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    // Floating encouragement pop ("Fixed!", "Blocked!", "Splash!")
    if (this.encouragementTimer > 0 && this.encouragementText) {
      const rise = (0.9 - this.encouragementTimer) * 20;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.encouragementTimer * 2);
      this.drawCartoonPanel(
        ctx,
        this.encouragementX - 52,
        this.encouragementY - rise - 16,
        104,
        30,
        '#22c55e',
        '#0f172a',
        12,
        2.5
      );
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⭐ ${this.encouragementText}`, this.encouragementX, this.encouragementY - rise - 1);
      ctx.restore();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // Bottom big star + rocket bar
    this.drawStarProgress(ctx, w, h, progressRatio, preset.starCount);
  }

  private render(timeSec: number): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0b1226';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const w = canvas.width;
    const h = canvas.height;

    this.drawCartoonBackdrop(ctx, w, h, '#0f172a', '#1e1b4b', '#1e293b', timeSec);

    if (this.descriptor.mechanicType === 'weld_seal') {
      this.renderO2SealLeakScene(ctx, w, h, timeSec);
      return;
    }

    if (this.descriptor.mechanicType === 'dipole_align') {
      this.renderDonkiSolarFlareScene(ctx, w, h, timeSec);
      return;
    }

    if (this.descriptor.mechanicType === 'water_bladder') {
      this.renderGcrWaterBladderScene(ctx, w, h, timeSec);
      return;
    }

    if (this.descriptor.mechanicType === 'uv_sterilize') {
      this.renderZeoliteUvScrubberScene(ctx, w, h, timeSec);
      return;
    }

    if (this.descriptor.mechanicType === 'core_spectrometer') {
      this.renderQuietSunDualConsoleScene(ctx, w, h, timeSec);
      return;
    }

    if (this.descriptor.mechanicType === 'dust_brush') {
      this.renderArtemisDustLevitationScene(ctx, w, h, timeSec);
      return;
    }

    if (this.descriptor.mechanicType === 'whipple_intercept') {
      this.renderWhippleShutterSequencerScene(ctx, w, h, timeSec);
      return;
    }

    if (this.descriptor.mechanicType === 'thermal_conduit') {
      this.renderArtemisShadowFreezeScene(ctx, w, h, timeSec);
      return;
    }

    if (this.descriptor.mechanicType === 'filter_purge') {
      this.renderMarsDustStormPurgeScene(ctx, w, h, timeSec);
      return;
    }

    if (this.descriptor.mechanicType === 'frost_melt') {
      this.renderMarsFrostVortexScene(ctx, w, h, timeSec);
      return;
    }

    this.renderBackdropSchematic(ctx, w, h, timeSec);
    this.drawFeedbackAndProgress(ctx, w, h, timeSec, this.performanceRatio);
  }

  private renderDonkiSolarFlareScene(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number
  ): void {
    const preset = this.getPreset();
    this.drawCartoonBackdrop(ctx, w, h, '#2e1065', '#0f172a', '#1e1b4b', timeSec);
    this.drawGoalBanner(ctx, w, this.descriptor.goalIcon, this.descriptor.goalBanner, '#facc15');

    // Waving colorful aurora ribbons
    for (let band = 0; band < 2; band++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 24) {
        const y = 72 + band * 14 + Math.sin(x * 0.025 + timeSec * (2.2 + band)) * 7;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = band === 0 ? 'rgba(250, 204, 21, 0.35)' : 'rgba(52, 211, 153, 0.3)';
      ctx.lineWidth = 6;
      ctx.stroke();
    }

    // Normal/Hard only: Solar Wings on left/right to fold safely!
    if (preset.enableSecondaryAction) {
      const wingCenters = [
        { x: 96, y: this.radarCenterY },
        { x: 544, y: this.radarCenterY },
      ];
      for (const wing of wingCenters) {
        ctx.save();
        ctx.translate(wing.x, wing.y);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(wing.x < 320 ? 110 : -110, 0);
        ctx.stroke();

        if (this.solarArraysFeathered) {
          this.drawCartoonPanel(ctx, -50, -14, 100, 28, '#166534', '#22c55e', 10, 3);
          ctx.fillStyle = '#bbf7d0';
          ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('FOLDED ✅', 0, 5);
        } else {
          this.drawCartoonPanel(ctx, -54, -36, 108, 72, '#1d4ed8', '#facc15', 12, 3);
          ctx.fillStyle = '#fef08a';
          ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('TAP TO FOLD', 0, 5);
        }
        ctx.restore();
      }
      ctx.textAlign = 'left';
    }

    // Center Hero Space Base Bubble & Movable Shield Arc
    const cx = this.radarCenterX;
    const cy = this.radarCenterY;
    ctx.save();
    ctx.translate(cx, cy);

    ctx.beginPath();
    ctx.arc(0, 0, 96, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Big bright green/gold shield arc
    const halfArc = preset.enableSecondaryAction ? Math.PI / 4 : Math.PI / 3;
    ctx.beginPath();
    ctx.arc(0, 0, this.shieldArcRadius, this.shieldAngleRad - halfArc, this.shieldAngleRad + halfArc);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, this.shieldArcRadius, this.shieldAngleRad - halfArc, this.shieldAngleRad + halfArc);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Friendly cartoon base dome in center
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏠', 0, 1);

    // Incoming red/orange sun storm zaps
    let nextIncoming: { x: number; y: number } | null = null;
    for (const wave of this.protonWaves) {
      if (wave.state !== 'incoming') continue;
      const rimX = Math.cos(wave.vectorAngleRad) * 94;
      const rimY = Math.sin(wave.vectorAngleRad) * 94;
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(rimX, rimY, 6, 0, Math.PI * 2);
      ctx.fill();

      if (this.elapsedSec >= wave.spawnDelaySec) {
        const px = Math.cos(wave.vectorAngleRad) * wave.distanceFromCore;
        const py = Math.sin(wave.vectorAngleRad) * wave.distanceFromCore;
        if (!nextIncoming) {
          nextIncoming = {
            x: cx + Math.cos(wave.vectorAngleRad) * this.shieldArcRadius,
            y: cy + Math.sin(wave.vectorAngleRad) * this.shieldArcRadius,
          };
        }
        ctx.beginPath();
        ctx.arc(px, py, 13, 0, Math.PI * 2);
        ctx.fillStyle = '#f43f5e';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fde047';
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const firstWave = this.protonWaves.find((w) => w.state === 'incoming');
    const demoPt = firstWave
      ? {
          x: cx + Math.cos(firstWave.vectorAngleRad) * this.shieldArcRadius,
          y: cy + Math.sin(firstWave.vectorAngleRad) * this.shieldArcRadius,
          mode: 'tap' as const,
        }
      : undefined;

    this.drawFeedbackAndProgress(
      ctx,
      w,
      h,
      timeSec,
      this.performanceRatio,
      nextIncoming,
      demoPt
    );
  }

  private renderGcrWaterBladderScene(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number
  ): void {
    const preset = this.getPreset();
    this.drawCartoonBackdrop(ctx, w, h, '#1e1b4b', '#0f172a', '#172554', timeSec);
    this.drawGoalBanner(ctx, w, this.descriptor.goalIcon, this.descriptor.goalBanner, '#38bdf8');

    // Space rays bouncing off full water bags
    for (const bladder of this.waterBladders) {
      const startX = bladder.x - 28;
      const startY = 60;
      const endX = bladder.x;
      const endY = bladder.y - 24;
      ctx.strokeStyle = bladder.fillLevel >= 0.85 ? '#38bdf8' : '#f97316';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      const tNorm = (timeSec * 2 + bladder.id * 0.35) % 1;
      ctx.fillStyle = bladder.fillLevel >= 0.85 ? '#7dd3fc' : '#fde047';
      ctx.beginPath();
      ctx.arc(startX + (endX - startX) * tNorm, startY + (endY - startY) * tNorm, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (preset.enableSecondaryAction) {
      // Pipes connecting bottom tanks to bags
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(102, 195);
      ctx.lineTo(102, 162);
      ctx.lineTo(247, 162);
      ctx.lineTo(247, 195);
      ctx.moveTo(393, 195);
      ctx.lineTo(393, 162);
      ctx.lineTo(538, 162);
      ctx.lineTo(538, 195);
      ctx.stroke();
    }

    let firstIncomplete: { x: number; y: number } | null = null;
    for (const bladder of this.waterBladders) {
      const bw = preset.enableSecondaryAction ? 116 : 144;
      const bh = preset.enableSecondaryAction ? 52 : 86;
      const bx = bladder.x - bw / 2;
      const by = bladder.y - bh / 2;
      const filled = bladder.fillLevel >= 0.99;

      if (!filled && !firstIncomplete) {
        firstIncomplete = {
          x: bladder.x,
          y: preset.enableSecondaryAction && !bladder.junctionAligned ? bladder.junctionY : bladder.y,
        };
      }

      if (preset.enableSecondaryAction) {
        ctx.strokeStyle = bladder.junctionAligned ? '#22c55e' : '#475569';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(bladder.x, bladder.junctionY);
        ctx.lineTo(bladder.x, by + bh);
        ctx.stroke();
      }

      this.drawCartoonPanel(
        ctx,
        bx,
        by,
        bw,
        bh,
        '#0f172a',
        filled ? '#22c55e' : '#38bdf8',
        16,
        3.5
      );

      if (bladder.fillLevel > 0) {
        const fillH = Math.round((bh - 8) * bladder.fillLevel);
        this.drawRoundedRectPath(ctx, bx + 4, by + bh - 4 - fillH, bw - 8, fillH, 10);
        ctx.fillStyle = filled ? '#22c55e' : '#0ea5e9';
        ctx.fill();
      }

      ctx.font = preset.enableSecondaryAction ? '20px sans-serif' : '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(filled ? '💧✅' : '💧', bladder.x, bladder.y - (preset.enableSecondaryAction ? 0 : 8));
      if (!preset.enableSecondaryAction) {
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(filled ? 'FULL!' : 'TAP TO FILL', bladder.x, bladder.y + 22);
      }

      if (preset.enableSecondaryAction) {
        ctx.save();
        ctx.translate(bladder.x, bladder.junctionY);
        ctx.beginPath();
        ctx.arc(0, 0, 17, 0, Math.PI * 2);
        ctx.fillStyle = bladder.junctionAligned ? '#22c55e' : '#facc15';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#0f172a';
        ctx.stroke();
        ctx.rotate(bladder.junctionAligned ? 0 : Math.PI / 2);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(0, 10);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    if (preset.enableSecondaryAction) {
      this.renderWaterSourceTankAndSlider(ctx, 24, 198, 280, 56, '💧 WATER PUMP 1', this.potablePumpSlider, '#38bdf8');
      this.renderWaterSourceTankAndSlider(ctx, 336, 198, 280, 56, '🌱 PLANT PUMP 2', this.hydroponicPumpSlider, '#22c55e');
    }

    this.drawFeedbackAndProgress(
      ctx,
      w,
      h,
      timeSec,
      this.performanceRatio,
      firstIncomplete,
      firstIncomplete ? { x: firstIncomplete.x, y: firstIncomplete.y, mode: 'tap' } : null
    );
  }

  private renderWaterSourceTankAndSlider(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    title: string,
    sliderRatio: number,
    accentColor: string
  ): void {
    this.drawCartoonPanel(ctx, x, y, w, h, '#0f172a', accentColor, 14, 3);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(title, x + 12, y + 20);

    const trackX = x + 14;
    const trackY = y + 38;
    const trackW = w - 28;
    this.drawRoundedRectPath(ctx, trackX, trackY - 6, trackW, 12, 6);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    this.drawRoundedRectPath(ctx, trackX, trackY - 6, Math.max(10, trackW * sliderRatio), 12, 6);
    ctx.fillStyle = accentColor;
    ctx.fill();

    const knobX = trackX + trackW * sliderRatio;
    ctx.beginPath();
    ctx.arc(knobX, trackY, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#fde047';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();
  }

  /**
   * Dedicated Renderer for OSDR-OSD-379-BIO ("Zeolite Sieve & UV Sterilization Tuning"):
   * - Glowing emerald bio-telemetry pulse ring around the habitat
   * - Left Panel: 3-channel environmental waveform monitor:
   *   Humidity (Blue), CO2 Concentration (Red), and UV Sterilizer Frequency (Violet) + 2 Frequency Sliders
   * - Right Panel: Hydroponic leaf view with Zeolite Scrubber Vents and drifting green fungal spore clusters
   *   targeted by a Violet UV Sterilizer pulse beam
   */
  private renderZeoliteUvScrubberScene(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number
  ): void {
    const preset = this.getPreset();
    this.drawCartoonBackdrop(ctx, w, h, '#064e3b', '#0f172a', '#065f46', timeSec);
    this.drawGoalBanner(ctx, w, this.descriptor.goalIcon, this.descriptor.goalBanner, '#34d399');

    if (preset.enableSecondaryAction) {
      // Left Panel: Friendly Wavy Light Bars + 2 Simple Green-Zone Sliders
      this.drawCartoonPanel(ctx, 16, 62, 298, 92, '#020617', '#38bdf8', 14, 3);
      const midY = 108;
      ctx.beginPath();
      for (let px = 12; px <= 286; px += 6) {
        const y = midY + Math.sin(px * 0.045 * (0.5 + this.targetDehumidifierFreq) + timeSec * 4) * (12 + this.targetUvPhase * 10);
        if (px === 12) ctx.moveTo(16 + px, y);
        else ctx.lineTo(16 + px, y);
      }
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.beginPath();
      for (let px = 12; px <= 286; px += 6) {
        const y = midY + Math.sin(px * 0.045 * (0.5 + this.dehumidifierFreqSlider) + timeSec * 4) * (12 + this.uvPhaseSlider * 10);
        if (px === 12) ctx.moveTo(16 + px, y);
        else ctx.lineTo(16 + px, y);
      }
      ctx.strokeStyle = this.getWaveformMatchRatio() >= 0.9 ? '#22c55e' : '#c084fc';
      ctx.lineWidth = 4;
      ctx.stroke();

      this.renderFrequencyTuneSlider(ctx, 16, 162, 298, 42, '💨 DRY AIR DIAL', this.dehumidifierFreqSlider, this.targetDehumidifierFreq, '#38bdf8');
      this.renderFrequencyTuneSlider(ctx, 16, 210, 298, 42, '✨ LIGHT ZAP DIAL', this.uvPhaseSlider, this.targetUvPhase, '#c084fc');
    }

    // Plant Garden Area (Full width on Easy, Right half on Normal/Hard)
    const bioX = preset.enableSecondaryAction ? 328 : 28;
    const bioY = 62;
    const bioW = preset.enableSecondaryAction ? 296 : w - 56;
    const bioH = 192;
    this.drawCartoonPanel(ctx, bioX, bioY, bioW, bioH, '#062c22', '#22c55e', 18, 3.5);

    // Friendly cartoon space leaves
    const leafOffsets = preset.enableSecondaryAction
      ? [
          { x: bioX + 80, y: bioY + 86, rx: 34, ry: 16, rot: -0.3 },
          { x: bioX + 185, y: bioY + 135, rx: 38, ry: 17, rot: 0.25 },
        ]
      : [
          { x: 160, y: 158, rx: 52, ry: 22, rot: -0.25 },
          { x: 320, y: 148, rx: 56, ry: 24, rot: 0.15 },
          { x: 480, y: 162, rx: 52, ry: 22, rot: -0.2 },
        ];
    for (const lf of leafOffsets) {
      ctx.save();
      ctx.translate(lf.x, lf.y);
      ctx.rotate(lf.rot);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.32)';
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, lf.rx, lf.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Purple UV Lamp at top center of garden
    const emitterX = bioX + bioW / 2;
    const emitterY = bioY + 20;
    ctx.beginPath();
    ctx.arc(emitterX, emitterY, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#c084fc';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    if (this.uvBeamTimer > 0 && this.uvBeamTargetX !== null && this.uvBeamTargetY !== null) {
      ctx.save();
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(emitterX, emitterY);
      ctx.lineTo(this.uvBeamTargetX, this.uvBeamTargetY);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // Cartoon Googly-Eyed Space Germs!
    let nextSporeHint: { x: number; y: number } | null = null;
    for (const spore of this.fungalSpores) {
      const clean = spore.sterilized >= 0.99;
      if (!clean && !nextSporeHint) {
        nextSporeHint = { x: spore.x, y: spore.y };
      }
      ctx.save();
      ctx.translate(spore.x, spore.y);
      if (clean) {
        ctx.beginPath();
        ctx.arc(0, 0, spore.radius * 0.72, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#22c55e';
        ctx.stroke();
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✨', 0, 0);
      } else {
        const wob = Math.sin(timeSec * 6 + spore.id) * 2;
        ctx.beginPath();
        ctx.arc(0, wob, spore.radius * 0.78, 0, Math.PI * 2);
        ctx.fillStyle = '#84cc16';
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#0f172a';
        ctx.stroke();
        // Cute cartoon eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-6, wob - 3, 5, 0, Math.PI * 2);
        ctx.arc(6, wob - 3, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(-5, wob - 3, 2.5, 0, Math.PI * 2);
        ctx.arc(7, wob - 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    this.drawFeedbackAndProgress(
      ctx,
      w,
      h,
      timeSec,
      this.performanceRatio,
      nextSporeHint,
      nextSporeHint ? { x: nextSporeHint.x, y: nextSporeHint.y, mode: 'tap' } : null
    );
  }

  private renderFrequencyTuneSlider(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    valueRatio: number,
    targetRatio: number,
    color: string
  ): void {
    const locked = Math.abs(valueRatio - targetRatio) <= 0.1;
    this.drawCartoonPanel(ctx, x, y, w, h, '#0f172a', locked ? '#22c55e' : color, 12, 2.5);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(locked ? `${label} ✅` : label, x + 12, y + 16);

    const trackX = x + 14;
    const trackY = y + 29;
    const trackW = w - 28;
    this.drawRoundedRectPath(ctx, trackX, trackY - 5, trackW, 10, 5);
    ctx.fillStyle = '#1e293b';
    ctx.fill();

    // Bright Green Target Zone
    const targetX = trackX + trackW * targetRatio;
    this.drawRoundedRectPath(ctx, targetX - 18, trackY - 8, 36, 16, 6);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.55)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#22c55e';
    ctx.stroke();

    const knobX = trackX + trackW * valueRatio;
    ctx.beginPath();
    ctx.arc(knobX, trackY, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#fde047';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();
  }

  private renderQuietSunDualConsoleScene(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number
  ): void {
    const preset = this.getPreset();
    this.drawCartoonBackdrop(ctx, w, h, '#0c4a6e', '#0f172a', '#1e293b', timeSec);
    this.drawGoalBanner(ctx, w, this.descriptor.goalIcon, this.descriptor.goalBanner, '#38bdf8');

    // Left Console: Digging Moon Gems (Science)
    this.drawCartoonPanel(ctx, 18, 62, 294, 194, '#082f49', '#38bdf8', 18, 3.5);
    ctx.fillStyle = '#bae6fd';
    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💎 DIG MOON GEMS', 165, 86);

    // Big Drill / Gem Tube
    this.drawCartoonPanel(ctx, 56, 100, 66, 134, '#0f172a', '#38bdf8', 12, 3);
    const fillH = Math.round(124 * this.scienceTrackProgress);
    if (fillH > 0) {
      this.drawRoundedRectPath(ctx, 61, 229 - fillH, 56, fillH, 8);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
    }
    ctx.font = '28px sans-serif';
    ctx.fillText('⛏️', 89, 174);

    // Big Tap/Hold Button on Left
    const heatDanger = preset.enableHazards && this.drillBitHeat >= 0.82;
    this.drawCartoonPanel(
      ctx,
      138,
      104,
      154,
      126,
      heatDanger ? '#7f1d1d' : '#0284c7',
      heatDanger ? '#f43f5e' : '#fde047',
      16,
      3
    );
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(heatDanger ? '🔥 COOLING!' : 'TAP TO DIG!', 215, 162);

    if (preset.enableHazards) {
      // Friendly Heat Bar (NO numbers)
      this.drawRoundedRectPath(ctx, 152, 184, 126, 14, 7);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      this.drawRoundedRectPath(ctx, 154, 186, Math.max(8, 122 * Math.min(1, this.drillBitHeat)), 10, 5);
      ctx.fillStyle = heatDanger ? '#f43f5e' : '#facc15';
      ctx.fill();
    }

    // Right Console: Fix Base Dots / Filter Pad
    this.drawCartoonPanel(ctx, 328, 62, 294, 194, '#064e3b', '#22c55e', 18, 3.5);
    ctx.fillStyle = '#bbf7d0';
    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('🔧 FIX BASE!', 475, 86);

    if (preset.enableSecondaryAction) {
      this.drawCartoonPanel(
        ctx,
        344,
        96,
        262,
        56,
        '#0f172a',
        this.greywaterMembraneInstalled ? '#22c55e' : '#facc15',
        12,
        2.5
      );
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(this.greywaterMembraneInstalled ? 'FILTER IN ✅' : 'TAP FILTER PAD ➡️', 435, 129);
    }

    for (const pit of this.hullMicroPits) {
      const py = preset.enableSecondaryAction ? pit.y : 168;
      ctx.save();
      ctx.translate(pit.x, py);
      ctx.beginPath();
      ctx.arc(0, 0, preset.enableSecondaryAction ? 22 : 28, 0, Math.PI * 2);
      ctx.fillStyle = pit.sealed ? '#22c55e' : '#f97316';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
      ctx.font = '18px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(pit.sealed ? '✅' : '🔧', 0, 1);
      ctx.restore();
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const prog = Math.min(1, (this.scienceTrackProgress + this.maintenanceTrackProgress) / 1.5);
    const nextPit = this.hullMicroPits.find((p) => !p.sealed);
    const hintPt = nextPit
      ? { x: nextPit.x, y: preset.enableSecondaryAction ? nextPit.y : 168 }
      : { x: 215, y: 162 };

    this.drawFeedbackAndProgress(
      ctx,
      w,
      h,
      timeSec,
      prog,
      hintPt,
      { x: 215, y: 162, mode: 'tap' }
    );
  }

  /**
   * Dedicated Renderer for ARTEMIS-DUST-LEV-09 ("Electrostatic Dielectric Brush & Pulse Capacitor"):
   * - Crackling cyan/gold lightning arcs across the Solar Array and a levitating yellow dust cloud
   * - 6 Habitat Solar Array panels rapidly accumulating positively charged, jagged yellow lunar regolith dust particles
   * - Right Console: Pulse Capacitor Charge Meter with Green Peak Zone (70–95%) + Repeller Pulse trigger
   * - Manual EVA Dielectric Brush cursor with arc shock hazard indicator on active lightning nodes
   */
  private renderArtemisDustLevitationScene(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number
  ): void {
    const preset = this.getPreset();
    this.drawCartoonBackdrop(ctx, w, h, '#1e293b', '#0f172a', '#334155', timeSec);
    this.drawGoalBanner(ctx, w, this.descriptor.goalIcon, this.descriptor.goalBanner, '#facc15');

    // Floating yellow moon dust specks
    for (let m = 0; m < 12; m++) {
      const mx = ((m * 53 + timeSec * 18) % (w - 40)) + 20;
      const my = 66 + ((m * 31) % 165) + Math.sin(timeSec * 3 + m) * 6;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.fillRect(mx, my, 4, 4);
    }

    const deckX = 18;
    const deckY = 62;
    const deckW = preset.enableSecondaryAction ? 430 : w - 36;
    const deckH = 192;
    this.drawCartoonPanel(ctx, deckX, deckY, deckW, deckH, '#0f172a', '#38bdf8', 18, 3.5);

    let firstDirty: { x: number; y: number } | null = null;
    for (const cluster of this.regolithClusters) {
      const cw = preset.enableSecondaryAction ? 116 : 148;
      const ch = preset.enableSecondaryAction ? 68 : 114;
      const cx = cluster.x - cw / 2;
      const cy = cluster.y - ch / 2;
      const isClean = cluster.cleared >= 0.99;

      if (!isClean && !firstDirty) {
        firstDirty = { x: cluster.x, y: cluster.y };
      }

      this.drawCartoonPanel(
        ctx,
        cx,
        cy,
        cw,
        ch,
        isClean ? '#1d4ed8' : '#1e293b',
        isClean ? '#22c55e' : preset.enableHazards && cluster.hasActiveArc ? '#f97316' : '#facc15',
        14,
        3
      );

      // Clean blue solar panel grid lines
      ctx.strokeStyle = isClean ? 'rgba(147, 197, 253, 0.55)' : 'rgba(100, 116, 139, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + cw / 2, cy + 4);
      ctx.lineTo(cx + cw / 2, cy + ch - 4);
      ctx.moveTo(cx + 4, cluster.y);
      ctx.lineTo(cx + cw - 4, cluster.y);
      ctx.stroke();

      if (isClean) {
        ctx.font = preset.enableSecondaryAction ? '20px sans-serif' : '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✨', cluster.x, cluster.y);
      } else {
        // Cartoon yellow dust puff cloud on panel
        const dustScale = 1 - cluster.cleared * 0.65;
        ctx.save();
        ctx.translate(cluster.x, cluster.y);
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        const puffs = [
          { px: -12, py: 4, r: 14 * dustScale },
          { px: 12, py: 4, r: 14 * dustScale },
          { px: 0, py: -6, r: 17 * dustScale },
        ];
        for (const pf of puffs) {
          ctx.beginPath();
          ctx.arc(pf.px, pf.py, Math.max(5, pf.r), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        if (preset.enableHazards && cluster.hasActiveArc) {
          ctx.font = '18px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⚡', 0, 0);
        }
        ctx.restore();
      }
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    if (this.pulseWaveRadius > 0) {
      ctx.beginPath();
      ctx.arc(this.pulseWaveCenterX, this.pulseWaveCenterY, this.pulseWaveRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    if (preset.enableSecondaryAction) {
      const capX = 462;
      const capY = 62;
      const capW = 162;
      const capH = 192;
      const inGreen = this.isCapacitorInGreenPeak();
      this.drawCartoonPanel(ctx, capX, capY, capW, capH, '#0f172a', inGreen ? '#22c55e' : '#facc15', 16, 3.5);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ DUST ZAPPER', capX + capW / 2, capY + 24);

      // Green Peak Charge Bar (NO numbers)
      const meterX = capX + 14;
      const meterY = capY + 38;
      const meterW = capW - 28;
      this.drawRoundedRectPath(ctx, meterX, meterY, meterW, 20, 8);
      ctx.fillStyle = '#1e293b';
      ctx.fill();

      const minGreen = this.difficulty === 'normal' ? 0.56 : 0.7;
      this.drawRoundedRectPath(ctx, meterX + meterW * minGreen, meterY - 2, meterW * (0.96 - minGreen), 24, 6);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.45)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#22c55e';
      ctx.stroke();

      this.drawRoundedRectPath(ctx, meterX + 2, meterY + 3, Math.max(8, (meterW - 4) * this.capacitorCharge), 14, 5);
      ctx.fillStyle = inGreen ? '#22c55e' : '#facc15';
      ctx.fill();

      // Big Tap Zap Button
      this.drawCartoonPanel(
        ctx,
        capX + 14,
        capY + 76,
        capW - 28,
        98,
        inGreen ? '#16a34a' : '#0284c7',
        '#fde047',
        16,
        3.5
      );
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(inGreen ? '⚡ ZAP NOW!' : 'WAIT FOR', capX + capW / 2, capY + 122);
      ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(inGreen ? 'CLEARS 2!' : 'GREEN ZONE', capX + capW / 2, capY + 146);
      ctx.textAlign = 'left';
    }

    const cleanRatio =
      this.regolithClusters.length > 0
        ? this.getDustClearedCount() / this.regolithClusters.length
        : 0;
    this.drawFeedbackAndProgress(
      ctx,
      w,
      h,
      timeSec,
      cleanRatio,
      firstDirty,
      firstDirty ? { x: firstDirty.x, y: firstDirty.y, mode: 'tap' } : null
    );
  }

  private renderWhippleShutterSequencerScene(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number
  ): void {
    const preset = this.getPreset();
    this.drawCartoonBackdrop(ctx, w, h, '#1e1b4b', '#0f172a', '#312e81', timeSec);
    this.drawGoalBanner(ctx, w, this.descriptor.goalIcon, this.descriptor.goalBanner, '#fb923c');

    const cx = preset.enableSecondaryAction ? this.whippleDomeCenterX : 320;
    const cy = preset.enableSecondaryAction ? this.whippleDomeCenterY : 155;
    const radarR = this.whippleRadarRadius;
    const shutterR = this.whippleShutterRadius;
    const alarmFlash = Math.sin(timeSec * 10) > 0;

    ctx.save();
    ctx.translate(cx, cy);

    // Outer Space Circle
    ctx.beginPath();
    ctx.arc(0, 0, radarR, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    let hintSectorPos: { x: number; y: number } | null = null;
    for (const sector of this.whippleSectors) {
      const hasIncoming = this.meteorTrajectories.some(
        (m) =>
          m.state === 'incoming' &&
          m.sectorId === sector.id &&
          this.elapsedSec >= m.spawnDelaySec - 0.5
      );

      if (hasIncoming && !sector.powered && !hintSectorPos) {
        hintSectorPos = {
          x: cx + Math.cos(sector.midAngleRad) * (shutterR + 10),
          y: cy + Math.sin(sector.midAngleRad) * (shutterR + 10),
        };
      }

      // Slice divider lines
      ctx.beginPath();
      ctx.moveTo(Math.cos(sector.startAngleRad) * 32, Math.sin(sector.startAngleRad) * 32);
      ctx.lineTo(Math.cos(sector.startAngleRad) * radarR, Math.sin(sector.startAngleRad) * radarR);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (hasIncoming && !sector.powered) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radarR - 2, sector.startAngleRad, sector.endAngleRad);
        ctx.closePath();
        ctx.fillStyle = alarmFlash ? 'rgba(244, 63, 94, 0.25)' : 'rgba(251, 146, 60, 0.14)';
        ctx.fill();
      }

      // Big Green Armored Shield Arc vs Open Track
      ctx.beginPath();
      ctx.arc(0, 0, shutterR, sector.startAngleRad + 0.08, sector.endAngleRad - 0.08);
      if (sector.powered) {
        ctx.strokeStyle = sector.slamFlashTimer > 0 ? '#fde047' : '#22c55e';
        ctx.lineWidth = 14;
      } else {
        ctx.strokeStyle = hasIncoming ? '#f97316' : 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 6;
      }
      ctx.lineCap = 'round';
      ctx.stroke();

      // Big slice number
      const lx = Math.cos(sector.midAngleRad) * (shutterR + 20);
      const ly = Math.sin(sector.midAngleRad) * (shutterR + 20);
      ctx.fillStyle = sector.powered ? '#22c55e' : hasIncoming ? '#fde047' : '#cbd5e1';
      ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sector.shortLabel, lx, ly);
    }

    // Center Space Base Dome
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();
    ctx.font = '22px sans-serif';
    ctx.fillText('🏠', 0, 1);

    // Incoming Orange Space Rocks
    for (const meteor of this.meteorTrajectories) {
      if (meteor.state !== 'incoming') continue;
      if (this.elapsedSec >= meteor.spawnDelaySec) {
        const mx = Math.cos(meteor.angleRad) * meteor.distanceFromCenter;
        const my = Math.sin(meteor.angleRad) * meteor.distanceFromCenter;
        const wakeX = Math.cos(meteor.angleRad) * (meteor.distanceFromCenter + 16);
        const wakeY = Math.sin(meteor.angleRad) * (meteor.distanceFromCenter + 16);
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(wakeX, wakeY);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(mx, my, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#fde047';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ea580c';
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    if (preset.enableSecondaryAction) {
      this.drawCartoonPanel(ctx, 420, 62, 204, 192, '#0f172a', '#fb923c', 16, 3.5);
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🛡️ TAP SHIELD SLICES', 522, 84);

      for (const sector of this.whippleSectors) {
        const bw = 82;
        const bh = 38;
        const bx = sector.buttonX - bw / 2;
        const by = sector.buttonY - bh / 2;
        const threatened = this.meteorTrajectories.some(
          (m) =>
            m.state === 'incoming' &&
            m.sectorId === sector.id &&
            this.elapsedSec >= m.spawnDelaySec - 0.4
        );
        this.drawCartoonPanel(
          ctx,
          bx,
          by,
          bw,
          bh,
          sector.powered ? '#166534' : threatened ? '#9a3412' : '#1e293b',
          sector.powered ? '#22c55e' : threatened ? '#fde047' : '#475569',
          10,
          2.5
        );
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(
          sector.powered ? `${sector.shortLabel} ON` : threatened ? `${sector.shortLabel} 🛡️!` : `SLICE ${sector.shortLabel}`,
          sector.buttonX,
          sector.buttonY + 5
        );
      }
      ctx.textAlign = 'left';
    }

    const demoMeteor = this.meteorTrajectories.find((m) => m.state === 'incoming');
    const demoSector = demoMeteor ? this.whippleSectors[demoMeteor.sectorId] : null;
    const demoPt = demoSector
      ? {
          x: cx + Math.cos(demoSector.midAngleRad) * (shutterR + 8),
          y: cy + Math.sin(demoSector.midAngleRad) * (shutterR + 8),
          mode: 'tap' as const,
        }
      : null;

    this.drawFeedbackAndProgress(ctx, w, h, timeSec, this.performanceRatio, hintSectorPos, demoPt);
  }

  private renderArtemisShadowFreezeScene(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number
  ): void {
    const preset = this.getPreset();
    const heaterProg = this.getHeaterStrategyProgress();
    const bermProg = this.getRegolithBermProgress();
    const totalDone = preset.enableSecondaryAction
      ? Math.min(1, Math.max(heaterProg, bermProg))
      : heaterProg;

    this.drawCartoonBackdrop(ctx, w, h, '#0c1e3e', '#172554', '#1e3a8a', timeSec);
    this.drawGoalBanner(ctx, w, this.descriptor.goalIcon, this.descriptor.goalBanner, '#fbbf24');

    // Gentle floating snowflakes while cold
    const coldAmt = Math.max(0.1, 1 - totalDone);
    ctx.fillStyle = `rgba(186, 230, 253, ${(0.25 + coldAmt * 0.45).toFixed(2)})`;
    for (let i = 0; i < 8; i++) {
      const fx = (i * 82 + Math.sin(timeSec * 1.5 + i) * 14) % w;
      const fy = 68 + ((timeSec * 22 + i * 31) % 160);
      ctx.beginPath();
      ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!preset.enableSecondaryAction) {
      // EASY MODE: One big cozy hero Space Base + big wide golden Heater Slider
      this.drawCartoonPanel(
        ctx,
        76,
        66,
        w - 152,
        182,
        '#0f172a',
        totalDone >= 0.9 ? '#22c55e' : '#38bdf8',
        20,
        3.5
      );

      // Cozy Base Hero Icon in top-center
      const baseGlow = Math.min(1, heaterProg);
      ctx.save();
      ctx.translate(w / 2, 128);
      ctx.beginPath();
      ctx.arc(0, 0, 42 + baseGlow * 10, 0, Math.PI * 2);
      ctx.fillStyle =
        baseGlow >= 0.5 ? 'rgba(251, 191, 36, 0.28)' : 'rgba(56, 189, 248, 0.22)';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = baseGlow >= 0.5 ? '#fbbf24' : '#7dd3fc';
      ctx.stroke();

      ctx.font = '38px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(baseGlow >= 0.7 ? '🏠' : '🥶', -18, 0);
      ctx.fillText(baseGlow >= 0.4 ? '🔥' : '❄️', 22, 2);
      ctx.restore();

      // Big wide chunky slider track (x = 120..520, y = 196..226)
      const trackX = 120;
      const trackW = 400;
      const trackY = 202;
      this.drawRoundedRectPath(ctx, trackX, trackY - 12, trackW, 24, 12);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#020617';
      ctx.stroke();

      const fillW = Math.max(24, trackW * heaterProg);
      const heatGrad = ctx.createLinearGradient(trackX, 0, trackX + trackW, 0);
      heatGrad.addColorStop(0, '#38bdf8');
      heatGrad.addColorStop(0.5, '#facc15');
      heatGrad.addColorStop(1, '#fb923c');
      this.drawRoundedRectPath(ctx, trackX + 2, trackY - 10, fillW - 4, 20, 10);
      ctx.fillStyle = heatGrad;
      ctx.fill();

      const knobX = trackX + trackW * heaterProg;
      ctx.beginPath();
      ctx.arc(knobX, trackY, 18, 0, Math.PI * 2);
      ctx.fillStyle = '#fde047';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔥', knobX, trackY + 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      const hintPt = heaterProg < 0.99 ? { x: Math.min(490, knobX + 60), y: trackY } : null;
      const demoPt =
        heaterProg < 0.99
          ? { x: Math.max(140, knobX), y: trackY, mode: 'drag' as const, x2: 500, y2: trackY }
          : null;
      this.drawFeedbackAndProgress(ctx, w, h, timeSec, totalDone, hintPt, demoPt);
      return;
    }

    // NORMAL / HARD MODE: Left Heater Sliders + Right Sand-Wall Dozer Map
    const leftX = 16;
    const leftY = 62;
    const leftW = 258;
    const leftH = 190;
    this.drawCartoonPanel(
      ctx,
      leftX,
      leftY,
      leftW,
      leftH,
      '#0f172a',
      heaterProg >= bermProg && heaterProg > 0 ? '#fbbf24' : '#475569',
      16,
      3.5
    );

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔥 TURN UP HEATERS', leftX + leftW / 2, leftY + 22);
    ctx.textAlign = 'left';

    const trackX = 36;
    const trackW = 216;
    const drawMiniHeaterSlider = (title: string, val: number, yCenter: number) => {
      const warm = val >= 0.45;
      this.drawCartoonPanel(
        ctx,
        leftX + 10,
        yCenter - 32,
        leftW - 20,
        66,
        '#1e293b',
        warm ? '#fb923c' : '#38bdf8',
        12,
        2.5
      );
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${warm ? '🔥' : '❄️'} ${title}`, leftX + 20, yCenter - 11);

      this.drawRoundedRectPath(ctx, trackX, yCenter + 4, trackW, 14, 7);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      const fw = Math.max(12, trackW * val);
      this.drawRoundedRectPath(ctx, trackX, yCenter + 4, fw, 14, 7);
      ctx.fillStyle = warm ? '#fb923c' : '#38bdf8';
      ctx.fill();

      const kx = trackX + trackW * val;
      ctx.beginPath();
      ctx.arc(kx, yCenter + 11, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#fde047';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
    };

    drawMiniHeaterSlider('Air Pipes', this.o2PipeHeaterSlider, leftY + 68);
    drawMiniHeaterSlider('Batteries', this.batteryBankHeaterSlider, leftY + 142);

    // RIGHT PANEL: Cartoon Base & 4 Sand Walls + Yellow Dozer Rover
    const rightX = 286;
    const rightY = 62;
    const rightW = 338;
    const rightH = 190;
    this.drawCartoonPanel(
      ctx,
      rightX,
      rightY,
      rightW,
      rightH,
      '#0f172a',
      bermProg > heaterProg ? '#22c55e' : '#38bdf8',
      16,
      3.5
    );

    ctx.fillStyle = '#86efac';
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚜 OR PILE SAND WALLS', rightX + rightW / 2, rightY + 22);
    ctx.textAlign = 'left';

    const cx = this.thermalMapCenterX;
    const cy = this.thermalMapCenterY;

    // Cozy Base Center
    const baseWarm = totalDone >= 0.45;
    this.drawCartoonPanel(
      ctx,
      cx - 42,
      cy - 30,
      84,
      60,
      baseWarm ? '#451a03' : '#082f49',
      baseWarm ? '#fbbf24' : '#38bdf8',
      14,
      3
    );
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(baseWarm ? '🏠' : '🥶', cx, cy + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // 4 Sand Berm Walls
    let nextWall: { x: number; y: number } | null = null;
    for (const wall of this.regolithBermWalls) {
      const wx = wall.cx - wall.w / 2;
      const wy = wall.cy - wall.h / 2;
      const isPacked = wall.packed >= 0.99;
      if (!isPacked && !nextWall) {
        nextWall = { x: wall.cx, y: wall.cy };
      }

      this.drawRoundedRectPath(ctx, wx, wy, wall.w, wall.h, 8);
      ctx.fillStyle = isPacked
        ? '#166534'
        : wall.packed > 0
        ? '#854d0e'
        : '#1e293b';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = isPacked
        ? '#22c55e'
        : wall.packed > 0
        ? '#facc15'
        : '#38bdf8';
      ctx.stroke();

      if (wall.packed > 0) {
        this.drawRoundedRectPath(
          ctx,
          wx + 2,
          wy + 2,
          wall.w > wall.h ? Math.max(6, (wall.w - 4) * wall.packed) : wall.w - 4,
          wall.w > wall.h ? wall.h - 4 : Math.max(6, (wall.h - 4) * wall.packed),
          6
        );
        ctx.fillStyle = isPacked ? '#22c55e' : '#facc15';
        ctx.fill();
      }
    }

    // Yellow Cartoon Dozer Rover
    ctx.save();
    ctx.translate(this.roverDozerX, this.roverDozerY);
    ctx.rotate(this.roverDozerAngleRad);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-13, -11, 22, 5);
    ctx.fillRect(-13, 6, 22, 5);
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.fillRect(-10, -7, 18, 14);
    ctx.strokeRect(-10, -7, 18, 14);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(8, -12, 6, 24);
    ctx.restore();

    const hintPt =
      heaterProg < 0.85
        ? { x: trackX + trackW * 0.65, y: leftY + 79 }
        : nextWall;
    const demoPt = nextWall
      ? { x: trackX + 20, y: leftY + 79, mode: 'drag' as const, x2: trackX + 190, y2: leftY + 79 }
      : null;

    this.drawFeedbackAndProgress(ctx, w, h, timeSec, totalDone, hintPt, demoPt);
  }

  private renderMarsDustStormPurgeScene(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number
  ): void {
    const preset = this.getPreset();
    const inTrough = this.isWindInTrough();
    const windRatio = Math.max(0, Math.min(1, (this.windSpeedKmh - 24) / (95 - 24)));

    this.drawCartoonBackdrop(ctx, w, h, '#431407', '#7c2d12', '#9a3412', timeSec);
    this.drawGoalBanner(ctx, w, this.descriptor.goalIcon, this.descriptor.goalBanner, '#fb923c');

    // Cartoon swirling wind ribbons
    ctx.save();
    for (let s = 0; s < 6; s++) {
      const sx = ((timeSec * 150 + s * 130) % (w + 140)) - 120;
      const sy = 76 + (s % 3) * 58;
      ctx.strokeStyle = 'rgba(253, 186, 116, 0.35)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 65, sy);
      ctx.stroke();
    }
    ctx.restore();

    const cleanProgress = preset.enableSecondaryAction
      ? Math.max(this.getMoxieFilterPurgeProgress(), this.getLoadShedBreakerProgress())
      : this.getMoxieFilterPurgeProgress();

    let nextFilter: { x: number; y: number } | null = null;
    for (const c of this.moxieFilterCells) {
      if (c.purged < 0.99) {
        nextFilter = { x: c.x, y: c.y };
        break;
      }
    }

    if (!preset.enableSecondaryAction) {
      // EASY MODE: 3 huge circular air filters centered cleanly — 1 tap pops dust off!
      this.drawCartoonPanel(ctx, 42, 66, w - 84, 184, '#0f172a', '#fb923c', 20, 3.5);

      for (const cell of this.moxieFilterCells) {
        const isClean = cell.purged >= 0.99;
        const pulse = isClean ? 0 : Math.sin(timeSec * 6 + cell.id) * 3;
        ctx.save();
        ctx.translate(cell.x, cell.y);

        ctx.beginPath();
        ctx.arc(0, 0, cell.radius + pulse, 0, Math.PI * 2);
        ctx.fillStyle = isClean ? '#14532d' : '#7c2d12';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = isClean ? '#22c55e' : '#facc15';
        ctx.stroke();

        // Friendly mesh lines
        ctx.strokeStyle = isClean ? 'rgba(134, 239, 172, 0.5)' : 'rgba(253, 186, 116, 0.45)';
        ctx.lineWidth = 2;
        for (let m = -16; m <= 16; m += 16) {
          ctx.beginPath();
          ctx.moveTo(m, -22);
          ctx.lineTo(m, 22);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-22, m);
          ctx.lineTo(22, m);
          ctx.stroke();
        }

        if (!isClean) {
          // Cartoon orange dust blobs
          ctx.fillStyle = '#fb923c';
          ctx.beginPath();
          ctx.arc(-8, -6, 11, 0, Math.PI * 2);
          ctx.arc(10, 4, 10, 0, Math.PI * 2);
          ctx.arc(-2, 10, 9, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isClean ? '✅' : '💨', 0, 1);
        ctx.restore();
      }

      if (this.backPurgeShockwaveRadius > 0) {
        ctx.beginPath();
        ctx.arc(
          this.backPurgeShockwaveX,
          this.backPurgeShockwaveY,
          this.backPurgeShockwaveRadius,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      const demoPt = nextFilter
        ? { x: nextFilter.x, y: nextFilter.y, mode: 'tap' as const }
        : null;
      this.drawFeedbackAndProgress(ctx, w, h, timeSec, cleanProgress, nextFilter, demoPt);
      return;
    }

    // NORMAL / HARD MODE: Left Wind Gauge + 6 Filters | Right Power Switches
    const leftX = 14;
    const leftY = 62;
    const leftW = 390;
    const leftH = 190;
    this.drawCartoonPanel(
      ctx,
      leftX,
      leftY,
      leftW,
      leftH,
      '#0f172a',
      inTrough ? '#22c55e' : '#f43f5e',
      16,
      3.5
    );

    ctx.fillStyle = inTrough ? '#4ade80' : '#fda4af';
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      inTrough ? '🟢 CALM WIND — TAP TO PUFF!' : '🔴 STRONG WIND — WAIT!',
      leftX + leftW / 2,
      leftY + 20
    );
    ctx.textAlign = 'left';

    // Cartoon Wind Meter (Green Safe Zone vs Red Gust Zone — NO numbers)
    const meterX = leftX + 16;
    const meterY = leftY + 28;
    const meterW = leftW - 32;
    const meterH = 18;
    const troughWidth = meterW * ((48 - 24) / (95 - 24));

    this.drawRoundedRectPath(ctx, meterX, meterY, troughWidth, meterH, 8);
    ctx.fillStyle = '#166534';
    ctx.fill();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    this.drawRoundedRectPath(ctx, meterX + troughWidth + 4, meterY, meterW - troughWidth - 4, meterH, 8);
    ctx.fillStyle = '#881337';
    ctx.fill();
    ctx.strokeStyle = '#f43f5e';
    ctx.stroke();

    // Bouncy needle
    const needleX = meterX + windRatio * meterW;
    ctx.beginPath();
    ctx.arc(needleX, meterY + meterH / 2, 10, 0, Math.PI * 2);
    ctx.fillStyle = inTrough ? '#22c55e' : '#fde047';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    for (const cell of this.moxieFilterCells) {
      const isClean = cell.purged >= 0.99;
      ctx.save();
      ctx.translate(cell.x, cell.y);

      ctx.beginPath();
      ctx.arc(0, 0, cell.radius, 0, Math.PI * 2);
      ctx.fillStyle = isClean ? '#14532d' : '#7c2d12';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = isClean ? '#22c55e' : inTrough ? '#facc15' : '#fb923c';
      ctx.stroke();

      if (!isClean) {
        const dustAlpha = Math.max(0.25, 1 - cell.purged);
        ctx.fillStyle = `rgba(251, 146, 60, ${dustAlpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(-5, -3, 10 * dustAlpha, 0, Math.PI * 2);
        ctx.arc(6, 4, 9 * dustAlpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isClean ? '✅' : '💨', 0, 1);
      ctx.restore();
    }

    if (this.backPurgeShockwaveRadius > 0) {
      ctx.beginPath();
      ctx.arc(
        this.backPurgeShockwaveX,
        this.backPurgeShockwaveY,
        this.backPurgeShockwaveRadius,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3.5;
      ctx.stroke();
    }

    // RIGHT PANEL: 3 Big Power Switches
    const rightX = 414;
    const rightY = 62;
    const rightW = 212;
    const rightH = 190;
    this.drawCartoonPanel(
      ctx,
      rightX,
      rightY,
      rightW,
      rightH,
      '#0f172a',
      this.getBreakersTrippedCount() > 0 ? '#facc15' : '#475569',
      16,
      3.5
    );

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ SAVE POWER SWITCHES', rightX + rightW / 2, rightY + 22);
    ctx.textAlign = 'left';

    for (const brk of this.loadShedBreakers) {
      this.drawCartoonPanel(
        ctx,
        brk.x,
        brk.y,
        brk.w,
        brk.h,
        brk.tripped ? '#422006' : '#1e293b',
        brk.tripped ? '#facc15' : '#475569',
        10,
        2.5
      );
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(brk.label, brk.x + 10, brk.y + 16);
      ctx.fillStyle = brk.tripped ? '#fde047' : '#94a3b8';
      ctx.font = '10px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(brk.subLabel, brk.x + 10, brk.y + 30);

      // Chunky ON / SAVED pill button
      this.drawRoundedRectPath(ctx, brk.x + brk.w - 54, brk.y + 7, 46, 24, 8);
      ctx.fillStyle = brk.tripped ? '#facc15' : '#334155';
      ctx.fill();
      ctx.fillStyle = brk.tripped ? '#0f172a' : '#e2e8f0';
      ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(brk.tripped ? 'SAVED' : 'ON', brk.x + brk.w - 31, brk.y + 23);
      ctx.textAlign = 'left';
    }

    const demoPt = nextFilter
      ? { x: nextFilter.x, y: nextFilter.y, mode: 'tap' as const }
      : null;
    this.drawFeedbackAndProgress(ctx, w, h, timeSec, cleanProgress, nextFilter, demoPt);
  }


  private renderO2SealLeakScene(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number
  ): void {
    const preset = this.getPreset();
    const safeZone = this.isValveInSafeZone();

    this.drawCartoonBackdrop(ctx, w, h, '#0f172a', '#1e293b', '#334155', timeSec);
    this.drawGoalBanner(ctx, w, this.descriptor.goalIcon, this.descriptor.goalBanner, '#fbbf24');

    // Pipe geometry differs cleanly between Easy (centered 1-step) and Normal/Hard (wheel + pipe)
    const pipeX = preset.enableSecondaryAction ? 170 : 72;
    const pipeW = preset.enableSecondaryAction ? 436 : w - 144;
    const pipeY = preset.enableSecondaryAction ? 142 : 130;
    const pipeH = preset.enableSecondaryAction ? 72 : 76;

    // Big Rounded Cartoon Space Pipe
    this.drawCartoonPanel(
      ctx,
      pipeX,
      pipeY,
      pipeW,
      pipeH,
      '#334155',
      safeZone ? '#38bdf8' : '#f43f5e',
      22,
      4
    );

    // Pipe highlight stripe & collar rings
    this.drawRoundedRectPath(ctx, pipeX + 12, pipeY + 10, pipeW - 24, 14, 7);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fill();

    const collars = preset.enableSecondaryAction ? [225, 345, 475, 590] : [100, 242, 398, 540];
    for (const fx of collars) {
      this.drawRoundedRectPath(ctx, fx - 5, pipeY - 5, 10, pipeH + 10, 4);
      ctx.fillStyle = '#475569';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Normal/Hard: Friendly Green Shutoff Wheel on Left + Safe Light Indicator
    if (preset.enableSecondaryAction) {
      // Safe light badge above pipe
      this.drawCartoonPanel(
        ctx,
        16,
        68,
        172,
        42,
        safeZone ? '#14532d' : '#881337',
        safeZone ? '#22c55e' : '#f43f5e',
        12,
        3
      );
      ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(safeZone ? '🟢 SAFE TO FIX!' : '🔴 TURN WHEEL FIRST!', 102, 94);
      ctx.textAlign = 'left';

      // Big Chunky Cartoon Valve Wheel
      ctx.save();
      ctx.translate(this.valveCenterX, this.valveCenterY);
      const rotRad = (this.valveRotationDeg * Math.PI) / 180;
      ctx.rotate(rotRad);

      ctx.beginPath();
      ctx.arc(0, 0, this.valveRadius, 0, Math.PI * 2);
      ctx.fillStyle = safeZone ? 'rgba(34, 197, 94, 0.2)' : 'rgba(250, 204, 21, 0.2)';
      ctx.fill();
      ctx.strokeStyle = safeZone ? '#22c55e' : '#facc15';
      ctx.lineWidth = 10;
      ctx.stroke();

      for (let sp = 0; sp < 4; sp++) {
        const a = (sp * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * this.valveRadius, Math.sin(a) * this.valveRadius);
        ctx.strokeStyle = safeZone ? '#4ade80' : '#fde047';
        ctx.lineWidth = 6;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
    }

    // Draw Pipe Cracks / Leaks
    let nextCrack: { x: number; y: number } | null = null;
    for (const fracture of this.fractures) {
      const allSealed = fracture.segments.every((s) => s.sealed >= 1);
      if (!allSealed && !nextCrack) {
        nextCrack = { x: fracture.centerX, y: fracture.centerY };
      }

      // Friendly glow circle around unsealed crack
      if (!allSealed) {
        const glowR = 28 + Math.sin(timeSec * 6 + fracture.id) * 4;
        ctx.beginPath();
        ctx.arc(fracture.centerX, fracture.centerY, glowR, 0, Math.PI * 2);
        ctx.fillStyle = safeZone ? 'rgba(250, 204, 21, 0.22)' : 'rgba(56, 189, 248, 0.22)';
        ctx.fill();
      }

      for (const seg of fracture.segments) {
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        if (seg.sealed >= 1) {
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 10;
          ctx.stroke();
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 4;
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 9;
          ctx.stroke();
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 3.5;
          ctx.stroke();
        }
      }

      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(allSealed ? '✅' : '💨', fracture.centerX, pipeY - 16);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    if (preset.enableHazards && this.hullHeat > 0.15) {
      ctx.save();
      ctx.translate(this.pointerX, this.pointerY);
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2 * Math.min(1, this.hullHeat));
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
    }

    const hintPt =
      preset.enableSecondaryAction && !safeZone
        ? { x: this.valveCenterX, y: this.valveCenterY }
        : nextCrack;
    const demoPt = hintPt
      ? { x: hintPt.x, y: hintPt.y, mode: 'tap' as const }
      : null;

    this.drawFeedbackAndProgress(ctx, w, h, timeSec, this.performanceRatio, hintPt, demoPt);
  }

  private renderMarsFrostVortexScene(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number
  ): void {
    const preset = this.getPreset();
    const thermalProg = this.getThermalCoilProgress();
    const chiselProg = this.getAcousticChiselProgress();
    const clearedRatio =
      this.cryoVentValves.length > 0
        ? Math.min(1, this.getCryoValvesDeIcedCount() / this.cryoVentValves.length)
        : 0;

    this.drawCartoonBackdrop(ctx, w, h, '#082f49', '#0c4a6e', '#164e63', timeSec);
    this.drawGoalBanner(ctx, w, this.descriptor.goalIcon, this.descriptor.goalBanner, '#38bdf8');

    let nextValve: { x: number; y: number } | null = null;
    for (const v of this.cryoVentValves) {
      if (v.thermalMelted + v.chiselShattered < 0.99) {
        nextValve = { x: v.x, y: v.y };
        break;
      }
    }

    if (!preset.enableSecondaryAction) {
      // EASY MODE: 3 big frozen valves centered cleanly — 1 tap melts each one!
      this.drawCartoonPanel(ctx, 48, 66, w - 96, 184, '#0f172a', '#38bdf8', 20, 3.5);

      // Connecting pipe behind valves
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(130, 160);
      ctx.lineTo(510, 160);
      ctx.stroke();

      for (const valve of this.cryoVentValves) {
        const totalClear = Math.min(1, valve.thermalMelted + valve.chiselShattered);
        const isDeIced = totalClear >= 0.99;
        const pulse = isDeIced ? 0 : Math.sin(timeSec * 6 + valve.id) * 3;

        ctx.save();
        ctx.translate(valve.x, valve.y);
        ctx.beginPath();
        ctx.arc(0, 0, valve.radius + pulse, 0, Math.PI * 2);
        ctx.fillStyle = isDeIced ? '#14532d' : '#0c4a6e';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = isDeIced ? '#22c55e' : '#7dd3fc';
        ctx.stroke();

        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isDeIced ? '🔥' : '❄️', 0, 1);
        ctx.restore();
      }

      const demoPt = nextValve
        ? { x: nextValve.x, y: nextValve.y, mode: 'tap' as const }
        : null;
      this.drawFeedbackAndProgress(ctx, w, h, timeSec, clearedRatio, nextValve, demoPt);
      return;
    }

    // NORMAL / HARD MODE: Left Warm Heater Button | Right 5 Cryo Valves (+ Dust Devil on Hard)
    const leftX = 14;
    const leftY = 62;
    const leftW = 220;
    const leftH = 190;
    this.drawCartoonPanel(ctx, leftX, leftY, leftW, leftH, '#0f172a', '#fb923c', 16, 3.5);

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔥 WARM HEATER', leftX + leftW / 2, leftY + 22);

    // Big Warm Heater Button
    const btnX = leftX + 16;
    const btnY = leftY + 34;
    const btnW = leftW - 32;
    const btnH = 66;
    const coilGlow = this.thermalCoilActive || thermalProg > 0;
    this.drawCartoonPanel(
      ctx,
      btnX,
      btnY,
      btnW,
      btnH,
      coilGlow ? '#7c2d12' : '#1e293b',
      coilGlow ? '#fbbf24' : '#fb923c',
      14,
      3
    );
    ctx.font = '24px sans-serif';
    ctx.fillText('🔥', btnX + btnW / 2, btnY + 30);
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('HOLD TO MELT ALL!', btnX + btnW / 2, btnY + 54);
    ctx.textAlign = 'left';

    // Two clean icon progress meters (Heater vs Ice Chip)
    const drawSmallBar = (icon: string, label: string, val: number, color: string, by: number) => {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${icon} ${label}`, leftX + 16, by);
      this.drawRoundedRectPath(ctx, leftX + 16, by + 6, leftW - 32, 12, 6);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      if (val > 0) {
        this.drawRoundedRectPath(ctx, leftX + 16, by + 6, Math.max(10, (leftW - 32) * val), 12, 6);
        ctx.fillStyle = color;
        ctx.fill();
      }
    };
    drawSmallBar('🔥', 'Heater Power', thermalProg, '#fb923c', leftY + 124);
    drawSmallBar('🔨', 'Ice Tap', chiselProg, '#38bdf8', leftY + 162);

    // RIGHT PANEL: 5 Frozen Cryo-Valves
    const rightX = 244;
    const rightY = 62;
    const rightW = 382;
    const rightH = 190;
    this.drawCartoonPanel(ctx, rightX, rightY, rightW, rightH, '#0f172a', '#38bdf8', 16, 3.5);

    ctx.fillStyle = '#bae6fd';
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('❄️ OR TAP FROZEN VALVES', rightX + rightW / 2, rightY + 22);
    ctx.textAlign = 'left';

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    this.cryoVentValves.forEach((v, idx) => {
      if (idx === 0) ctx.moveTo(v.x, v.y);
      else ctx.lineTo(v.x, v.y);
    });
    ctx.closePath();
    ctx.stroke();

    for (const valve of this.cryoVentValves) {
      const totalClear = Math.min(1, valve.thermalMelted + valve.chiselShattered);
      const isDeIced = totalClear >= 0.99;
      const inVortex = preset.enableHazards && this.isValveInVortex(valve.id);

      ctx.save();
      ctx.translate(valve.x, valve.y);
      ctx.beginPath();
      ctx.arc(0, 0, valve.radius, 0, Math.PI * 2);
      ctx.fillStyle = isDeIced ? '#14532d' : inVortex ? '#881337' : '#0c4a6e';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = isDeIced ? '#22c55e' : inVortex ? '#f43f5e' : '#7dd3fc';
      ctx.stroke();

      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isDeIced ? '✅' : inVortex ? '🌀' : '❄️', 0, 1);
      ctx.restore();
    }

    // Spinning Dust Devil only shown when hazards are enabled (Hard mode)
    if (preset.enableHazards) {
      ctx.save();
      for (let ring = 0; ring < 4; ring++) {
        const rRadius = 10 + ring * 6;
        const wobbleX = Math.sin(timeSec * 12 + ring * 1.3) * 3;
        const wobbleY = Math.cos(timeSec * 10 + ring) * 2 - ring * 2;
        ctx.strokeStyle = ring % 2 === 0 ? '#7dd3fc' : '#fb923c';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.vortexX + wobbleX, this.vortexY + wobbleY, rRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#fda4af';
      ctx.textAlign = 'center';
      ctx.fillText('🌀 AVOID', this.vortexX, this.vortexY - 28);
      ctx.restore();
    }

    const hintPt = nextValve || { x: btnX + btnW / 2, y: btnY + btnH / 2 };
    const demoPt = { x: hintPt.x, y: hintPt.y, mode: 'tap' as const };
    this.drawFeedbackAndProgress(ctx, w, h, timeSec, clearedRatio, hintPt, demoPt);
  }

  private renderBackdropSchematic(
    ctx: CanvasRenderingContext2D,
    w: number,
    _h: number,
    _timeSec: number
  ): void {
    const type = this.descriptor.mechanicType;
    if (type === 'thermal_conduit') {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 26;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      this.nodes.forEach((n, idx) => {
        if (idx === 0) ctx.moveTo(n.x, n.y);
        else ctx.lineTo(n.x, n.y);
      });
      ctx.stroke();

      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 4;
      ctx.stroke();
    } else if (type === 'whipple_intercept') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(40, 272, w - 80, 40);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 272, w - 80, 40);
    }
  }

  private renderNodeInterior(
    ctx: CanvasRenderingContext2D,
    node: MiniGameTargetNode,
    timeSec: number
  ): void {
    const pulse = Math.sin(timeSec * 8 + node.id) * 3;
    const type = this.descriptor.mechanicType;

    if (type === 'dust_brush' || type === 'filter_purge') {
      ctx.fillStyle = type === 'dust_brush' ? '#eab308' : '#ea580c';
      ctx.beginPath();
      ctx.arc(-6, -4, 11, 0, Math.PI * 2);
      ctx.arc(8, 3, 10, 0, Math.PI * 2);
      ctx.arc(-2, 8, 9, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'frost_melt') {
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 2.5;
      for (let a = 0; a < 3; a++) {
        const ang = (a * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * -15, Math.sin(ang) * -15);
        ctx.lineTo(Math.cos(ang) * 15, Math.sin(ang) * 15);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = this.descriptor.secondaryColor;
      ctx.beginPath();
      ctx.arc(0, 0, 10 + pulse * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
