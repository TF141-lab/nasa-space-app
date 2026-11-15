import type {
  OsdrMusculoskeletalStudyRecord,
  RadLabInstrumentRecord,
  ShieldingMaterialId,
  SpaceWeatherSummary,
  TraineeCombinedFeedPayload,
} from '../types/spaceWeather';

export type SiteId = 'artemis_shackleton' | 'mars_jezero';

export type DifficultyLevel = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
  id: DifficultyLevel;
  label: string;
  shortDesc: string;
  startingResourceBonus: number;
  startingScience: number;
  drainMultiplier: number;
  costMultiplier: number;
  gainMultiplier: number;
  minScienceToWin: number;
  eventMinIntervalSec: number;
  eventMaxIntervalSec: number;
  miniGameDurationSec: number;
  miniGameSpeedMultiplier: number;
  miniGameHintDelaySec: number;
}

export const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  easy: {
    id: 'easy',
    label: 'Easy · Cadet',
    shortDesc: '0% Bonus · 1.05x Drain · 450 Sci Goal',
    startingResourceBonus: 0,
    startingScience: 100,
    drainMultiplier: 1.05,
    costMultiplier: 1.0,
    gainMultiplier: 1.0,
    minScienceToWin: 450,
    eventMinIntervalSec: 18,
    eventMaxIntervalSec: 26,
    miniGameDurationSec: 30,
    miniGameSpeedMultiplier: 0.55,
    miniGameHintDelaySec: 4,
  },
  normal: {
    id: 'normal',
    label: 'Normal · Engineer',
    shortDesc: '-12% Bonus · 1.35x Drain · 600 Sci Goal',
    startingResourceBonus: -12,
    startingScience: 75,
    drainMultiplier: 1.35,
    costMultiplier: 1.25,
    gainMultiplier: 0.85,
    minScienceToWin: 600,
    eventMinIntervalSec: 12,
    eventMaxIntervalSec: 18,
    miniGameDurationSec: 15,
    miniGameSpeedMultiplier: 0.78,
    miniGameHintDelaySec: 6,
  },
  hard: {
    id: 'hard',
    label: 'Hard · Commander',
    shortDesc: '-24% Bonus · 1.70x Drain · 750 Sci Goal',
    startingResourceBonus: -24,
    startingScience: 50,
    drainMultiplier: 1.7,
    costMultiplier: 1.55,
    gainMultiplier: 0.75,
    minScienceToWin: 750,
    eventMinIntervalSec: 8,
    eventMaxIntervalSec: 13,
    miniGameDurationSec: 12,
    miniGameSpeedMultiplier: 1.0,
    miniGameHintDelaySec: 999,
  },
};

export type StationId =
  | 'solar_array'
  | 'hydroponics_dome'
  | 'rad_shield_core'
  | 'rover_science_bay'
  | 'hab_bunk';

export interface SiteConfig {
  id: SiteId;
  name: string;
  subtitle: string;
  nasaProgram: string;
  dayName: string;
  dayDurationHours: number;
  gravityG: number;
  surfaceTempRange: string;
  baseSolarEfficiency: number;
  ambientRadiationMsvPerDay: number;
  dailyPowerDrain: number;
  dailyLifeSupportDrain: number;
  dailyShieldingDecay: number;
  groundPalette: {
    primary: string;
    secondary: string;
    crater: string;
    ridge: string;
    sky: string;
  };
  descriptionForKids: string;
}

export const MISSION_SITES: Record<SiteId, SiteConfig> = {
  artemis_shackleton: {
    id: 'artemis_shackleton',
    name: 'Moon: Shackleton Crater Rim',
    subtitle: 'Artemis Lunar South Pole Base',
    nasaProgram: 'Artemis & LRO Surface Datasets (NASA)',
    dayName: 'Day',
    dayDurationHours: 24,
    gravityG: 0.166,
    surfaceTempRange: 'roughly -130°C to -200°C in shadowed craters',
    baseSolarEfficiency: 1.0,
    ambientRadiationMsvPerDay: 1.36, // Approx. LRO CRaTER / lunar dosimetry (~500 mSv/yr unshielded)
    dailyPowerDrain: 10,
    dailyLifeSupportDrain: 11,
    dailyShieldingDecay: 9,
    groundPalette: {
      primary: '#64748b',
      secondary: '#475569',
      crater: '#1e293b',
      ridge: '#94a3b8',
      sky: '#060b19',
    },
    descriptionForKids:
      'Near the Lunar South Pole! On the Moon, daytime lasts about two weeks, and then night lasts about two weeks too! High peaks catch almost constant sunlight for solar power, and deep dark craters hide frozen water ice, but there is zero atmosphere to block cosmic radiation!',
  },
  mars_jezero: {
    id: 'mars_jezero',
    name: 'Mars: Jezero Crater Outpost',
    subtitle: 'Mars Surface Habitat Simulation',
    nasaProgram: 'Mars Exploration & Curiosity RAD Dosimetry (NASA)',
    dayName: 'Sol',
    dayDurationHours: 24.6,
    gravityG: 0.38,
    surfaceTempRange: 'roughly -85°C night to -20°C afternoon',
    baseSolarEfficiency: 0.9,
    ambientRadiationMsvPerDay: 0.67, // Approx. Curiosity RAD surface measurement (~240 mSv/yr)
    dailyPowerDrain: 11,
    dailyLifeSupportDrain: 10,
    dailyShieldingDecay: 8,
    groundPalette: {
      primary: '#b45309',
      secondary: '#92400e',
      crater: '#451a03',
      ridge: '#d97706',
      sky: '#1c1018',
    },
    descriptionForKids:
      'An ancient Martian river delta! A thin carbon-dioxide atmosphere blocks some radiation, and a Martian day ("Sol") is 24 hours and 39 minutes—but huge swirling dust storms can block your solar panels!',
  },
};

export const getTimeUnit = (siteId: SiteId) => MISSION_SITES[siteId].dayName; // "Day" or "Sol"
export const getTimeUnitPlural = (siteId: SiteId) => MISSION_SITES[siteId].dayName + 's'; // "Days" or "Sols"

export interface EngineeringTradeOffAction {
  id: string;
  stationId: StationId;
  title: string;
  actionVerb: string;
  powerDelta: number;
  lifeSupportDelta: number;
  shieldingDelta: number;
  scienceDelta: number;
  tradeOffExplanation: string;
  nasaFact: string;
}

export const STATION_ACTIONS: Record<StationId, EngineeringTradeOffAction> = {
  solar_array: {
    id: 'overclock_solar',
    stationId: 'solar_array',
    title: 'Solar & Kilopower Array',
    actionVerb: 'Divert Crew to Align & Clean Arrays',
    powerDelta: 32,
    lifeSupportDelta: -7,
    shieldingDelta: -5,
    scienceDelta: 15,
    tradeOffExplanation:
      'GAIN +32% Power & +15 Science, but COST -7% Life Support (suit O2 used during EVA) and -5% Shielding (crew exposed outside the habitat).',
    nasaFact:
      'NASA Artemis astronauts perform EVA (spacewalks) to brush electrostatic lunar dust off solar panels—using extra suit oxygen every minute outside!',
  },
  hydroponics_dome: {
    id: 'boost_hydroponics',
    stationId: 'hydroponics_dome',
    title: 'Hydroponics & O2 Greenhouse',
    actionVerb: 'Run High-Intensity LED Grow & O2 Cycle',
    powerDelta: -11,
    lifeSupportDelta: 34,
    shieldingDelta: -2,
    scienceDelta: 25,
    tradeOffExplanation:
      'GAIN +34% Life Support (fresh oxygen & dwarf wheat) & +25 Science, but COST -11% Power to run pink/blue LED grow lamps and water heaters.',
    nasaFact:
      'In NASA OSDR Veggie experiments, plants convert CO2 into breathable oxygen and fresh food, but agricultural lighting is one of the biggest power consumers in space!',
  },
  rad_shield_core: {
    id: 'reinforce_shielding',
    stationId: 'rad_shield_core',
    title: 'Regolith & Water-Wall Shield Core',
    actionVerb: 'Pump Water Walls & Charge Magnetic Coils',
    powerDelta: -10,
    lifeSupportDelta: -5,
    shieldingDelta: 34,
    scienceDelta: 20,
    tradeOffExplanation:
      'GAIN +34% Radiation Shielding & +20 Science, but COST -10% Power and -5% Life Support water reserves diverted into protective water-lined storm shelter walls.',
    nasaFact:
      'NASA OSDR biological research proves hydrogen-rich water bags and sintered lunar regolith (moon dirt bricks) absorb dangerous solar protons better than bare aluminum!',
  },
  rover_science_bay: {
    id: 'deep_core_expedition',
    stationId: 'rover_science_bay',
    title: 'NASA OSDR & Rover Lab Bay',
    actionVerb: 'Launch Deep Core & Dosimetry Expedition',
    powerDelta: -10,
    lifeSupportDelta: -9,
    shieldingDelta: -6,
    scienceDelta: 95,
    tradeOffExplanation:
      'GAIN +95 NASA Science Points, but COST -10% Power, -9% Life Support, and -6% Shielding as the rover drills deep samples in unshielded terrain.',
    nasaFact:
      'Every deep-space science expedition trades away precious battery reserves and oxygen margin to gather samples that teach Earth how life adapts to space!',
  },
  hab_bunk: {
    id: 'emergency_storm_huddle',
    stationId: 'hab_bunk',
    title: 'Central Habitat Command Bunk',
    actionVerb: 'Enter Low-Power Storm Shelter Mode',
    powerDelta: 18,
    lifeSupportDelta: 16,
    shieldingDelta: 20,
    scienceDelta: -15,
    tradeOffExplanation:
      'GAIN +18% Power, +16% Life Support, and +20% Shielding by shutting down research labs, but COST -15 Science Points because all experiments pause!',
    nasaFact:
      'During solar storms, astronauts retreat to the heavily shielded inner sleep bunk and power down science racks—staying safe at the cost of lost research time.',
  },
};

export type EventDataOrigin = 'scenario' | 'live' | 'snapshot';

export interface SpaceWeatherEvent {
  id: string;
  donkiCode: string;
  dataOrigin: EventDataOrigin;
  title: string;
  applicableSites: ('artemis_shackleton' | 'mars_jezero')[];
  sourceDatabase: string;
  severity: 'NOMINAL' | 'MODERATE' | 'SEVERE';
  plainExplanation: string;
  vocabTerm: string;
  vocabDefinition: string;
  choices: [
    {
      label: string;
      powerDelta: number;
      lifeSupportDelta: number;
      shieldingDelta: number;
      scienceDelta: number;
      consequenceText: string;
    },
    {
      label: string;
      powerDelta: number;
      lifeSupportDelta: number;
      shieldingDelta: number;
      scienceDelta: number;
      consequenceText: string;
    }
  ];
}

