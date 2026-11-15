import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialGameState,
  applyStationAction,
  triggerEndOfSolEvent,
  resolveEventAndAdvanceSol,
  resolveActiveEventOnly,
  resolveActiveEventWithMiniGame,
  computeMiniGameEventDeltas,
  advanceSolOvernight,
  getRandomEventDelayMs,
  DIFFICULTY_CONFIGS,
  STATION_ACTIONS,
  NASA_SPACE_EVENTS,
  computeDeterministicMissionAdvice,
  getEventsForSite,
  getTimeUnit,
  getTimeUnitPlural,
  MISSION_SITES,
  computeEventWeights,
  getEventAttribution,
  computeEvaRadiationPlan,
  evaluateDonkiTacticalAction,
  evaluateCountermeasureSchedule,
  buildTraineeCombinedFeedPayload,
  applyTraineeProtocolToState,
  computeMissionRank,
  MISSION_RANK_ORDER,
} from './rules.ts';
import { getMiniGameDescriptor, MiniGameManager } from './MiniGameManager.ts';
import {
  CACHE_TTL_MS,
  createSpaceWeatherService,
  normalizeDonkiPayload,
  RATE_LIMIT_COOLDOWN_MS,
  STALE_MAX_AGE_MS,
} from '../../server/spaceWeather.ts';
import { computeSunMood } from '../utils/spaceWeatherDisplay.ts';
import { DATA_SOURCES } from '../data/sources.ts';
import type { SpaceWeatherSummary } from '../types/spaceWeather.ts';
import {
  BACKGROUND_MUSIC_MILD_VOLUME,
  BACKGROUND_MUSIC_SRC,
  soundFX,
} from './sound.ts';

test('Every station action enforces a genuine engineering trade-off (no free safe choices)', () => {
  const stations = Object.values(STATION_ACTIONS);
  assert.equal(stations.length, 5);

  for (const action of stations) {
    const deltas = [
      action.powerDelta,
      action.lifeSupportDelta,
      action.shieldingDelta,
      action.scienceDelta,
    ];
    const hasGain = deltas.some((d) => d > 0);
    const hasCost = deltas.some((d) => d < 0);
    assert.equal(
      hasGain && hasCost,
      true,
      `Station ${action.id} must have both positive gains and negative trade-off costs`
    );
  }
});

test('Applying Solar Array action scales positive power by gainMultiplier and negative costs by costMultiplier', () => {
  const easyInitial = createInitialGameState('artemis_shackleton', 'Test Cadet', 'easy');
  const easyNext = applyStationAction(easyInitial, 'solar_array');

  assert.equal(easyNext.power, Math.min(100, easyInitial.power + 32));
  assert.equal(easyNext.lifeSupport, easyInitial.lifeSupport - 7);
  assert.equal(easyNext.shielding, easyInitial.shielding - 5);
  assert.equal(easyNext.scienceScore, easyInitial.scienceScore + 15);
  assert.equal(easyNext.actionsTakenThisSol, 1);

  const normalInitial = createInitialGameState('artemis_shackleton', 'Test Cadet', 'normal');
  const normalNext = applyStationAction(normalInitial, 'solar_array');
  // Normal: gainMultiplier = 0.85 (+32 * 0.85 = +27), costMultiplier = 1.25 (-7 * 1.25 = -9, -5 * 1.25 = -6)
  assert.equal(normalNext.power, normalInitial.power + 27);
  assert.equal(normalNext.lifeSupport, normalInitial.lifeSupport - 9);
  assert.equal(normalNext.shielding, normalInitial.shielding - 6);
  assert.equal(normalNext.scienceScore, normalInitial.scienceScore + 15);
});

test('Low-Resource Science Penalty reduces positive Science gains by 50% when Power, O2, or Shielding is below 25%', () => {
  const lowPowerState = createInitialGameState('artemis_shackleton', 'Low Reserve Cadet', 'normal');
  lowPowerState.power = 24;
  lowPowerState.lifeSupport = 80;
  lowPowerState.shielding = 80;

  // Rover Science Bay normally grants +95 Science; at <25% Power it grants Math.round(95 * 0.5) = +48 Science
  const afterRover = applyStationAction(lowPowerState, 'rover_science_bay');
  assert.equal(afterRover.scienceScore, lowPowerState.scienceScore + 48);

  // Event resolution also halves positive Science gain when a survival resource is <25%
  const lowO2EventState = triggerEndOfSolEvent(
    createInitialGameState('artemis_shackleton', 'Low O2 Cadet', 'easy'),
    0
  );
  lowO2EventState.lifeSupport = 20;
  const resolvedEvent = resolveActiveEventOnly(lowO2EventState, 0);
  // Choice 0 of hab_oxygen_leakage normally grants +25 Science -> halved to +13 Science
  assert.equal(resolvedEvent.scienceScore, lowO2EventState.scienceScore + 13);
});

test('Depleting a core resource triggers immediate educational failure state', () => {
  const state = createInitialGameState('mars_jezero', 'Mars Cadet');
  state.power = 10;
  // Hydroponics costs -11 * costMultiplier power
  const after = applyStationAction(state, 'hydroponics_dome');
  assert.equal(after.power, 0);
  assert.equal(after.status, 'failed');
  assert.ok(after.failureReason?.includes('Outpost Power reached 0%'));
});

test('Resolving a live random event during a Sol updates resources without advancing Sol, while advanceSolOvernight advances Sol', () => {
  const state = createInitialGameState('artemis_shackleton', 'Lunar Cadet');
  const withEvent = triggerEndOfSolEvent(state, 4);
  assert.ok(withEvent.activeEvent);

  const sameSolResolved = resolveActiveEventOnly(withEvent, 1);
  assert.equal(sameSolResolved.sol, 1);
  assert.equal(sameSolResolved.activeEvent, null);

  const nextSol = advanceSolOvernight(sameSolResolved);
  assert.equal(nextSol.sol, 2);
  assert.equal(nextSol.actionsTakenThisSol, 0);
});

test('Surviving Sol 10 night requires meeting the minimum NASA Science Point requirement to win', () => {
  const lowScienceState = createInitialGameState('artemis_shackleton', 'Low Sci Cadet', 'normal');
  lowScienceState.sol = 10;
  lowScienceState.power = 90;
  lowScienceState.lifeSupport = 90;
  lowScienceState.shielding = 90;
  lowScienceState.scienceScore = 550; // Below Normal 600 requirement

  const failedSci = advanceSolOvernight(lowScienceState);
  assert.equal(failedSci.status, 'failed');
  assert.ok(failedSci.failureReason?.includes('NASA Science Points'));

  const heroState = createInitialGameState('artemis_shackleton', 'Hero Cadet', 'normal');
  heroState.sol = 10;
  heroState.power = 90;
  heroState.lifeSupport = 90;
  heroState.shielding = 90;
  heroState.scienceScore = 620; // Meets Normal 600 requirement

  const completed = advanceSolOvernight(heroState);
  assert.equal(completed.status, 'victory');
});

test('Deterministic engineering advisor highlights the lowest resource trade-off', () => {
  const state = createInitialGameState('artemis_shackleton', 'Cadet');
  state.shielding = 25;
  const advice = computeDeterministicMissionAdvice(state);
  assert.ok(advice.includes('Radiation Shielding at 25%'));
});

test('Site-specific climate events and shared Oxygen Leakage event filter properly for Moon and Mars', () => {
  const moonEvents = getEventsForSite('artemis_shackleton');
  const marsEvents = getEventsForSite('mars_jezero');

  // Oxygen leakage is in both Moon and Mars event pools
  assert.ok(moonEvents.some((e) => e.id === 'hab_oxygen_leakage'));
  assert.ok(marsEvents.some((e) => e.id === 'hab_oxygen_leakage'));

  // Moon has electrostatic dust and vacuum micrometeoroids, not Martian dust storm
  assert.ok(moonEvents.some((e) => e.id === 'lunar_electrostatic_dust'));
  assert.ok(moonEvents.some((e) => e.id === 'lunar_micrometeoroid_shower'));
  assert.ok(!moonEvents.some((e) => e.id === 'mars_global_dust_storm'));

  // Mars has global dust storm and CO2 frost vortex, not Lunar electrostatic dust
  assert.ok(marsEvents.some((e) => e.id === 'mars_global_dust_storm'));
  assert.ok(marsEvents.some((e) => e.id === 'mars_co2_frost_vortex'));
  assert.ok(!marsEvents.some((e) => e.id === 'lunar_electrostatic_dust'));
});

test('Easy, Normal, and Hard difficulty levels scale starting resources, event intervals, min science goals, mini-game timers, and overnight costs', () => {
  const easyState = createInitialGameState('artemis_shackleton', 'Cadet', 'easy');
  const normalState = createInitialGameState('artemis_shackleton', 'Cadet', 'normal');
  const hardState = createInitialGameState('artemis_shackleton', 'Cadet', 'hard');

  assert.equal(easyState.power, 84);
  assert.equal(easyState.lifeSupport, 86);
  assert.equal(easyState.shielding, 85);
  assert.equal(easyState.scienceScore, 100);
  assert.equal(easyState.minScienceToWin, 450);

  assert.equal(normalState.power, 72);
  assert.equal(normalState.lifeSupport, 74);
  assert.equal(normalState.shielding, 73);
  assert.equal(normalState.scienceScore, 75);
  assert.equal(normalState.minScienceToWin, 600);

  assert.equal(hardState.power, 60);
  assert.equal(hardState.lifeSupport, 62);
  assert.equal(hardState.shielding, 61);
  assert.equal(hardState.scienceScore, 50);
  assert.equal(hardState.minScienceToWin, 750);

  assert.equal(DIFFICULTY_CONFIGS.easy.miniGameDurationSec, 30);
  assert.equal(DIFFICULTY_CONFIGS.normal.miniGameDurationSec, 15);
  assert.equal(DIFFICULTY_CONFIGS.hard.miniGameDurationSec, 12);

  // Random event intervals are shorter on Hard than Easy
  assert.ok(
    DIFFICULTY_CONFIGS.hard.eventMaxIntervalSec < DIFFICULTY_CONFIGS.easy.eventMinIntervalSec
  );
  const hardDelay = getRandomEventDelayMs('hard');
  assert.ok(hardDelay >= 8000 && hardDelay <= 13000);

  // Trigger Oxygen Leakage (index 0) on both Easy and Hard and compare remaining O2 after choice 0
  const easyLeak = triggerEndOfSolEvent(easyState, 0);
  const hardLeak = triggerEndOfSolEvent(hardState, 0);
  assert.equal(easyLeak.activeEvent?.id, 'hab_oxygen_leakage');
  assert.equal(hardLeak.activeEvent?.id, 'hab_oxygen_leakage');

  const afterEasy = resolveEventAndAdvanceSol(easyLeak, 0);
  const afterHard = resolveEventAndAdvanceSol(hardLeak, 0);

  assert.ok(afterEasy.lifeSupport > afterHard.lifeSupport);
  assert.ok(afterEasy.power > afterHard.power);
});

