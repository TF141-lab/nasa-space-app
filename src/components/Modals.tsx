import React, { useEffect, useRef, useState } from 'react';
import {
  computeMiniGameEventDeltas,
  DIFFICULTY_CONFIGS,
  getEventAttribution,
  getStationActionDeltas,
  getTimeUnit,
  hasLowResourcePenalty,
  MISSION_SITES,
  MiniGameResourceDelta,
  NASA_SPACE_EVENTS,
  OutpostGameState,
  scaleMiniGameDeltasForState,
  SpaceWeatherEvent,
  STATION_ACTIONS,
  StationId,
} from '../game/rules';
import {
  getMiniGameDescriptor,
  MiniGameCompletionPayload,
  MiniGameDescriptor,
  MiniGameManager,
  MiniGameTelemetrySnapshot,
} from '../game/MiniGameManager';
import type { OsdrStudyHighlight, SpaceWeatherSummary } from '../types/spaceWeather';
import {
  computeSunMood,
  describeFlareSize,
  formatReportedAgo,
  formatSavedDate,
} from '../utils/spaceWeatherDisplay';

interface StationModalProps {
  stationId: StationId;
  gameState: OutpostGameState;
  onExecuteAction: (stationId: StationId) => void;
  onClose: () => void;
}

export const StationTradeOffModal: React.FC<StationModalProps> = ({
  stationId,
  gameState,
  onExecuteAction,
  onClose,
}) => {
  const action = STATION_ACTIONS[stationId];
  const deltas = getStationActionDeltas(gameState, stationId);
  const lowResPenalty = hasLowResourcePenalty(gameState);
  const canAct = gameState.actionsTakenThisSol < gameState.maxActionsPerSol;

  const formatDelta = (val: number, unit: string) => {
    if (val === 0) return `0% ${unit}`;
    return `${val > 0 ? '+' : ''}${val}% ${unit}`;
  };

  return (
    <div
      role="dialog"
      aria-label={action.title}
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#0b1226] pointer-events-auto"
    >
      <div className="w-full max-w-xl bg-slate-900 border-2 border-amber-400 shadow-2xl p-6 text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
          <div>
            <p className="text-xs font-mono-tabular text-amber-400">
              ENGINEERING STATION TELEMETRY · SHIFT {gameState.actionsTakenThisSol}/
              {gameState.maxActionsPerSol} USED
            </p>
            <h2 className="text-xl font-bold text-white mt-0.5">{action.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 cursor-pointer"
          >
            Close [Esc]
          </button>
        </div>

        <p className="text-sm text-slate-200 leading-relaxed mb-4">
          {action.tradeOffExplanation}
        </p>

        {lowResPenalty && action.scienceDelta > 0 && (
          <div className="p-2.5 bg-rose-950 border border-rose-500 text-xs font-mono-tabular text-rose-200 mb-4">
            CRITICAL RESERVE ALERT (&lt;25%): Positive NASA Science gains are reduced by 50% until all survival systems recover to 25%+!
          </div>
        )}

        {/* Trade-Off Impact Comparison Grid */}
        <div className="grid grid-cols-4 gap-2.5 mb-4 font-mono-tabular text-center">
          <div className="p-2.5 bg-slate-950 border border-slate-800">
            <div className="text-[11px] text-slate-400">POWER</div>
            <div
              className={`text-sm font-bold mt-0.5 ${
                deltas.powerDelta >= 0 ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {formatDelta(deltas.powerDelta, 'PWR')}
            </div>
          </div>
          <div className="p-2.5 bg-slate-950 border border-slate-800">
            <div className="text-[11px] text-slate-400">LIFE SUPPORT</div>
            <div
              className={`text-sm font-bold mt-0.5 ${
                deltas.lifeSupportDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatDelta(deltas.lifeSupportDelta, 'O2')}
            </div>
          </div>
          <div className="p-2.5 bg-slate-950 border border-slate-800">
            <div className="text-[11px] text-slate-400">SHIELDING</div>
            <div
              className={`text-sm font-bold mt-0.5 ${
                deltas.shieldingDelta >= 0 ? 'text-purple-400' : 'text-rose-400'
              }`}
            >
              {formatDelta(deltas.shieldingDelta, 'SHD')}
            </div>
          </div>
          <div className="p-2.5 bg-slate-950 border border-slate-800">
            <div className="text-[11px] text-slate-400">NASA SCIENCE</div>
            <div
              className={`text-sm font-bold mt-0.5 ${
                deltas.scienceDelta >= 0 ? 'text-sky-400' : 'text-rose-400'
              }`}
            >
              {deltas.scienceDelta >= 0 ? `+${deltas.scienceDelta}` : deltas.scienceDelta} PTS
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-950 border border-sky-900/60 mb-5">
          <div className="text-xs font-semibold text-sky-400 mb-1">
            REAL NASA ENGINEERING FACT
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{action.nasaFact}</p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canAct}
            onClick={() => onExecuteAction(stationId)}
            className={`px-5 py-2 text-xs font-bold border cursor-pointer transition-colors ${
              canAct
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-200'
                : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
            }`}
          >
            {canAct
              ? `Confirm: ${action.actionVerb}`
              : `All 2 Crew Shifts Used Today — End ${getTimeUnit(gameState.siteId)} to Continue`}
          </button>
        </div>
      </div>
    </div>
  );
};

interface SpaceEventTopRightPopupProps {
  gameState: OutpostGameState;
  liveWeather?: SpaceWeatherSummary | null;
  onActivateMiniGame: () => void;
}

export const SpaceEventTopRightPopup: React.FC<SpaceEventTopRightPopupProps> = ({
  gameState,
  liveWeather = null,
  onActivateMiniGame,
}) => {
  const ev = gameState.activeEvent;
  if (!ev) return null;

  const diff = gameState.difficulty || 'normal';
  const durationSec = DIFFICULTY_CONFIGS[diff].miniGameDurationSec;
  const descriptor = getMiniGameDescriptor(ev.donkiCode);
  const attribution = getEventAttribution(ev, liveWeather);

  const borderColor =
    ev.severity === 'SEVERE'
      ? 'border-rose-400'
      : ev.severity === 'MODERATE'
      ? 'border-amber-400'
      : 'border-sky-400';

  const badgeColor =
    ev.severity === 'SEVERE'
      ? 'bg-rose-500/20 text-rose-200 border-rose-400/70'
      : ev.severity === 'MODERATE'
      ? 'bg-amber-400/20 text-amber-200 border-amber-400/70'
      : 'bg-sky-400/20 text-sky-200 border-sky-400/70';

  return (
    <div
      role="region"
      aria-label={`Incoming Space Alert: ${descriptor.taskTitle}`}
      data-testid="top-right-event-popup"
      className={`fixed top-16 right-3 md:right-4 z-30 w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl bg-slate-900 border-4 ${borderColor} shadow-2xl p-4 text-slate-100 pointer-events-auto`}
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full animate-pulse ${
              ev.severity === 'SEVERE'
                ? 'bg-rose-500'
                : ev.severity === 'MODERATE'
                ? 'bg-amber-400'
                : 'bg-sky-400'
            }`}
            aria-hidden="true"
          />
          <span
            data-testid="popup-event-code"
            className="text-xs font-bold text-amber-300"
          >
            {descriptor.goalIcon} SPACE ALERT
          </span>
        </div>
        <span
          className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border ${badgeColor}`}
        >
          {ev.severity === 'SEVERE'
            ? 'URGENT!'
            : ev.severity === 'MODERATE'
            ? 'HEADS UP!'
            : 'BONUS MISSION!'}
        </span>
      </div>

      <div
        data-testid="popup-data-origin"
        className="mt-2 text-[11px] font-semibold text-sky-300"
      >
        {attribution.originLabel}
      </div>

      {attribution.realRecordText && attribution.realRecordLink && (
        <div className="mt-1.5 p-2 rounded-xl bg-slate-950 border border-sky-500/40 text-[11px] text-emerald-300">
          <div>{attribution.realRecordText}</div>
          <a
            href={attribution.realRecordLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-300 underline hover:text-sky-200 inline-block mt-0.5"
          >
            Source: NASA DONKI ↗
          </a>
        </div>
      )}

      <h3 className="text-base font-extrabold text-white mt-2">
        {descriptor.taskTitle}
      </h3>
      <p className="text-xs text-slate-200 leading-relaxed mt-1 mb-3">
        {descriptor.goalBanner}
      </p>

      <button
        type="button"
        data-testid="activate-minigame-btn"
        onClick={onActivateMiniGame}
        className="w-full py-3 px-4 rounded-xl text-sm font-extrabold bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-2 border-emerald-200 cursor-pointer shadow-lg transition-transform active:scale-95"
      >
        Let&apos;s Help! ({durationSec}s) →
      </button>
    </div>
  );
};

interface MiniGameAnimatedPreviewProps {
  descriptor: MiniGameDescriptor;
  activePhaseOverride?: number | null;
  onPhaseChange?: (phaseIdx: number, phaseProgress: number) => void;
}

const REAL_LIFE_ANIMATION_CAPTIONS: Record<
  string,
  [string, string, string]
> = {
  weld_seal: [
    '1. 14.7 PSI cabin air jets out of hull micro-crack; Bulkhead Valve throttles airflow',
    '2. Flexible Kapton polyimide tape + two-part vacuum epoxy applied over low-pressure breach',
    '3. Epoxy resin cures into an airtight elastomer plug without outgassing (0.00 L/min)',
  ],
  dust_brush: [
    '1. Solar UV charges jagged silicate moon dust (+q) clinging to photovoltaic glass',
    '2. Transparent ITO electrodes fire a 3-phase AC travelling-wave EDS electric field',
    '3. Dielectrophoretic wave lofts and surfs 90%+ dust grains off contact-free!',
  ],
  whipple_intercept: [
    '1. 20 km/s hypervelocity micrometeoroid approaches spaced outer Aluminum Bumper',
    '2. Outer bumper shocks & vaporizes the solid pebble into an expanding plasma cloud',
    '3. Nextel ceramic & Kevlar fabric blankets absorb the dispersed cloud; hull intact!',
  ],
  filter_purge: [
    '1. Red iron-oxide & perchlorate Mars dust clogs HEPA intake ahead of 800°C MOXIE cell',
    '2. MEDA anemometer detects calm green wind trough; pneumatic reverse-pulse fires',
    '3. Sintered HEPA mesh cleared; clean Martian CO2 splits into breathable O2!',
  ],
  frost_melt: [
    '1. At -85°C and 6 mbar pressure, Martian CO2 freezes solid into dry-ice frost on valve',
    '2. Bonded Kapton foil strip heaters (> -78.5°C) & ultrasonic piezo transducers activate',
    '3. Solid CO2 frost sublimates directly into gas plumes with zero liquid slush!',
  ],
  dipole_align: [
    '1. SARJ rotary joint feathers solar wings 90° edge-on to prevent voltage arcing',
    '2. Active superconducting dipole coil generates a protective magnetic field (B)',
    '3. Lorentz force (F = qv × B) curves incoming solar protons harmlessly around hull!',
  ],
  uv_sterilize: [
    '1. Humid cabin air lets Aspergillus fungal spores drift toward Veggie crop vents',
    '2. Porous Zeolite 5A molecular sieve crystal bed traps H2O vapor without chemicals',
    '3. 254 nm UV-C germicidal photons dimerize spore DNA—99.99% sterile air loop!',
  ],
  thermal_conduit: [
    '1. Shackleton Crater permanent shadow drops to -203°C outside the habitat wall',
    '2. Rover packs 50 cm of fluffy vacuum regolith berm (k = 0.002 W/m·K) + Glycol loop',
    '3. Point-contact vacuum regolith traps radiative heat inside like a thermos flask!',
  ],
  water_bladder: [
    '1. Heavy metal walls scatter secondary neutrons when hit by solar protons',
    '2. Manifold valves route potable H2O into overhead 25 g/cm² storm-shelter bladders',
    '3. Light H2O hydrogen nuclei brake solar protons like billiard balls—zero spallation!',
  ],
  core_spectrometer: [
    '1. In lunar vacuum (no air cooling), continuous drilling would overheat bit & bake out ice',
    '2. Honeybee TRIDENT drill uses bite-and-pause pecking while ECLSS FO membrane cycles',
    '3. Bit conducts heat away safely; Raman UV spectrometer preserves 100% water-ice volatiles!',
  ],
};

const MiniGameAnimatedPreview: React.FC<MiniGameAnimatedPreviewProps> = ({
  descriptor,
  activePhaseOverride = null,
  onPhaseChange,
}) => {
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;
  const { mechanicType, accentColor, realLifeSolution } = descriptor;

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startMs = performance.now();
    let lastReportedPhase = -1;

    const drawRound = (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
      fill: string,
      stroke: string,
      lineW = 2.5
    ) => {
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
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = lineW;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    };

    const tick = (nowMs: number) => {
      const cycleSec = 5.4;
      const rawT = ((nowMs - startMs) / 1000) % cycleSec;
      const p =
        activePhaseOverride !== null
          ? activePhaseOverride * 0.34 + 0.16 + Math.sin(nowMs / 260) * 0.06
          : rawT / cycleSec;
      const phaseIdx = p < 0.34 ? 0 : p < 0.68 ? 1 : 2;
      if (phaseIdx !== lastReportedPhase) {
        lastReportedPhase = phaseIdx;
        onPhaseChangeRef.current?.(phaseIdx, p);
      }

      const w = canvas.width;
      const h = canvas.height;

      // Deep blueprint telemetry background
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#071022');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Subtle engineering blueprint grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      for (let gx = 24; gx < w; gx += 24) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 24; gy < h; gy += 24) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // Top Header Banner: Real-Life NASA System Code
      drawRound(8, 6, w - 16, 22, 6, '#020617', 'rgba(52, 211, 153, 0.45)', 1.5);
      ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#6ee7b7';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `NASA REAL SOLUTION: ${realLifeSolution.solutionTitle.slice(0, 42)}`,
        15,
        17
      );

      const cx = w / 2;
      const cy = 84;

      if (mechanicType === 'weld_seal') {
        // Real-Life Solution: Bulkhead Valve Isolation + Kapton-Epoxy Vacuum Patch
        drawRound(22, cy - 18, w - 44, 36, 10, '#1e293b', '#38bdf8', 2);
        // Bulkhead Isolation Valve on left
        const valveGreen = p >= 0.25;
        ctx.save();
        ctx.translate(62, cy);
        ctx.rotate(p * Math.PI * 1.5);
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fillStyle = valveGreen ? '#065f46' : '#7f1d1d';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = valveGreen ? '#34d399' : '#f87171';
        ctx.stroke();
        ctx.restore();
        ctx.font = 'bold 8.5px monospace';
        ctx.fillStyle = valveGreen ? '#6ee7b7' : '#fca5a5';
        ctx.textAlign = 'center';
        ctx.fillText(valveGreen ? '4.2 PSI SAFE' : '14.7 PSI JET', 62, cy + 26);

        // 3 Hull Micro-Fractures with Kapton-Epoxy Patch curing
        const cracks = [138, 204, 270];
        cracks.forEach((px, idx) => {
          const patched = p > 0.32 + idx * 0.2;
          // Crack line
          ctx.beginPath();
          ctx.moveTo(px - 10, cy - 10);
          ctx.lineTo(px, cy + 3);
          ctx.lineTo(px + 10, cy - 8);
          ctx.strokeStyle = patched ? '#f59e0b' : '#f43f5e';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          if (patched) {
            // Golden Kapton Polyimide + Epoxy Elastomer Layer
            drawRound(
              px - 18,
              cy - 13,
              36,
              26,
              6,
              'rgba(245, 158, 11, 0.88)',
              '#fef08a',
              2
            );
            ctx.font = 'bold 8px monospace';
            ctx.fillStyle = '#020617';
            ctx.fillText('KAPTON', px, cy);
          } else if (!valveGreen) {
            // Supersonic air jet escaping into vacuum
            ctx.fillStyle = '#7dd3fc';
            ctx.fillRect(px - 2, cy - 26 - ((nowMs / 40) % 10), 4, 8);
          }
        });
      } else if (mechanicType === 'dust_brush') {
        // Real-Life Solution: NASA Kennedy Electrodynamic Dust Shield (EDS) ITO Travelling Wave
        drawRound(26, cy - 26, w - 52, 52, 10, '#0c4a6e', '#38bdf8', 2);
        // Transparent ITO Interdigitated Electrodes
        for (let ex = 44; ex < w - 40; ex += 18) {
          const wavePhase = Math.sin(p * Math.PI * 6 - ex * 0.12);
          ctx.strokeStyle =
            p > 0.32 && wavePhase > 0
              ? '#fde047'
              : 'rgba(125, 211, 252, 0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ex, cy - 22);
          ctx.lineTo(ex, cy + 22);
          ctx.stroke();
        }
        // Travelling electric wave front
        if (p >= 0.3 && p < 0.85) {
          const waveX = 40 + ((p - 0.3) / 0.55) * (w - 80);
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(waveX, cy - 30);
          ctx.lineTo(waveX, cy + 30);
          ctx.stroke();
        }
        // Charged Lunar Dust Grains (+q) surfing off the panel
        for (let i = 0; i < 6; i++) {
          const baseX = 62 + i * 42;
          const loft = p < 0.32 ? 0 : Math.min(1, (p - 0.32) * 2.2);
          const dx = baseX + loft * 55;
          const dy = cy - loft * 34 - Math.sin(loft * Math.PI) * 14;
          if (loft < 0.95) {
            ctx.beginPath();
            ctx.arc(dx, dy, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#ca8a04';
            ctx.fill();
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.font = 'bold 7px monospace';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText('+q', dx, dy);
          }
        }
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.fillText(
          p < 0.34
            ? 'UV STATIC DUST (+q) ON ITO GLASS'
            : p < 0.68
            ? '3-PHASE AC TRAVELLING WAVE (EDS)'
            : '90%+ DUST REPELED CONTACT-FREE!',
          cx,
          cy + 36
        );
      } else if (mechanicType === 'whipple_intercept') {
        // Real-Life Solution: Multi-Wall Stuffed Whipple Bumper (Al Bumper + Nextel + Kevlar + Rear Wall)
        const bumperX = 115;
        const kevlarX = 195;
        const hullX = 265;

        // 1. Outer Sacrificial Aluminum Bumper
        drawRound(bumperX, cy - 34, 10, 68, 3, '#94a3b8', '#38bdf8', 2);
        // 2. Intermediate Nextel Ceramic + Kevlar Stuffing
        drawRound(kevlarX, cy - 34, 14, 68, 3, '#ca8a04', '#facc15', 2);
        // 3. Inner Habitat Pressure Wall
        drawRound(hullX, cy - 34, 16, 68, 4, '#065f46', '#34d399', 2);

        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('AL BUMPER', bumperX + 5, cy + 44);
        ctx.fillStyle = '#fde047';
        ctx.fillText('NEXTEL/KEVLAR', kevlarX + 7, cy + 44);
        ctx.fillStyle = '#6ee7b7';
        ctx.fillText('HULL WALL', hullX + 8, cy + 44);

        if (p < 0.36) {
          // 20 km/s Micrometeoroid approaching outer bumper
          const rx = 35 + (p / 0.36) * (bumperX - 42);
          ctx.beginPath();
          ctx.arc(rx, cy, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#f97316';
          ctx.fill();
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#fdba74';
          ctx.fillText('20 km/s', rx, cy - 15);
        } else {
          // Vaporized plasma cloud expanding between Al Bumper and Nextel/Kevlar blanket
          const spread = Math.min(1, (p - 0.36) / 0.45);
          for (let i = -3; i <= 3; i++) {
            const px = bumperX + 12 + spread * (kevlarX - bumperX - 16);
            const py = cy + i * spread * 9;
            ctx.beginPath();
            ctx.arc(px, py, 4.5 * (1 - spread * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = spread < 0.7 ? '#fb923c' : '#fde047';
            ctx.fill();
          }
        }
      } else if (mechanicType === 'filter_purge') {
        // Real-Life Solution: Perseverance MOXIE 800°C SOXE + Reverse-Pulse HEPA Back-Flush
        drawRound(42, cy - 28, 96, 56, 8, '#7c2d12', '#f97316', 2);
        drawRound(186, cy - 28, 114, 56, 8, '#064e3b', '#34d399', 2);
        ctx.font = 'bold 8.5px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fed7aa';
        ctx.fillText('HEPA MESH FILTER', 90, cy - 14);
        ctx.fillStyle = '#6ee7b7';
        ctx.fillText('800°C MOXIE SOXE', 243, cy - 14);

        if (p < 0.35) {
          ctx.fillStyle = '#fca5a5';
          ctx.fillText('IRON-OXIDE CLOG', 90, cy + 8);
          ctx.fillStyle = '#94a3b8';
          ctx.fillText('WAITING CALM WIND', 243, cy + 8);
        } else if (p < 0.7) {
          // Reverse-pulse pneumatic jet blowing left
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(182, cy + 4);
          ctx.lineTo(138, cy + 4);
          ctx.stroke();
          ctx.fillStyle = '#7dd3fc';
          ctx.fillText('<< REVERSE PULSE', 90, cy + 8);
          ctx.fillStyle = '#fde047';
          ctx.fillText('MEDA CALM TROUGH', 243, cy + 8);
        } else {
          ctx.fillStyle = '#6ee7b7';
          ctx.fillText('HEPA MESH CLEAN!', 90, cy + 8);
          ctx.fillStyle = '#38bdf8';
          ctx.fillText('2CO2 -> 2CO + O2', 243, cy + 8);
        }
      } else if (mechanicType === 'frost_melt') {
        // Real-Life Solution: Kapton Foil Sublimation Strip Heaters & Piezo Ultrasonic De-Icing
        const valves = [82, 170, 258];
        valves.forEach((vx, idx) => {
          const sublimated = p > 0.34 + idx * 0.18;
          drawRound(
            vx - 28,
            cy - 22,
            56,
            44,
            10,
            sublimated ? '#3b1d06' : '#082f49',
            sublimated ? '#f59e0b' : '#7dd3fc',
            2
          );
          // Kapton Amber Strip Heater Coil
          ctx.strokeStyle = p >= 0.3 ? '#f59e0b' : '#475569';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(vx - 18, cy + 8);
          ctx.lineTo(vx - 6, cy + 2);
          ctx.lineTo(vx + 6, cy + 8);
          ctx.lineTo(vx + 18, cy + 2);
          ctx.stroke();

          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = sublimated ? '#fde047' : '#bae6fd';
          ctx.fillText(sublimated ? 'CO2 GAS ^' : '-85°C ICE', vx, cy - 6);
        });
      } else if (mechanicType === 'dipole_align') {
        // Real-Life Solution: SARJ 90° Feathered Solar Wings + Lorentz F = qv x B Magnetic Dipole
        // Habitat Core
        ctx.beginPath();
        ctx.arc(cx + 26, cy, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Solar Wings rotating 90 deg edge-on (Feathered)
        const feathered = p >= 0.28;
        drawRound(
          cx + 10,
          cy - 38,
          32,
          feathered ? 4 : 12,
          2,
          '#0284c7',
          '#fde047',
          1.5
        );
        drawRound(
          cx + 10,
          cy + (feathered ? 34 : 26),
          32,
          feathered ? 4 : 12,
          2,
          '#0284c7',
          '#fde047',
          1.5
        );

        // Active Magnetic Dipole Arc (B field)
        ctx.beginPath();
        ctx.arc(cx + 26, cy, 42, Math.PI * 0.65, Math.PI * 1.35);
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Incoming red solar protons curving away via Lorentz Force (F = qv x B)
        const pProg = (p * 1.8) % 1;
        const px = 30 + pProg * 115;
        const py =
          px < cx - 22 ? cy - 6 : cy - 6 - Math.pow((px - (cx - 22)) / 22, 2) * 28;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#f43f5e';
        ctx.fill();
        ctx.font = 'bold 8.5px monospace';
        ctx.fillStyle = '#e9d5ff';
        ctx.textAlign = 'left';
        ctx.fillText('F = qv × B', 24, cy - 26);
        ctx.fillStyle = '#fde047';
        ctx.fillText(feathered ? 'SARJ: 90° FEATHERED' : 'SARJ: ROTATING...', 24, cy + 34);
      } else if (mechanicType === 'uv_sterilize') {
        // Real-Life Solution: Zeolite 5A Desiccant Bed + 254 nm UV-C DNA Dimerization
        drawRound(24, cy - 28, 102, 56, 8, '#064e3b', '#34d399', 2);
        ctx.font = 'bold 8.5px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#6ee7b7';
        ctx.fillText('ZEOLITE 5A SIEVE', 75, cy - 10);
        ctx.fillStyle = '#bae6fd';
        ctx.fillText(p >= 0.3 ? 'H2O TRAPPED (DRY)' : 'SCRUBBING H2O...', 75, cy + 10);

        // 254 nm UV-C Germicidal LED Array on Right
        drawRound(144, cy - 28, 180, 56, 8, '#2e1065', '#c084fc', 2);
        ctx.fillStyle = '#e9d5ff';
        ctx.fillText('254 nm UV-C GERMICIDAL BEAM', 234, cy - 14);
        const spores = [178, 234, 290];
        spores.forEach((sx, idx) => {
          const zapped = p > 0.36 + idx * 0.18;
          ctx.beginPath();
          ctx.arc(sx, cy + 8, 11, 0, Math.PI * 2);
          ctx.fillStyle = zapped ? '#4c1d95' : '#14532d';
          ctx.fill();
          ctx.strokeStyle = zapped ? '#c084fc' : '#4ade80';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.fillText(zapped ? 'DNA X' : 'SPORE', sx, cy + 8);
        });
      } else if (mechanicType === 'thermal_conduit') {
        // Real-Life Solution: 50cm Sintered Lunar Regolith Thermal Berm + Glycol Heat Loop
        const bermThickness = Math.min(18, Math.max(4, p * 22));
        // Outer Regolith Berm (low thermal conductivity k = 0.002 W/mK)
        drawRound(
          cx - 70 - bermThickness,
          cy - 28 - bermThickness * 0.4,
          140 + bermThickness * 2,
          56 + bermThickness * 0.8,
          14,
          '#57534e',
          '#fbbf24',
          2
        );
        // Inner Habitat Glycol Loop
        drawRound(cx - 64, cy - 22, 128, 44, 10, '#0f172a', '#f97316', 2);
        ctx.font = 'bold 8.5px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fde047';
        ctx.fillText(
          `REGOLITH BERM (${Math.round((bermThickness / 18) * 50)}cm · k=0.002)`,
          cx,
          cy - 6
        );
        ctx.fillStyle = '#fdba74';
        ctx.fillText('GLYCOL LOOP: +21°C STABLE', cx, cy + 10);
      } else if (mechanicType === 'water_bladder') {
        // Real-Life Solution: Dual-Use Potable H2O Hydrogen Storm Shelter (Proton Billiard Braking)
        drawRound(28, cy - 26, w - 56, 26, 8, '#0284c7', '#38bdf8', 2);
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e0f2fe';
        ctx.fillText('25 g/cm² H2O HYDROGEN BLADDER WALL (1H PROTONS)', cx, cy - 13);

        // Incoming Solar Protons stopped inside the H2O layer with zero secondary neutrons
        for (let i = 0; i < 4; i++) {
          const px = 72 + i * 66;
          const py = cy - 38 + Math.min(24, p * 36);
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fillStyle = py >= cy - 16 ? '#34d399' : '#f43f5e';
          ctx.fill();
        }
        ctx.fillStyle = '#6ee7b7';
        ctx.fillText('CREW QUARTERS BELOW: ZERO SECONDARY NEUTRON SCATTER', cx, cy + 20);
      } else {
        // core_spectrometer: Honeybee TRIDENT Bite-and-Pause Vacuum Drill + ECLSS 98% FO Filter
        drawRound(22, cy - 28, 146, 56, 8, '#082f49', '#38bdf8', 2);
        drawRound(180, cy - 28, 146, 56, 8, '#064e3b', '#34d399', 2);
        const isPausedToCool = p > 0.42 && p < 0.68;
        ctx.font = 'bold 8.5px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#bae6fd';
        ctx.fillText('TRIDENT VACUUM DRILL', 95, cy - 12);
        ctx.fillStyle = isPausedToCool ? '#fde047' : '#38bdf8';
        ctx.fillText(
          isPausedToCool ? 'PAUSE: COOLING BIT (ICE SAFE)' : 'PECKING CORE SAMPLE...',
          95,
          cy + 10
        );

        ctx.fillStyle = '#6ee7b7';
        ctx.fillText('ECLSS FO MEMBRANE', 253, cy - 12);
        ctx.fillStyle = '#a7f3d0';
        ctx.fillText('98% H2O RECOVERED + RTV', 253, cy + 10);
      }

      // Bottom Synchronized Caption Bar (matches Real-Life NASA Engineering Solution text)
      const captions =
        REAL_LIFE_ANIMATION_CAPTIONS[mechanicType] ||
        REAL_LIFE_ANIMATION_CAPTIONS.weld_seal;
      drawRound(8, h - 30, w - 16, 24, 6, '#020617', '#38bdf8', 1.5);
      ctx.font = 'bold 8.8px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(captions[phaseIdx], cx, h - 18);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [mechanicType, accentColor, realLifeSolution.solutionTitle, activePhaseOverride]);

  return (
    <div className="w-full rounded-2xl overflow-hidden border-4 border-sky-400/70 bg-slate-950 shadow-inner">
      <canvas
        ref={previewRef}
        width={348}
        height={164}
        data-testid="minigame-solution-animation-canvas"
        aria-label={`Animated schematic of ${realLifeSolution.solutionTitle}`}
        className="w-full h-40 object-contain block"
      />
    </div>
  );
};

interface SpaceEventModalProps {
  gameState: OutpostGameState;
  liveWeather?: SpaceWeatherSummary | null;
  onCompleteMiniGame: (payload: MiniGameCompletionPayload) => void;
  onReplaySound?: () => void;
}

export const SpaceEventModal: React.FC<SpaceEventModalProps> = ({
  gameState,
  liveWeather = null,
  onCompleteMiniGame,
  onReplaySound,
}) => {
  const ev = gameState.activeEvent;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const managerRef = useRef<MiniGameManager | null>(null);
  const onCompleteRef = useRef(onCompleteMiniGame);
  onCompleteRef.current = onCompleteMiniGame;

  const diff = gameState.difficulty || 'normal';
  const diffDurationSec = DIFFICULTY_CONFIGS[diff].miniGameDurationSec;
  const descriptor = ev ? getMiniGameDescriptor(ev.donkiCode) : null;

  const [telemetry, setTelemetry] = useState<MiniGameTelemetrySnapshot | null>(null);
  const [hasStartedChallenge, setHasStartedChallenge] = useState(false);
  const [showBriefingPopup, setShowBriefingPopup] = useState(true);
  const [showFunFact, setShowFunFact] = useState(false);
  const [completedPayload, setCompletedPayload] = useState<MiniGameCompletionPayload | null>(null);
  const [selectedQuizIdx, setSelectedQuizIdx] = useState<number | null>(null);
  const [animPhaseIdx, setAnimPhaseIdx] = useState<number>(0);
  const [lockedPhaseIdx, setLockedPhaseIdx] = useState<number | null>(null);

  // Reset briefing popup whenever a new event code is activated
  useEffect(() => {
    setHasStartedChallenge(false);
    setShowBriefingPopup(true);
    setShowFunFact(false);
    setCompletedPayload(null);
    setSelectedQuizIdx(null);
    setAnimPhaseIdx(0);
    setLockedPhaseIdx(null);
    setTelemetry(null);
  }, [ev?.donkiCode]);

  // Mount and start the MiniGameManager countdown ONLY after the player hits "Let's Go!"
  useEffect(() => {
    if (!ev || !hasStartedChallenge || !canvasRef.current) return;

    const manager = new MiniGameManager({
      eventCode: ev.donkiCode,
      difficulty: diff,
      durationSec: diffDurationSec,
      onTelemetryUpdate: (snap) => {
        setTelemetry(snap);
      },
      onComplete: (payload) => {
        setCompletedPayload(payload);
      },
    });

    managerRef.current = manager;
    manager.mount(canvasRef.current);

    return () => {
      manager.unmount();
      managerRef.current = null;
    };
  }, [ev?.donkiCode, diff, diffDurationSec, hasStartedChallenge]);

  const handleLetsGo = () => {
    if (!hasStartedChallenge) {
      setHasStartedChallenge(true);
      setShowBriefingPopup(false);
    } else {
      managerRef.current?.resume();
      setShowBriefingPopup(false);
    }
  };

  const handlePauseForBriefing = () => {
    managerRef.current?.pause();
    setShowBriefingPopup(true);
  };

  if (!ev || !descriptor) return null;

  const attribution = getEventAttribution(ev, liveWeather);

  const liveDeltas: MiniGameResourceDelta = scaleMiniGameDeltasForState(
    telemetry?.deltas || computeMiniGameEventDeltas(ev, 0.0, diff),
    gameState
  );
  const ratio = telemetry?.performanceRatio ?? 0;
  const timeLeft = telemetry?.timeRemainingSec ?? diffDurationSec;

  const borderColor =
    ev.severity === 'SEVERE'
      ? 'border-rose-400'
      : ev.severity === 'MODERATE'
      ? 'border-amber-400'
      : 'border-sky-400';

  const fmtSigned = (n: number, suffix = '%') => `${n >= 0 ? '+' : ''}${n}${suffix}`;
  const starTargetCount = diff === 'easy' ? 3 : 5;
  const earnedStars = (r: number) => Math.max(1, Math.round(Math.max(0, Math.min(1, r)) * starTargetCount));

  return (
    <>
      {/* =====================================================================
          PRE-CHALLENGE KID-FRIENDLY BRIEFING POPUP (Animated preview + big Let's Go!)
         ===================================================================== */}
      {showBriefingPopup && !completedPayload && (
        <div
          role="dialog"
          aria-label={`Mission Briefing: ${descriptor.taskTitle}`}
          data-testid="minigame-briefing-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5 bg-[#0b1226]/75 backdrop-blur-sm pointer-events-auto"
        >
          <div
            className={`w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-900 border-4 ${borderColor} shadow-2xl p-5 md:p-6 text-slate-100`}
          >
            {/* Friendly Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    data-testid="briefing-event-code"
                    className="text-xs font-bold text-amber-300"
                  >
                    {descriptor.goalIcon} {attribution.originLabel}
                  </span>
                </div>
                {attribution.realRecordText && attribution.realRecordLink && (
                  <div className="mt-1 text-xs text-emerald-300 font-semibold">
                    {attribution.realRecordText}{' '}
                    <a
                      href={attribution.realRecordLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-300 underline hover:text-sky-200"
                    >
                      Source: NASA DONKI ↗
                    </a>
                  </div>
                )}
                <h2 className="text-xl md:text-2xl font-extrabold text-white mt-0.5">
                  {descriptor.taskTitle}
                </h2>
              </div>

              <div className="px-3.5 py-2 rounded-2xl bg-slate-950 border-2 border-emerald-400/70 text-right">
                <div className="text-[11px] text-emerald-300 font-bold">
                  {hasStartedChallenge ? 'PAUSED' : 'READY!'}
                </div>
                <div
                  data-testid="briefing-timer-standby"
                  className="text-base font-extrabold text-amber-300"
                >
                  {timeLeft.toFixed(0)}s
                </div>
              </div>
            </div>

            {/* Big Animated Demo + Short Instruction */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4 items-center">
              <div className="flex flex-col gap-2.5">
                <MiniGameAnimatedPreview
                  descriptor={descriptor}
                  activePhaseOverride={lockedPhaseIdx}
                  onPhaseChange={(phase) => setAnimPhaseIdx(phase)}
                />
                <div className="px-3.5 py-2.5 rounded-2xl bg-slate-950 border-2 border-slate-800 text-sm font-bold text-amber-200 text-center">
                  {descriptor.goalBanner}
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="space-y-2">
                  {descriptor.howToSolveSteps.map((stepText, idx) => {
                    const isStepActive = (lockedPhaseIdx ?? animPhaseIdx) === idx;
                    return (
                      <div
                        key={idx}
                        data-testid={`briefing-step-${idx + 1}`}
                        onClick={() =>
                          setLockedPhaseIdx((prev) => (prev === idx ? null : idx))
                        }
                        className={`p-3 rounded-2xl border-2 text-sm font-semibold leading-snug transition-all cursor-pointer ${
                          isStepActive
                            ? 'bg-emerald-950/90 border-emerald-400 text-emerald-100 shadow-[0_0_12px_rgba(52,211,153,0.28)]'
                            : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      >
                        {stepText}
                      </div>
                    );
                  })}
                </div>

                <div className="p-2.5 rounded-2xl bg-sky-950 border-2 border-sky-500/40 text-xs font-semibold text-sky-200">
                  👆 {descriptor.controlsSummary}
                </div>
              </div>
            </div>

            {/* Real-Life NASA Engineering Solution Card (Synchronized Animated Text & Phase Strip) */}
            <div
              data-testid="briefing-real-life-solution"
              className="mb-4 p-3.5 rounded-2xl bg-emerald-950/70 border-2 border-emerald-400/60 text-left"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"
                    aria-hidden="true"
                  />
                  🛠️ Real-Life NASA Engineering Solution
                </span>
                <span className="text-[11px] font-mono-tabular text-sky-300">
                  {descriptor.realLifeSolution.nasaSystemCode}
                </span>
              </div>
              <div className="text-sm font-bold text-white mb-1.5">
                {descriptor.realLifeSolution.solutionTitle}
              </div>

              {/* Synchronized 3-Stage Animated Text Breakdown matching the Canvas Animation */}
              <div
                data-testid="real-life-solution-animated-stages"
                className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-2"
              >
                {(
                  REAL_LIFE_ANIMATION_CAPTIONS[descriptor.mechanicType] ||
                  REAL_LIFE_ANIMATION_CAPTIONS.weld_seal
                ).map((stageCaption, sIdx) => {
                  const activeStage = (lockedPhaseIdx ?? animPhaseIdx) === sIdx;
                  return (
                    <button
                      key={sIdx}
                      type="button"
                      data-testid={`solution-anim-stage-${sIdx + 1}`}
                      data-active={activeStage ? 'true' : 'false'}
                      onClick={() =>
                        setLockedPhaseIdx((prev) => (prev === sIdx ? null : sIdx))
                      }
                      className={`text-left p-2 rounded-xl border text-[11px] font-mono-tabular leading-snug transition-all cursor-pointer ${
                        activeStage
                          ? 'bg-slate-950 border-amber-300 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.28)] scale-[1.01]'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {stageCaption}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-slate-200 leading-relaxed mt-1.5">
                {descriptor.realLifeSolution.realWorldPrinciple}
              </p>
            </div>

            {/* Optional Kid-Friendly "Did you know?" Fun-Fact Card */}
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setShowFunFact((prev) => !prev)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-950 hover:bg-indigo-900 text-amber-200 border-2 border-indigo-400/50 cursor-pointer"
              >
                {showFunFact ? 'Hide NASA Fun Fact ▲' : 'Did you know? 🌟 Tap for a NASA Fun Fact ▼'}
              </button>
              {showFunFact && (
                <div className="mt-2 p-3.5 rounded-2xl bg-indigo-950 border-2 border-indigo-400/50 text-xs md:text-sm text-slate-100 leading-relaxed">
                  <strong className="text-amber-300">🚀 Real Space Science:</strong>{' '}
                  {descriptor.nasaFunFact}
                </div>
              )}
            </div>

            {/* Big Bright Let's Go! CTA */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="text-xs md:text-sm font-semibold text-slate-300">
                Ready, Astronaut? Tap the green button!
              </div>
              <button
                type="button"
                data-testid="minigame-lets-go-btn"
                onClick={handleLetsGo}
                className="px-8 py-4 rounded-2xl text-base md:text-lg font-extrabold bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-4 border-emerald-200 cursor-pointer whitespace-nowrap shrink-0 shadow-xl transition-transform active:scale-95"
              >
                {hasStartedChallenge ? 'Keep Playing! 🚀' : "Let's Go! 🚀"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          END-OF-GAME CELEBRATION & NASA FUN FACT SCREEN
         ===================================================================== */}
      {completedPayload && (
        <div
          role="dialog"
          aria-label="Mission Complete"
          data-testid="minigame-complete-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1226]/75 backdrop-blur-sm pointer-events-auto"
        >
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border-4 border-amber-400 shadow-2xl p-6 text-center text-slate-100">
            <div className="text-4xl mb-2">
              {completedPayload.performanceRatio >= 0.45 ? '🎉' : '🌟'}
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-amber-300">
              {completedPayload.performanceRatio >= 0.75
                ? 'Great job, Commander!'
                : completedPayload.performanceRatio >= 0.4
                ? 'Nice work, Astronaut!'
                : 'Good try, Cadet!'}
            </h2>
            <p className="text-sm text-slate-200 mt-1 mb-3">{descriptor.taskTitle}</p>

            {/* Big Gold Stars */}
            <div className="flex items-center justify-center gap-2 text-3xl mb-4">
              {Array.from({ length: starTargetCount }).map((_, idx) => (
                <span
                  key={idx}
                  className={
                    idx < earnedStars(completedPayload.performanceRatio)
                      ? 'text-amber-300 drop-shadow'
                      : 'text-slate-700'
                  }
                >
                  ★
                </span>
              ))}
            </div>

            {/* Friendly Resource Badges */}
            <div className="grid grid-cols-4 gap-2 mb-4 text-center">
              <div className="p-2 rounded-2xl bg-slate-950 border-2 border-slate-800">
                <div className="text-xs">⚡ Power</div>
                <div className="text-sm font-extrabold text-amber-300">
                  {fmtSigned(completedPayload.deltas.powerDelta)}
                </div>
              </div>
              <div className="p-2 rounded-2xl bg-slate-950 border-2 border-slate-800">
                <div className="text-xs">🌬️ Air</div>
                <div className="text-sm font-extrabold text-emerald-300">
                  {fmtSigned(completedPayload.deltas.o2Delta)}
                </div>
              </div>
              <div className="p-2 rounded-2xl bg-slate-950 border-2 border-slate-800">
                <div className="text-xs">🛡️ Shield</div>
                <div className="text-sm font-extrabold text-purple-300">
                  {fmtSigned(completedPayload.deltas.shieldingDelta)}
                </div>
              </div>
              <div className="p-2 rounded-2xl bg-slate-950 border-2 border-slate-800">
                <div className="text-xs">🔬 Science</div>
                <div
                  data-testid="minigame-complete-science"
                  className="text-sm font-extrabold text-sky-300"
                >
                  {fmtSigned(
                    completedPayload.deltas.scienceDelta +
                      (selectedQuizIdx !== null &&
                      descriptor.realLifeSolution.solutionChoices[selectedQuizIdx]?.isCorrect
                        ? 15
                        : 0),
                    ''
                  )}
                </div>
              </div>
            </div>

            {/* Interactive Real-Life Engineering Check (+15 Bonus Science) */}
            <div
              data-testid="minigame-real-life-quiz"
              className="p-3.5 rounded-2xl bg-emerald-950/60 border-2 border-emerald-400/60 text-left text-xs mb-3"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-extrabold text-emerald-300 uppercase">
                  🧠 Real-Life Engineering Check (+15 Bonus Science)
                </span>
                <span className="text-[11px] font-mono-tabular text-amber-300">
                  {descriptor.realLifeSolution.solutionTitle}
                </span>
              </div>
              <p className="text-slate-100 font-semibold mb-2">
                {descriptor.realLifeSolution.fieldQuestion}
              </p>
              <div className="space-y-1.5">
                {descriptor.realLifeSolution.solutionChoices.map((choice, cIdx) => {
                  const isPicked = selectedQuizIdx === cIdx;
                  return (
                    <button
                      key={cIdx}
                      type="button"
                      data-testid={`minigame-quiz-option-${cIdx}`}
                      onClick={() => setSelectedQuizIdx(cIdx)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        isPicked
                          ? choice.isCorrect
                            ? 'bg-emerald-900/90 border-emerald-300 text-emerald-100'
                            : 'bg-rose-950/90 border-rose-400 text-rose-100'
                          : 'bg-slate-950 hover:bg-slate-900 border-slate-700 text-slate-200'
                      }`}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
              {selectedQuizIdx !== null && (
                <div
                  data-testid="minigame-quiz-feedback"
                  className={`mt-2 p-2 rounded-xl text-xs font-semibold ${
                    descriptor.realLifeSolution.solutionChoices[selectedQuizIdx]?.isCorrect
                      ? 'bg-emerald-950 text-emerald-200 border border-emerald-400/50'
                      : 'bg-amber-950 text-amber-200 border border-amber-400/50'
                  }`}
                >
                  {descriptor.realLifeSolution.solutionChoices[selectedQuizIdx]?.isCorrect
                    ? '✅ +15 BONUS SCIENCE! '
                    : '💡 Engineering Note: '}
                  {descriptor.realLifeSolution.solutionChoices[selectedQuizIdx]?.explanation}
                </div>
              )}
            </div>

            {/* Real NASA Fun Fact */}
            <div className="p-3 rounded-2xl bg-sky-950 border-2 border-sky-400/50 text-left text-xs text-slate-100 mb-4">
              <div className="font-extrabold text-sky-300 mb-0.5">🚀 Real NASA Fun Fact!</div>
              {descriptor.nasaFunFact}
            </div>

            <button
              type="button"
              data-testid="minigame-continue-btn"
              onClick={() => {
                const quizBonus =
                  selectedQuizIdx !== null &&
                  descriptor.realLifeSolution.solutionChoices[selectedQuizIdx]?.isCorrect
                    ? 15
                    : 0;
                onCompleteRef.current({
                  ...completedPayload,
                  deltas: {
                    ...completedPayload.deltas,
                    scienceDelta: completedPayload.deltas.scienceDelta + quizBonus,
                  },
                });
              }}
              className="w-full py-3.5 rounded-2xl text-base font-extrabold bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-4 border-emerald-200 cursor-pointer shadow-xl transition-transform active:scale-95"
            >
              Back to Base! 🚀
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          ACTIVE INTERACTIVE CHALLENGE OVERLAY
         ===================================================================== */}
      {hasStartedChallenge && !completedPayload && (
        <div
          role="dialog"
          aria-label={`Interactive Mini-Game: ${descriptor.taskTitle}`}
          data-testid="minigame-overlay-modal"
          className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 bg-[#0b1226] pointer-events-auto"
        >
          <div
            className={`w-full max-w-2xl rounded-3xl bg-slate-900 border-4 ${borderColor} shadow-2xl p-3.5 sm:p-5 text-slate-100`}
          >
            {/* Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    data-testid="minigame-event-code"
                    className="text-xs font-bold text-amber-300"
                  >
                    {descriptor.goalIcon} {attribution.originLabel}
                  </span>
                </div>
                <h2 className="text-base md:text-lg font-extrabold text-white mt-0.5">
                  {descriptor.taskTitle}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="minigame-reopen-briefing-btn"
                  onClick={handlePauseForBriefing}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-sky-300 border-2 border-sky-500/50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  ❓ How to Play
                </button>
                {onReplaySound && (
                  <button
                    type="button"
                    onClick={onReplaySound}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border-2 border-slate-600 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    🔊 Sound
                  </button>
                )}
                <div className="px-3 py-1 rounded-xl bg-slate-950 border-2 border-amber-400/70 text-right">
                  <div className="text-[10px] font-bold text-slate-400">TIME</div>
                  <div
                    data-testid="minigame-timer"
                    className={`text-sm font-extrabold ${
                      timeLeft <= 4 ? 'text-rose-400' : 'text-amber-300'
                    }`}
                  >
                    {timeLeft.toFixed(1)}s
                  </div>
                </div>
              </div>
            </div>

            {/* Real-Life NASA Engineering Solution Active Banner */}
            <div
              data-testid="active-real-life-solution"
              className="mt-2 mb-2.5 rounded-2xl bg-slate-950 border-2 border-emerald-500/50 px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-mono-tabular uppercase text-emerald-300 font-bold flex items-center gap-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"
                      aria-hidden="true"
                    />
                    🛠️ Real-Life Solution: {descriptor.realLifeSolution.solutionTitle}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-amber-200">
                    {descriptor.goalBanner}
                  </div>
                </div>
                <div className="text-xs font-bold text-sky-300 shrink-0">
                  👆 Tap or Drag!
                </div>
              </div>
              <div
                data-testid="active-solution-live-caption"
                className="mt-1.5 pt-1.5 border-t border-slate-800/90 text-[11px] font-mono-tabular text-cyan-200 flex items-center justify-between gap-2"
              >
                <span>
                  {
                    (
                      REAL_LIFE_ANIMATION_CAPTIONS[descriptor.mechanicType] ||
                      REAL_LIFE_ANIMATION_CAPTIONS.weld_seal
                    )[ratio < 0.34 ? 0 : ratio < 0.75 ? 1 : 2]
                  }
                </span>
                <span className="text-emerald-300 font-bold shrink-0">
                  {Math.round(ratio * 100)}%
                </span>
              </div>
            </div>

            {/* Interactive 2D HTML5 Cartoon Canvas */}
            <div className="relative w-full rounded-2xl bg-[#050b16] border-4 border-slate-700 overflow-hidden mb-3">
              <canvas
                ref={canvasRef}
                width={640}
                height={300}
                data-testid="minigame-canvas"
                className="w-full h-[230px] sm:h-[260px] block cursor-pointer touch-none"
              />
            </div>

            {/* Kid-Friendly Stars & Base Impact Badges */}
            <div className="rounded-2xl bg-slate-950 border-2 border-slate-800 p-2.5 mb-3">
              <div className="flex items-center justify-between gap-2 text-xs mb-2">
                <span className="font-bold text-slate-300">
                  ⭐ Stars Earned:{' '}
                  <strong data-testid="minigame-ratio" className="text-amber-300">
                    {earnedStars(ratio)}/{starTargetCount} ({Math.round(ratio * 100)}%)
                  </strong>
                </span>
                <span className="text-xs font-semibold text-sky-300">
                  {ratio >= 0.8 ? 'Awesome!' : ratio >= 0.4 ? 'Keep going!' : 'Tap glowing targets!'}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-1.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400">⚡ Power</div>
                  <div
                    data-testid="minigame-delta-power"
                    className={`text-xs font-extrabold ${
                      liveDeltas.powerDelta >= 0 ? 'text-amber-300' : 'text-rose-400'
                    }`}
                  >
                    {fmtSigned(liveDeltas.powerDelta)}
                  </div>
                </div>
                <div className="p-1.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400">🌬️ Air</div>
                  <div
                    data-testid="minigame-delta-o2"
                    className={`text-xs font-extrabold ${
                      liveDeltas.o2Delta >= 0 ? 'text-emerald-300' : 'text-rose-400'
                    }`}
                  >
                    {fmtSigned(liveDeltas.o2Delta)}
                  </div>
                </div>
                <div className="p-1.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400">🛡️ Shield</div>
                  <div
                    data-testid="minigame-delta-shield"
                    className={`text-xs font-extrabold ${
                      liveDeltas.shieldingDelta >= 0 ? 'text-purple-300' : 'text-rose-400'
                    }`}
                  >
                    {fmtSigned(liveDeltas.shieldingDelta)}
                  </div>
                </div>
                <div className="p-1.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400">🔬 Science</div>
                  <div
                    data-testid="minigame-delta-science"
                    className={`text-xs font-extrabold ${
                      liveDeltas.scienceDelta >= 0 ? 'text-sky-300' : 'text-rose-400'
                    }`}
                  >
                    {fmtSigned(liveDeltas.scienceDelta, ' PTS')}
                  </div>
                </div>
              </div>
            </div>

            {/* Simple Touch-Friendly Action Buttons (NO hotkey brackets) */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-300 max-w-sm">
                💡 {descriptor.proTip}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {diff !== 'easy' && ev.donkiCode === 'DONKI-FLR-2026-X2.4' && (
                  <button
                    type="button"
                    onClick={() => managerRef.current?.toggleSolarArrayGimbal()}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-amber-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {descriptor.realLifeSolution.secondaryActionLabel || '🪽 Feather Solar Wings 90°'}
                  </button>
                )}
                {diff !== 'easy' && ev.donkiCode === 'DONKI-QUIET-SUN-SOL' && (
                  <button
                    type="button"
                    onClick={() => managerRef.current?.boostMaintenanceConsole(0.25)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-2 border-emerald-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {descriptor.realLifeSolution.secondaryActionLabel || '🛠️ Swap ECLSS Membrane & Patch'}
                  </button>
                )}
                {diff !== 'easy' && ev.donkiCode === 'ARTEMIS-DUST-LEV-09' && (
                  <button
                    type="button"
                    onClick={() => managerRef.current?.swipeManualEvaBrush()}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-amber-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {descriptor.realLifeSolution.secondaryActionLabel || '🧹 Grounded Carbon Brush'}
                  </button>
                )}
                {diff !== 'easy' && ev.donkiCode === 'ARTEMIS-LRO-CRATER-89S' && (
                  <button
                    type="button"
                    onClick={() => managerRef.current?.packRegolithBerm()}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-2 border-emerald-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {descriptor.realLifeSolution.secondaryActionLabel || '🚜 Pack Regolith Berm'}
                  </button>
                )}
                {diff !== 'easy' && ev.donkiCode === 'MARS-MEDA-DUST-88' && (
                  <button
                    type="button"
                    onClick={() => managerRef.current?.flipLoadShedBreaker()}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-amber-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {descriptor.realLifeSolution.secondaryActionLabel || '⚡ Shed Auxiliary Load'}
                  </button>
                )}
                {diff !== 'easy' && ev.donkiCode === 'MARS-JEZERO-FROST-19' && (
                  <button
                    type="button"
                    onClick={() => managerRef.current?.tapAcousticChisel()}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-amber-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {descriptor.realLifeSolution.secondaryActionLabel || '🔨 Fire Piezo Ultrasonic Tap'}
                  </button>
                )}
                <button
                  type="button"
                  data-testid="minigame-primary-solution-btn"
                  onClick={() => managerRef.current?.applyInteractionImpulse(0.25)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-400 hover:bg-sky-300 text-slate-950 border-2 border-sky-200 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {descriptor.realLifeSolution.primaryActionLabel}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    managerRef.current?.forceCompleteWithRatio(
                      managerRef.current.getPerformanceRatio()
                    )
                  }
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-2 border-emerald-400/50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Done! ✓
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface SolTransitionModalProps {
  gameState: OutpostGameState;
  onConfirmEnterSol: () => void;
}

export const SolTransitionModal: React.FC<SolTransitionModalProps> = ({
  gameState,
  onConfirmEnterSol,
}) => {
  const site = MISSION_SITES[gameState.siteId];
  const diffCfg = DIFFICULTY_CONFIGS[gameState.difficulty || 'normal'];
  const overnightPwr = Math.round(site.dailyPowerDrain * diffCfg.drainMultiplier);
  const overnightO2 = Math.round(site.dailyLifeSupportDrain * diffCfg.drainMultiplier);
  const overnightShd = Math.round(site.dailyShieldingDecay * diffCfg.drainMultiplier);
  const sciNeeded = Math.max(0, gameState.minScienceToWin - gameState.scienceScore);

  return (
    <div
      role="dialog"
      aria-label={`Entering ${site.dayName} ${gameState.sol}`}
      data-testid="entering-sol-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1226] pointer-events-auto"
    >
      <div className="w-full max-w-xl bg-slate-900 border-4 border-amber-400 shadow-2xl p-6 md:p-8 text-center text-slate-100">
        <div className="inline-block px-3 py-1 bg-amber-400/20 border border-amber-400 text-xs font-mono-tabular font-bold text-amber-300 mb-3">
          OVERNIGHT TELEMETRY COMPLETE · {site.name.toUpperCase()}
        </div>

        <h2 className="font-pixel text-xl md:text-2xl text-white tracking-wide mb-2">
          ENTERING {site.dayName.toUpperCase()} {gameState.sol} OF {gameState.maxSols}
        </h2>

        <p className="text-sm text-slate-300 max-w-md mx-auto mb-5">
          Nighttime heaters, oxygen scrubbers, and radiation shields kept your crew safe through the cold dark cycle!
        </p>

        {/* Overnight Drain & Current Reserves Summary */}
        <div className="grid grid-cols-4 gap-2.5 mb-5 font-mono-tabular">
          <div className="p-3 bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400">POWER</div>
            <div className="text-base font-bold text-amber-400 mt-0.5">{gameState.power}%</div>
            <div className="text-[10px] text-rose-400 mt-0.5">-{overnightPwr}% Night</div>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400">O2 &amp; FOOD</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">{gameState.lifeSupport}%</div>
            <div className="text-[10px] text-rose-400 mt-0.5">-{overnightO2}% Night</div>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400">SHIELDING</div>
            <div className="text-base font-bold text-purple-400 mt-0.5">{gameState.shielding}%</div>
            <div className="text-[10px] text-rose-400 mt-0.5">-{overnightShd}% Night</div>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400">SCIENCE GOAL</div>
            <div className="text-base font-bold text-sky-400 mt-0.5">
              {gameState.scienceScore}/{gameState.minScienceToWin}
            </div>
            <div className="text-[10px] text-emerald-400 mt-0.5">
              {sciNeeded === 0 ? 'Goal Met!' : `Need ${sciNeeded} more`}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onConfirmEnterSol}
          className="w-full py-3.5 text-sm font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-amber-200 cursor-pointer"
        >
          Begin {site.dayName} {gameState.sol} Crew Shifts [Enter / Space] →
        </button>
      </div>
    </div>
  );
};

interface NasaCodexModalProps {
  liveWeather?: SpaceWeatherSummary | null;
  weatherOffline?: boolean;
  osdrStudy?: OsdrStudyHighlight | null;
  onOpenCredits?: () => void;
  onOpenTraineeLab?: () => void;
  onClose: () => void;
  onSimulateEvent?: (event: SpaceWeatherEvent) => void;
}

export const NasaCodexModal: React.FC<NasaCodexModalProps> = ({
  liveWeather = null,
  weatherOffline = false,
  osdrStudy = null,
  onOpenCredits,
  onOpenTraineeLab,
  onClose,
  onSimulateEvent,
}) => {
  const mood = computeSunMood(liveWeather);
  const latestFlare = liveWeather?.flares?.[0];
  const latestStorm = liveWeather?.storms?.[0];
  const latestCme = liveWeather?.cmes?.[0];
  const moodSummary =
    mood === 'Stormy'
      ? 'Sun mood: Stormy — strong solar flare or storm reported!'
      : mood === 'Busy'
      ? 'Sun mood: Busy — medium solar flares reported lately.'
      : 'Sun mood: Quiet — calm space skies right now.';

  const moodColor =
    mood === 'Stormy'
      ? 'text-rose-300'
      : mood === 'Busy'
      ? 'text-amber-300'
      : 'text-emerald-300';

  return (
    <div
      role="dialog"
      aria-label="Space Data Codex"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1226] pointer-events-auto"
    >
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-slate-900 border-2 border-sky-400 p-6 text-slate-100 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
          <div>
            <p className="text-xs font-mono-tabular text-sky-400">
              SCIENTIFIC GROUNDING &amp; DATA ATTRIBUTION
            </p>
            <h2 className="text-xl font-bold text-white">
              Open Science Datasets &amp; Training Scenarios
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onOpenTraineeLab && (
              <button
                type="button"
                data-testid="codex-open-trainee-lab-btn"
                onClick={onOpenTraineeLab}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-400 hover:bg-cyan-300 text-slate-950 border border-cyan-200 cursor-pointer"
              >
                Open Trainee Lab
              </button>
            )}
            {onOpenCredits && (
              <button
                type="button"
                onClick={onOpenCredits}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-950 hover:bg-sky-900 text-sky-200 border border-sky-400/60 cursor-pointer"
              >
                Data &amp; Credits
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-600 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-4 text-xs leading-relaxed text-slate-300">
          {/* LIVE SPACE WEATHER SECTION (kid words, <= 12 words per line) */}
          <div
            data-testid="codex-live-weather"
            className="p-3.5 rounded-xl bg-slate-950 border border-sky-500/60 space-y-1.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-sky-300">
                Live Space Weather (Latest Reported)
              </h3>
              <a
                href={liveWeather?.source?.url || 'https://ccmc.gsfc.nasa.gov/tools/DONKI/'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-sky-300 underline hover:text-sky-200"
              >
                Source: NASA DONKI ↗
              </a>
            </div>

            <p className={`text-sm font-bold ${moodColor}`}>{moodSummary}</p>

            {latestFlare ? (
              <p className="text-slate-200">
                Latest flare: {latestFlare.classType} ({describeFlareSize(latestFlare.classType)}) · reported{' '}
                {formatReportedAgo(latestFlare.peakTime)}.
              </p>
            ) : (
              <p className="text-slate-200">
                No solar flares reported in the last 30 days.
              </p>
            )}

            <p className="text-slate-400">
              Flare guide: A/B/C small · M medium · X big.
            </p>

            {latestCme && (
              <p className="text-slate-300">
                Latest solar cloud (CME): reported {formatReportedAgo(latestCme.startTime)}
                {latestCme.speedKmPerSec ? ` · ${latestCme.speedKmPerSec} km/s` : ''}.
              </p>
            )}

            {latestStorm && (
              <p className="text-slate-300">
                Latest magnetic storm: Kp {latestStorm.maxKp ?? '?'} · reported{' '}
                {formatReportedAgo(latestStorm.startTime)}.
              </p>
            )}

            {weatherOffline && (
              <p className="text-amber-300 font-semibold">
                Offline right now — showing saved weather notes.
              </p>
            )}

            {liveWeather?.status === 'fallback' && (
              <p className="text-amber-300 font-semibold">
                Saved NASA data from {formatSavedDate(liveWeather.fetchedAt)}.
              </p>
            )}

            {liveWeather?.status === 'stale' && (
              <p className="text-amber-300 font-semibold">
                Saved copy from {formatSavedDate(liveWeather.fetchedAt)} (updating later).
              </p>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800 text-[11px]">
              <span className="font-semibold text-slate-400">NASA API Status:</span>
              {liveWeather?.status === 'live' ? (
                <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live API Telemetry Connected (via api.nasa.gov)
                </span>
              ) : (
                <span className="text-amber-300 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Baseline Science Dataset Active (Ready for Key in .env)
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 pt-1">
              Preliminary research data provided as-is. Analysts post entries hours or days later.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <h3 className="text-sm font-bold text-amber-400 mb-1">
              1. NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information)
            </h3>
            <p>
              Tracks solar flares (X-class and M-class), Coronal Mass Ejections (CMEs), and
              Solar Energetic Particle (SEP) proton storms. Real reported space-weather activity
              gently shapes which training scenarios appear in your mission.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h3 className="text-sm font-bold text-emerald-400">
              2. NASA OSDR (Open Science Data Repository &amp; Biological Dosimetry)
            </h3>
            <p>
              Provides astronaut radiation dosimetry (measured in Millisieverts, mSv) and space
              biology data from experiments like Veggie, BioSentinel, and Rodent Research, showing
              how plants recycle CO2 into breathable oxygen.
            </p>
            {osdrStudy && (
              <div className="p-2.5 rounded-lg bg-slate-900 border border-emerald-500/40 text-[11px]">
                <div className="font-mono-tabular text-emerald-300 font-bold">
                  Featured Study: {osdrStudy.id}
                </div>
                <div className="text-slate-100 mt-0.5">{osdrStudy.title}</div>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
                  <span className="text-slate-400 italic">{osdrStudy.creditLine}</span>
                  <a
                    href={osdrStudy.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-300 underline hover:text-sky-200"
                  >
                    View {osdrStudy.id} ↗
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <h3 className="text-sm font-bold text-sky-400 mb-1">
              3. Moon (LRO) &amp; Mars Planetary Datasets
            </h3>
            <p>
              On the Moon, missions are counted in Earth days. A full Moon day-and-night cycle
              lasts about 29.5 Earth days: roughly two weeks of sunlight, then two weeks of
              darkness, so solar power only works in the sunny stretch (except on a few high
              spots near the south pole that get sunlight almost all the time). Shackleton Crater
              Rim also has roughly 1.36 mSv/day unshielded cosmic radiation and roughly -130°C to
              -200°C crater shadows. On Mars, a day is called a Sol and lasts about 24 hours 39
              minutes, with ~0.38g gravity, roughly 0.67 mSv/day surface radiation, and global dust
              storms that cut solar array output.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-400 mb-2">
              TRAINING SCENARIOS IN SIMULATION:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {NASA_SPACE_EVENTS.map((ev) => {
                const attr = getEventAttribution(ev, liveWeather);
                return (
                  <div
                    key={ev.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="text-[11px] font-semibold text-sky-400">
                        {attr.originLabel}
                      </div>
                      <div className="font-bold text-white text-xs mt-0.5">{ev.title}</div>
                      {attr.realRecordText && attr.realRecordLink && (
                        <div className="text-[11px] text-emerald-300 mt-1">
                          {attr.realRecordText}{' '}
                          <a
                            href={attr.realRecordLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-300 underline hover:text-sky-200"
                          >
                            Link ↗
                          </a>
                        </div>
                      )}
                      <div className="text-[11px] text-slate-400 mt-1">
                        Term: <strong className="text-slate-200">{ev.vocabTerm}</strong>
                      </div>
                    </div>
                    {onSimulateEvent && (
                      <button
                        type="button"
                        onClick={() => onSimulateEvent(ev)}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/50 cursor-pointer whitespace-nowrap shrink-0 self-start"
                      >
                        Try Scenario Mini-Game
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