export const NASA_SPACE_EVENTS: SpaceWeatherEvent[] = [
  {
    id: 'hab_oxygen_leakage',
    donkiCode: 'ECLSS-O2-SEAL-404',
    dataOrigin: 'scenario',
    title: 'Emergency Airlock & Pipe Oxygen Leakage!',
    applicableSites: ['artemis_shackleton', 'mars_jezero'],
    sourceDatabase: 'Training scenario inspired by NASA OSDR',
    severity: 'SEVERE',
    plainExplanation:
      'Extreme day-to-night temperature swings cracked an external airlock seal! Pressurized breathable oxygen is venting into space and costing precious Life Support reserves.',
    vocabTerm: 'ECLSS Pressure Integrity',
    vocabDefinition:
      'The Environmental Control and Life Support System (ECLSS) keeps air pressure and oxygen levels safe inside the habitat so astronauts can breathe without spacesuits.',
    choices: [
      {
        label: 'Weld Seal & Repressurize from Backup Tanks (-10% Power, -4% O2)',
        powerDelta: -10,
        lifeSupportDelta: -4,
        shieldingDelta: -2,
        scienceDelta: 25,
        consequenceText:
          'Arc-welding the seal used -10% Power and -4% O2 during the repair, stopping a larger leak and logging +25 Science!',
      },
      {
        label: 'Isolate Module & Let Reserve O2 Vent Overnight (-14% O2, -4% Power)',
        powerDelta: -4,
        lifeSupportDelta: -14,
        shieldingDelta: -3,
        scienceDelta: 10,
        consequenceText:
          'Sealing off the leaking bay saved battery power (-4% Power), but vented -14% Life Support oxygen reserves into the vacuum!',
      },
    ],
  },
  {
    id: 'lunar_electrostatic_dust',
    donkiCode: 'ARTEMIS-DUST-LEV-09',
    dataOrigin: 'scenario',
    title: 'Lunar Terminator Electrostatic Dust Levitation!',
    applicableSites: ['artemis_shackleton'],
    sourceDatabase: 'Training scenario inspired by Artemis & Mars research',
    severity: 'MODERATE',
    plainExplanation:
      'On the airless Moon, ultraviolet sunlight charges razor-sharp lunar dust with static electricity, making it float and coat your solar panels and radiator seals!',
    vocabTerm: 'Electrostatic Regolith',
    vocabDefinition:
      'Because the Moon has no wind or water to smooth rocks down, lunar dust is jagged like volcanic glass and clings to spacesuits and solar arrays via static charge.',
    choices: [
      {
        label: 'Pulse Electrostatic Repeller Shields (-10% Power, -4% O2)',
        powerDelta: -10,
        lifeSupportDelta: -4,
        shieldingDelta: -2,
        scienceDelta: 30,
        consequenceText:
          'High-voltage repeller grids cleared the jagged Moon dust at a cost of -10% Power and -4% O2, earning +30 Artemis surface Science!',
      },
      {
        label: 'Perform EVA Suit Brush-Off in Unshielded Vacuum (-9% O2, -10% Shielding)',
        powerDelta: -4,
        lifeSupportDelta: -9,
        shieldingDelta: -10,
        scienceDelta: 20,
        consequenceText:
          'Astronauts brushed the arrays clean by hand, costing -9% suit O2, -10% Radiation Shielding exposure, and -4% airlock Power.',
      },
    ],
  },
  {
    id: 'lunar_micrometeoroid_shower',
    donkiCode: 'LRO-IMPACT-SWARM-12',
    dataOrigin: 'scenario',
    title: 'Lunar Vacuum Micrometeoroid Swarm!',
    applicableSites: ['artemis_shackleton'],
    sourceDatabase: 'Training scenario inspired by Artemis & Mars research',
    severity: 'SEVERE',
    plainExplanation:
      'Because the Moon has zero atmosphere to burn up space debris, tiny rocks traveling tens of thousands of km/h are peppering the outer Shackleton Crater rim!',
    vocabTerm: 'Whipple Shielding',
    vocabDefinition:
      'A layered bumper wall on spacecraft and lunar habitats that shatters tiny hypervelocity micrometeoroids before they can puncture the inner pressurized hull.',
    choices: [
      {
        label: 'Energize Active Whipple & Regolith Shutters (-12% Power, -5% Shielding)',
        powerDelta: -12,
        lifeSupportDelta: -4,
        shieldingDelta: -5,
        scienceDelta: 35,
        consequenceText:
          'Heavy blast shutters absorbed the impact swarm (-12% Power, -5% Shielding wear, -4% O2) while seismic sensors recorded +35 Science.',
      },
      {
        label: 'Absorb Impacts on Outer Hull & Patch Later (-13% Shielding, -6% O2)',
        powerDelta: -5,
        lifeSupportDelta: -6,
        shieldingDelta: -13,
        scienceDelta: 15,
        consequenceText:
          'High-speed grit pitted the outer radiation shell (-13% Shielding, -6% O2, -5% Power).',
      },
    ],
  },
  {
    id: 'mars_global_dust_storm',
    donkiCode: 'MARS-MEDA-DUST-88',
    dataOrigin: 'scenario',
    title: 'Martian Regional Dust Storm & Sky Darkening!',
    applicableSites: ['mars_jezero'],
    sourceDatabase: 'Training scenario inspired by Artemis & Mars research',
    severity: 'SEVERE',
    plainExplanation:
      'Inspired by Mars Perseverance MEDA weather research: strong winds lift fine iron-oxide red dust high into the Martian sky, blocking sunlight and clogging air filters!',
    vocabTerm: 'Atmospheric Optical Depth (Tau)',
    vocabDefinition:
      'A measure of how much sunlight is blocked by airborne Martian dust. High Tau means solar panels generate far less electricity on Mars!',
    choices: [
      {
        label: 'Burn Backup Battery & Compressors to Clear Intake Filters (-12% Power, -4% O2)',
        powerDelta: -12,
        lifeSupportDelta: -4,
        shieldingDelta: -2,
        scienceDelta: 30,
        consequenceText:
          'High-pressure air blasts kept CO2 intakes clear during the dust storm, costing -12% Power and -4% O2 while logging +30 Mars climate Science!',
      },
      {
        label: 'Throttle Habitat Power & Breathe Reserve O2 Tanks (-7% Power, -11% O2)',
        powerDelta: -7,
        lifeSupportDelta: -11,
        shieldingDelta: -4,
        scienceDelta: 15,
        consequenceText:
          'Dust-choked arrays and throttled scrubbers cost -7% Power and -11% Life Support oxygen reserves.',
      },
    ],
  },
  {
    id: 'mars_co2_frost_vortex',
    donkiCode: 'MARS-JEZERO-FROST-19',
    dataOrigin: 'scenario',
    title: 'Martian Dry-Ice Frost & Convective Dust Devil!',
    applicableSites: ['mars_jezero'],
    sourceDatabase: 'Training scenario inspired by Artemis & Mars research',
    severity: 'MODERATE',
    plainExplanation:
      'A swirling Martian dust devil swept across the Jezero delta right before nightfall, followed by freezing temperatures putting carbon-dioxide frost onto greenhouse valves!',
    vocabTerm: 'Carbon Dioxide (CO2) Sublimation',
    vocabDefinition:
      'Mars’s thin atmosphere is about 95% carbon dioxide. In extreme Martian cold, CO2 gas freezes directly into dry-ice frost on cold metal surfaces.',
    choices: [
      {
        label: 'Run Valve De-Icing Heaters Overnight (-11% Power, -5% O2)',
        powerDelta: -11,
        lifeSupportDelta: -5,
        shieldingDelta: -2,
        scienceDelta: 25,
        consequenceText:
          'Thermal coils melted the dry-ice frost (-11% Power, -5% O2) and preserved the greenhouse seals (+25 Science).',
      },
      {
        label: 'Chip Frost Manually & Seal Outer Vents (-5% Power, -9% O2, -8% Shielding)',
        powerDelta: -5,
        lifeSupportDelta: -9,
        shieldingDelta: -8,
        scienceDelta: 20,
        consequenceText:
          'Cold-weather EVA maintenance cost -9% O2, -8% Shielding, and -5% Power.',
      },
    ],
  },
  {
    id: 'donki_x2_flare',
    donkiCode: 'DONKI-FLR-2026-X2.4',
    dataOrigin: 'scenario',
    title: 'Solar Flare & Proton Storm Alert!',
    applicableSites: ['artemis_shackleton', 'mars_jezero'],
    sourceDatabase: 'Training scenario inspired by NASA DONKI',
    severity: 'SEVERE',
    plainExplanation:
      'A strong solar flare sent a burst of high-energy protons racing from the Sun toward your outpost!',
    vocabTerm: 'Coronal Mass Ejection (CME)',
    vocabDefinition:
      'A giant cloud of magnetized solar plasma and radiation blasted out by the Sun that can harm astronaut cells and electronics.',
    choices: [
      {
        label: 'Divert 12% Power to Electromagnetic & Water Shielding',
        powerDelta: -12,
        lifeSupportDelta: -4,
        shieldingDelta: 16,
        scienceDelta: 30,
        consequenceText:
          'Your batteries dropped (-12% Power), but crew radiation dose stayed safe and OSDR sensors logged +30 Science!',
      },
      {
        label: 'Keep Solar Arrays Collecting & Ride Out the Storm',
        powerDelta: 14,
        lifeSupportDelta: -5,
        shieldingDelta: -14,
        scienceDelta: 10,
        consequenceText:
          'You saved +14% Power, but high-energy protons degraded habitat shielding (-14% Shielding) and stressed hydroponic microbes!',
      },
    ],
  },
  {
    id: 'osdr_microbiome_bloom',
    donkiCode: 'OSDR-OSD-379-BIO',
    dataOrigin: 'scenario',
    title: 'Hydroponic CO2 Scrubber Imbalance',
    applicableSites: ['artemis_shackleton', 'mars_jezero'],
    sourceDatabase: 'Training scenario inspired by NASA OSDR',
    plainExplanation:
      'Inspired by NASA Open Science Data Repository (OSDR) plant-microbe studies, humidity in the lettuce dome spiked, slowing oxygen production.',
    severity: 'MODERATE',
    vocabTerm: 'Bioregenerative Life Support',
    vocabDefinition:
      'Using living plants and algae to recycle astronaut carbon dioxide (CO2) breath back into breathable oxygen and food.',
    choices: [
      {
        label: 'Run Thermal Dehumidifiers & UV Sterilizers (-10% Power)',
        powerDelta: -10,
        lifeSupportDelta: 18,
        shieldingDelta: 0,
        scienceDelta: 35,
        consequenceText:
          'Dehumidifiers (-10% Power) restored crisp oxygen flow (+18% Life Support) and yielded valuable botany telemetry (+35 Science).',
      },
      {
        label: 'Vent Humid Air & Ration Emergency O2 Tanks (-10% Life Support)',
        powerDelta: 10,
        lifeSupportDelta: -10,
        shieldingDelta: -3,
        scienceDelta: 5,
        consequenceText:
          'Conserved +10% Power for heating, but venting cost -10% Life Support oxygen reserves.',
      },
    ],
  },
  {
    id: 'artemis_shadow_freeze',
    donkiCode: 'ARTEMIS-LRO-CRATER-89S',
    dataOrigin: 'scenario',
    title: 'Deep Crater Shadow Temperature Drop',
    applicableSites: ['artemis_shackleton'],
    sourceDatabase: 'Training scenario inspired by Artemis & Mars research',
    severity: 'MODERATE',
    plainExplanation:
      'The sun dipped behind a crater ridge, plunging external habitat pipes into deep lunar shadow cold. Battery heaters must work overtime!',
    vocabTerm: 'Lunar Regolith Insulation',
    vocabDefinition:
      'Crushed rock and dust covering the Moon or Mars. Packing it over pipes traps heat and blocks cosmic rays.',
    choices: [
      {
        label: 'Boost Habitat & Pipe Heaters (-12% Power, +10% Life Support)',
        powerDelta: -12,
        lifeSupportDelta: 10,
        shieldingDelta: 5,
        scienceDelta: 20,
        consequenceText:
          'Heaters kept water pipes flowing (+10% Life Support) at the cost of -12% overnight battery power.',
      },
      {
        label: 'Send Crew Outside to Pack Regolith Blankets (-9% Shielding)',
        powerDelta: 6,
        lifeSupportDelta: -6,
        shieldingDelta: -9,
        scienceDelta: 40,
        consequenceText:
          'Saved battery power and earned +40 Science studying thermal soil, but the freezing EVA cost -6% O2 and -9% Shielding.',
      },
    ],
  },
  {
    id: 'donki_gcr_spike',
    donkiCode: 'DONKI-SEP-2026-M8.1',
    dataOrigin: 'scenario',
    title: 'Solar Particle & Cosmic Ray Dosimetry Alert',
    applicableSites: ['artemis_shackleton', 'mars_jezero'],
    sourceDatabase: 'Training scenario inspired by NASA DONKI',
    severity: 'SEVERE',
    plainExplanation:
      'Radiation dosimeters show rising energetic particle and Galactic Cosmic Ray exposure. Every choice carries a real survival cost.',
    vocabTerm: 'Millisievert (mSv)',
    vocabDefinition:
      'The scientific unit researchers use to measure how much space radiation is absorbed by an astronaut’s body.',
    choices: [
      {
        label: 'Transfer Drinking Water into Overhead Shield Bladders',
        powerDelta: -6,
        lifeSupportDelta: -10,
        shieldingDelta: 22,
        scienceDelta: 25,
        consequenceText:
          'Water walls blocked cosmic rays (+22% Shielding), though drinking and hydroponic water dropped (-10% Life Support).',
      },
      {
        label: 'Prioritize Water for Food Crops & Accept Higher Dose',
        powerDelta: -4,
        lifeSupportDelta: 16,
        shieldingDelta: -12,
        scienceDelta: 15,
        consequenceText:
          'Crops thrived (+16% Life Support), but unblocked cosmic rays reduced Crew Radiation Shielding (-12% Shielding).',
      },
    ],
  },
  {
    id: 'nominal_clear_skies',
    donkiCode: 'DONKI-QUIET-SUN-SOL',
    dataOrigin: 'scenario',
    title: 'Quiet Sun Window: Science vs. Maintenance',
    applicableSites: ['artemis_shackleton', 'mars_jezero'],
    sourceDatabase: 'Training scenario inspired by NASA DONKI',
    severity: 'NOMINAL',
    plainExplanation:
      'Solar wind activity is calm right now. Outpost sensors ask whether to push for extra science or fortify systems before the next storm.',
    vocabTerm: 'Engineering Margin',
    vocabDefinition:
      'Extra reserve power, oxygen, and shielding kept by astronauts so an unexpected solar storm does not end the mission.',
    choices: [
      {
        label: 'Run High-Power Spectrometer & Core Drill (+65 Science, -10% Power)',
        powerDelta: -10,
        lifeSupportDelta: -5,
        shieldingDelta: -3,
        scienceDelta: 65,
        consequenceText:
          'Huge scientific breakthrough (+65 Science!), though batteries (-10% Power) and O2 (-5%) are tighter for tomorrow.',
      },
      {
        label: 'Recycle Greywater & Patch Micrometeoroid Seals (-10 Science)',
        powerDelta: -5,
        lifeSupportDelta: 16,
        shieldingDelta: 16,
        scienceDelta: -10,
        consequenceText:
          'Paused lab experiments (-10 Science) to rebuild +16% Life Support and +16% Shielding margin.',
      },
    ],
  },
];