test('A balanced player strategy across all 10 Sols reliably achieves Victory and meets NASA Science Goal on Easy difficulty, while passive turtling on Normal falls short without Science expeditions or events', () => {
  let state = createInitialGameState('artemis_shackleton', 'Commander', 'easy');

  for (let sol = 1; sol <= 10; sol++) {
    assert.equal(state.status, 'active', `Should be active on Sol ${sol}`);
    for (let shift = 0; shift < 2; shift++) {
      const minRes = Math.min(state.power, state.lifeSupport, state.shielding);
      if (minRes === state.power) {
        state = applyStationAction(state, 'solar_array');
      } else if (minRes === state.lifeSupport) {
        state = applyStationAction(state, 'hydroponics_dome');
      } else {
        state = applyStationAction(state, 'rad_shield_core');
      }
    }
    state = advanceSolOvernight(state);
  }

  assert.equal(state.status, 'victory');
  assert.ok(state.scienceScore >= state.minScienceToWin);
});

test('Hard difficulty drains punish unthinking single-station play before Sol 10', () => {
  let state = createInitialGameState('artemis_shackleton', 'Careless Commander', 'hard');

  for (let sol = 1; sol <= 10; sol++) {
    if (state.status !== 'active') break;
    state = applyStationAction(state, 'solar_array');
    state = applyStationAction(state, 'solar_array');
    state = triggerEndOfSolEvent(state, sol);
    state = resolveEventAndAdvanceSol(state, 0);
  }

  assert.equal(state.status, 'failed');
});

test('computeMiniGameEventDeltas scales linearly between Failed Weld (0%) and Perfect Weld (100%) for ECLSS-O2-SEAL-404', () => {
  const failed = computeMiniGameEventDeltas('ECLSS-O2-SEAL-404', 0.0, 'normal');
  const mid = computeMiniGameEventDeltas('ECLSS-O2-SEAL-404', 0.5, 'normal');
  const perfect = computeMiniGameEventDeltas('ECLSS-O2-SEAL-404', 1.0, 'normal');
  const overheated = computeMiniGameEventDeltas('ECLSS-O2-SEAL-404', 1.0, 'normal', 2);

  // Partial/Failed Weld (0%): -4% Power, -14% O2, -3% Shielding, +10 Science
  assert.deepEqual(failed, {
    powerDelta: -4,
    o2Delta: -14,
    shieldingDelta: -3,
    scienceDelta: 10,
  });

  // Perfect Weld (100%): -10% Power, -4% O2, -2% Shielding, +25 Science
  assert.deepEqual(perfect, {
    powerDelta: -10,
    o2Delta: -4,
    shieldingDelta: -2,
    scienceDelta: 25,
  });

  // 50% Linearly Interpolated Midpoint
  assert.equal(mid.powerDelta, -7);
  assert.equal(mid.o2Delta, -9);
  assert.equal(mid.scienceDelta, 18);

  // Overheating hull while welding applies extra shielding damage
  assert.equal(overheated.shieldingDelta, -4);
});

test('MiniGameManager ECLSS-O2-SEAL-404 requires 180-deg Valve Isolation before sealing all 3 fractures', () => {
  const completedPayloads: {
    eventCode: string;
    performanceRatio: number;
    deltas: { powerDelta: number; o2Delta: number; shieldingDelta: number; scienceDelta: number };
  }[] = [];

  const manager = new MiniGameManager({
    eventCode: 'ECLSS-O2-SEAL-404',
    difficulty: 'normal',
    durationSec: 12,
    onComplete: (payload) => {
      completedPayloads.push(payload);
    },
  });

  assert.equal(manager.eventCode, 'ECLSS-O2-SEAL-404');
  assert.equal(manager.totalDurationSec, 12);
  assert.equal(manager.isValveInSafeZone(), false);
  assert.equal(manager.getPerformanceRatio(), 0);

  // Step 1: Rotate rotary shutoff valve 180 degrees (2 impulses of 90 deg) into Safe Welding Zone
  manager.applyInteractionImpulse();
  assert.equal(manager.getValveRotationDeg(), 90);
  assert.equal(manager.isValveInSafeZone(), false);

  manager.applyInteractionImpulse();
  assert.equal(manager.getValveRotationDeg(), 180);
  assert.equal(manager.isValveInSafeZone(), true);
  assert.equal(manager.getPerformanceRatio(), 0);

  // Step 2: Weld each of the 3 jagged fracture lines
  manager.applyInteractionImpulse();
  assert.ok(manager.getPerformanceRatio() > 0.3 && manager.getPerformanceRatio() < 0.4);

  manager.applyInteractionImpulse();
  assert.ok(manager.getPerformanceRatio() > 0.6 && manager.getPerformanceRatio() < 0.7);

  manager.applyInteractionImpulse();
  assert.equal(manager.getPerformanceRatio(), 1);
  assert.equal(completedPayloads.length, 1);

  const completedPayload = completedPayloads[0];
  assert.equal(completedPayload.eventCode, 'ECLSS-O2-SEAL-404');
  assert.equal(completedPayload.performanceRatio, 1);
  assert.deepEqual(completedPayload.deltas, {
    powerDelta: -10,
    o2Delta: -4,
    shieldingDelta: -2,
    scienceDelta: 25,
  });

  const state = triggerEndOfSolEvent(
    createInitialGameState('artemis_shackleton', 'Cadet', 'easy'),
    0
  );
  const resolved = resolveActiveEventWithMiniGame(
    state,
    completedPayload.performanceRatio,
    completedPayload.deltas
  );
  assert.equal(resolved.activeEvent, null);
  assert.equal(resolved.power, state.power - 10);
  assert.equal(resolved.lifeSupport, state.lifeSupport - 4);
  assert.equal(resolved.shielding, state.shielding - 2);
  assert.equal(resolved.scienceScore, state.scienceScore + 25);
});

test('computeMiniGameEventDeltas scales between Array Overload (0%) and High Deflection (>=80%) for DONKI-FLR-2026-X2.4', () => {
  const unshielded = computeMiniGameEventDeltas('DONKI-FLR-2026-X2.4', 0.0, 'normal');
  const mid = computeMiniGameEventDeltas('DONKI-FLR-2026-X2.4', 0.4, 'normal');
  const high80 = computeMiniGameEventDeltas('DONKI-FLR-2026-X2.4', 0.8, 'normal');
  const high100 = computeMiniGameEventDeltas('DONKI-FLR-2026-X2.4', 1.0, 'normal');

  // Array Overload / Unshielded (0%): +14% Power, -5% O2, -14% Shielding, +10 Science
  assert.deepEqual(unshielded, {
    powerDelta: 14,
    o2Delta: -5,
    shieldingDelta: -14,
    scienceDelta: 10,
  });

  // High Deflection (Shield blocks >=80% of protons): -12% Power, -4% O2, +16% Shielding, +30 Science
  assert.deepEqual(high80, {
    powerDelta: -12,
    o2Delta: -4,
    shieldingDelta: 16,
    scienceDelta: 30,
  });
  assert.deepEqual(high100, high80);

  // Midpoint (40% blocked -> 50% of 80% threshold): +1% Power, -1% Shielding->+1% Shielding, +20 Science
  assert.equal(mid.powerDelta, 1);
  assert.equal(mid.shieldingDelta, 1);
  assert.equal(mid.scienceDelta, 20);
});

test('MiniGameManager DONKI-FLR-2026-X2.4 supports Shield Arc rotation, Solar Array Gimbal toggle, and 5-wave deflection', () => {
  const completedPayloads: {
    eventCode: string;
    performanceRatio: number;
    deltas: { powerDelta: number; o2Delta: number; shieldingDelta: number; scienceDelta: number };
  }[] = [];

  const manager = new MiniGameManager({
    eventCode: 'DONKI-FLR-2026-X2.4',
    difficulty: 'normal',
    durationSec: 12,
    onComplete: (payload) => {
      completedPayloads.push(payload);
    },
  });

  assert.equal(manager.eventCode, 'DONKI-FLR-2026-X2.4');
  assert.equal(manager.getPerformanceRatio(), 0);
  assert.equal(manager.isSolarArraysFeathered(), false);

  // Rotate shield arc and toggle solar array wings between Collect and Feather/Fold
  manager.rotateShieldArcByDeg(45);
  const afterRotateDeg = manager.getSnapshot().shieldAngleDeg ?? -1;
  assert.ok(afterRotateDeg >= 0 && afterRotateDeg < 360);

  const featheredState = manager.toggleSolarArrayGimbal();
  assert.equal(featheredState, true);
  assert.equal(manager.isSolarArraysFeathered(), true);

  // Phase-lock and deflect all 5 incoming crimson proton waves
  for (let i = 0; i < 5; i++) {
    manager.applyInteractionImpulse();
  }

  assert.equal(manager.getPerformanceRatio(), 1);
  assert.equal(completedPayloads.length, 1);
  assert.deepEqual(completedPayloads[0].deltas, {
    powerDelta: -12,
    o2Delta: -4,
    shieldingDelta: 16,
    scienceDelta: 30,
  });
});

