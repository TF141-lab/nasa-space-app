import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  advanceSolOvernight,
  applyStationAction,
  applyTraineeProtocolToState,
  computeMissionRank,
  createInitialGameState,
  DIFFICULTY_CONFIGS,
  DifficultyLevel,
  getEventByCode,
  getRandomEventDelayMs,
  getTimeUnit,
  getTimeUnitPlural,
  MISSION_RANK_ORDER,
  MISSION_SITES,
  MissionRankTier,
  OutpostGameState,
  resolveActiveEventWithMiniGame,
  SiteId,
  StationId,
  triggerEndOfSolEvent,
} from './game/rules';
import { MiniGameCompletionPayload } from './game/MiniGameManager';
import { OutpostCanvas, OUTPOST_STATIONS } from './game/OutpostCanvas';
import {
  BACKGROUND_MUSIC_MILD_VOLUME,
  BACKGROUND_MUSIC_SRC,
  soundFX,
} from './game/sound';
import {
  NasaCodexModal,
  SolTransitionModal,
  SpaceEventModal,
  SpaceEventTopRightPopup,
  StationTradeOffModal,
} from './components/Modals';
import { AdvisorModal } from './components/AdvisorModal';
import { CreditsModal } from './components/CreditsModal';
import { TraineeDashboardModal } from './components/TraineeDashboardModal';
import { recordMissionLog } from './firebase.ts';
import type { OsdrStudyHighlight, SpaceWeatherSummary } from './types/spaceWeather';
import { computeSunMood } from './utils/spaceWeatherDisplay';

type GameShellMode = 'title' | 'playing' | 'paused' | 'gameover';