export interface OutpostGameState {
  siteId: SiteId;
  difficulty: DifficultyLevel;
  commanderName: string;
  sol: number;
  maxSols: number;
  power: number;
  lifeSupport: number;
  shielding: number;
  scienceScore: number;
  minScienceToWin: number;
  actionsTakenThisSol: number;
  maxActionsPerSol: number;
  status: 'active' | 'victory' | 'failed';
  failureReason: string | null;
  activeEvent: SpaceWeatherEvent | null;
  historyLog: string[];
}

export function getEventsForSite(siteId: SiteId): SpaceWeatherEvent[] {
  return NASA_SPACE_EVENTS.filter((ev) => ev.applicableSites.includes(siteId));
}

export function getRandomEventDelayMs(difficulty: DifficultyLevel = 'normal'): number {
  const cfg = DIFFICULTY_CONFIGS[difficulty];
  const sec =
    cfg.eventMinIntervalSec +
    Math.random() * (cfg.eventMaxIntervalSec - cfg.eventMinIntervalSec);
  return Math.round(sec * 1000);
}

export function createInitialGameState(
  siteId: SiteId = 'artemis_shackleton',
  commanderName = 'Junior Commander',
  difficulty: DifficultyLevel = 'normal'
): OutpostGameState {
  const diffCfg = DIFFICULTY_CONFIGS[difficulty];
  return {
    siteId,
    difficulty,
    commanderName,
    sol: 1,
    maxSols: 10,
    power: clampResource(84 + diffCfg.startingResourceBonus),
    lifeSupport: clampResource(86 + diffCfg.startingResourceBonus),
    shielding: clampResource(85 + diffCfg.startingResourceBonus),
    scienceScore: diffCfg.startingScience,
    minScienceToWin: diffCfg.minScienceToWin,
    actionsTakenThisSol: 0,
    maxActionsPerSol: 2,
    status: 'active',
    failureReason: null,
    activeEvent: null,
    historyLog: [
      `${getTimeUnit(siteId)} 1 [${diffCfg.label}]: Landed at ${MISSION_SITES[siteId].name}. Reach ${diffCfg.minScienceToWin} NASA Science Points & survive 10 ${getTimeUnitPlural(siteId)}!`,
    ],
  };
}