test('computeMiniGameEventDeltas scales between Water Kept in Hydroponics (0%) and Full Overhead Bladder Fill (100%) for DONKI-SEP-2026-M8.1', () => {
  const lowFill = computeMiniGameEventDeltas('DONKI-SEP-2026-M8.1', 0.0, 'normal');
  const midFill = computeMiniGameEventDeltas('DONKI-SEP-2026-M8.1', 0.5, 'normal');
  const fullFill = computeMiniGameEventDeltas('DONKI-SEP-2026-M8.1', 1.0, 'normal');

  // Water Kept in Hydroponics (0.0): -4% Power, +16% O2, -12% Shielding, +15 Science
  assert.deepEqual(lowFill, {
    powerDelta: -4,
    o2Delta: 16,
    shieldingDelta: -12,
    scienceDelta: 15,
  });

  // Full Overhead Bladder Fill (1.0): -6% Power, -10% O2, +22% Shielding, +25 Science
  assert.deepEqual(fullFill, {
    powerDelta: -6,
    o2Delta: -10,
    shieldingDelta: 22,
    scienceDelta: 25,
  });

  // Midpoint (50% bladder fill): -5% Power, +3% O2, +5% Shielding, +20 Science
  assert.deepEqual(midFill, {
    powerDelta: -5,
    o2Delta: 3,
    shieldingDelta: 5,
    scienceDelta: 20,
  });
});

test('MiniGameManager DONKI-SEP-2026-M8.1 supports Pipe Junction rotation, Water Pump Sliders, and filling all 4 Overhead Hull Shield Bladders', () => {
  const completedPayloads: {
    eventCode: string;
    performanceRatio: number;
    deltas: { powerDelta: number; o2Delta: number; shieldingDelta: number; scienceDelta: number };
  }[] = [];

  const manager = new MiniGameManager({
    eventCode: 'DONKI-SEP-2026-M8.1',
    difficulty: 'normal',
    durationSec: 12,
    onComplete: (payload) => {
      completedPayloads.push(payload);
    },
  });

  assert.equal(manager.eventCode, 'DONKI-SEP-2026-M8.1');
  assert.equal(manager.getPerformanceRatio(), 0);
  assert.equal(manager.getBladdersFilledCount(), 0);

  // Rotate pipe junction J1 and adjust Potable & Hydroponic pump sliders
  const j1Open = manager.togglePipeJunction(0);
  assert.equal(j1Open, true);
  assert.ok(manager.getPerformanceRatio() > 0);

  manager.setWaterPumpSliders(0.85, 0.75);
  const snap = manager.getSnapshot();
  assert.equal(snap.potablePumpPct, 85);
  assert.equal(snap.hydroponicPumpPct, 75);
  assert.equal(snap.openJunctionsCount, 1);

  // Pump water into all 4 overhead bladders above active GCR hotspots
  for (let i = 0; i < 4; i++) {
    manager.applyInteractionImpulse();
  }

  assert.equal(manager.getBladdersFilledCount(), 4);
  assert.equal(manager.getPerformanceRatio(), 1);
  assert.equal(completedPayloads.length, 1);
  assert.deepEqual(completedPayloads[0].deltas, {
    powerDelta: -6,
    o2Delta: -10,
    shieldingDelta: 22,
    scienceDelta: 25,
  });
});

test('computeMiniGameEventDeltas scales between Scrubber Clogged (0%) and Balanced Scrubber & Sterilized Spores (100%) for OSDR-OSD-379-BIO', () => {
  const clogged = computeMiniGameEventDeltas('OSDR-OSD-379-BIO', 0.0, 'normal');
  const mid = computeMiniGameEventDeltas('OSDR-OSD-379-BIO', 0.5, 'normal');
  const balanced = computeMiniGameEventDeltas('OSDR-OSD-379-BIO', 1.0, 'normal');

  // Scrubber Clogged (0.0): +10% Power, -10% O2, -3% Shielding, +5 Science
  assert.deepEqual(clogged, {
    powerDelta: 10,
    o2Delta: -10,
    shieldingDelta: -3,
    scienceDelta: 5,
  });

  // Balanced Scrubber & Sterilized Spores (1.0): -10% Power, +18% O2, 0% Shielding, +35 Science
  assert.deepEqual(balanced, {
    powerDelta: -10,
    o2Delta: 18,
    shieldingDelta: 0,
    scienceDelta: 35,
  });

  // Midpoint (0.5): 0% Power, +4% O2, -1% Shielding, +20 Science
  assert.deepEqual(mid, {
    powerDelta: 0,
    o2Delta: 4,
    shieldingDelta: -1,
    scienceDelta: 20,
  });
});

test('MiniGameManager OSDR-OSD-379-BIO supports 3-channel frequency slider tuning and UV sterilization of all 4 fungal spores', () => {
  const completedPayloads: {
    eventCode: string;
    performanceRatio: number;
    deltas: { powerDelta: number; o2Delta: number; shieldingDelta: number; scienceDelta: number };
  }[] = [];

  const manager = new MiniGameManager({
    eventCode: 'OSDR-OSD-379-BIO',
    difficulty: 'normal',
    durationSec: 12,
    onComplete: (payload) => {
      completedPayloads.push(payload);
    },
  });

  assert.equal(manager.eventCode, 'OSDR-OSD-379-BIO');
  assert.equal(manager.getSporesSterilizedCount(), 0);
  assert.ok(manager.getWaveformMatchRatio() < 0.5);

  // Tune both frequency sliders to lock the Thermal Dehumidifier & UV Sterilizer waves (75% & 80%)
  manager.setScrubberFrequencySliders(0.75, 0.8);
  assert.equal(manager.getWaveformMatchRatio(), 1);
  assert.equal(manager.getPerformanceRatio(), 0.5);

  // Sterilize all 4 drifting green fungal spore clusters with the UV pulse beam
  for (let i = 0; i < 4; i++) {
    manager.applyInteractionImpulse();
  }

  assert.equal(manager.getSporesSterilizedCount(), 4);
  assert.equal(manager.getPerformanceRatio(), 1);
  assert.equal(completedPayloads.length, 1);
  assert.deepEqual(completedPayloads[0].deltas, {
    powerDelta: -10,
    o2Delta: 18,
    shieldingDelta: 0,
    scienceDelta: 35,
  });
});

test('computeMiniGameEventDeltas scales between 100% Maintenance Focus (0%), Hybrid Split (50%), and 100% Science Focus (100%) for DONKI-QUIET-SUN-SOL', () => {
  const maint100 = computeMiniGameEventDeltas('DONKI-QUIET-SUN-SOL', 0.0, 'normal');
  const hybrid50 = computeMiniGameEventDeltas('DONKI-QUIET-SUN-SOL', 0.5, 'normal');
  const science100 = computeMiniGameEventDeltas('DONKI-QUIET-SUN-SOL', 1.0, 'normal');

  // 100% Maintenance Focus (0.0): -5% Power, +16% O2, +16% Shielding, -10 Science
  assert.deepEqual(maint100, {
    powerDelta: -5,
    o2Delta: 16,
    shieldingDelta: 16,
    scienceDelta: -10,
  });

  // 100% Science Focus (1.0): -10% Power, -5% O2, -3% Shielding, +65 Science
  assert.deepEqual(science100, {
    powerDelta: -10,
    o2Delta: -5,
    shieldingDelta: -3,
    scienceDelta: 65,
  });

  // 50/50 Hybrid Split (0.5): blends resource deltas proportionally
  assert.deepEqual(hybrid50, {
    powerDelta: -7,
    o2Delta: 6,
    shieldingDelta: 7,
    scienceDelta: 28,
  });
});

test('MiniGameManager DONKI-QUIET-SUN-SOL runs a Dual-Track Mission Console supporting Science Focus, Maintenance Focus, and Hybrid Split', () => {
  const manager = new MiniGameManager({
    eventCode: 'DONKI-QUIET-SUN-SOL',
    difficulty: 'normal',
  });

  assert.equal(manager.eventCode, 'DONKI-QUIET-SUN-SOL');
  assert.equal(manager.totalDurationSec, 15);
  assert.equal(manager.getScienceTrackProgress(), 0);
  assert.equal(manager.getMaintenanceTrackProgress(), 0);

  // 1. Dedicating effort to Left Console (Core Drill & Spectrometer) -> 100% Science Focus
  manager.boostScienceConsole(0.5);
  assert.equal(manager.getScienceTrackProgress(), 0.5);
  assert.equal(manager.getPerformanceRatio(), 1.0);
  assert.deepEqual(manager.getCurrentDeltas(), {
    powerDelta: -10,
    o2Delta: -5,
    shieldingDelta: -3,
    scienceDelta: 65,
  });

  // 2. Splitting effort with Right Console (Greywater Filter & Hull Patch) -> 50/50 Hybrid Split
  manager.boostMaintenanceConsole(0.5);
  assert.equal(manager.getMaintenanceTrackProgress(), 0.5);
  assert.equal(manager.getPerformanceRatio(), 0.5);
  assert.equal(manager.getSnapshot().greywaterMembraneInstalled, true);
  assert.deepEqual(manager.getCurrentDeltas(), {
    powerDelta: -7,
    o2Delta: 6,
    shieldingDelta: 7,
    scienceDelta: 28,
  });

  // 3. Completing with 100% Maintenance Focus (ratio 0.0)
  const maintPayload = manager.forceCompleteWithRatio(0.0);
  assert.deepEqual(maintPayload.deltas, {
    powerDelta: -5,
    o2Delta: 16,
    shieldingDelta: 16,
    scienceDelta: -10,
  });
});