export default function App() {
  const [gameMode, setGameMode] = useState<GameShellMode>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const goParam = params.get('gameover');
      if (goParam === 'victory' || goParam === 'failed') {
        return 'gameover';
      }
      if (params.get('autostart') === '1' || params.get('event') || params.get('lab') === '1') {
        return 'playing';
      }
    }
    return 'title';
  });

  const [selectedSite, setSelectedSite] = useState<SiteId>('artemis_shackleton');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('normal');
  const [commanderName, setCommanderName] = useState<string>('Cadet Nova');
  const [gameState, setGameState] = useState<OutpostGameState>(() => {
    const initial = createInitialGameState('artemis_shackleton', 'Cadet Nova', 'normal');
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const evParam = params.get('event');
      if (evParam) {
        const matched = getEventByCode(evParam);
        if (matched) {
          initial.activeEvent = matched;
        }
      }
    }
    return initial;
  });

  // Frozen end-of-run snapshot for Victory / Game Over modal
  const [endRunSnapshot, setEndRunSnapshot] = useState<{
    siteId: SiteId;
    sol: number;
    scienceScore: number;
    power: number;
    lifeSupport: number;
    shielding: number;
    status: 'victory' | 'failed';
    failureReason: string | null;
  } | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const goParam = params.get('gameover');
      if (goParam === 'victory') {
        return {
          siteId: 'artemis_shackleton',
          sol: 10,
          scienceScore: Number(params.get('sci') || 820),
          power: Number(params.get('pwr') || 78),
          lifeSupport: Number(params.get('o2') || 74),
          shielding: Number(params.get('shd') || 76),
          status: 'victory',
          failureReason: null,
        };
      }
      if (goParam === 'failed') {
        return {
          siteId: 'artemis_shackleton',
          sol: Number(params.get('sol') || 2),
          scienceScore: Number(params.get('sci') || 110),
          power: Number(params.get('pwr') || 0),
          lifeSupport: Number(params.get('o2') || 42),
          shielding: Number(params.get('shd') || 50),
          status: 'failed',
          failureReason:
            'Habitat electrical bus dropped to 0% during lunar night thermal load.',
        };
      }
    }
    return null;
  });

  const [nearStation, setNearStation] = useState<StationId | null>(null);
  const [inspectingStation, setInspectingStation] = useState<StationId | null>(null);
  const [isMiniGameActive, setIsMiniGameActive] = useState(false);
  const [showEnteringSolModal, setShowEnteringSolModal] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const [showTraineeLab, setShowTraineeLab] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('lab') === '1';
    }
    return false;
  });
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [muted, setMuted] = useState(false);

  // Live NASA DONKI & OSDR space data (server-fetched; offline/fallback resilient)
  const [liveWeather, setLiveWeather] = useState<SpaceWeatherSummary | null>(null);
  const [weatherOffline, setWeatherOffline] = useState(false);
  const [osdrStudy, setOsdrStudy] = useState<OsdrStudyHighlight | null>(null);
  const [nasaApiStatus, setNasaApiStatus] = useState<{
    configured: boolean;
    keyMasked: string | null;
    mode: 'live' | 'stale' | 'fallback';
    isRateLimited: boolean;
    rateLimitedUntil: string | null;
    lastUpdated: string | null;
  } | null>(null);
  const liveWeatherRef = useRef<SpaceWeatherSummary | null>(null);
  liveWeatherRef.current = liveWeather;
  const lastWeatherFetchMsRef = useRef<number>(0);

  const site = MISSION_SITES[gameState.siteId];
  const unit = site.dayName; // "Day" | "Sol"
  const unitPlural = unit + 's'; // "Days" | "Sols"

  // Keep document state in sync for accessibility and keyboard focus
  // and keep background music synced with shell state (pauses on 'paused', plays at mild volume otherwise)
  useEffect(() => {
    document.body.dataset.state = gameMode;
    soundFX.syncGameShellMode(gameMode);
  }, [gameMode]);

  // Unlock and start mild background music on first user gesture (pointerdown / keydown)
  useEffect(() => {
    const handleUnlock = () => {
      soundFX.unlockAndPlayBgm();
    };
    window.addEventListener('pointerdown', handleUnlock, { passive: true });
    window.addEventListener('keydown', handleUnlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
    };
  }, []);

  // Fetch live space weather on load and every 30 min ONLY while tab is visible
  useEffect(() => {
    let active = true;
    const POLL_INTERVAL_MS = 30 * 60 * 1000;

    const loadWeather = async () => {
      try {
        const res = await fetch('/api/space-weather');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as SpaceWeatherSummary;
        if (!active) return;
        setLiveWeather(data);
        setWeatherOffline(false);
        lastWeatherFetchMsRef.current = Date.now();
      } catch {
        if (!active) return;
        setWeatherOffline(true);
      }
    };

    const loadOsdr = async () => {
      try {
        const res = await fetch('/api/osdr-study');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as OsdrStudyHighlight;
        if (!active) return;
        setOsdrStudy(data);
      } catch {
        // Optional highlight; silently ignore
      }
    };

    const loadNasaStatus = async () => {
      try {
        const res = await fetch('/api/nasa/status');
        if (res.ok) {
          const data = await res.json();
          if (active) setNasaApiStatus(data);
        }
      } catch {
        // Optional status; silently ignore
      }
    };

    loadWeather();
    loadOsdr();
    loadNasaStatus();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadWeather();
        loadNasaStatus();
      }
    }, POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastWeatherFetchMsRef.current >= POLL_INTERVAL_MS
      ) {
        loadWeather();
        loadNasaStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const startNewMission = useCallback(
    (siteOverride?: SiteId, diffOverride?: DifficultyLevel) => {
      const targetSite = siteOverride || selectedSite;
      const targetDiff = diffOverride || selectedDifficulty;
      const fresh = createInitialGameState(targetSite, commanderName, targetDiff);

      setGameState(fresh);
      setEndRunSnapshot(null);
      setInspectingStation(null);
      setIsMiniGameActive(false);
      setShowEnteringSolModal(false);
      setGameMode('playing');
      document.body.dataset.state = 'playing';
      soundFX.syncGameShellMode('playing');
      soundFX.unlockAndPlayBgm();

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [selectedSite, selectedDifficulty, commanderName]
  );

  // Keyboard shortcuts for Title Start (Enter/Space), Pause (P/Esc), Restart (R), Mute (M)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (gameMode === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        startNewMission();
        return;
      }

      if (
        showEnteringSolModal &&
        (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')
      ) {
        e.preventDefault();
        setShowEnteringSolModal(false);
        return;
      }

      if (e.key === 'Escape') {
        if (inspectingStation) {
          setInspectingStation(null);
          return;
        }
        if (showCredits) {
          setShowCredits(false);
          return;
        }
        if (showCodex) {
          setShowCodex(false);
          return;
        }
        if (showAdvisor) {
          setShowAdvisor(false);
          return;
        }
        if (showTraineeLab) {
          setShowTraineeLab(false);
          return;
        }
        if (gameMode === 'playing') {
          setGameMode('paused');
        } else if (gameMode === 'paused') {
          setGameMode('playing');
        }
      }

      // Quick-trigger for active space hazard event
      if (
        gameState.activeEvent &&
        !isMiniGameActive &&
        gameMode === 'playing' &&
        !inspectingStation &&
        !showCodex &&
        !showAdvisor &&
        !showCredits &&
        !showTraineeLab &&
        (e.key === ' ' || e.key === 'Enter' || e.key === '1')
      ) {
        e.preventDefault();
        soundFX.playInteract();
        setIsMiniGameActive(true);
        return;
      }

      if (
        e.key.toLowerCase() === 'p' &&
        !inspectingStation &&
        !showCodex &&
        !showAdvisor &&
        !showCredits &&
        !showTraineeLab
      ) {
        if (gameMode === 'playing') setGameMode('paused');
        else if (gameMode === 'paused') setGameMode('playing');
      }

      if (
        e.key.toLowerCase() === 'm' &&
        !inspectingStation &&
        !showCodex &&
        !showAdvisor &&
        !showCredits &&
        !showTraineeLab
      ) {
        setMuted((prev) => {
          const next = !prev;
          soundFX.muted = next;
          return next;
        });
      }

      if (
        e.key.toLowerCase() === 'r' &&
        gameMode === 'playing' &&
        !inspectingStation &&
        !showCredits &&
        !showTraineeLab
      ) {
        startNewMission();
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [
    gameMode,
    inspectingStation,
    showEnteringSolModal,
    showCodex,
    showAdvisor,
    showCredits,
    showTraineeLab,
    gameState.activeEvent,
    isMiniGameActive,
    startNewMission,
  ]);

  // Helper to record mission outcome to local and cloud mission logs
  const logMissionOutcome = useCallback(
    (st: OutpostGameState, reasonOverride?: string) => {
      recordMissionLog({
        commanderName,
        siteId: st.siteId,
        solsSurvived: st.sol,
        scienceScore: Math.round(st.scienceScore),
        outcome: st.status === 'victory' ? 'victory' : 'failed',
        summaryNote:
          st.status === 'victory'
            ? `Mission Completed! Survived all 10 ${getTimeUnitPlural(st.siteId)} with ${Math.round(st.scienceScore)} Science Points.`
            : `Mission ended on ${getTimeUnit(st.siteId)} ${st.sol}: ${reasonOverride || st.failureReason || 'Critical system depleted'}.`,
      }).catch(() => {});
    },
    [commanderName]
  );

  // Handle station action execution
  const handleExecuteStationAction = (stationId: StationId) => {
    soundFX.playInteract();
    const updated = applyStationAction(gameState, stationId);
    setGameState(updated);
    setInspectingStation(null);

    if (updated.status === 'failed') {
      soundFX.playAlert();
      setEndRunSnapshot({
        siteId: updated.siteId,
        sol: updated.sol,
        scienceScore: updated.scienceScore,
        power: updated.power,
        lifeSupport: updated.lifeSupport,
        shielding: updated.shielding,
        status: 'failed',
        failureReason: updated.failureReason,
      });
      setGameMode('gameover');
      logMissionOutcome(updated);
    }
  };

  // Random Time NASA Event Generator scaled by Difficulty Mode
  useEffect(() => {
    if (
      gameMode !== 'playing' ||
      gameState.status !== 'active' ||
      gameState.activeEvent ||
      showEnteringSolModal
    ) {
      return;
    }

    const delayMs = getRandomEventDelayMs(gameState.difficulty);
    const timer = window.setTimeout(() => {
      setGameState((prev) => {
        if (prev.status !== 'active' || prev.activeEvent) return prev;
        soundFX.playAlert();
        setIsMiniGameActive(false);
        return triggerEndOfSolEvent(prev, undefined, liveWeatherRef.current);
      });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [
    gameMode,
    gameState.status,
    gameState.activeEvent,
    gameState.difficulty,
    gameState.sol,
    showEnteringSolModal,
  ]);

  // Resolve Interactive Hazard Mini-Game callback during the Sol (does not advance Sol)
  const handleCompleteEventMiniGame = useCallback(
    (payload: MiniGameCompletionPayload) => {
      setIsMiniGameActive(false);
      setGameState((prev) => {
        const updated = resolveActiveEventWithMiniGame(
          prev,
          payload.performanceRatio,
          payload.deltas
        );
        if (updated.status === 'failed') {
          soundFX.playAlert();
          setEndRunSnapshot({
            siteId: updated.siteId,
            sol: updated.sol,
            scienceScore: updated.scienceScore,
            power: updated.power,
            lifeSupport: updated.lifeSupport,
            shielding: updated.shielding,
            status: 'failed',
            failureReason: updated.failureReason,
          });
          setGameMode('gameover');
          logMissionOutcome(updated);
        }
        return updated;
      });
    },
    [logMissionOutcome]
  );

  // End Sol & show Big "ENTERING SOL X" Popup Modal (or Victory / Failure after Sol 10)
  const handleTriggerEndSol = () => {
    setIsMiniGameActive(false);
    const updated = advanceSolOvernight(gameState);
    setGameState(updated);

    if (updated.status === 'victory' || updated.status === 'failed') {
      if (updated.status === 'victory') soundFX.playVictory();
      else soundFX.playAlert();

      setShowEnteringSolModal(false);
      setEndRunSnapshot({
        siteId: updated.siteId,
        sol: updated.sol,
        scienceScore: updated.scienceScore,
        power: updated.power,
        lifeSupport: updated.lifeSupport,
        shielding: updated.shielding,
        status: updated.status,
        failureReason: updated.failureReason,
      });
      setGameMode('gameover');
      logMissionOutcome(updated);
    } else {
      soundFX.playNewSol();
      setShowEnteringSolModal(true);
    }
  };

  const actionsRemaining = gameState.maxActionsPerSol - gameState.actionsTakenThisSol;

  const isMarsSite = gameState.siteId === 'mars_jezero';
  const hudPanelTheme = isMarsSite
    ? 'bg-[#0b1226] border border-orange-400/75 shadow-[0_10px_28px_rgba(0,0,0,0.68),0_0_16px_rgba(251,146,60,0.22)] rounded-[14px]'
    : 'bg-[#0b1226] border border-cyan-400/75 shadow-[0_10px_28px_rgba(0,0,0,0.68),0_0_16px_rgba(56,189,248,0.22)] rounded-[14px]';

  // Helper to render smooth rounded gradient progress bars for the 3 core resources
  const renderResourcePips = (value: number, gradientClass: string) => {
    const pct = Math.max(0, Math.min(100, value));
    return (
      <div
        className="w-full h-2.5 mt-1.5 rounded-full bg-slate-800 border border-slate-700/80 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${gradientClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#060b19] select-none">
      {/* Full-Viewport Smooth Atmospheric Outpost Canvas */}
      <div className="fixed inset-0 bg-[#060b19]">
        <OutpostCanvas
          siteId={gameState.siteId}
          gameMode={gameMode}
          sol={gameState.sol}
          power={gameState.power}
          lifeSupport={gameState.lifeSupport}
          shielding={gameState.shielding}
          actionsRemaining={actionsRemaining}
          activeStation={inspectingStation}
          activeEventId={gameState.activeEvent?.id || null}
          onNearStationChange={setNearStation}
          onTriggerStationModal={(stId) => setInspectingStation(stId)}
        />
      </div>

      {/* =====================================================================
          TITLE SCREEN OVERLAY (Stage 1: Live 2.5D Outpost Backdrop + Asymmetric Left/Right Split)
         ===================================================================== */}
      {gameMode === 'title' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-6 md:p-12 bg-[#0b1226] pointer-events-auto">
          <div className="w-full max-w-xl mx-auto bg-slate-900 border-2 border-amber-400 p-6 md:p-8 shadow-2xl">
            {/* Custom Inline SVG Title Emblem Lockup (Independent habitat badge) */}
            <div className="flex items-center gap-3 mb-3">
              <svg
                viewBox="0 0 48 48"
                className="w-12 h-12 shrink-0"
                aria-hidden="true"
              >
                <rect x="2" y="2" width="44" height="44" fill="#0f172a" stroke="#f59e0b" strokeWidth="3" />
                <circle cx="24" cy="24" r="13" fill="#0f766e" />
                <path d="M10 30 Q24 12 38 22" fill="none" stroke="#f59e0b" strokeWidth="3" />
                <rect x="21" y="9" width="6" height="12" fill="#f8fafc" />
                <polygon points="24,4 18,11 30,11" fill="#fbbf24" />
              </svg>
              <div>
                <div className="text-xs font-mono-tabular text-amber-400">
                  JUNIOR ASTRONAUT MISSION TRAINER · AGES 7–12
                </div>
                <h1 className="font-pixel text-lg md:text-xl text-white tracking-tight mt-1">
                  STARBOUND OUTPOST
                </h1>
              </div>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed mb-4">
              Command a 2.5D Lunar or Martian outpost inspired by{' '}
              <strong className="text-sky-300">NASA DONKI</strong> space weather,{' '}
              <strong className="text-emerald-300">OSDR</strong> biology, and{' '}
              <strong className="text-amber-300">Moon/Mars</strong> planetary datasets. Every
              choice has a genuine engineering trade-off—balance{' '}
              <strong>Power</strong>, <strong>Life Support (O2/Food)</strong>, and{' '}
              <strong>Radiation Shielding</strong> across 10 {getTimeUnitPlural(selectedSite)}!
            </p>

            {/* Mission Site Selector */}
            <div className="mb-3.5">
              <div className="text-xs font-bold text-slate-300 mb-2">
                SELECT SURFACE MISSION SITE:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(['artemis_shackleton', 'mars_jezero'] as SiteId[]).map((sId) => {
                  const cfg = MISSION_SITES[sId];
                  const isSelected = selectedSite === sId;
                  return (
                    <button
                      key={sId}
                      type="button"
                      onClick={() => {
                        setSelectedSite(sId);
                        setGameState(
                          createInitialGameState(sId, commanderName, selectedDifficulty)
                        );
                      }}
                      className={`text-left p-3 border-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800 border-amber-400 text-white'
                          : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-xs font-bold text-amber-400">{cfg.name}</div>
                      <div className="text-[11px] text-slate-300 mt-1 line-clamp-2">
                        {cfg.descriptionForKids}
                      </div>
                      <div className="text-[10px] font-mono-tabular text-sky-300 mt-1.5">
                        Dose: {cfg.ambientRadiationMsvPerDay} mSv/day · Gravity: {cfg.gravityG}g
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedSite === 'artemis_shackleton' && (
                <div className="mt-2 px-3 py-1.5 bg-slate-950 border border-sky-500/40 text-[11px] text-sky-200">
                  <strong className="text-amber-300">Did you know?</strong> On the Moon, daytime
                  lasts about two weeks, and then night lasts about two weeks too!
                </div>
              )}
            </div>

            {/* 3 Difficulty Levels Selector (Easy, Normal, Hard) */}
            <div className="mb-4">
              <div className="text-xs font-bold text-slate-300 mb-1.5">
                SELECT MISSION DIFFICULTY:
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['easy', 'normal', 'hard'] as DifficultyLevel[]).map((diffId) => {
                  const dCfg = DIFFICULTY_CONFIGS[diffId];
                  const isSelected = selectedDifficulty === diffId;
                  return (
                    <button
                      key={diffId}
                      type="button"
                      onClick={() => {
                        setSelectedDifficulty(diffId);
                        setGameState(
                          createInitialGameState(selectedSite, commanderName, diffId)
                        );
                      }}
                      className={`text-left px-2.5 py-2 border-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800 border-amber-400 text-white'
                          : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-xs font-bold text-amber-400 whitespace-nowrap truncate">
                        {dCfg.label}
                      </div>
                      <div className="text-[10px] text-slate-300 mt-0.5 line-clamp-1">
                        {dCfg.shortDesc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary CTA + Secondary Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={() => startNewMission()}
                className="px-5 py-3 text-sm font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-amber-200 cursor-pointer whitespace-nowrap shrink-0"
              >
                Launch Outpost Mission [Enter]
              </button>

              <button
                type="button"
                data-testid="title-trainee-lab-btn"
                onClick={() => setShowTraineeLab(true)}
                className="px-3.5 py-3 text-xs font-bold bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-400/70 cursor-pointer whitespace-nowrap shrink-0"
              >
                Trainee Telemetry Lab
              </button>

              <button
                type="button"
                onClick={() => setShowCodex(true)}
                className="px-3.5 py-3 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-600 cursor-pointer whitespace-nowrap shrink-0"
              >
                Space Data Codex
              </button>

              <button
                type="button"
                data-testid="title-credits-btn"
                onClick={() => setShowCredits(true)}
                className="px-3.5 py-3 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 cursor-pointer whitespace-nowrap shrink-0"
              >
                Data &amp; Credits
              </button>
            </div>

            {/* Flat borderless inline control hint */}
            <p className="text-xs font-mono-tabular text-slate-400 mt-5">
              WASD / Click Move · Keys 1–5 or E Inspect Station · Space / Enter Launch · P Pause
            </p>
          </div>
        </div>
      )}

      {/* =====================================================================
          PLAYING HUD OVERLAY (Pointer-events-none wrapper with compact perimeter clusters)
         ===================================================================== */}
      {gameMode !== 'title' && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:p-3.5 md:p-4 font-hud">
          {/* TOP PERIMETER BAR: Left = 3 Core Competing Resources | Right = Sol/Day Counter & Utility Buttons */}
          <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
            {/* 3 Core Competing Resources Cluster */}
            <div className={`pointer-events-auto flex items-center gap-2 sm:gap-3 px-2.5 py-2 sm:px-3.5 sm:py-2.5 max-w-full ${hudPanelTheme}`}>
              {/* Resource 1: Power */}
              <div className="w-[88px] sm:w-32">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[10px] sm:text-xs font-bold tracking-wider text-amber-300">
                    POWER
                  </span>
                  <span
                    data-testid="hud-power"
                    className="text-sm sm:text-lg font-bold font-mono-tabular text-white leading-none"
                  >
                    {Math.round(gameState.power)}%
                  </span>
                </div>
                {renderResourcePips(
                  gameState.power,
                  'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 shadow-[0_0_8px_rgba(251,191,36,0.45)]'
                )}
              </div>

              <div className="h-8 w-px bg-slate-700/90" />

              {/* Resource 2: Life Support (O2 & Food) */}
              <div className="w-[98px] sm:w-36">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[10px] sm:text-xs font-bold tracking-wider text-emerald-300">
                    O2 &amp; FOOD
                  </span>
                  <span
                    data-testid="hud-lifesupport"
                    className="text-sm sm:text-lg font-bold font-mono-tabular text-white leading-none"
                  >
                    {Math.round(gameState.lifeSupport)}%
                  </span>
                </div>
                {renderResourcePips(
                  gameState.lifeSupport,
                  'bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-300 shadow-[0_0_8px_rgba(52,211,153,0.45)]'
                )}
              </div>

              <div className="h-8 w-px bg-slate-700/90" />

              {/* Resource 3: Radiation Shielding */}
              <div className="w-[96px] sm:w-36">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[10px] sm:text-xs font-bold tracking-wider text-purple-300">
                    SHIELDING
                  </span>
                  <span
                    data-testid="hud-shielding"
                    className="text-sm sm:text-lg font-bold font-mono-tabular text-white leading-none"
                  >
                    {Math.round(gameState.shielding)}%
                  </span>
                </div>
                {renderResourcePips(
                  gameState.shielding,
                  'bg-gradient-to-r from-purple-500 via-fuchsia-400 to-violet-300 shadow-[0_0_8px_rgba(192,132,252,0.45)]'
                )}
              </div>
            </div>

            {/* Top-Right Cluster: Sol/Day Counter, Science Score, High-Thinking Advisor, Codex, Utility Icons */}
            <div className={`pointer-events-auto flex flex-wrap items-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-3 sm:py-2 max-w-full ${hudPanelTheme}`}>
              <div className="px-1.5 sm:px-2 border-r border-slate-700/90">
                <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  {unit.toUpperCase()}
                </div>
                <div
                  data-testid="hud-sol"
                  className="text-sm sm:text-lg font-bold font-mono-tabular text-amber-300 leading-tight"
                >
                  {gameState.sol}/{gameState.maxSols}
                </div>
              </div>

              <div className="px-1.5 sm:px-2 border-r border-slate-700/90">
                <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  SCIENCE GOAL
                </div>
                <div
                  data-testid="hud-science"
                  className={`text-sm sm:text-lg font-bold font-mono-tabular leading-tight ${
                    gameState.scienceScore >= gameState.minScienceToWin
                      ? 'text-emerald-300'
                      : 'text-sky-300'
                  }`}
                >
                  {Math.round(gameState.scienceScore)}/{gameState.minScienceToWin}
                </div>
              </div>

              <button
                type="button"
                data-testid="hud-sun-mood"
                onClick={() => setShowCodex(true)}
                title="Open Live Space Weather & Data Codex"
                className={`px-2.5 py-1.5 text-[11px] sm:text-xs font-bold border rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  weatherOffline && !liveWeather
                    ? 'bg-slate-800 text-slate-300 border-slate-600'
                    : computeSunMood(liveWeather) === 'Stormy'
                    ? 'bg-rose-950 text-rose-200 border-rose-400/70'
                    : computeSunMood(liveWeather) === 'Busy'
                    ? 'bg-amber-950 text-amber-200 border-amber-400/70'
                    : 'bg-emerald-950 text-emerald-200 border-emerald-400/60'
                }`}
              >
                {weatherOffline && !liveWeather
                  ? 'Sun: Offline'
                  : `Sun: ${computeSunMood(liveWeather)}`}
              </button>

              {/* NASA Open API Status Badge */}
              {nasaApiStatus?.configured ? (
                <div
                  data-testid="hud-nasa-badge"
                  title={`NASA API Live Connected (${nasaApiStatus.keyMasked}). Streaming real-time DONKI & OSDR telemetry.`}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold rounded-xl bg-emerald-950/90 border border-emerald-500/70 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] whitespace-nowrap shrink-0"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>NASA LIVE</span>
                </div>
              ) : (
                <div
                  data-testid="hud-nasa-badge"
                  title="NASA Baseline Snapshot active. Enter your free API key into .env (NASA_API_KEY) to stream live solar flares and CME telemetry!"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold rounded-xl bg-slate-900 border border-amber-500/50 text-amber-300 whitespace-nowrap shrink-0"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>NASA BASELINE</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowAdvisor(true)}
                className="px-2.5 py-1.5 text-[11px] sm:text-xs font-bold bg-amber-950 hover:bg-amber-900 text-amber-200 border border-amber-400/70 hover:border-amber-300 hover:shadow-[0_0_14px_rgba(251,191,36,0.35)] rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                Capcom Advisor
              </button>

              <button
                type="button"
                data-testid="hud-trainee-lab-btn"
                onClick={() => setShowTraineeLab(true)}
                className="px-2.5 py-1.5 text-[11px] sm:text-xs font-bold bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-400/70 hover:border-cyan-300 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                Trainee Lab
              </button>

              <button
                type="button"
                onClick={() => setShowCodex(true)}
                className="px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-400/40 hover:border-sky-300/80 hover:shadow-[0_0_12px_rgba(56,189,248,0.3)] rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                Space Data
              </button>

              <button
                type="button"
                data-testid="hud-credits-btn"
                onClick={() => setShowCredits(true)}
                className="px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 hover:border-sky-400/75 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                Credits
              </button>

              {/* Compact Rounded Utility Icon Buttons: Mute [M], Pause [P], Restart [R] */}
              <button
                type="button"
                tabIndex={-1}
                aria-label={muted ? 'Unmute Audio [M]' : 'Mute Audio [M]'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setMuted((prev) => {
                    const next = !prev;
                    soundFX.muted = next;
                    return next;
                  });
                }}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-sky-400/75 hover:shadow-[0_0_10px_rgba(56,189,248,0.28)] text-slate-200 rounded-xl transition-all cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  {muted ? (
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3l3.5 3.5-1.5 1.5L15 13.5 11.5 17 10 15.5 13.5 12 10 8.5 11.5 7 15 10.5 18.5 7 20 8.5 16.5 12z" />
                  ) : (
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                  )}
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Pause Game [P]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setGameMode((m) => (m === 'paused' ? 'playing' : 'paused'));
                }}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-sky-400/75 hover:shadow-[0_0_10px_rgba(56,189,248,0.28)] text-slate-200 rounded-xl transition-all cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Restart Mission [R]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  startNewMission();
                }}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-sky-400/75 hover:shadow-[0_0_10px_rgba(56,189,248,0.28)] text-slate-200 rounded-xl transition-all cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                </svg>
              </button>
            </div>
          </div>

          {/* BOTTOM PERIMETER DOCK: Single Unified Strip for Station Trade-Offs + End Sol/Day CTA */}
          <div className={`pointer-events-auto flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 sm:px-3.5 sm:py-2 ${hudPanelTheme}`}>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="pr-2 mr-0.5 border-r border-slate-700/90">
                <div className="text-[10px] sm:text-[11px] font-mono-tabular font-semibold text-amber-300">
                  SHIFTS LEFT: {actionsRemaining}/{gameState.maxActionsPerSol}
                </div>
                <div className="text-xs sm:text-sm font-bold text-white">Stations [1–5]:</div>
              </div>

              {OUTPOST_STATIONS.map((st) => {
                const isNear = nearStation === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      soundFX.playInteract();
                      setInspectingStation(st.id);
                    }}
                    className={`px-2 py-1 sm:px-2.5 sm:py-1.5 text-left border rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isNear
                        ? 'bg-slate-800 border-amber-400 text-white shadow-[0_0_14px_rgba(251,191,36,0.35)]'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-600/80 hover:border-sky-400/75 hover:shadow-[0_0_12px_rgba(56,189,248,0.25)] text-slate-100'
                    }`}
                  >
                    <div className="text-[11px] sm:text-xs font-bold">
                      [{st.keyHint}] {st.label}
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-mono-tabular text-slate-300">
                      {st.shortTag}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTriggerEndSol}
                className="px-3.5 py-2 sm:px-4 sm:py-2 text-xs font-bold bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 border border-amber-200 rounded-xl shadow-[0_4px_14px_rgba(245,158,11,0.35)] hover:shadow-[0_0_18px_rgba(251,191,36,0.55)] transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                {gameState.sol >= gameState.maxSols
                  ? `Complete ${unit} 10 (Need ${gameState.minScienceToWin} Sci) →`
                  : gameState.siteId === 'mars_jezero'
                  ? `End ${unit} ${gameState.sol} & Advance Night →`
                  : `End ${unit} ${gameState.sol} & Start Next Day →`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          INTERACTIVE STATION TRADE-OFF MODAL
         ===================================================================== */}
      {gameMode === 'playing' && inspectingStation && (
        <StationTradeOffModal
          stationId={inspectingStation}
          gameState={gameState}
          onExecuteAction={handleExecuteStationAction}
          onClose={() => setInspectingStation(null)}
        />
      )}

      {/* =====================================================================
          TOP-RIGHT SPACE WEATHER ALERT POPUP (Appears first with button to activate Mini-Game)
         ===================================================================== */}
      {gameMode === 'playing' && gameState.activeEvent && !isMiniGameActive && (
        <SpaceEventTopRightPopup
          gameState={gameState}
          liveWeather={liveWeather}
          onActivateMiniGame={() => {
            soundFX.playInteract();
            setInspectingStation(null);
            setIsMiniGameActive(true);
          }}
        />
      )}

      {/* =====================================================================
          INTERACTIVE 2D CANVAS MINI-GAME OVERLAY FOR RANDOM SPACE HAZARDS
         ===================================================================== */}
      {gameMode === 'playing' && gameState.activeEvent && isMiniGameActive && (
        <SpaceEventModal
          gameState={gameState}
          liveWeather={liveWeather}
          onCompleteMiniGame={handleCompleteEventMiniGame}
          onReplaySound={() => {
            if (gameState.activeEvent) {
              soundFX.playEventSound(gameState.activeEvent.id);
            }
          }}
        />
      )}

      {/* =====================================================================
          BIG "ENTERING SOL X" POPUP MODAL AFTER CLICKING END SOL BUTTON
         ===================================================================== */}
      {gameMode === 'playing' && showEnteringSolModal && (
        <SolTransitionModal
          gameState={gameState}
          onConfirmEnterSol={() => {
            soundFX.playInteract();
            setShowEnteringSolModal(false);
          }}
        />
      )}

      {/* =====================================================================
          SPACE DATA CODEX MODAL
         ===================================================================== */}
      {showCodex && (
        <NasaCodexModal
          liveWeather={liveWeather}
          weatherOffline={weatherOffline}
          osdrStudy={osdrStudy}
          onOpenCredits={() => {
            setShowCodex(false);
            setShowCredits(true);
          }}
          onOpenTraineeLab={() => {
            setShowCodex(false);
            setShowTraineeLab(true);
          }}
          onClose={() => setShowCodex(false)}
          onSimulateEvent={(ev) => {
            setShowCodex(false);
            setInspectingStation(null);
            setIsMiniGameActive(true);
            setGameMode('playing');
            soundFX.playAlert();
            setGameState((prev) => ({
              ...prev,
              activeEvent: ev,
            }));
          }}
        />
      )}

      {/* =====================================================================
          TRAINEE TELEMETRY & COUNTERMEASURE LAB MODAL (RadLab, DONKI, OSDR)
         ===================================================================== */}
      {showTraineeLab && (
        <TraineeDashboardModal
          gameState={gameState}
          liveWeather={liveWeather}
          onApplyProtocol={(label, deltas) => {
            soundFX.playInteract();
            setGameState((prev) => {
              const updated = applyTraineeProtocolToState(prev, label, deltas);
              if (updated.status === 'failed') {
                soundFX.playAlert();
                setEndRunSnapshot({
                  siteId: updated.siteId,
                  sol: updated.sol,
                  scienceScore: updated.scienceScore,
                  power: updated.power,
                  lifeSupport: updated.lifeSupport,
                  shielding: updated.shielding,
                  status: 'failed',
                  failureReason: updated.failureReason,
                });
                setShowTraineeLab(false);
                setGameMode('gameover');
                logMissionOutcome(updated);
              }
              return updated;
            });
          }}
          onTriggerScenarioByCode={(code) => {
            const matched = getEventByCode(code);
            if (matched) {
              setShowTraineeLab(false);
              setInspectingStation(null);
              setIsMiniGameActive(true);
              setGameMode('playing');
              soundFX.playAlert();
              setGameState((prev) => ({
                ...prev,
                activeEvent: matched,
              }));
            }
          }}
          onClose={() => setShowTraineeLab(false)}
        />
      )}

      {/* =====================================================================
          MISSION HELPER (AI) MODAL
         ===================================================================== */}
      {showAdvisor && (
        <AdvisorModal
          gameState={gameState}
          onClose={() => setShowAdvisor(false)}
        />
      )}

      {/* =====================================================================
          DATA & CREDITS MODAL
         ===================================================================== */}
      {showCredits && (
        <CreditsModal
          liveWeather={liveWeather}
          onClose={() => setShowCredits(false)}
        />
      )}

      {/* =====================================================================
          PAUSE MODAL (Single Focused Status Card)
         ===================================================================== */}
      {gameMode === 'paused' && (
        <div
          role="dialog"
          aria-label="Mission Paused"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1226] pointer-events-auto"
        >
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-400 p-6 text-center shadow-2xl">
            <p className="text-xs font-mono-tabular text-amber-400">
              OUTPOST TELEMETRY STANDBY
            </p>
            <h2 className="font-pixel text-lg text-white mt-1 mb-4">MISSION PAUSED</h2>

            <div className="grid grid-cols-3 gap-2 mb-6 font-mono-tabular">
              <div className="p-2.5 bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">{unit.toUpperCase()}</div>
                <div className="text-base font-bold text-amber-400">
                  {gameState.sol}/{gameState.maxSols}
                </div>
              </div>
              <div className="p-2.5 bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">SCIENCE</div>
                <div className="text-base font-bold text-sky-400">
                  {gameState.scienceScore}
                </div>
              </div>
              <div className="p-2.5 bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">MIN MARGIN</div>
                <div className="text-base font-bold text-emerald-400">
                  {Math.min(gameState.power, gameState.lifeSupport, gameState.shielding)}%
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setGameMode('playing')}
                className="w-full py-2.5 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer"
              >
                Resume Mission [P / Esc]
              </button>
              <button
                type="button"
                onClick={() => startNewMission()}
                className="w-full py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 cursor-pointer"
              >
                Restart Mission [R]
              </button>
              <button
                type="button"
                onClick={() => setGameMode('title')}
                className="w-full py-2.5 text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 cursor-pointer"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VICTORY / GAME OVER MODAL (Single Focused Outcome-Matched Status Card + Rank)
         ===================================================================== */}
      {gameMode === 'gameover' && endRunSnapshot && (() => {
        const rankEval = computeMissionRank({
          status: endRunSnapshot.status,
          sol: endRunSnapshot.sol,
          maxSols: gameState.maxSols,
          scienceScore: endRunSnapshot.scienceScore,
          minScienceToWin: gameState.minScienceToWin,
          power: endRunSnapshot.power,
          lifeSupport: endRunSnapshot.lifeSupport,
          shielding: endRunSnapshot.shielding,
          difficulty: gameState.difficulty,
        });

        const rankStyleMap: Record<
          MissionRankTier,
          {
            border: string;
            bg: string;
            text: string;
            accent: string;
            fillHex: string;
          }
        > = {
          IRON: {
            border: 'border-slate-500',
            bg: 'bg-slate-900/90',
            text: 'text-slate-200',
            accent: 'text-slate-400',
            fillHex: '#94a3b8',
          },
          BRONZE: {
            border: 'border-amber-700',
            bg: 'bg-amber-950/40',
            text: 'text-amber-300',
            accent: 'text-amber-400',
            fillHex: '#d97706',
          },
          SILVER: {
            border: 'border-slate-300',
            bg: 'bg-slate-800/80',
            text: 'text-slate-100',
            accent: 'text-sky-300',
            fillHex: '#e2e8f0',
          },
          GOLD: {
            border: 'border-yellow-400',
            bg: 'bg-yellow-950/40',
            text: 'text-yellow-300',
            accent: 'text-amber-300',
            fillHex: '#facc15',
          },
          PLATINUM: {
            border: 'border-cyan-300',
            bg: 'bg-cyan-950/45',
            text: 'text-cyan-200',
            accent: 'text-cyan-300',
            fillHex: '#67e8f9',
          },
          DIAMOND: {
            border: 'border-fuchsia-400',
            bg: 'bg-indigo-950/60',
            text: 'text-fuchsia-200',
            accent: 'text-cyan-300',
            fillHex: '#e879f9',
          },
        };

        const rStyle = rankStyleMap[rankEval.rank];

        return (
          <div
            role="dialog"
            aria-label={
              endRunSnapshot.status === 'victory' ? 'Mission Accomplished' : 'Mission Scrubbed'
            }
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1226] pointer-events-auto"
          >
            <div
              className={`w-full max-w-xl bg-slate-900 border-2 p-6 shadow-2xl ${
                endRunSnapshot.status === 'victory'
                  ? 'border-emerald-400'
                  : 'border-rose-500'
              }`}
            >
              <div className="text-xs font-mono-tabular text-amber-400">
                {endRunSnapshot.status === 'victory'
                  ? 'JUNIOR ASTRONAUT CERTIFICATION COMPLETE'
                  : 'ENGINEERING TRADE-OFF DEBRIEF'}
              </div>
              <h2 className="font-pixel text-lg text-white mt-1 mb-3">
                {endRunSnapshot.status === 'victory'
                  ? `10-${getTimeUnit(endRunSnapshot.siteId).toUpperCase()} MISSION ACCOMPLISHED!`
                  : 'MISSION SCRUBBED — CREW EVACUATED'}
              </h2>

              <p className="text-sm text-slate-200 leading-relaxed mb-4">
                {endRunSnapshot.status === 'victory'
                  ? `Outstanding engineering, ${gameState.commanderName}! You balanced electrical power, oxygen/food production, and radiation shielding across all 10 ${getTimeUnitPlural(endRunSnapshot.siteId)} at ${MISSION_SITES[endRunSnapshot.siteId].name}.`
                  : endRunSnapshot.failureReason}
              </p>

              {/* MISSION PERFORMANCE RANK BANNER (IRON, BRONZE, SILVER, GOLD, PLATINUM, DIAMOND) */}
              <div
                data-testid="gameover-rank-card"
                className={`mb-4 p-4 border-2 ${rStyle.border} ${rStyle.bg}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    {/* Custom SVG Astronaut Rank Crest */}
                    <svg
                      viewBox="0 0 48 48"
                      className="w-12 h-12 shrink-0"
                      aria-hidden="true"
                    >
                      <polygon
                        points="24,2 44,12 44,36 24,46 4,36 4,12"
                        fill="#090d16"
                        stroke={rStyle.fillHex}
                        strokeWidth="3"
                      />
                      <polygon
                        points="24,9 30,19 41,20 33,28 35,39 24,33 13,39 15,28 7,20 18,19"
                        fill={rStyle.fillHex}
                      />
                    </svg>
                    <div>
                      <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-slate-400">
                        MISSION PERFORMANCE RANK
                      </div>
                      <div className="flex items-baseline gap-2.5 mt-0.5">
                        <span
                          data-testid="gameover-rank-tier"
                          className={`font-pixel text-xl tracking-wide ${rStyle.text}`}
                        >
                          {rankEval.rank}
                        </span>
                        <span className={`text-xs font-bold ${rStyle.accent}`}>
                          {rankEval.title}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono-tabular shrink-0">
                    <div className="text-[10px] text-slate-400 uppercase">RATING</div>
                    <div
                      data-testid="gameover-rank-score"
                      className={`text-lg font-bold ${rStyle.text}`}
                    >
                      {rankEval.performanceScore}/100
                    </div>
                  </div>
                </div>

                {/* 6-Tier Ladder: IRON -> BRONZE -> SILVER -> GOLD -> PLATINUM -> DIAMOND */}
                <div
                  data-testid="gameover-rank-ladder"
                  className="grid grid-cols-6 gap-1.5 mt-3 pt-3 border-t border-slate-800/90 font-mono-tabular text-center"
                >
                  {MISSION_RANK_ORDER.map((tier) => {
                    const isEarned = tier === rankEval.rank;
                    return (
                      <div
                        key={tier}
                        data-testid={`rank-step-${tier}`}
                        data-active={isEarned ? 'true' : 'false'}
                        className={`py-1 px-1 text-[10px] font-bold border transition-all ${
                          isEarned
                            ? `${rStyle.border} bg-slate-950 ${rStyle.text} shadow-[0_0_10px_rgba(255,255,255,0.18)]`
                            : 'border-slate-800 bg-slate-950/50 text-slate-500'
                        }`}
                      >
                        {tier}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2.5 text-xs text-slate-300 leading-snug">
                  {rankEval.nextRankHint}
                </div>
              </div>

              {/* 3 Tabular-Nums Stat Tiles */}
              <div className="grid grid-cols-3 gap-3 mb-5 font-mono-tabular text-center">
                <div className="p-3 bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400">
                    {getTimeUnitPlural(endRunSnapshot.siteId).toUpperCase()} SURVIVED
                  </div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {endRunSnapshot.sol}/10
                  </div>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400">SCIENCE SCORE</div>
                  <div className="text-lg font-bold text-sky-400 mt-0.5">
                    {endRunSnapshot.scienceScore}
                  </div>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400">FINAL PWR/O2/SHD</div>
                  <div className="text-sm font-bold text-amber-400 mt-1">
                    {endRunSnapshot.power}%/{endRunSnapshot.lifeSupport}%/
                    {endRunSnapshot.shielding}%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setGameMode('title')}
                  className="px-4 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 cursor-pointer"
                >
                  Change Mission Site
                </button>
                <button
                  type="button"
                  data-start="true"
                  onClick={() => startNewMission()}
                  className="px-6 py-2.5 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-amber-200 cursor-pointer"
                >
                  {endRunSnapshot.status === 'victory'
                    ? 'Play Again (New Strategy)'
                    : 'Try Again with New Strategy'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Looping Atmospheric Background Music (Void Survival) kept at mild volume (0.18) */}
      <audio
        id="outpost-bgm"
        data-testid="outpost-bgm"
        src={BACKGROUND_MUSIC_SRC}
        loop
        preload="auto"
        ref={(el) => {
          if (el && Math.abs(el.volume - BACKGROUND_MUSIC_MILD_VOLUME) > 0.001 && !muted) {
            el.volume = BACKGROUND_MUSIC_MILD_VOLUME;
          }
          soundFX.bindBackgroundAudio(el);
        }}
      />
    </main>
  );
}