export function clampResource(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export const LOW_RESOURCE_THRESHOLD = 25;
export const LOW_RESOURCE_SCIENCE_MULTIPLIER = 0.5;

export function hasLowResourcePenalty(
  state: Pick<OutpostGameState, 'power' | 'lifeSupport' | 'shielding'>
): boolean {
  return (
    state.power < LOW_RESOURCE_THRESHOLD ||
    state.lifeSupport < LOW_RESOURCE_THRESHOLD ||
    state.shielding < LOW_RESOURCE_THRESHOLD
  );
}

export function applyLowResourceSciencePenalty(
  scienceDelta: number,
  state: Pick<OutpostGameState, 'power' | 'lifeSupport' | 'shielding'>
): number {
  if (scienceDelta > 0 && hasLowResourcePenalty(state)) {
    return Math.round(scienceDelta * LOW_RESOURCE_SCIENCE_MULTIPLIER);
  }
  return scienceDelta;
}

export function scaleEventDelta(delta: number, difficulty: DifficultyLevel): number {
  const cfg = DIFFICULTY_CONFIGS[difficulty];
  if (delta < 0) {
    return Math.round(delta * cfg.costMultiplier);
  }
  if (delta > 0) {
    return Math.round(delta * cfg.gainMultiplier);
  }
  return 0;
}

export interface ScaledStationActionDeltas {
  powerDelta: number;
  lifeSupportDelta: number;
  shieldingDelta: number;
  scienceDelta: number;
  lowResourcePenaltyApplied: boolean;
}

export function getStationActionDeltas(
  state: Pick<
    OutpostGameState,
    'siteId' | 'difficulty' | 'power' | 'lifeSupport' | 'shielding'
  >,
  stationId: StationId
): ScaledStationActionDeltas {
  const action = STATION_ACTIONS[stationId];
  const site = MISSION_SITES[state.siteId];
  const diff = state.difficulty || 'normal';
  const diffCfg = DIFFICULTY_CONFIGS[diff];

  const powerDelta =
    action.powerDelta > 0
      ? Math.round(action.powerDelta * site.baseSolarEfficiency * diffCfg.gainMultiplier)
      : Math.round(action.powerDelta * diffCfg.costMultiplier);

  const lifeSupportDelta = scaleEventDelta(action.lifeSupportDelta, diff);
  const shieldingDelta = scaleEventDelta(action.shieldingDelta, diff);
  const lowResourcePenaltyApplied = action.scienceDelta > 0 && hasLowResourcePenalty(state);
  const scienceDelta = applyLowResourceSciencePenalty(action.scienceDelta, state);

  return {
    powerDelta,
    lifeSupportDelta,
    shieldingDelta,
    scienceDelta,
    lowResourcePenaltyApplied,
  };
}

export function checkSurvivalStatus(state: OutpostGameState): {
  status: 'active' | 'victory' | 'failed';
  failureReason: string | null;
} {
  if (state.power <= 0) {
    return {
      status: 'failed',
      failureReason:
        'Outpost Power reached 0%! Without electrical power, habitat heaters and pumps froze during the night. Next run, balance high-power research with Solar Array maintenance!',
    };
  }
  if (state.lifeSupport <= 0) {
    return {
      status: 'failed',
      failureReason:
        'Life Support (Oxygen & Food) reached 0%! The crew had to scrub the mission and return to orbit. Next run, allocate power to the Hydroponics Greenhouse before O2 gets critical!',
    };
  }
  if (state.shielding <= 0) {
    return {
      status: 'failed',
      failureReason:
        'Radiation Shielding reached 0%! Space radiation exceeded NASA OSDR safe career limits. Next run, reinforce Regolith & Water-Wall Shielding before solar storms hit!',
    };
  }
  if (state.sol >= state.maxSols && state.status === 'active') {
    const reqSci = state.minScienceToWin ?? DIFFICULTY_CONFIGS[state.difficulty || 'normal'].minScienceToWin;
    if (state.scienceScore < reqSci) {
      return {
        status: 'failed',
        failureReason: `Crew survived ${getTimeUnit(state.siteId)} 10, but NASA Science Points (${state.scienceScore} PTS) fell short of the ${reqSci} PTS mission requirement! Next run, trade extra power & oxygen margin at the OSDR Rover Science Lab (+95 SCI) to meet your NASA research goal!`,
      };
    }
    return {
      status: 'victory',
      failureReason: null,
    };
  }
  return { status: 'active', failureReason: null };
}

export function applyStationAction(
  state: OutpostGameState,
  stationId: StationId
): OutpostGameState {
  if (state.status !== 'active' || state.actionsTakenThisSol >= state.maxActionsPerSol) {
    return state;
  }

  const action = STATION_ACTIONS[stationId];
  const deltas = getStationActionDeltas(state, stationId);

  const nextPower = clampResource(state.power + deltas.powerDelta);
  const nextLife = clampResource(state.lifeSupport + deltas.lifeSupportDelta);
  const nextShield = clampResource(state.shielding + deltas.shieldingDelta);
  const nextScience = Math.max(0, Math.min(10000, state.scienceScore + deltas.scienceDelta));

  const penaltyTag = deltas.lowResourcePenaltyApplied ? ' [LOW-RES -50% SCI]' : '';

  const updated: OutpostGameState = {
    ...state,
    power: nextPower,
    lifeSupport: nextLife,
    shielding: nextShield,
    scienceScore: nextScience,
    actionsTakenThisSol: state.actionsTakenThisSol + 1,
    historyLog: [
      `${getTimeUnit(state.siteId)} ${state.sol} [${action.title}]: ${action.actionVerb} (${deltas.powerDelta >= 0 ? '+' : ''}${deltas.powerDelta}% PWR, ${deltas.lifeSupportDelta >= 0 ? '+' : ''}${deltas.lifeSupportDelta}% O2, ${deltas.shieldingDelta >= 0 ? '+' : ''}${deltas.shieldingDelta}% SHD, ${deltas.scienceDelta >= 0 ? '+' : ''}${deltas.scienceDelta} SCI${penaltyTag})`,
      ...state.historyLog.slice(0, 14),
    ],
  };

  if (nextPower <= 0 || nextLife <= 0 || nextShield <= 0) {
    const check = checkSurvivalStatus(updated);
    return {
      ...updated,
      status: 'failed',
      failureReason: check.failureReason,
    };
  }

  return updated;
}

function parseIsoMs(iso: string | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export function computeEventWeights(
  sitePool: SpaceWeatherEvent[],
  liveWeather?: SpaceWeatherSummary | null,
  nowMs: number = Date.now()
): number[] {
  if (!liveWeather) {
    return sitePool.map(() => 1);
  }

  const cutoff72h = nowMs - 72 * 60 * 60 * 1000;
  const cutoff7d = nowMs - 7 * 24 * 60 * 60 * 1000;

  const hasFlareOrCme72h =
    (liveWeather.flares || []).some((f) => parseIsoMs(f.peakTime) >= cutoff72h) ||
    (liveWeather.cmes || []).some((c) => parseIsoMs(c.startTime) >= cutoff72h);

  const hasSepOrSevereStorm72h =
    (liveWeather.sepEvents || []).some((s) => parseIsoMs(s.eventTime) >= cutoff72h) ||
    (liveWeather.storms || []).some(
      (g) => (g.maxKp ?? 0) >= 5 && parseIsoMs(g.startTime) >= cutoff72h
    );

  const anyActivity7d =
    (liveWeather.flares || []).some((f) => parseIsoMs(f.peakTime) >= cutoff7d) ||
    (liveWeather.cmes || []).some((c) => parseIsoMs(c.startTime) >= cutoff7d) ||
    (liveWeather.storms || []).some((g) => parseIsoMs(g.startTime) >= cutoff7d) ||
    (liveWeather.sepEvents || []).some((s) => parseIsoMs(s.eventTime) >= cutoff7d);

  return sitePool.map((ev) => {
    if (ev.id === 'donki_x2_flare' && hasFlareOrCme72h) return 3;
    if (ev.id === 'donki_gcr_spike' && hasSepOrSevereStorm72h) return 3;
    if (ev.id === 'nominal_clear_skies' && !anyActivity7d) return 3;
    return 1;
  });
}

export function pickWeightedEvent(
  sitePool: SpaceWeatherEvent[],
  liveWeather?: SpaceWeatherSummary | null,
  nowMs: number = Date.now(),
  randUnit: number = Math.random()
): SpaceWeatherEvent {
  const weights = computeEventWeights(sitePool, liveWeather, nowMs);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const clampedRand = Math.max(0, Math.min(0.9999999, randUnit));
  let target = clampedRand * totalWeight;
  for (let i = 0; i < sitePool.length; i++) {
    target -= weights[i];
    if (target < 0) return sitePool[i];
  }
  return sitePool[sitePool.length - 1];
}

export interface EventAttribution {
  dataOrigin: EventDataOrigin;
  originLabel: string;
  realRecordText?: string;
  realRecordLink?: string;
}

function formatUtcShortDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toISOString().slice(0, 10);
}

export function getEventAttribution(
  ev: SpaceWeatherEvent,
  liveWeather?: SpaceWeatherSummary | null
): EventAttribution {
  const fallbackOriginLabel = ev.sourceDatabase;
  if (!liveWeather) {
    return {
      dataOrigin: 'scenario',
      originLabel: fallbackOriginLabel,
    };
  }

  const backingOrigin: EventDataOrigin =
    liveWeather.status === 'live' ? 'live' : 'snapshot';

  if (ev.id === 'donki_x2_flare') {
    const flare = liveWeather.flares?.[0];
    if (flare) {
      return {
        dataOrigin: backingOrigin,
        originLabel: fallbackOriginLabel,
        realRecordText: `Real record: ${flare.classType} flare · reported ${formatUtcShortDate(flare.peakTime)} · ${flare.id}`,
        realRecordLink: flare.link,
      };
    }
    const cme = liveWeather.cmes?.[0];
    if (cme) {
      return {
        dataOrigin: backingOrigin,
        originLabel: fallbackOriginLabel,
        realRecordText: `Real record: CME${cme.speedKmPerSec ? ` (${cme.speedKmPerSec} km/s)` : ''} · reported ${formatUtcShortDate(cme.startTime)} · ${cme.id}`,
        realRecordLink: cme.link,
      };
    }
  }

  if (ev.id === 'donki_gcr_spike') {
    const sep = liveWeather.sepEvents?.[0];
    if (sep) {
      return {
        dataOrigin: backingOrigin,
        originLabel: fallbackOriginLabel,
        realRecordText: `Real record: SEP proton event · reported ${formatUtcShortDate(sep.eventTime)} · ${sep.id}`,
        realRecordLink: sep.link,
      };
    }
    const storm = liveWeather.storms?.[0];
    if (storm) {
      return {
        dataOrigin: backingOrigin,
        originLabel: fallbackOriginLabel,
        realRecordText: `Real record: Geomagnetic storm (Kp ${storm.maxKp ?? '?'}) · reported ${formatUtcShortDate(storm.startTime)} · ${storm.id}`,
        realRecordLink: storm.link,
      };
    }
  }

  return {
    dataOrigin: ev.dataOrigin ?? 'scenario',
    originLabel: fallbackOriginLabel,
  };
}

export function triggerEndOfSolEvent(
  state: OutpostGameState,
  eventIndexSeed?: number,
  liveWeather?: SpaceWeatherSummary | null,
  nowMs: number = Date.now()
): OutpostGameState {
  if (state.status !== 'active') return state;
  const sitePool = getEventsForSite(state.siteId);
  if (typeof eventIndexSeed === 'number') {
    const idx = Math.abs(eventIndexSeed) % sitePool.length;
    return {
      ...state,
      activeEvent: sitePool[idx],
    };
  }
  const chosen = pickWeightedEvent(sitePool, liveWeather, nowMs, Math.random());
  return {
    ...state,
    activeEvent: chosen,
  };
}

export interface MiniGameResourceDelta {
  powerDelta: number;
  o2Delta: number;
  shieldingDelta: number;
  scienceDelta: number;
}

export function getEventByCode(eventCode: string): SpaceWeatherEvent | undefined {
  return NASA_SPACE_EVENTS.find(
    (ev) => ev.donkiCode === eventCode || ev.id === eventCode
  );
}

export function scaleMiniGameDeltasForState(
  deltas: MiniGameResourceDelta,
  state: Pick<OutpostGameState, 'difficulty' | 'power' | 'lifeSupport' | 'shielding'>
): MiniGameResourceDelta {
  const diff = state.difficulty || 'normal';
  return {
    powerDelta: scaleEventDelta(deltas.powerDelta, diff),
    o2Delta: scaleEventDelta(deltas.o2Delta, diff),
    shieldingDelta: scaleEventDelta(deltas.shieldingDelta, diff),
    scienceDelta: applyLowResourceSciencePenalty(deltas.scienceDelta, state),
  };
}

/**
 * Interpolates between the Partial/Failed state (0.0) and Perfect Execution state (1.0)
 * based on performanceRatio (% of fractures/targets completed) in [0.0, 1.0].
 * For ECLSS-O2-SEAL-404:
 * - Failed/Partial (0.0): -4% Power, -14% O2, -3% Shielding, +10 Science
 * - Perfect Weld (1.0):   -10% Power, -4% O2, -2% Shielding, +25 Science
 * Plus any hull overheat shielding penalty incurred by holding the plasma torch too slow.
 */
export function computeMiniGameEventDeltas(
  eventOrCode: SpaceWeatherEvent | string,
  performanceRatio: number,
  difficulty: DifficultyLevel = 'normal',
  extraShieldPenalty = 0
): MiniGameResourceDelta {
  const ev =
    typeof eventOrCode === 'string'
      ? getEventByCode(eventOrCode) || NASA_SPACE_EVENTS[0]
      : eventOrCode;

  const ratio = Math.max(0, Math.min(1, Number.isFinite(performanceRatio) ? performanceRatio : 0));
  const lerpRound = (startVal: number, endVal: number) =>
    Math.round(startVal + (endVal - startVal) * ratio);

  if (ev.donkiCode === 'ECLSS-O2-SEAL-404' || ev.id === 'hab_oxygen_leakage') {
    const overheatPenalty = Math.max(0, Math.round(extraShieldPenalty));
    return {
      powerDelta: lerpRound(-4, -10),
      o2Delta: lerpRound(-14, -4),
      shieldingDelta: lerpRound(-3, -2) - overheatPenalty,
      scienceDelta: lerpRound(10, 25),
    };
  }

  if (ev.donkiCode === 'DONKI-FLR-2026-X2.4' || ev.id === 'donki_x2_flare') {
    // High Deflection (>80% protons blocked) locks in full High Deflection outcome:
    // -12% Power, -4% O2, +16% Shielding, +30 Science
    // Array Overload / Unshielded (0% blocked, arrays left open):
    // +14% Power, -5% O2, -14% Shielding, +10 Science
    const effectiveRatio = ratio >= 0.8 ? 1.0 : ratio / 0.8;
    const lerpFlare = (unshieldedVal: number, highDeflectVal: number) =>
      Math.round(unshieldedVal + (highDeflectVal - unshieldedVal) * effectiveRatio);

    return {
      powerDelta: lerpFlare(14, -12),
      o2Delta: lerpFlare(-5, -4),
      shieldingDelta: lerpFlare(-14, 16) - Math.max(0, Math.round(extraShieldPenalty)),
      scienceDelta: lerpFlare(10, 30),
    };
  }

  if (ev.donkiCode === 'DONKI-SEP-2026-M8.1' || ev.id === 'donki_gcr_spike') {
    // Water Kept in Hydroponics (0.0 - Low bladder fill, high dose):
    // -4% Power, +16% O2, -12% Shielding, +15 Science
    // Full Overhead Bladder Fill (1.0 - High radiation absorption):
    // -6% Power, -10% O2, +22% Shielding, +25 Science
    return {
      powerDelta: lerpRound(-4, -6),
      o2Delta: lerpRound(16, -10),
      shieldingDelta: lerpRound(-12, 22) - Math.max(0, Math.round(extraShieldPenalty)),
      scienceDelta: lerpRound(15, 25),
    };
  }

  if (ev.donkiCode === 'OSDR-OSD-379-BIO' || ev.id === 'osdr_microbiome_bloom') {
    // Scrubber Clogged (0.0 - Emergency air vent triggered):
    // +10% Power, -10% O2, -3% Shielding, +5 Science
    // Balanced Scrubber & Sterilized Spores (1.0):
    // -10% Power, +18% O2, 0% Shielding, +35 Science
    return {
      powerDelta: lerpRound(10, -10),
      o2Delta: lerpRound(-10, 18),
      shieldingDelta: lerpRound(-3, 0) - Math.max(0, Math.round(extraShieldPenalty)),
      scienceDelta: lerpRound(5, 35),
    };
  }

  if (ev.donkiCode === 'DONKI-QUIET-SUN-SOL' || ev.id === 'nominal_clear_skies') {
    // 100% Maintenance Focus (ratio = 0.0): -5% Power, +16% O2, +16% Shielding, -10 Science
    // 100% Science Focus (ratio = 1.0):     -10% Power, -5% O2, -3% Shielding, +65 Science
    // Hybrid Split (0.0 < ratio < 1.0):     Proportional blend between Maintenance and Science
    return {
      powerDelta: lerpRound(-5, -10),
      o2Delta: lerpRound(16, -5),
      shieldingDelta: lerpRound(16, -3) - Math.max(0, Math.round(extraShieldPenalty)),
      scienceDelta: lerpRound(-10, 65),
    };
  }

  if (ev.donkiCode === 'ARTEMIS-DUST-LEV-09' || ev.id === 'lunar_electrostatic_dust') {
    // Manual Brush Under Arcing Conditions (0.0): -4% Power, -9% O2, -10% Shielding, +20 Science
    // Timed Electrostatic Repeller Pulses (1.0):  -10% Power, -4% O2, -2% Shielding, +30 Science
    return {
      powerDelta: lerpRound(-4, -10),
      o2Delta: lerpRound(-9, -4),
      shieldingDelta: lerpRound(-10, -2) - Math.max(0, Math.round(extraShieldPenalty)),
      scienceDelta: lerpRound(20, 30),
    };
  }

  if (ev.donkiCode === 'LRO-IMPACT-SWARM-12' || ev.id === 'lunar_micrometeoroid_shower') {
    // <40% Impacts Blocked (Hull absorbs hits, ratio <= 0.4):
    // -5% Power, -6% O2, -13% Shielding, +15 Science
    // >80% Impacts Blocked by Active Shutters (ratio >= 0.8):
    // -12% Power, -4% O2, -5% Shielding, +35 Science
    const effectiveRatio =
      ratio <= 0.4 ? 0.0 : ratio >= 0.8 ? 1.0 : (ratio - 0.4) / 0.4;
    const lerpSwarm = (hullHitVal: number, shutterBlockVal: number) =>
      Math.round(hullHitVal + (shutterBlockVal - hullHitVal) * effectiveRatio);

    return {
      powerDelta: lerpSwarm(-5, -12),
      o2Delta: lerpSwarm(-6, -4),
      shieldingDelta: lerpSwarm(-13, -5) - Math.max(0, Math.round(extraShieldPenalty)),
      scienceDelta: lerpSwarm(15, 35),
    };
  }

  if (ev.donkiCode === 'ARTEMIS-LRO-CRATER-89S' || ev.id === 'artemis_shadow_freeze') {
    // EVA Regolith Blanket Strategy (ratio = 0.0): +6% Power, -6% O2, -9% Shielding, +40 Science
    // Heater-Dominant Strategy (ratio = 1.0):      -12% Power, +10% O2, +5% Shielding, +20 Science
    return {
      powerDelta: lerpRound(6, -12),
      o2Delta: lerpRound(-6, 10),
      shieldingDelta: lerpRound(-9, 5) - Math.max(0, Math.round(extraShieldPenalty)),
      scienceDelta: lerpRound(40, 20),
    };
  }

  if (ev.donkiCode === 'MARS-MEDA-DUST-88' || ev.id === 'mars_global_dust_storm') {
    // Habitat Throttled / Reserve O2 Used (ratio = 0.0):
    // -7% Power, -11% O2, -4% Shielding, +15 Science
    // Filters Purged via Compressors (ratio = 1.0):
    // -12% Power, -4% O2, -2% Shielding, +30 Science
    return {
      powerDelta: lerpRound(-7, -12),
      o2Delta: lerpRound(-11, -4),
      shieldingDelta: lerpRound(-4, -2) - Math.max(0, Math.round(extraShieldPenalty)),
      scienceDelta: lerpRound(15, 30),
    };
  }

  if (ev.donkiCode === 'MARS-JEZERO-FROST-19' || ev.id === 'mars_co2_frost_vortex') {
    // Manual Frost Chipping & Vent Sealing (ratio = 0.0):
    // -5% Power, -9% O2, -8% Shielding, +20 Science
    // Thermal Coil De-Icing (ratio = 1.0):
    // -11% Power, -5% O2, -2% Shielding, +25 Science
    return {
      powerDelta: lerpRound(-5, -11),
      o2Delta: lerpRound(-9, -5),
      shieldingDelta: lerpRound(-8, -2) - Math.max(0, Math.round(extraShieldPenalty)),
      scienceDelta: lerpRound(20, 25),
    };
  }

  const c0 = ev.choices[0];
  const c1 = ev.choices[1];

  // Failure Floor (0.0): worse outcome between the two static choices, scaled by difficulty
  const floorPower = scaleEventDelta(Math.min(c0.powerDelta, c1.powerDelta), difficulty);
  const floorO2 = scaleEventDelta(Math.min(c0.lifeSupportDelta, c1.lifeSupportDelta), difficulty);
  const floorShield = scaleEventDelta(Math.min(c0.shieldingDelta, c1.shieldingDelta), difficulty);
  const floorScience = Math.min(c0.scienceDelta, c1.scienceDelta);

  // Success Ceiling (1.0): best outcome between the two static choices + Perfect Execution Mastery Bonus
  const ceilPower = scaleEventDelta(Math.max(c0.powerDelta, c1.powerDelta), difficulty) + 6;
  const ceilO2 = scaleEventDelta(Math.max(c0.lifeSupportDelta, c1.lifeSupportDelta), difficulty) + 6;
  const ceilShield = scaleEventDelta(Math.max(c0.shieldingDelta, c1.shieldingDelta), difficulty) + 6;
  const ceilScience = Math.max(c0.scienceDelta, c1.scienceDelta) + 15;

  return {
    powerDelta: lerpRound(floorPower, ceilPower),
    o2Delta: lerpRound(floorO2, ceilO2),
    shieldingDelta: lerpRound(floorShield, ceilShield) - Math.max(0, Math.round(extraShieldPenalty)),
    scienceDelta: lerpRound(floorScience, ceilScience),
  };
}

export function resolveActiveEventWithMiniGame(
  state: OutpostGameState,
  performanceRatio: number,
  overrideDeltas?: MiniGameResourceDelta
): OutpostGameState {
  if (state.status !== 'active' || !state.activeEvent) return state;

  const clampedRatio = Math.max(0, Math.min(1, performanceRatio));
  const diff = state.difficulty || 'normal';
  const rawDeltas =
    overrideDeltas || computeMiniGameEventDeltas(state.activeEvent, clampedRatio, diff);
  const deltas = scaleMiniGameDeltasForState(rawDeltas, state);

  const netPower = clampResource(state.power + deltas.powerDelta);
  const netLife = clampResource(state.lifeSupport + deltas.o2Delta);
  const netShield = clampResource(state.shielding + deltas.shieldingDelta);
  const netScience = Math.max(
    0,
    Math.min(10000, state.scienceScore + deltas.scienceDelta)
  );

  const pct = Math.round(clampedRatio * 100);
  const gradeLabel =
    clampedRatio >= 0.85
      ? 'PERFECT EXECUTION'
      : clampedRatio >= 0.5
      ? 'NOMINAL CONTAINMENT'
      : 'CRITICAL FAILURE';

  const penaltyTag =
    rawDeltas.scienceDelta > 0 && hasLowResourcePenalty(state)
      ? ' [LOW-RES -50% SCI]'
      : '';

  const updated: OutpostGameState = {
    ...state,
    power: netPower,
    lifeSupport: netLife,
    shielding: netShield,
    scienceScore: netScience,
    activeEvent: null,
    historyLog: [
      `${getTimeUnit(state.siteId)} ${state.sol} Mini-Game [${state.activeEvent.donkiCode}] ${gradeLabel} (${pct}%): ${deltas.powerDelta >= 0 ? '+' : ''}${deltas.powerDelta}% PWR, ${deltas.o2Delta >= 0 ? '+' : ''}${deltas.o2Delta}% O2, ${deltas.shieldingDelta >= 0 ? '+' : ''}${deltas.shieldingDelta}% SHD, ${deltas.scienceDelta >= 0 ? '+' : ''}${deltas.scienceDelta} SCI${penaltyTag}`,
      ...state.historyLog.slice(0, 14),
    ],
  };

  if (netPower <= 0 || netLife <= 0 || netShield <= 0) {
    const failedCheck = checkSurvivalStatus(updated);
    return {
      ...updated,
      status: 'failed',
      failureReason: failedCheck.failureReason,
    };
  }

  return updated;
}

// Resolves the live top-right random event during the Sol without advancing to the next Sol
export function resolveActiveEventOnly(
  state: OutpostGameState,
  choiceIndex: 0 | 1
): OutpostGameState {
  if (state.status !== 'active' || !state.activeEvent) return state;

  const choice = state.activeEvent.choices[choiceIndex];
  const diff = state.difficulty || 'normal';

  const scaledPowerDelta = scaleEventDelta(choice.powerDelta, diff);
  const scaledLifeDelta = scaleEventDelta(choice.lifeSupportDelta, diff);
  const scaledShieldDelta = scaleEventDelta(choice.shieldingDelta, diff);
  const scaledScienceDelta = applyLowResourceSciencePenalty(choice.scienceDelta, state);

  const netPower = clampResource(state.power + scaledPowerDelta);
  const netLife = clampResource(state.lifeSupport + scaledLifeDelta);
  const netShield = clampResource(state.shielding + scaledShieldDelta);
  const netScience = Math.max(
    0,
    Math.min(10000, state.scienceScore + scaledScienceDelta)
  );

  const updated: OutpostGameState = {
    ...state,
    power: netPower,
    lifeSupport: netLife,
    shielding: netShield,
    scienceScore: netScience,
    activeEvent: null,
    historyLog: [
      `${getTimeUnit(state.siteId)} ${state.sol} Alert [${state.activeEvent.donkiCode}]: ${choice.consequenceText}`,
      ...state.historyLog.slice(0, 14),
    ],
  };

  if (netPower <= 0 || netLife <= 0 || netShield <= 0) {
    const failedCheck = checkSurvivalStatus(updated);
    return {
      ...updated,
      status: 'failed',
      failureReason: failedCheck.failureReason,
    };
  }

  return updated;
}

// Advances to the next Sol directly (applies overnight drain and checks minimum NASA Science Point requirement on Sol 10)
export function advanceSolOvernight(state: OutpostGameState): OutpostGameState {
  if (state.status !== 'active') return state;

  // If an active event was still open in the top-right corner when ending the Sol, resolve Option 2 first
  const workingState = state.activeEvent ? resolveActiveEventOnly(state, 1) : state;
  if (workingState.status === 'failed') return workingState;

  const site = MISSION_SITES[workingState.siteId];
  const diffCfg = DIFFICULTY_CONFIGS[workingState.difficulty || 'normal'];

  const overnightPowerDrain = Math.round(site.dailyPowerDrain * diffCfg.drainMultiplier);
  const overnightLifeDrain = Math.round(site.dailyLifeSupportDrain * diffCfg.drainMultiplier);
  const overnightShieldDecay = Math.round(site.dailyShieldingDecay * diffCfg.drainMultiplier);

  const netPower = clampResource(workingState.power - overnightPowerDrain);
  const netLife = clampResource(workingState.lifeSupport - overnightLifeDrain);
  const netShield = clampResource(workingState.shielding - overnightShieldDecay);
  const netScience = Math.max(0, Math.min(10000, workingState.scienceScore + 20));

  const tempState: OutpostGameState = {
    ...workingState,
    power: netPower,
    lifeSupport: netLife,
    shielding: netShield,
    scienceScore: netScience,
    activeEvent: null,
    actionsTakenThisSol: 0,
    historyLog: [
      `${getTimeUnit(workingState.siteId)} ${workingState.sol} Overnight (${diffCfg.label}): -${overnightPowerDrain}% PWR, -${overnightLifeDrain}% O2, -${overnightShieldDecay}% SHD, +20 Telemetry SCI.`,
      ...workingState.historyLog.slice(0, 14),
    ],
  };

  if (netPower <= 0 || netLife <= 0 || netShield <= 0) {
    const failedCheck = checkSurvivalStatus(tempState);
    return {
      ...tempState,
      status: 'failed',
      failureReason: failedCheck.failureReason,
    };
  }

  if (workingState.sol >= workingState.maxSols) {
    const reqSci =
      tempState.minScienceToWin ??
      DIFFICULTY_CONFIGS[tempState.difficulty || 'normal'].minScienceToWin;
    if (tempState.scienceScore < reqSci) {
      return {
        ...tempState,
        status: 'failed',
        failureReason: `Crew survived ${getTimeUnit(tempState.siteId)} 10, but NASA Science Points (${tempState.scienceScore} PTS) fell short of the ${reqSci} PTS mission requirement! Next run, trade extra power & oxygen margin at the OSDR Rover Science Lab (+95 SCI) to meet your NASA research goal!`,
      };
    }
    return {
      ...tempState,
      status: 'victory',
      failureReason: null,
    };
  }

  return {
    ...tempState,
    sol: workingState.sol + 1,
  };
}

export function resolveEventAndAdvanceSol(
  state: OutpostGameState,
  choiceIndex: 0 | 1
): OutpostGameState {
  if (state.status !== 'active' || !state.activeEvent) return state;

  const afterEvent = resolveActiveEventOnly(state, choiceIndex);
  if (afterEvent.status === 'failed') return afterEvent;

  return advanceSolOvernight(afterEvent);
}

// Deterministic fallback engineering trade-off calculator when live AI is unavailable or for instant analysis
export function computeDeterministicMissionAdvice(state: OutpostGameState): string {
  const lowest = Math.min(state.power, state.lifeSupport, state.shielding);
  const site = MISSION_SITES[state.siteId];
  const diffCfg = DIFFICULTY_CONFIGS[state.difficulty || 'normal'];
  const pwrDrain = Math.round(site.dailyPowerDrain * diffCfg.drainMultiplier);
  const o2Drain = Math.round(site.dailyLifeSupportDrain * diffCfg.drainMultiplier);
  const solarDeltas = getStationActionDeltas(state, 'solar_array');
  const hydroDeltas = getStationActionDeltas(state, 'hydroponics_dome');
  const shieldDeltas = getStationActionDeltas(state, 'rad_shield_core');

  if (lowest === state.power) {
    return `• PRIORITY ALERT (Power at ${state.power}%): On ${site.name} (${diffCfg.label}), overnight heaters drain ${pwrDrain}% Power every night. Visit the Solar & Kilopower Array first (+${solarDeltas.powerDelta}% Power), even though the spacewalk costs ${solarDeltas.lifeSupportDelta}% O2 and ${solarDeltas.shieldingDelta}% Shielding.\n• TRADE-OFF MATH: Avoid running the Hydroponics LED lamps (${hydroDeltas.powerDelta}% Power) until your batteries are above 60%, and keep all survival resources >=25% to avoid the -50% Low-Resource Science Penalty.\n• SPACE SCIENCE TIP: Astronauts schedule heavy lab research only during peak solar charging windows!`;
  }
  if (lowest === state.lifeSupport) {
    return `• PRIORITY ALERT (Life Support at ${state.lifeSupport}%): Crew oxygen and hydroponic food are your lowest margin (overnight consumption is -${o2Drain}%). Watch out for Emergency Oxygen Leakage events and visit the Hydroponics & O2 Greenhouse (+${hydroDeltas.lifeSupportDelta}% Life Support) right away.\n• TRADE-OFF MATH: Running the greenhouse LED grow lights will cost ${hydroDeltas.powerDelta}% Power, so pair your second shift with either the Solar Array or Low-Power Storm Huddle.\n• LIFE SUPPORT TIP: Plants recycle exhaled CO2 into breathable O2, but require steady electrical energy!`;
  }
  return `• PRIORITY ALERT (Radiation Shielding at ${state.shielding}%): Unshielded surface dose at ${site.name} is roughly ${site.ambientRadiationMsvPerDay} mSv/day. Visit the Regolith & Water-Wall Shield Core (+${shieldDeltas.shieldingDelta}% Shielding) before a solar flare strikes!\n• TRADE-OFF MATH: Pumping water into shelter walls costs ${shieldDeltas.powerDelta}% Power and ${shieldDeltas.lifeSupportDelta}% Life Support water, so keep your O2 above 50%.\n• RADIATION TIP: Hydrogen atoms in water and lunar regolith bricks stop solar protons far better than thin metal walls!`;
}

// ============================================================================
// NASA & PARTNER SOURCE PARAMETERS (RadLab, DONKI Red-Alert, OSDR Atrophy)
// ============================================================================

/**
 * 1. ABSORBED DOSE RATE — RadLab (OSDR Radiation Dosimetry Database)
 * Real radiation exposure measurements recorded by ISS & planetary dosimetry instruments.
 */
export const RADLAB_INSTRUMENT_RECORDS: RadLabInstrumentRecord[] = [
  {
    detectorId: 'ISS-COLUMBUS-DOSTEL-1',
    instrumentName: 'DOSTEL-1 (Dosimetry Telescope, ISS Columbus Module)',
    location: 'Low Earth Orbit (ISS ~408 km, 51.6° incl.)',
    absorbedDoseRateMicroGyPerHour: 11.4,
    dailyEquivalentMsv: 0.52,
    solarActivityState: 'Quiet',
    recordedWindow: 'ISS Expedition Dosimetry Baseline (RadLab)',
    sourceUrl: 'https://osdr.nasa.gov/bio/repo/data/payloads',
  },
  {
    detectorId: 'ISS-USLAB-TEPC-2',
    instrumentName: 'TEPC (Tissue Equivalent Proportional Counter, ISS Destiny Lab)',
    location: 'Low Earth Orbit (SAA Pass & High-Latitude Orbit)',
    absorbedDoseRateMicroGyPerHour: 18.8,
    dailyEquivalentMsv: 0.78,
    solarActivityState: 'Busy',
    recordedWindow: 'South Atlantic Anomaly & M-Class Solar Pass (RadLab)',
    sourceUrl: 'https://osdr.nasa.gov/bio/repo/data/payloads',
  },
  {
    detectorId: 'ISS-ZVEZDA-ALTEA-SPE',
    instrumentName: 'ALTEA / RadLab Active Dosimeter (Solar Particle Event Peak)',
    location: 'Orbital Storm Shelter / High-Flux Pass',
    absorbedDoseRateMicroGyPerHour: 64.5,
    dailyEquivalentMsv: 2.85,
    solarActivityState: 'Stormy',
    recordedWindow: 'Solar Energetic Particle (SEP) Flux Window (RadLab)',
    sourceUrl: 'https://osdr.nasa.gov/bio/repo/data/payloads',
  },
];

export interface ShieldingMaterialSpec {
  id: ShieldingMaterialId;
  name: string;
  arealDensityGPerCm2: number;
  doseAttenuationFactor: number; // Multiplier on absorbed dose rate (lower = better protection)
  suitMobilityPenaltyPct: number;
  scientificNote: string;
}

export const SHIELDING_MATERIALS: Record<ShieldingMaterialId, ShieldingMaterialSpec> = {
  bare_aluminum: {
    id: 'bare_aluminum',
    name: 'Standard Aluminum Hull (Al-2219)',
    arealDensityGPerCm2: 5,
    doseAttenuationFactor: 1.0,
    suitMobilityPenaltyPct: 0,
    scientificNote:
      'Baseline metallic skin; heavy nuclei can produce secondary Bremsstrahlung/neutron scatter in bare metal.',
  },
  polyethylene_liner: {
    id: 'polyethylene_liner',
    name: 'HDPE Hydrogen-Rich Polyethylene Liner',
    arealDensityGPerCm2: 15,
    doseAttenuationFactor: 0.68,
    suitMobilityPenaltyPct: 5,
    scientificNote:
      'High hydrogen content in polyethylene absorbs galactic cosmic ray (GCR) ions and solar protons with minimal secondary scatter.',
  },
  water_wall: {
    id: 'water_wall',
    name: 'Potable Water-Wall Shelter Bags',
    arealDensityGPerCm2: 25,
    doseAttenuationFactor: 0.45,
    suitMobilityPenaltyPct: 12,
    scientificNote:
      'Dual-use ECLSS drinking/hydroponic water bags stacked around crew quarters cut absorbed dose rate by more than half.',
  },
  sintered_regolith: {
    id: 'sintered_regolith',
    name: 'Sintered Regolith Overburden + Water Core',
    arealDensityGPerCm2: 50,
    doseAttenuationFactor: 0.24,
    suitMobilityPenaltyPct: 20,
    scientificNote:
      'Thick planetary regolith bricks combined with an inner hydrogen water bladder provide deep storm-shelter protection.',
  },
};

export interface EvaRadiationPlanResult {
  detectorId: string;
  materialId: ShieldingMaterialId;
  evaHours: number;
  effectiveDoseRateMicroGyPerHour: number;
  accumulatedDoseMsv: number;
  dailyOperationalLimitMsv: number;
  exposureGaugePct: number;
  requiresShelterCycle: boolean;
  powerDelta: number;
  lifeSupportDelta: number;
  shieldingDelta: number;
  scienceDelta: number;
  statusSummary: string;
}

export function computeEvaRadiationPlan(
  detectorId: string,
  materialId: ShieldingMaterialId,
  evaHours: number,
  siteId: SiteId = 'artemis_shackleton'
): EvaRadiationPlanResult {
  const detector =
    RADLAB_INSTRUMENT_RECORDS.find((d) => d.detectorId === detectorId) ||
    RADLAB_INSTRUMENT_RECORDS[0];
  const material = SHIELDING_MATERIALS[materialId] || SHIELDING_MATERIALS.polyethylene_liner;
  const clampedHours = Math.max(0.5, Math.min(8, Number.isFinite(evaHours) ? evaHours : 2));
  const siteMultiplier = siteId === 'artemis_shackleton' ? 1.25 : 0.92;

  const effectiveDoseRateMicroGyPerHour =
    Math.round(
      detector.absorbedDoseRateMicroGyPerHour *
        material.doseAttenuationFactor *
        siteMultiplier *
        100
    ) / 100;

  // Quality factor Q ~ 2.1 for mixed proton/GCR space radiation field converting mGy to mSv
  const evaDoseMsv = (effectiveDoseRateMicroGyPerHour * clampedHours * 2.1) / 1000;
  const habitatHours = Math.max(0, 24 - clampedHours);
  const habitatDoseMsv =
    ((detector.absorbedDoseRateMicroGyPerHour * 0.28 * habitatHours * 1.8) / 1000);

  const accumulatedDoseMsv = Math.round((evaDoseMsv + habitatDoseMsv) * 1000) / 1000;
  const dailyOperationalLimitMsv = 1.5; // Operational daily threshold before storm shelter cycling
  const exposureGaugePct = Math.max(
    0,
    Math.min(100, Math.round((accumulatedDoseMsv / dailyOperationalLimitMsv) * 100))
  );
  const requiresShelterCycle = exposureGaugePct >= 75;

  const shieldingBonus = Math.round((1 - material.doseAttenuationFactor) * 26);
  const evaDosePenalty = requiresShelterCycle ? -12 : -Math.round(clampedHours * 1.5);

  const powerDelta = materialId === 'sintered_regolith' || materialId === 'water_wall' ? -8 : -4;
  const lifeSupportDelta = -Math.max(2, Math.round(clampedHours * 1.8));
  const shieldingDelta = shieldingBonus + evaDosePenalty;
  const scienceDelta = requiresShelterCycle
    ? Math.round(clampedHours * 6)
    : Math.round(clampedHours * 11);

  const statusSummary = requiresShelterCycle
    ? `SHELTER CYCLE REQUIRED (${exposureGaugePct}% of daily limit): High RadLab dose rate (${effectiveDoseRateMicroGyPerHour} μGy/hr). Cycle crew into reinforced shelter!`
    : `SAFE EVA WINDOW (${exposureGaugePct}% of daily limit): ${accumulatedDoseMsv.toFixed(2)} mSv total dose with ${material.name}.`;

  return {
    detectorId: detector.detectorId,
    materialId: material.id,
    evaHours: clampedHours,
    effectiveDoseRateMicroGyPerHour,
    accumulatedDoseMsv,
    dailyOperationalLimitMsv,
    exposureGaugePct,
    requiresShelterCycle,
    powerDelta,
    lifeSupportDelta,
    shieldingDelta,
    scienceDelta,
    statusSummary,
  };
}

/**
 * 2. SOLAR FLARE & CME ALERTS — Space Weather Emergency Alert System (DONKI)
 * Tactical red-alert procedures: securing external antenna arrays or retreating to safe modules.
 */
export type DonkiTacticalActionId =
  | 'secure_antenna_arrays'
  | 'retreat_safe_module'
  | 'ride_out_flux';

export interface DonkiRedAlertOutcome {
  actionId: DonkiTacticalActionId;
  actionTitle: string;
  commDropoutPrevented: boolean;
  crewFluxProtected: boolean;
  powerDelta: number;
  lifeSupportDelta: number;
  shieldingDelta: number;
  scienceDelta: number;
  summaryText: string;
}

export function evaluateDonkiTacticalAction(
  actionId: DonkiTacticalActionId,
  flareClass = 'M1.7',
  cmeSpeedKmPerSec = 474
): DonkiRedAlertOutcome {
  const isSevere =
    flareClass.toUpperCase().startsWith('X') || (cmeSpeedKmPerSec ?? 0) >= 700;

  if (actionId === 'secure_antenna_arrays') {
    return {
      actionId,
      actionTitle: 'Gimbal & Stow External High-Gain Antenna Arrays',
      commDropoutPrevented: true,
      crewFluxProtected: false,
      powerDelta: isSevere ? -9 : -6,
      lifeSupportDelta: -3,
      shieldingDelta: isSevere ? 8 : 10,
      scienceDelta: 28,
      summaryText: `Secured external Ka-band antennas before ${flareClass} flare / ${cmeSpeedKmPerSec} km/s CME impact—prevented telemetry communication dropout (+28 SCI)!`,
    };
  }

  if (actionId === 'retreat_safe_module') {
    return {
      actionId,
      actionTitle: 'Retreat Crew to Inner Water-Wall Safe Module during Peak Flux',
      commDropoutPrevented: true,
      crewFluxProtected: true,
      powerDelta: -5,
      lifeSupportDelta: 6,
      shieldingDelta: isSevere ? 20 : 16,
      scienceDelta: 12,
      summaryText: `Crew retreated to heavily shielded inner storm bunk during peak solar proton flux (+${isSevere ? 20 : 16}% Shielding, safe dose maintained)!`,
    };
  }

  return {
    actionId: 'ride_out_flux',
    actionTitle: 'Maintain Open Telemetry Dish & Unshielded Operations',
    commDropoutPrevented: false,
    crewFluxProtected: false,
    powerDelta: 8,
    lifeSupportDelta: -6,
    shieldingDelta: isSevere ? -18 : -12,
    scienceDelta: -10,
    summaryText: `WARNING: Unprotected external arrays suffered ionosphere/plasma communication dropouts and elevated crew radiation dose!`,
  };
}

/**
 * 3. BONE DENSITY AND MUSCLE MASS LOSS RATES — NASA OSDR
 * Crew Conditioning & Countermeasure Scheduler balancing resistive exercise, sleep, and bio-regenerative nutrition.
 */
export const OSDR_MUSCULOSKELETAL_STUDIES: OsdrMusculoskeletalStudyRecord[] = [
  {
    studyId: 'OSD-488',
    title: 'OSDR Spaceflight Soleus & Gastrocnemius Muscle Atrophy and Resistive Countermeasure Profile',
    unmitigatedBoneDensityLossPctPerMonth: 1.4,
    unmitigatedMuscleMassLossPctPerMonth: 3.2,
    recommendedResistiveMinPerDay: 90,
    recommendedSleepHoursPerDay: 8.0,
    sourceUrl: 'https://osdr.nasa.gov/bio/repo/search?q=bone+density+muscle+atrophy',
  },
  {
    studyId: 'OSD-379',
    title: 'OSDR Microgravity Trabecular Bone Mineral Density & Bio-Regenerative Nutritional Countermeasures',
    unmitigatedBoneDensityLossPctPerMonth: 1.2,
    unmitigatedMuscleMassLossPctPerMonth: 2.8,
    recommendedResistiveMinPerDay: 75,
    recommendedSleepHoursPerDay: 8.0,
    sourceUrl: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-379',
  },
];

export interface CountermeasureScheduleInput {
  resistiveExerciseMin: number; // 0 to 120 min/day (ARED resistive device)
  sleepHours: number; // 4 to 10 hrs/day
  bioRegenNutritionPct: number; // 25 to 100% (Veggie leafy greens + vitamin D/calcium ration)
  gravityG?: number; // 0.166g Moon, 0.38g Mars
}

export interface CountermeasureEvaluationResult {
  boneDensityChangePctPerMonth: number; // 0 or negative %/mo
  muscleMassChangePctPerMonth: number; // 0 or negative %/mo
  crewStaminaScore: number; // 0 to 100%
  missionPerformanceMultiplier: number; // 0.65 to 1.20
  atrophyRiskLevel: 'OPTIMAL' | 'MODERATE_ATROPHY' | 'SEVERE_ATROPHY';
  powerDelta: number;
  lifeSupportDelta: number;
  shieldingDelta: number;
  scienceDelta: number;
  scientificSummary: string;
}

export function evaluateCountermeasureSchedule(
  input: CountermeasureScheduleInput
): CountermeasureEvaluationResult {
  const exMin = Math.max(0, Math.min(120, Number.isFinite(input.resistiveExerciseMin) ? input.resistiveExerciseMin : 60));
  const sleepHrs = Math.max(4, Math.min(10, Number.isFinite(input.sleepHours) ? input.sleepHours : 8));
  const nutPct = Math.max(25, Math.min(100, Number.isFinite(input.bioRegenNutritionPct) ? input.bioRegenNutritionPct : 80));
  const gravityG = input.gravityG ?? 0.166;

  // Baseline unmitigated loss scaled slightly by partial gravity vs microgravity
  const gravityFactor = gravityG < 0.25 ? 0.92 : 0.78;
  const baseBoneLoss = 1.45 * gravityFactor; // ~1.33%/mo on Moon, ~1.13%/mo on Mars unmitigated
  const baseMuscleLoss = 3.2 * gravityFactor; // ~2.94%/mo on Moon, ~2.50%/mo on Mars unmitigated

  const exerciseMitigation = Math.min(1.0, exMin / 90);
  const sleepMitigation = Math.min(1.0, Math.max(0.2, (sleepHrs - 4) / 4));
  const nutritionMitigation = Math.min(1.0, nutPct / 90);

  const combinedProtection =
    exerciseMitigation * 0.55 + nutritionMitigation * 0.25 + sleepMitigation * 0.2;

  const boneDensityChangePctPerMonth =
    -Math.round(Math.max(0.05, baseBoneLoss * (1 - combinedProtection * 0.92)) * 100) / 100;
  const muscleMassChangePctPerMonth =
    -Math.round(Math.max(0.08, baseMuscleLoss * (1 - combinedProtection * 0.94)) * 100) / 100;

  const crewStaminaScore = Math.max(
    10,
    Math.min(100, Math.round(combinedProtection * 100))
  );

  const missionPerformanceMultiplier =
    Math.round((0.65 + (crewStaminaScore / 100) * 0.55) * 100) / 100;

  const atrophyRiskLevel =
    crewStaminaScore >= 78
      ? 'OPTIMAL'
      : crewStaminaScore >= 52
      ? 'MODERATE_ATROPHY'
      : 'SEVERE_ATROPHY';

  // Resource impacts of the daily conditioning routine
  const powerDelta = -Math.round((exMin / 30) * 2 + (nutPct / 50) * 2);
  const lifeSupportDelta =
    crewStaminaScore >= 75 ? 10 : crewStaminaScore >= 50 ? 2 : -8;
  const shieldingDelta = sleepHrs >= 7.5 ? 4 : -2;
  const scienceDelta =
    atrophyRiskLevel === 'OPTIMAL'
      ? 30
      : atrophyRiskLevel === 'MODERATE_ATROPHY'
      ? 12
      : -12;

  const scientificSummary =
    atrophyRiskLevel === 'OPTIMAL'
      ? `OPTIMAL CONDITIONING (${crewStaminaScore}% Stamina): ARED resistive loading (${exMin}m), ${sleepHrs}h circadian sleep, and ${nutPct}% bio-regenerative diet limit bone loss to ${boneDensityChangePctPerMonth}%/mo and boost Science output (${missionPerformanceMultiplier}x).`
      : atrophyRiskLevel === 'MODERATE_ATROPHY'
      ? `MODERATE ATROPHY (${crewStaminaScore}% Stamina): Bone mineral density is dropping at ${boneDensityChangePctPerMonth}%/mo and muscle mass at ${muscleMassChangePctPerMonth}%/mo. Increase resistive exercise toward 90 min/day.`
      : `CRITICAL BIOLOGICAL ATROPHY (${crewStaminaScore}% Stamina): Neglected countermeasures cause rapid bone loss (${boneDensityChangePctPerMonth}%/mo) and muscle atrophy (${muscleMassChangePctPerMonth}%/mo), degrading crew stamina and mission performance (${missionPerformanceMultiplier}x)!`;

  return {
    boneDensityChangePctPerMonth,
    muscleMassChangePctPerMonth,
    crewStaminaScore,
    missionPerformanceMultiplier,
    atrophyRiskLevel,
    powerDelta,
    lifeSupportDelta,
    shieldingDelta,
    scienceDelta,
    scientificSummary,
  };
}

/**
 * Applies any Trainee Telemetry Lab protocol (RadLab EVA Plan, DONKI Red-Alert, or OSDR Conditioning)
 * directly to the live OutpostGameState so trainee actions update core mission resources and logs.
 */
export function applyTraineeProtocolToState(
  state: OutpostGameState,
  protocolLabel: string,
  deltas: {
    powerDelta: number;
    lifeSupportDelta: number;
    shieldingDelta: number;
    scienceDelta: number;
  }
): OutpostGameState {
  if (state.status !== 'active') return state;

  const nextPower = clampResource(state.power + deltas.powerDelta);
  const nextLife = clampResource(state.lifeSupport + deltas.lifeSupportDelta);
  const nextShield = clampResource(state.shielding + deltas.shieldingDelta);
  const scaledSci = applyLowResourceSciencePenalty(deltas.scienceDelta, state);
  const nextScience = Math.max(0, Math.min(10000, state.scienceScore + scaledSci));

  const updated: OutpostGameState = {
    ...state,
    power: nextPower,
    lifeSupport: nextLife,
    shielding: nextShield,
    scienceScore: nextScience,
    historyLog: [
      `${getTimeUnit(state.siteId)} ${state.sol} [${protocolLabel}]: ${deltas.powerDelta >= 0 ? '+' : ''}${deltas.powerDelta}% PWR, ${deltas.lifeSupportDelta >= 0 ? '+' : ''}${deltas.lifeSupportDelta}% O2, ${deltas.shieldingDelta >= 0 ? '+' : ''}${deltas.shieldingDelta}% SHD, ${scaledSci >= 0 ? '+' : ''}${scaledSci} SCI`,
      ...state.historyLog.slice(0, 14),
    ],
  };

  if (nextPower <= 0 || nextLife <= 0 || nextShield <= 0) {
    const check = checkSurvivalStatus(updated);
    return {
      ...updated,
      status: 'failed',
      failureReason: check.failureReason,
    };
  }

  return updated;
}

/**
 * Builds the combined JSON payload combining DONKI, RadLab Dosimetry, and OSDR Musculoskeletal feeds
 * for the Trainee Dashboard & API endpoint (/api/trainee-telemetry).
 */
export function buildTraineeCombinedFeedPayload(
  liveWeather: SpaceWeatherSummary | null | undefined,
  nowMs: number = Date.now()
): TraineeCombinedFeedPayload {
  const latestFlare = liveWeather?.flares?.[0] || null;
  const latestCme = liveWeather?.cmes?.[0] || null;
  const latestStorm = liveWeather?.storms?.[0] || null;

  const isXFlare = Boolean(latestFlare?.classType?.toUpperCase().startsWith('X'));
  const isMFlare = Boolean(latestFlare?.classType?.toUpperCase().startsWith('M'));
  const isFastCme = Boolean((latestCme?.speedKmPerSec ?? 0) >= 600);
  const isStorm = Boolean((latestStorm?.maxKp ?? 0) >= 5);

  const sunMood = isXFlare || isStorm ? 'Stormy' : isMFlare || isFastCme ? 'Busy' : 'Quiet';
  const activeAlertLevel =
    sunMood === 'Stormy' ? 'RED_ALERT' : sunMood === 'Busy' ? 'ELEVATED' : 'NOMINAL';

  return {
    schemaVersion: '1.0.0-NASA-OSDR-RADLAB-DONKI',
    generatedAt: new Date(nowMs).toISOString(),
    parameters: {
      absorbedDoseRate: {
        parameterName: 'Absorbed Dose Rate',
        sourceDataset: 'RadLab (OSDR Radiation Dosimetry Database)',
        safeMissionDoseLimitMsv: 600,
        dailyOperationalSafeLimitMsv: 1.5,
        issInstruments: RADLAB_INSTRUMENT_RECORDS,
      },
      solarFlareAndCmeAlerts: {
        parameterName: 'Solar Flare & Coronal Mass Ejection (CME) Alerts',
        sourceDataset:
          'Space Weather Database of Notifications, Knowledge, Information (DONKI)',
        sunMood,
        activeAlertLevel,
        latestFlare,
        latestCme,
        latestStorm,
      },
      boneAndMuscleLossRates: {
        parameterName: 'Bone Density and Muscle Mass Loss Rates',
        sourceDataset: 'NASA Open Science Data Repository (OSDR)',
        referenceStudies: OSDR_MUSCULOSKELETAL_STUDIES,
      },
    },
  };
}

// ============================================================================
// POST-GAME PERFORMANCE RANKING SYSTEM
// Tiers: IRON, BRONZE, SILVER, GOLD, PLATINUM, DIAMOND
// ============================================================================

export type MissionRankTier =
  | 'IRON'
  | 'BRONZE'
  | 'SILVER'
  | 'GOLD'
  | 'PLATINUM'
  | 'DIAMOND';

export const MISSION_RANK_ORDER: readonly MissionRankTier[] = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'DIAMOND',
] as const;