test('computeMiniGameEventDeltas scales between Manual Brush Under Arcing Conditions (0%) and Timed Electrostatic Repeller Pulses (100%) for ARTEMIS-DUST-LEV-09', () => {
  const manualArcing = computeMiniGameEventDeltas('ARTEMIS-DUST-LEV-09', 0.0, 'normal');
  const mid = computeMiniGameEventDeltas('ARTEMIS-DUST-LEV-09', 0.5, 'normal');
  const timedRepeller = computeMiniGameEventDeltas('ARTEMIS-DUST-LEV-09', 1.0, 'normal');

  // Manual Brush Under Arcing Conditions (0.0): -4% Power, -9% O2, -10% Shielding, +20 Science
  assert.deepEqual(manualArcing, {
    powerDelta: -4,
    o2Delta: -9,
    shieldingDelta: -10,
    scienceDelta: 20,
  });

  // Timed Electrostatic Repeller Pulses (1.0): -10% Power, -4% O2, -2% Shielding, +30 Science
  assert.deepEqual(timedRepeller, {
    powerDelta: -10,
    o2Delta: -4,
    shieldingDelta: -2,
    scienceDelta: 30,
  });

  // Midpoint (0.5): -7% Power, -6% O2, -6% Shielding, +25 Science
  assert.deepEqual(mid, {
    powerDelta: -7,
    o2Delta: -6,
    shieldingDelta: -6,
    scienceDelta: 25,
  });
});

test('MiniGameManager ARTEMIS-DUST-LEV-09 supports Timed Capacitor Repeller Pulses at Green Peak and Manual EVA Brush with arc shock hazards', () => {
  const completedPayloads: {
    eventCode: string;
    performanceRatio: number;
    deltas: { powerDelta: number; o2Delta: number; shieldingDelta: number; scienceDelta: number };
  }[] = [];

  const repellerManager = new MiniGameManager({
    eventCode: 'ARTEMIS-DUST-LEV-09',
    difficulty: 'normal',
    durationSec: 12,
    onComplete: (payload) => {
      completedPayloads.push(payload);
    },
  });

  assert.equal(repellerManager.eventCode, 'ARTEMIS-DUST-LEV-09');
  assert.equal(repellerManager.getDustClearedCount(), 0);
  assert.equal(repellerManager.isCapacitorInGreenPeak(), true);

  // Fire 3 Timed Capacitor Repeller Pulses in the Green Peak (each clears 2 of the 6 solar cells)
  repellerManager.applyInteractionImpulse();
  assert.equal(repellerManager.getDustClearedCount(), 2);

  repellerManager.applyInteractionImpulse();
  assert.equal(repellerManager.getDustClearedCount(), 4);

  repellerManager.applyInteractionImpulse();
  assert.equal(repellerManager.getDustClearedCount(), 6);
  assert.equal(repellerManager.getPerformanceRatio(), 1.0);
  assert.equal(completedPayloads.length, 1);
  assert.deepEqual(completedPayloads[0].deltas, {
    powerDelta: -10,
    o2Delta: -4,
    shieldingDelta: -2,
    scienceDelta: 30,
  });

  // Also verify Manual EVA Brush under arcing conditions (swiping over active lightning nodes)
  const brushManager = new MiniGameManager({
    eventCode: 'ARTEMIS-DUST-LEV-09',
    difficulty: 'normal',
  });
  // Swipe all 6 cells manually with the EVA brush (3 of which have active lightning arcs: indices 0, 2, 4)
  for (let i = 0; i < 6; i++) {
    brushManager.swipeManualEvaBrush(i);
  }
  assert.equal(brushManager.getDustClearedCount(), 6);
  assert.equal(brushManager.getArcShockCount(), 3);
  assert.equal(brushManager.getPerformanceRatio(), 0.0);
  assert.deepEqual(brushManager.getCurrentDeltas(), {
    powerDelta: -4,
    o2Delta: -9,
    shieldingDelta: -10,
    scienceDelta: 20,
  });
});

test('computeMiniGameEventDeltas scales between <40% Impacts Blocked (Hull Hits) and >80% Impacts Blocked (Active Shutters) for LRO-IMPACT-SWARM-12', () => {
  const hullHits0 = computeMiniGameEventDeltas('LRO-IMPACT-SWARM-12', 0.0, 'normal');
  const hullHits40 = computeMiniGameEventDeltas('LRO-IMPACT-SWARM-12', 0.4, 'normal');
  const mid60 = computeMiniGameEventDeltas('LRO-IMPACT-SWARM-12', 0.6, 'normal');
  const blocked80 = computeMiniGameEventDeltas('LRO-IMPACT-SWARM-12', 0.8, 'normal');
  const blocked100 = computeMiniGameEventDeltas('LRO-IMPACT-SWARM-12', 1.0, 'normal');

  // <40% Impacts Blocked (Hull absorbs hits): -5% Power, -6% O2, -13% Shielding, +15 Science
  assert.deepEqual(hullHits0, {
    powerDelta: -5,
    o2Delta: -6,
    shieldingDelta: -13,
    scienceDelta: 15,
  });
  assert.deepEqual(hullHits40, hullHits0);

  // >80% Impacts Blocked by Active Shutters: -12% Power, -4% O2, -5% Shielding, +35 Science
  assert.deepEqual(blocked80, {
    powerDelta: -12,
    o2Delta: -4,
    shieldingDelta: -5,
    scienceDelta: 35,
  });
  assert.deepEqual(blocked100, blocked80);

  // Midpoint (60% blocked -> 50% between 40% and 80%): -8% Power, -5% O2, -9% Shielding, +25 Science
  assert.deepEqual(mid60, {
    powerDelta: -8,
    o2Delta: -5,
    shieldingDelta: -9,
    scienceDelta: 25,
  });
});

test('MiniGameManager LRO-IMPACT-SWARM-12 enforces max 2 simultaneous active shutters and calculates >80% vs <40% outcome deltas', () => {
  const completedPayloads: {
    eventCode: string;
    performanceRatio: number;
    deltas: { powerDelta: number; o2Delta: number; shieldingDelta: number; scienceDelta: number };
  }[] = [];

  const manager = new MiniGameManager({
    eventCode: 'LRO-IMPACT-SWARM-12',
    difficulty: 'normal',
    durationSec: 12,
    onComplete: (payload) => {
      completedPayloads.push(payload);
    },
  });

  assert.equal(manager.eventCode, 'LRO-IMPACT-SWARM-12');
  assert.equal(manager.getPerformanceRatio(), 0);
  assert.deepEqual(manager.getActiveShutterIds(), []);

  // Energize Sector S2 (id=1) and Sector S4 (id=3) -> 2 active shutters
  manager.energizeWhippleShutter(1, false);
  assert.deepEqual(manager.getActiveShutterIds(), [1]);

  manager.energizeWhippleShutter(3, false);
  assert.deepEqual(manager.getActiveShutterIds(), [1, 3]);
  assert.equal(manager.getSnapshot().activeShuttersCount, 2);

  // Energizing a 3rd sector (S6, id=5) automatically de-energizes the oldest shutter (S2, id=1)
  manager.energizeWhippleShutter(5, false);
  assert.deepEqual(manager.getActiveShutterIds(), [3, 5]);
  assert.equal(manager.getSnapshot().activeShuttersCount, 2);

  // Cycle power across all 5 incoming Doppler micrometeoroid trajectories to block 100% (>80%)
  for (let i = 0; i < 5; i++) {
    manager.applyInteractionImpulse();
  }

  assert.equal(manager.getMeteorsBlockedCount(), 5);
  assert.equal(manager.getPerformanceRatio(), 1.0);
  assert.equal(completedPayloads.length, 1);
  assert.deepEqual(completedPayloads[0].deltas, {
    powerDelta: -12,
    o2Delta: -4,
    shieldingDelta: -5,
    scienceDelta: 35,
  });

  // Also verify <40% Impacts Blocked (e.g., 1/5 = 20% blocked) outcome
  const lowBlockManager = new MiniGameManager({
    eventCode: 'LRO-IMPACT-SWARM-12',
    difficulty: 'normal',
  });
  lowBlockManager.applyInteractionImpulse();
  assert.equal(lowBlockManager.getMeteorsBlockedCount(), 1);
  assert.equal(lowBlockManager.getPerformanceRatio(), 0.2);
  assert.deepEqual(lowBlockManager.getCurrentDeltas(), {
    powerDelta: -5,
    o2Delta: -6,
    shieldingDelta: -13,
    scienceDelta: 15,
  });
});

test('computeMiniGameEventDeltas scales between EVA Regolith Blanket Strategy (0%) and Heater-Dominant Strategy (100%) for ARTEMIS-LRO-CRATER-89S', () => {
  const regolithBlanket = computeMiniGameEventDeltas('ARTEMIS-LRO-CRATER-89S', 0.0, 'normal');
  const hybrid50 = computeMiniGameEventDeltas('ARTEMIS-LRO-CRATER-89S', 0.5, 'normal');
  const heaterDominant = computeMiniGameEventDeltas('ARTEMIS-LRO-CRATER-89S', 1.0, 'normal');

  // EVA Regolith Blanket Strategy (0.0): +6% Power, -6% O2, -9% Shielding, +40 Science
  assert.deepEqual(regolithBlanket, {
    powerDelta: 6,
    o2Delta: -6,
    shieldingDelta: -9,
    scienceDelta: 40,
  });

  // Heater-Dominant Strategy (1.0): -12% Power, +10% O2, +5% Shielding, +20 Science
  assert.deepEqual(heaterDominant, {
    powerDelta: -12,
    o2Delta: 10,
    shieldingDelta: 5,
    scienceDelta: 20,
  });

  // Hybrid 50/50 Split (0.5): -3% Power, +2% O2, -2% Shielding, +30 Science
  assert.deepEqual(hybrid50, {
    powerDelta: -3,
    o2Delta: 2,
    shieldingDelta: -2,
    scienceDelta: 30,
  });
});

test('MiniGameManager ARTEMIS-LRO-CRATER-89S supports Internal Heater Sliders, EVA Rover Regolith Berms, and strategy interpolation', () => {
  const manager = new MiniGameManager({
    eventCode: 'ARTEMIS-LRO-CRATER-89S',
    difficulty: 'normal',
    durationSec: 12,
  });

  assert.equal(manager.eventCode, 'ARTEMIS-LRO-CRATER-89S');
  assert.equal(manager.getHeaterStrategyProgress(), 0);
  assert.equal(manager.getRegolithBermProgress(), 0);
  assert.equal(manager.getPerformanceRatio(), 0.5);

  // 1. Drag Internal Heater Sliders (O2 Pipes & Battery Banks) -> Heater-Dominant Strategy (1.0)
  manager.setThermalHeaterSliders(0.8, 0.8);
  assert.equal(manager.getHeaterStrategyProgress(), 0.8);
  assert.equal(manager.getPerformanceRatio(), 1.0);
  assert.deepEqual(manager.getCurrentDeltas(), {
    powerDelta: -12,
    o2Delta: 10,
    shieldingDelta: 5,
    scienceDelta: 20,
  });

  // 2. Pack all 4 exterior Regolith Berms to 80% -> Equal Hybrid Strategy (0.5)
  for (let i = 0; i < 4; i++) {
    manager.packRegolithBerm(i, 0.8);
  }
  assert.equal(manager.getRegolithBermProgress(), 0.8);
  assert.equal(manager.getPerformanceRatio(), 0.5);
  assert.deepEqual(manager.getCurrentDeltas(), {
    powerDelta: -3,
    o2Delta: 2,
    shieldingDelta: -2,
    scienceDelta: 30,
  });

  // 3. Pure EVA Regolith Blanket Strategy (0.0)
  const regolithManager = new MiniGameManager({
    eventCode: 'ARTEMIS-LRO-CRATER-89S',
    difficulty: 'normal',
  });
  for (let i = 0; i < 4; i++) {
    regolithManager.packRegolithBerm(i, 1.0);
  }
  assert.equal(regolithManager.getRegolithBermsPackedCount(), 4);
  assert.equal(regolithManager.getPerformanceRatio(), 0.0);
  assert.deepEqual(regolithManager.getCurrentDeltas(), {
    powerDelta: 6,
    o2Delta: -6,
    shieldingDelta: -9,
    scienceDelta: 40,
  });
});

test('computeMiniGameEventDeltas scales between Habitat Throttled / Reserve O2 Used (0%) and Filters Purged via Compressors (100%) for MARS-MEDA-DUST-88', () => {
  const throttledReserveO2 = computeMiniGameEventDeltas('MARS-MEDA-DUST-88', 0.0, 'normal');
  const midMix = computeMiniGameEventDeltas('MARS-MEDA-DUST-88', 0.5, 'normal');
  const filtersPurged = computeMiniGameEventDeltas('MARS-MEDA-DUST-88', 1.0, 'normal');

  // Habitat Throttled / Reserve O2 Used (0.0): -7% Power, -11% O2, -4% Shielding, +15 Science
  assert.deepEqual(throttledReserveO2, {
    powerDelta: -7,
    o2Delta: -11,
    shieldingDelta: -4,
    scienceDelta: 15,
  });

  // Filters Purged via Compressors (1.0): -12% Power, -4% O2, -2% Shielding, +30 Science
  assert.deepEqual(filtersPurged, {
    powerDelta: -12,
    o2Delta: -4,
    shieldingDelta: -2,
    scienceDelta: 30,
  });

  // Midpoint (0.5): -9% Power, -7% O2, -3% Shielding, +23 Science
  assert.deepEqual(midMix, {
    powerDelta: -9,
    o2Delta: -7,
    shieldingDelta: -3,
    scienceDelta: 23,
  });
});

test('MiniGameManager MARS-MEDA-DUST-88 supports timed Compressor Back-Purge Blasts in wind troughs, penalizes peak gust blasts, and supports Habitat Power Breaker load shedding', () => {
  const completedPayloads: {
    eventCode: string;
    performanceRatio: number;
    deltas: { powerDelta: number; o2Delta: number; shieldingDelta: number; scienceDelta: number };
  }[] = [];

  const manager = new MiniGameManager({
    eventCode: 'MARS-MEDA-DUST-88',
    difficulty: 'normal',
    durationSec: 12,
    onComplete: (payload) => {
      completedPayloads.push(payload);
    },
  });

  assert.equal(manager.eventCode, 'MARS-MEDA-DUST-88');
  assert.equal(manager.getMoxieFiltersPurgedCount(), 0);
  assert.equal(manager.getPerformanceRatio(), 0);
  assert.equal(manager.isWindInTrough(), true);

  // 1. Firing against a peak 95 km/h gust wastes battery power and only partially clears 1 cell
  manager.setWindSpeedKmh(95);
  assert.equal(manager.isWindInTrough(), false);
  const gustBlast = manager.fireCompressorBackPurgeBlast();
  assert.equal(gustBlast, false);
  assert.equal(manager.getWastedGustBlastsCount(), 1);
  assert.equal(manager.getMoxieFiltersPurgedCount(), 0);

  // 2. Flipping breakers on the Habitat Power Breaker Board activates load shedding & reserve O2
  const breakerManager = new MiniGameManager({
    eventCode: 'MARS-MEDA-DUST-88',
    difficulty: 'normal',
  });
  for (let i = 0; i < 3; i++) {
    breakerManager.flipLoadShedBreaker(i);
  }
  assert.equal(breakerManager.getBreakersTrippedCount(), 3);
  assert.equal(breakerManager.getPerformanceRatio(), 0.0);
  assert.deepEqual(breakerManager.getCurrentDeltas(), {
    powerDelta: -7,
    o2Delta: -11,
    shieldingDelta: -4,
    scienceDelta: 15,
  });

  // 3. Firing high-pressure Compressor Back-Purge Blasts during wind troughs cleanly purges all 6 MOXIE filters
  manager.setWindSpeedKmh(32);
  assert.equal(manager.isWindInTrough(), true);
  // Reset wasted gust count on a fresh manager for 100% clean compressor purge test
  const cleanPurgeManager = new MiniGameManager({
    eventCode: 'MARS-MEDA-DUST-88',
    difficulty: 'normal',
    onComplete: (payload) => {
      completedPayloads.push(payload);
    },
  });
  cleanPurgeManager.setWindSpeedKmh(30);
  for (let i = 0; i < 3; i++) {
    const res = cleanPurgeManager.fireCompressorBackPurgeBlast();
    assert.equal(res, true);
  }
  assert.equal(cleanPurgeManager.getMoxieFiltersPurgedCount(), 6);
  assert.equal(cleanPurgeManager.getPerformanceRatio(), 1.0);
  assert.equal(completedPayloads.length, 1);
  assert.deepEqual(completedPayloads[0].deltas, {
    powerDelta: -12,
    o2Delta: -4,
    shieldingDelta: -2,
    scienceDelta: 30,
  });
});

test('computeMiniGameEventDeltas scales between Manual Frost Chipping & Vent Sealing (0%) and Thermal Coil De-Icing (100%) for MARS-JEZERO-FROST-19', () => {
  const manualChipping = computeMiniGameEventDeltas('MARS-JEZERO-FROST-19', 0.0, 'normal');
  const midHybrid = computeMiniGameEventDeltas('MARS-JEZERO-FROST-19', 0.5, 'normal');
  const thermalCoil = computeMiniGameEventDeltas('MARS-JEZERO-FROST-19', 1.0, 'normal');

  // Manual Frost Chipping & Vent Sealing (0.0): -5% Power, -9% O2, -8% Shielding, +20 Science
  assert.deepEqual(manualChipping, {
    powerDelta: -5,
    o2Delta: -9,
    shieldingDelta: -8,
    scienceDelta: 20,
  });

  // Thermal Coil De-Icing (1.0): -11% Power, -5% O2, -2% Shielding, +25 Science
  assert.deepEqual(thermalCoil, {
    powerDelta: -11,
    o2Delta: -5,
    shieldingDelta: -2,
    scienceDelta: 25,
  });

  // Midpoint (0.5): -8% Power, -7% O2, -5% Shielding, +23 Science
  assert.deepEqual(midHybrid, {
    powerDelta: -8,
    o2Delta: -7,
    shieldingDelta: -5,
    scienceDelta: 23,
  });
});

test('MiniGameManager MARS-JEZERO-FROST-19 supports Thermal Coil De-Icing, Acoustic Chisel frost chipping across 5 valves, and Dust Devil Vortex hazard avoidance', () => {
  // 1. Thermal Coil De-Icing (1.0): melts -85°C CO2 dry-ice frost electrically across all 5 valves
  const completedThermal: {
    eventCode: string;
    performanceRatio: number;
    deltas: { powerDelta: number; o2Delta: number; shieldingDelta: number; scienceDelta: number };
  }[] = [];

  const thermalManager = new MiniGameManager({
    eventCode: 'MARS-JEZERO-FROST-19',
    difficulty: 'normal',
    durationSec: 12,
    onComplete: (payload) => {
      completedThermal.push(payload);
    },
  });

  assert.equal(thermalManager.eventCode, 'MARS-JEZERO-FROST-19');
  assert.equal(thermalManager.getCryoValvesDeIcedCount(), 0);
  assert.equal(thermalManager.getPerformanceRatio(), 0.5);

  thermalManager.fireThermalCoilPulse(0.4);
  thermalManager.fireThermalCoilPulse(0.4);
  thermalManager.fireThermalCoilPulse(0.4);

  assert.equal(thermalManager.getCryoValvesDeIcedCount(), 5);
  assert.equal(thermalManager.getPerformanceRatio(), 1.0);
  assert.equal(completedThermal.length, 1);
  assert.deepEqual(completedThermal[0].deltas, {
    powerDelta: -11,
    o2Delta: -5,
    shieldingDelta: -2,
    scienceDelta: 25,
  });

  // 2. Manual Frost Chipping via Acoustic Chisel + Dust Devil Vortex hazard check
  const completedChisel: {
    eventCode: string;
    performanceRatio: number;
    deltas: { powerDelta: number; o2Delta: number; shieldingDelta: number; scienceDelta: number };
  }[] = [];

  const chiselManager = new MiniGameManager({
    eventCode: 'MARS-JEZERO-FROST-19',
    difficulty: 'normal',
    durationSec: 12,
    onComplete: (payload) => {
      completedChisel.push(payload);
    },
  });

  // Place the spinning Dust Devil Vortex directly over VENT #1 (314, 112) and verify tapping it triggers vortex hazard
  chiselManager.setVortexPosition(314, 112);
  assert.equal(chiselManager.isValveInVortex(0), true);
  const hitVortex = chiselManager.tapAcousticChisel(0);
  assert.equal(hitVortex, false);
  assert.equal(chiselManager.getVortexHitsCount(), 1);

  // Move vortex away and chip all 5 frozen cryo-valves manually with a fresh manager for clean Manual Frost Chipping (0.0)
  const cleanChiselManager = new MiniGameManager({
    eventCode: 'MARS-JEZERO-FROST-19',
    difficulty: 'normal',
    onComplete: (payload) => {
      completedChisel.push(payload);
    },
  });
  cleanChiselManager.setVortexPosition(250, 240); // Away from all 5 valves
  for (let i = 0; i < 5; i++) {
    const chipped = cleanChiselManager.tapAcousticChisel(i, 1.0);
    assert.equal(chipped, true);
  }
  assert.equal(cleanChiselManager.getCryoValvesDeIcedCount(), 5);
  assert.equal(cleanChiselManager.getPerformanceRatio(), 0.0);
  assert.equal(completedChisel.length, 1);
  assert.deepEqual(completedChisel[0].deltas, {
    powerDelta: -5,
    o2Delta: -9,
    shieldingDelta: -8,
    scienceDelta: 20,
  });
});