export interface MissionRankInput {
  status: 'victory' | 'failed';
  sol: number;
  maxSols?: number;
  scienceScore: number;
  minScienceToWin?: number;
  power: number;
  lifeSupport: number;
  shielding: number;
  difficulty?: DifficultyLevel;
}

export interface MissionRankEvaluation {
  rank: MissionRankTier;
  title: string;
  performanceScore: number; // 0 to 100
  nextRank: MissionRankTier | null;
  nextRankHint: string;
}

export function computeMissionRank(input: MissionRankInput): MissionRankEvaluation {
  const maxSols = Math.max(1, input.maxSols ?? 10);
  const minSci = Math.max(1, input.minScienceToWin ?? 600);
  const clampedSol = Math.max(1, Math.min(maxSols, input.sol));
  const pwr = clampResource(input.power);
  const o2 = clampResource(input.lifeSupport);
  const shd = clampResource(input.shielding);

  // 1. Survival progression (0 - 35 pts)
  const survivalRatio = input.status === 'victory' ? 1 : clampedSol / maxSols;
  const survivalPts = survivalRatio * 35;

  // 2. Science output relative to mission target (0 - 35 pts; 100% of goal = 26 pts, 135%+ of goal = 35 pts)
  const sciRatio = Math.max(0, Math.min(1.35, input.scienceScore / minSci));
  const sciencePts = Math.min(35, (sciRatio / 1.35) * 35);

  // 3. Final habitat resource reserves & lowest-margin stability (0 - 30 pts)
  const avgRes = (pwr + o2 + shd) / 3;
  const minRes = Math.min(pwr, o2, shd);
  const resourcePts = (avgRes / 100) * 20 + (minRes / 100) * 10;

  // 4. Optional difficulty bonus
  const diffBonus =
    input.difficulty === 'hard' ? 5 : input.difficulty === 'normal' ? 2 : 0;

  const rawScore = Math.round(survivalPts + sciencePts + resourcePts + diffBonus);
  const performanceScore = Math.max(0, Math.min(100, rawScore));

  let rank: MissionRankTier;

  if (input.status === 'failed') {
    if (performanceScore >= 55 && clampedSol >= 7) {
      rank = 'SILVER';
    } else if (performanceScore >= 35 || clampedSol >= 4) {
      rank = 'BRONZE';
    } else {
      rank = 'IRON';
    }
  } else {
    // Victory: completed all Sols/Days and achieved NASA Science Goal
    if (performanceScore >= 85 && minRes >= 45) {
      rank = 'DIAMOND';
    } else if (performanceScore >= 74 && minRes >= 25) {
      rank = 'PLATINUM';
    } else {
      rank = 'GOLD';
    }
  }

  const metadata: Record<
    MissionRankTier,
    { title: string; nextRank: MissionRankTier | null; nextRankHint: string }
  > = {
    IRON: {
      title: 'Iron Cadet — Orbital Orientation',
      nextRank: 'BRONZE',
      nextRankHint:
        'Keep all three survival gauges above 25% and survive past Day/Sol 4 to earn BRONZE rank.',
    },
    BRONZE: {
      title: 'Bronze Scout — Field Systems Trainee',
      nextRank: 'SILVER',
      nextRankHint:
        'Balance Solar Power and Hydroponics O2 into late mission (Day/Sol 7+) to reach SILVER rank.',
    },
    SILVER: {
      title: 'Silver Specialist — Habitat Flight Controller',
      nextRank: 'GOLD',
      nextRankHint:
        'Complete all 10 Days/Sols while meeting the NASA Science Goal to unlock GOLD certification.',
    },
    GOLD: {
      title: 'Gold Commander — Certified Outpost Engineer',
      nextRank: 'PLATINUM',
      nextRankHint:
        'Finish with all survival resources >=25% and higher surplus Science (74+ rating) for PLATINUM rank.',
    },
    PLATINUM: {
      title: 'Platinum Vanguard — Deep-Space Mission Director',
      nextRank: 'DIAMOND',
      nextRankHint:
        'Maintain >=45% in every resource and exceed the Science goal with an 85+ rating to achieve DIAMOND rank.',
    },
    DIAMOND: {
      title: 'Diamond Flight Director — Chief Planetary Architect',
      nextRank: null,
      nextRankHint:
        'Peak astronaut engineering! You achieved the highest possible NASA Outpost certification.',
    },
  };

  return {
    rank,
    title: metadata[rank].title,
    performanceScore,
    nextRank: metadata[rank].nextRank,
    nextRankHint: metadata[rank].nextRankHint,
  };
}