test('Every single NASA space event mini-game has complete telemetry data points, 3-step How-To-Solve guide, controls summary, and pause/resume support', () => {
  assert.equal(NASA_SPACE_EVENTS.length, 10);

  for (const ev of NASA_SPACE_EVENTS) {
    const desc = getMiniGameDescriptor(ev.donkiCode);
    assert.equal(
      desc.eventCode,
      ev.donkiCode,
      `Event ${ev.id} (${ev.donkiCode}) must map to its exact MiniGameDescriptor`
    );
    assert.equal(desc.telemetryDataPoints.length, 3);
    assert.equal(desc.howToSolveSteps.length, 3);
    for (const pt of desc.telemetryDataPoints) {
      assert.ok(pt.trim().length > 10, `Telemetry data point must be descriptive for ${ev.donkiCode}`);
    }
    for (const step of desc.howToSolveSteps) {
      assert.ok(step.includes('STEP'), `How-to-solve step must include STEP label for ${ev.donkiCode}`);
    }
    assert.ok(desc.controlsSummary.trim().length > 10);
    assert.ok(desc.proTip.trim().length > 10);
    assert.ok(desc.zeroPctLabel.trim().length > 3);
    assert.ok(desc.hundredPctLabel.trim().length > 3);

    const mgr = new MiniGameManager({
      eventCode: ev.donkiCode,
      difficulty: 'normal',
    });
    assert.equal(mgr.isPaused(), false);
    mgr.pause();
    assert.equal(mgr.isPaused(), true);
    mgr.resume();
    assert.equal(mgr.isPaused(), false);
  }
});

test('Easy (Cadet) mode simplifies every mini-game to 1 action, max 3 targets, and kid-friendly text without hotkey brackets', () => {
  assert.equal(DIFFICULTY_CONFIGS.easy.miniGameHintDelaySec, 4);
  assert.equal(DIFFICULTY_CONFIGS.normal.miniGameHintDelaySec, 6);
  assert.ok(DIFFICULTY_CONFIGS.hard.miniGameHintDelaySec > 60);

  for (const ev of NASA_SPACE_EVENTS) {
    const desc = getMiniGameDescriptor(ev.donkiCode);
    assert.ok(desc.goalIcon.trim().length >= 1, `goalIcon missing for ${ev.donkiCode}`);
    assert.ok(desc.nasaFunFact.trim().length > 15, `nasaFunFact missing for ${ev.donkiCode}`);
    const bannerWords = desc.goalBanner.trim().split(/\s+/);
    assert.ok(
      bannerWords.length <= 8,
      `goalBanner should be <=8 words for ${ev.donkiCode}: "${desc.goalBanner}"`
    );
    assert.ok(
      !/\[[A-Za-z0-9\s/–-]+\]/.test(desc.controlsSummary),
      `controlsSummary should not list keybinding brackets for ${ev.donkiCode}`
    );
  }

  // Easy mode 1-action checks:
  const o2Easy = new MiniGameManager({ eventCode: 'ECLSS-O2-SEAL-404', difficulty: 'easy' });
  assert.equal(o2Easy.isValveInSafeZone(), true);
  assert.equal(o2Easy.getSnapshot().totalFracturesCount, 3);
  o2Easy.applyInteractionImpulse();
  o2Easy.applyInteractionImpulse();
  o2Easy.applyInteractionImpulse();
  assert.equal(o2Easy.getPerformanceRatio(), 1);

  const flrEasy = new MiniGameManager({ eventCode: 'DONKI-FLR-2026-X2.4', difficulty: 'easy' });
  assert.equal(flrEasy.isSolarArraysFeathered(), true);
  assert.equal(flrEasy.getSnapshot().protonsTotal, 3);

  const sepEasy = new MiniGameManager({ eventCode: 'DONKI-SEP-2026-M8.1', difficulty: 'easy' });
  assert.equal(sepEasy.getSnapshot().totalBladdersCount, 3);
  assert.equal(sepEasy.getSnapshot().openJunctionsCount, 3);

  const bioEasy = new MiniGameManager({ eventCode: 'OSDR-OSD-379-BIO', difficulty: 'easy' });
  assert.equal(bioEasy.getSnapshot().totalSporesCount, 3);
  assert.equal(bioEasy.getSnapshot().waveformMatchPct, 100);

  const dustEasy = new MiniGameManager({ eventCode: 'ARTEMIS-DUST-LEV-09', difficulty: 'easy' });
  assert.equal(dustEasy.getSnapshot().totalDustCount, 3);
  for (let i = 0; i < 3; i++) dustEasy.swipeManualEvaBrush(i);
  assert.equal(dustEasy.getArcShockCount(), 0);
  assert.equal(dustEasy.getDustClearedCount(), 3);

  const lroEasy = new MiniGameManager({ eventCode: 'LRO-IMPACT-SWARM-12', difficulty: 'easy' });
  assert.equal(lroEasy.getSnapshot().meteorsTotal, 3);

  const medaEasy = new MiniGameManager({ eventCode: 'MARS-MEDA-DUST-88', difficulty: 'easy' });
  assert.equal(medaEasy.getSnapshot().totalMoxieFilters, 3);

  const frostEasy = new MiniGameManager({ eventCode: 'MARS-JEZERO-FROST-19', difficulty: 'easy' });
  assert.equal(frostEasy.getSnapshot().totalCryoValves, 3);
});

test('Moon uses Day/Days everywhere while Mars uses Sol/Sols everywhere in user-facing strings', () => {
  assert.equal(MISSION_SITES.artemis_shackleton.dayName, 'Day');
  assert.equal(MISSION_SITES.mars_jezero.dayName, 'Sol');
  assert.equal(getTimeUnit('artemis_shackleton'), 'Day');
  assert.equal(getTimeUnitPlural('artemis_shackleton'), 'Days');
  assert.equal(getTimeUnit('mars_jezero'), 'Sol');
  assert.equal(getTimeUnitPlural('mars_jezero'), 'Sols');

  const moonInit = createInitialGameState('artemis_shackleton', 'Lunar Cadet', 'normal');
  assert.ok(moonInit.historyLog[0].includes('Day 1'));
  assert.ok(moonInit.historyLog[0].includes('10 Days'));
  assert.ok(!/\bSols?\b/i.test(moonInit.historyLog[0]));

  const moonAction = applyStationAction(moonInit, 'solar_array');
  assert.ok(moonAction.historyLog[0].startsWith('Day 1 '));
  assert.ok(!/\bSols?\b/i.test(moonAction.historyLog[0]));

  const moonOvernight = advanceSolOvernight(moonAction);
  assert.ok(moonOvernight.historyLog[0].startsWith('Day 1 Overnight'));
  assert.ok(!/\bSols?\b/i.test(moonOvernight.historyLog[0]));

  const moonDay10LowSci = createInitialGameState('artemis_shackleton', 'Lunar Cadet', 'normal');
  moonDay10LowSci.sol = 10;
  moonDay10LowSci.scienceScore = 100;
  const moonFail = advanceSolOvernight(moonDay10LowSci);
  assert.ok(moonFail.failureReason?.includes('Crew survived Day 10'));
  assert.ok(!/\bSols?\b/i.test(moonFail.failureReason || ''));

  const marsInit = createInitialGameState('mars_jezero', 'Mars Cadet', 'normal');
  assert.ok(marsInit.historyLog[0].includes('Sol 1'));
  assert.ok(marsInit.historyLog[0].includes('10 Sols'));

  const marsDay10LowSci = createInitialGameState('mars_jezero', 'Mars Cadet', 'normal');
  marsDay10LowSci.sol = 10;
  marsDay10LowSci.scienceScore = 100;
  const marsFail = advanceSolOvernight(marsDay10LowSci);
  assert.ok(marsFail.failureReason?.includes('Crew survived Sol 10'));
});

test('normalizeDonkiPayload handles missing/malformed fields, limits to 5 newest items, and empty payload yields Quiet Sun mood', () => {
  const empty = normalizeDonkiPayload({
    flares: null,
    cmes: undefined,
    storms: 'bad' as unknown,
    sepEvents: [],
    fetchedAt: '2026-11-14T12:00:00Z',
  });
  assert.deepEqual(empty.flares, []);
  assert.deepEqual(empty.cmes, []);
  assert.deepEqual(empty.storms, []);
  assert.deepEqual(empty.sepEvents, []);
  assert.equal(computeSunMood(empty, Date.parse('2026-11-14T12:00:00Z')), 'Quiet');

  const manyFlares = Array.from({ length: 7 }, (_, i) => ({
    flrID: `2026-11-${10 + i}T01:00:00-FLR-001`,
    peakTime: `2026-11-${10 + i}T01:00:00Z`,
    classType: i === 6 ? 'X1.2' : 'C4.0',
    link: `https://ccmc.gsfc.nasa.gov/tools/DONKI/view/FLR/${i}`,
  }));
  const normalized = normalizeDonkiPayload({
    flares: [
      null,
      {}, // missing peakTime/beginTime should be dropped
      ...manyFlares,
    ],
    cmes: [
      {
        activityID: 'CME-1',
        startTime: '2026-11-14T00:00:00Z',
        cmeAnalyses: [{ isMostAccurate: false, speed: 420 }, { isMostAccurate: true, speed: 912.6 }],
        link: 'http://insecure.example.com', // non-https stripped to safe fallback URL
      },
    ],
    storms: [
      {
        gstID: 'GST-1',
        startTime: '2026-11-13T18:00:00Z',
        allKpIndex: [{ kpIndex: 4.3 }, { kpIndex: 6.0 }],
      },
    ],
    fetchedAt: '2026-11-14T12:00:00Z',
  });

  assert.equal(normalized.flares.length, 5);
  assert.equal(normalized.flares[0].classType, 'X1.2'); // newest first
  assert.equal(normalized.cmes[0].speedKmPerSec, 913);
  assert.ok(normalized.cmes[0].link.startsWith('https://'));
  assert.equal(normalized.storms[0].maxKp, 6);
  assert.equal(computeSunMood(normalized, Date.parse('2026-11-14T12:00:00Z')), 'Stormy');
});

test('SpaceWeatherService serves fallback when key missing/placeholder, caches for 30m, coalesces concurrent calls, handles stale-on-error, and honors 429 cooldown', async () => {
  // 1. Missing or placeholder key -> fallback with 0 upstream calls
  let calls = 0;
  const noKeyService = createSpaceWeatherService({
    getApiKey: () => 'MY_NASA_API_KEY',
    fetchFn: (async () => {
      calls++;
      throw new Error('Should not be called');
    }) as unknown as typeof fetch,
  });
  const fb = await noKeyService.getSpaceWeather();
  assert.equal(fb.status, 'fallback');
  assert.equal(calls, 0);

  // 2. Live fetch + X-Api-Key header + 30m cache + single-flight + stale-on-error + 429 cooldown
  let nowMs = Date.parse('2026-11-14T12:00:00Z');
  let upstreamCalls = 0;
  let mode: 'ok' | 'fail' | '429' | 'low_remaining' = 'ok';

  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    upstreamCalls++;
    const urlStr = String(input);
    const headers = (init?.headers || {}) as Record<string, string>;
    assert.equal(headers['X-Api-Key'], 'TEST_KEY_NOT_REAL');
    assert.ok(!urlStr.includes('api_key='));

    if (mode === '429') {
      return new Response('Too Many Requests', { status: 429 });
    }
    if (mode === 'fail') {
      throw new Error('Network down');
    }

    const respHeaders = new Headers({
      'x-ratelimit-remaining': mode === 'low_remaining' ? '12' : '950',
    });

    if (urlStr.includes('/FLR?')) {
      return new Response(
        JSON.stringify([
          {
            flrID: '2026-11-14T08:00:00-FLR-001',
            peakTime: '2026-11-14T08:00:00Z',
            classType: 'M4.2',
            link: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/view/FLR/1',
          },
        ]),
        { status: 200, headers: respHeaders }
      );
    }
    return new Response(JSON.stringify([]), { status: 200, headers: respHeaders });
  }) as unknown as typeof fetch;

  const svc = createSpaceWeatherService({
    fetchFn: fakeFetch,
    nowFn: () => nowMs,
    getApiKey: () => 'TEST_KEY_NOT_REAL',
  });

  // Single-flight: 4 concurrent requests trigger only 1 batch of 4 endpoint calls
  const batch = await Promise.all([
    svc.getSpaceWeather(),
    svc.getSpaceWeather(),
    svc.getSpaceWeather(),
    svc.getSpaceWeather(),
  ]);
  assert.equal(upstreamCalls, 4);
  assert.equal(batch[0].status, 'live');
  assert.equal(batch[0].flares[0].classType, 'M4.2');

  // Within 30-min TTL: served from cache with 0 extra calls
  nowMs += CACHE_TTL_MS - 1000;
  const cached = await svc.getSpaceWeather();
  assert.equal(upstreamCalls, 4);
  assert.equal(cached.status, 'live');

  // After TTL expires, upstream fails -> serves stale cache
  nowMs += 2000;
  mode = 'fail';
  const staleRes = await svc.getSpaceWeather();
  assert.equal(staleRes.status, 'stale');
  assert.equal(staleRes.stale, true);
  assert.equal(staleRes.flares[0].classType, 'M4.2');

  // After 24h max stale age + fail -> falls back to bundled snapshot
  nowMs += STALE_MAX_AGE_MS + 1000;
  const expiredFallback = await svc.getSpaceWeather();
  assert.equal(expiredFallback.status, 'fallback');

  // Reset to ok, trigger 429 cooldown and verify upstream is NOT called during cooldown
  mode = '429';
  const callsBefore429 = upstreamCalls;
  await svc.getSpaceWeather();
  const callsAfter429 = upstreamCalls;
  assert.ok(callsAfter429 > callsBefore429);

  mode = 'ok';
  await svc.getSpaceWeather();
  assert.equal(upstreamCalls, callsAfter429, 'Must not call upstream while in 429 cooldown');

  // Once cooldown elapses, upstream works again
  nowMs += RATE_LIMIT_COOLDOWN_MS + 1000;
  const recovered = await svc.getSpaceWeather();
  assert.equal(recovered.status, 'live');
  assert.ok(upstreamCalls > callsAfter429);
});

test('Space weather gently weights event selection without changing seeded path or resource deltas', () => {
  const nowMs = Date.parse('2026-11-14T12:00:00Z');
  const pool = getEventsForSite('artemis_shackleton');

  const flareWeather: SpaceWeatherSummary = {
    status: 'live',
    fetchedAt: '2026-11-14T12:00:00Z',
    windowDays: 30,
    source: { name: 'NASA DONKI', via: 'api.nasa.gov', url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/' },
    flares: [{ id: 'FLR-1', classType: 'X1.1', peakTime: '2026-11-13T10:00:00Z', link: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/' }],
    cmes: [],
    storms: [],
    sepEvents: [],
  };

  const flareWeights = computeEventWeights(pool, flareWeather, nowMs);
  const flareIdx = pool.findIndex((e) => e.id === 'donki_x2_flare');
  assert.equal(flareWeights[flareIdx], 3);
  assert.equal(flareWeights.filter((w) => w === 1).length, pool.length - 1);

  const stormWeather: SpaceWeatherSummary = {
    ...flareWeather,
    flares: [],
    storms: [{ id: 'GST-1', startTime: '2026-11-13T10:00:00Z', maxKp: 6, link: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/' }],
  };
  const stormWeights = computeEventWeights(pool, stormWeather, nowMs);
  const gcrIdx = pool.findIndex((e) => e.id === 'donki_gcr_spike');
  assert.equal(stormWeights[gcrIdx], 3);

  const quietWeather: SpaceWeatherSummary = {
    ...flareWeather,
    flares: [],
  };
  const quietWeights = computeEventWeights(pool, quietWeather, nowMs);
  const quietIdx = pool.findIndex((e) => e.id === 'nominal_clear_skies');
  assert.equal(quietWeights[quietIdx], 3);

  // Seeded triggerEndOfSolEvent must remain deterministic even when liveWeather is passed
  const state = createInitialGameState('artemis_shackleton', 'Cadet', 'normal');
  const seeded = triggerEndOfSolEvent(state, 0, flareWeather, nowMs);
  assert.equal(seeded.activeEvent?.id, pool[0].id);

  // Attribution honesty labels
  const flareEv = pool[flareIdx];
  const scenarioAttr = getEventAttribution(flareEv, null);
  assert.equal(scenarioAttr.dataOrigin, 'scenario');
  assert.equal(scenarioAttr.realRecordText, undefined);

  const liveAttr = getEventAttribution(flareEv, flareWeather);
  assert.equal(liveAttr.dataOrigin, 'live');
  assert.ok(liveAttr.realRecordText?.includes('X1.1 flare'));
  assert.ok(liveAttr.realRecordText?.includes('FLR-1'));
});

test('Every entry in DATA_SOURCES uses https:// and has attribution metadata', () => {
  assert.ok(DATA_SOURCES.length >= 12);
  for (const src of DATA_SOURCES) {
    assert.ok(src.url.startsWith('https://'), `Source URL must be https:// (${src.id})`);
    assert.ok(src.name.trim().length > 0);
    assert.ok(src.publisher.trim().length > 0);
    assert.ok(src.creditLine.trim().length > 0);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(src.retrievedOn));
  }
});

test('1. Absorbed Dose Rate (RadLab): EVA Timer & Shielding Planner computes authentic dosimetry exposure gauge and requires shelter cycling at high flux', () => {
  // Quiet Sun DOSTEL-1 with Sintered Regolith + Water Core over a short 2h EVA stays well within safe daily limit
  const safePlan = computeEvaRadiationPlan(
    'ISS-COLUMBUS-DOSTEL-1',
    'sintered_regolith',
    2.0,
    'artemis_shackleton'
  );
  assert.equal(safePlan.requiresShelterCycle, false);
  assert.ok(safePlan.exposureGaugePct < 75);
  assert.ok(safePlan.shieldingDelta > 0);

  // Stormy ALTEA SEP Peak with bare aluminum over an 8h EVA exceeds safe operational threshold and requires shelter cycling
  const stormPlan = computeEvaRadiationPlan(
    'ISS-ZVEZDA-ALTEA-SPE',
    'bare_aluminum',
    8.0,
    'artemis_shackleton'
  );
  assert.equal(stormPlan.requiresShelterCycle, true);
  assert.ok(stormPlan.exposureGaugePct >= 75);
  assert.ok(stormPlan.shieldingDelta < 0);
});

test('2. Solar Flare & CME Alerts (DONKI): Space Weather Emergency Alert System evaluates antenna stowage and safe module retreat', () => {
  const stowAntenna = evaluateDonkiTacticalAction('secure_antenna_arrays', 'X2.4', 850);
  assert.equal(stowAntenna.commDropoutPrevented, true);
  assert.equal(stowAntenna.scienceDelta, 28);
  assert.ok(stowAntenna.shieldingDelta > 0);

  const retreatModule = evaluateDonkiTacticalAction('retreat_safe_module', 'X2.4', 850);
  assert.equal(retreatModule.commDropoutPrevented, true);
  assert.equal(retreatModule.crewFluxProtected, true);
  assert.equal(retreatModule.shieldingDelta, 20);

  const rideOut = evaluateDonkiTacticalAction('ride_out_flux', 'X2.4', 850);
  assert.equal(rideOut.commDropoutPrevented, false);
  assert.equal(rideOut.crewFluxProtected, false);
  assert.ok(rideOut.shieldingDelta < 0);
});

test('3. Bone Density & Muscle Mass Loss Rates (OSDR): Crew Conditioning & Countermeasure Scheduler counters biological atrophy', () => {
  // Optimal daily routine (90m resistive exercise, 8h sleep, 95% bio-regenerative diet)
  const optimal = evaluateCountermeasureSchedule({
    resistiveExerciseMin: 90,
    sleepHours: 8.0,
    bioRegenNutritionPct: 95,
    gravityG: 0.166,
  });
  assert.equal(optimal.atrophyRiskLevel, 'OPTIMAL');
  assert.ok(optimal.crewStaminaScore >= 90);
  assert.ok(optimal.missionPerformanceMultiplier > 1.1);
  assert.ok(optimal.scienceDelta > 0);

  // Neglected daily exercise & poor sleep degrades stamina and triggers severe atrophy
  const neglected = evaluateCountermeasureSchedule({
    resistiveExerciseMin: 0,
    sleepHours: 4.5,
    bioRegenNutritionPct: 30,
    gravityG: 0.166,
  });
  assert.equal(neglected.atrophyRiskLevel, 'SEVERE_ATROPHY');
  assert.ok(neglected.boneDensityChangePctPerMonth < optimal.boneDensityChangePctPerMonth);
  assert.ok(neglected.muscleMassChangePctPerMonth < optimal.muscleMassChangePctPerMonth);
  assert.ok(neglected.crewStaminaScore < 40);
  assert.ok(neglected.scienceDelta < 0);
});

test('Combined Trainee Feed Payload integrates RadLab, DONKI, and OSDR parameters and applyTraineeProtocolToState updates live game state', () => {
  const payload = buildTraineeCombinedFeedPayload(null, Date.parse('2026-11-14T12:00:00Z'));
  assert.equal(payload.parameters.absorbedDoseRate.parameterName, 'Absorbed Dose Rate');
  assert.equal(
    payload.parameters.absorbedDoseRate.sourceDataset,
    'RadLab (OSDR Radiation Dosimetry Database)'
  );
  assert.equal(payload.parameters.absorbedDoseRate.issInstruments.length, 3);
  assert.equal(
    payload.parameters.solarFlareAndCmeAlerts.parameterName,
    'Solar Flare & Coronal Mass Ejection (CME) Alerts'
  );
  assert.equal(
    payload.parameters.boneAndMuscleLossRates.parameterName,
    'Bone Density and Muscle Mass Loss Rates'
  );
  assert.equal(payload.parameters.boneAndMuscleLossRates.referenceStudies.length, 2);

  const initial = createInitialGameState('artemis_shackleton', 'Cadet', 'normal');
  const updated = applyTraineeProtocolToState(initial, 'OSDR Crew Conditioning', {
    powerDelta: -6,
    lifeSupportDelta: 10,
    shieldingDelta: 4,
    scienceDelta: 30,
  });
  assert.equal(updated.power, initial.power - 6);
  assert.equal(updated.lifeSupport, initial.lifeSupport + 10);
  assert.equal(updated.shielding, initial.shielding + 4);
  assert.equal(updated.scienceScore, initial.scienceScore + 30);
});

test('Background music uses Void_Survival_c375955c.mp3 at mild volume (0.18) and syncs with mute and pause shell modes', () => {
  assert.equal(BACKGROUND_MUSIC_SRC, '/assets/aistudio/Void_Survival_c375955c.mp3');
  assert.equal(BACKGROUND_MUSIC_MILD_VOLUME, 0.18);
  assert.ok(BACKGROUND_MUSIC_MILD_VOLUME > 0 && BACKGROUND_MUSIC_MILD_VOLUME <= 0.25);

  let paused = true;
  const mockAudio = {
    loop: false,
    volume: 1,
    muted: false,
    play() {
      paused = false;
      return Promise.resolve();
    },
    pause() {
      paused = true;
    },
  } as unknown as HTMLAudioElement;

  soundFX.muted = false;
  soundFX.bindBackgroundAudio(mockAudio);
  assert.equal(mockAudio.loop, true);
  assert.equal(mockAudio.volume, 0.18);

  soundFX.syncGameShellMode('playing');
  assert.equal(paused, false);

  soundFX.syncGameShellMode('paused');
  assert.equal(paused, true);

  soundFX.syncGameShellMode('playing');
  assert.equal(paused, false);

  soundFX.muted = true;
  assert.equal(mockAudio.muted, true);
  assert.equal(mockAudio.volume, 0);
  assert.equal(paused, true);

  soundFX.muted = false;
  assert.equal(mockAudio.muted, false);
  assert.equal(mockAudio.volume, 0.18);
  assert.equal(paused, false);

  soundFX.bindBackgroundAudio(null);
});

test('computeMissionRank evaluates all 6 post-game performance tiers (IRON, BRONZE, SILVER, GOLD, PLATINUM, DIAMOND)', () => {
  assert.deepEqual(MISSION_RANK_ORDER, [
    'IRON',
    'BRONZE',
    'SILVER',
    'GOLD',
    'PLATINUM',
    'DIAMOND',
  ]);

  // 1. IRON: Early failure on Sol 2 with low science and depleted power
  const iron = computeMissionRank({
    status: 'failed',
    sol: 2,
    maxSols: 10,
    scienceScore: 95,
    minScienceToWin: 600,
    power: 0,
    lifeSupport: 30,
    shielding: 35,
    difficulty: 'normal',
  });
  assert.equal(iron.rank, 'IRON');
  assert.equal(iron.nextRank, 'BRONZE');

  // 2. BRONZE: Mid-mission scrub on Sol 5 with moderate science
  const bronze = computeMissionRank({
    status: 'failed',
    sol: 5,
    maxSols: 10,
    scienceScore: 280,
    minScienceToWin: 600,
    power: 45,
    lifeSupport: 0,
    shielding: 50,
    difficulty: 'normal',
  });
  assert.equal(bronze.rank, 'BRONZE');
  assert.equal(bronze.nextRank, 'SILVER');

  // 3. SILVER: Late-mission scrub on Sol 9 with strong science before failing
  const silver = computeMissionRank({
    status: 'failed',
    sol: 9,
    maxSols: 10,
    scienceScore: 540,
    minScienceToWin: 600,
    power: 55,
    lifeSupport: 50,
    shielding: 0,
    difficulty: 'normal',
  });
  assert.equal(silver.rank, 'SILVER');
  assert.equal(silver.nextRank, 'GOLD');

  // 4. GOLD: Completed all 10 Sols and met science goal with slim resource margins
  const gold = computeMissionRank({
    status: 'victory',
    sol: 10,
    maxSols: 10,
    scienceScore: 605,
    minScienceToWin: 600,
    power: 18,
    lifeSupport: 22,
    shielding: 20,
    difficulty: 'normal',
  });
  assert.equal(gold.rank, 'GOLD');
  assert.equal(gold.nextRank, 'PLATINUM');

  // 5. PLATINUM: Completed all 10 Sols with solid resources (>=25%) and good science
  const platinum = computeMissionRank({
    status: 'victory',
    sol: 10,
    maxSols: 10,
    scienceScore: 660,
    minScienceToWin: 600,
    power: 52,
    lifeSupport: 48,
    shielding: 50,
    difficulty: 'normal',
  });
  assert.equal(platinum.rank, 'PLATINUM');
  assert.equal(platinum.nextRank, 'DIAMOND');

  // 6. DIAMOND: Completed all 10 Sols with high science surplus and strong resource margins (>=45%)
  const diamond = computeMissionRank({
    status: 'victory',
    sol: 10,
    maxSols: 10,
    scienceScore: 840,
    minScienceToWin: 600,
    power: 80,
    lifeSupport: 76,
    shielding: 78,
    difficulty: 'hard',
  });
  assert.equal(diamond.rank, 'DIAMOND');
  assert.equal(diamond.nextRank, null);
  assert.ok(diamond.performanceScore >= 85);
});

test('Every mini-game descriptor includes a complete Real-Life NASA Engineering Solution and interactive field verification question', () => {
  for (const ev of NASA_SPACE_EVENTS) {
    const desc = getMiniGameDescriptor(ev.donkiCode);
    assert.ok(desc.realLifeSolution, `realLifeSolution missing for ${ev.donkiCode}`);
    assert.ok(
      desc.realLifeSolution.solutionTitle.trim().length > 10,
      `solutionTitle too short for ${ev.donkiCode}`
    );
    assert.ok(
      desc.realLifeSolution.nasaSystemCode.trim().length > 8,
      `nasaSystemCode too short for ${ev.donkiCode}`
    );
    assert.ok(
      desc.realLifeSolution.realWorldPrinciple.trim().length > 30,
      `realWorldPrinciple too short for ${ev.donkiCode}`
    );
    assert.ok(
      desc.realLifeSolution.primaryActionLabel.trim().length > 5,
      `primaryActionLabel missing for ${ev.donkiCode}`
    );
    assert.ok(
      desc.realLifeSolution.fieldQuestion.trim().endsWith('?'),
      `fieldQuestion should end with '?' for ${ev.donkiCode}`
    );
    assert.equal(desc.realLifeSolution.solutionChoices.length, 2);
    const correctCount = desc.realLifeSolution.solutionChoices.filter((c) => c.isCorrect).length;
    assert.equal(
      correctCount,
      1,
      `Expected exactly 1 correct choice in realLifeSolution for ${ev.donkiCode}`
    );
  }
});
