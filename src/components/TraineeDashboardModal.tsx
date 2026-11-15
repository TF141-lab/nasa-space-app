import React, { useMemo, useState } from 'react';
import {
  buildTraineeCombinedFeedPayload,
  computeEvaRadiationPlan,
  DonkiTacticalActionId,
  evaluateCountermeasureSchedule,
  evaluateDonkiTacticalAction,
  getTimeUnit,
  MISSION_SITES,
  OSDR_MUSCULOSKELETAL_STUDIES,
  OutpostGameState,
  RADLAB_INSTRUMENT_RECORDS,
  SHIELDING_MATERIALS,
} from '../game/rules';
import type { ShieldingMaterialId, SpaceWeatherSummary } from '../types/spaceWeather';

interface TraineeDashboardModalProps {
  gameState: OutpostGameState;
  liveWeather: SpaceWeatherSummary | null;
  onApplyProtocol?: (
    protocolLabel: string,
    deltas: {
      powerDelta: number;
      lifeSupportDelta: number;
      shieldingDelta: number;
      scienceDelta: number;
    }
  ) => void;
  onTriggerScenarioByCode?: (donkiCode: string) => void;
  onClose: () => void;
}

type LabTabId = 'radlab_eva' | 'donki_alert' | 'osdr_conditioning' | 'json_feed';

export const TraineeDashboardModal: React.FC<TraineeDashboardModalProps> = ({
  gameState,
  liveWeather,
  onApplyProtocol,
  onTriggerScenarioByCode,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LabTabId>('radlab_eva');
  const [appliedBanner, setAppliedBanner] = useState<string | null>(null);

  // 1. RadLab Absorbed Dose Rate & EVA Shielding Planner state
  const [selectedDetectorId, setSelectedDetectorId] = useState<string>(
    RADLAB_INSTRUMENT_RECORDS[0].detectorId
  );
  const [selectedMaterialId, setSelectedMaterialId] =
    useState<ShieldingMaterialId>('polyethylene_liner');
  const [evaHours, setEvaHours] = useState<number>(2.5);

  // 2. DONKI Solar Flare & CME Emergency Alert System state
  const [selectedDonkiAction, setSelectedDonkiAction] =
    useState<DonkiTacticalActionId>('secure_antenna_arrays');

  // 3. OSDR Bone Density & Muscle Mass Loss Countermeasure Scheduler state
  const [resistiveExerciseMin, setResistiveExerciseMin] = useState<number>(75);
  const [sleepHours, setSleepHours] = useState<number>(8.0);
  const [bioRegenNutritionPct, setBioRegenNutritionPct] = useState<number>(85);

  const site = MISSION_SITES[gameState.siteId];
  const unit = getTimeUnit(gameState.siteId);

  const evaPlan = useMemo(
    () =>
      computeEvaRadiationPlan(
        selectedDetectorId,
        selectedMaterialId,
        evaHours,
        gameState.siteId
      ),
    [selectedDetectorId, selectedMaterialId, evaHours, gameState.siteId]
  );

  const latestFlareClass = liveWeather?.flares?.[0]?.classType || 'M1.7';
  const latestCmeSpeed = liveWeather?.cmes?.[0]?.speedKmPerSec || 474;

  const donkiOutcome = useMemo(
    () =>
      evaluateDonkiTacticalAction(
        selectedDonkiAction,
        latestFlareClass,
        latestCmeSpeed
      ),
    [selectedDonkiAction, latestFlareClass, latestCmeSpeed]
  );

  const conditioningResult = useMemo(
    () =>
      evaluateCountermeasureSchedule({
        resistiveExerciseMin,
        sleepHours,
        bioRegenNutritionPct,
        gravityG: site.gravityG,
      }),
    [resistiveExerciseMin, sleepHours, bioRegenNutritionPct, site.gravityG]
  );

  const combinedPayload = useMemo(
    () => buildTraineeCombinedFeedPayload(liveWeather),
    [liveWeather]
  );

  const fmtSigned = (n: number, suffix = '%') => `${n >= 0 ? '+' : ''}${n}${suffix}`;

  const handleApplyToMission = (
    label: string,
    deltas: {
      powerDelta: number;
      lifeSupportDelta: number;
      shieldingDelta: number;
      scienceDelta: number;
    }
  ) => {
    if (onApplyProtocol) {
      onApplyProtocol(label, deltas);
      setAppliedBanner(
        `Applied "${label}" to ${unit} ${gameState.sol}: ${fmtSigned(deltas.powerDelta, '% PWR')} · ${fmtSigned(deltas.lifeSupportDelta, '% O2')} · ${fmtSigned(deltas.shieldingDelta, '% SHD')} · ${fmtSigned(deltas.scienceDelta, ' SCI')}`
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Trainee Telemetry & Countermeasure Lab"
      data-testid="trainee-dashboard-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#07090e]/90 pointer-events-auto"
    >
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border-2 border-cyan-400 p-5 sm:p-6 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5 mb-4">
          <div>
            <div className="text-xs font-mono-tabular text-cyan-400">
              NASA &amp; PARTNER SOURCE PARAMETERS · RADLAB · DONKI · OSDR
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5">
              Trainee Telemetry &amp; Countermeasure Lab ({site.name})
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 cursor-pointer whitespace-nowrap shrink-0"
          >
            Close Lab
          </button>
        </div>

        {/* Navigation Tabs for the 3 Core Parameters + Combined Feed */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            type="button"
            data-testid="tab-radlab-eva"
            onClick={() => setActiveTab('radlab_eva')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'radlab_eva'
                ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
            }`}
          >
            1. Absorbed Dose Rate (RadLab)
          </button>

          <button
            type="button"
            data-testid="tab-donki-alert"
            onClick={() => setActiveTab('donki_alert')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'donki_alert'
                ? 'bg-amber-400 text-slate-950 border-amber-200'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
            }`}
          >
            2. Solar Flare &amp; CME Alerts (DONKI)
          </button>

          <button
            type="button"
            data-testid="tab-osdr-conditioning"
            onClick={() => setActiveTab('osdr_conditioning')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'osdr_conditioning'
                ? 'bg-emerald-400 text-slate-950 border-emerald-200'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
            }`}
          >
            3. Bone &amp; Muscle Loss Rates (OSDR)
          </button>

          <button
            type="button"
            data-testid="tab-json-feed"
            onClick={() => setActiveTab('json_feed')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'json_feed'
                ? 'bg-purple-400 text-slate-950 border-purple-200'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
            }`}
          >
            Combined JSON Feed (DONKI + RadLab + OSDR)
          </button>
        </div>

        {appliedBanner && (
          <div
            data-testid="trainee-applied-banner"
            className="mb-4 p-3 rounded-xl bg-emerald-950 border border-emerald-400/70 text-xs font-mono-tabular text-emerald-200 flex items-center justify-between gap-2"
          >
            <span>● {appliedBanner}</span>
            <button
              type="button"
              onClick={() => setAppliedBanner(null)}
              className="text-emerald-300 underline hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ===================================================================
            PARAMETER 1: ABSORBED DOSE RATE (RADLAB) — EVA TIMER & SHIELDING PLANNER
           =================================================================== */}
        {activeTab === 'radlab_eva' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs font-mono-tabular text-cyan-400">
                SOURCE DATASET: RadLab (OSDR Radiation Dosimetry Database) · ISS Dosimetry Instruments
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">
                EVA Timer &amp; Shielding Planner (Absorbed Dose Rate)
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Trainees equip different shielding materials or schedule spacewalks (EVAs). The{' '}
                <strong className="text-cyan-300">Radiation Exposure Gauge</strong> fills up based on
                authentic absorbed dose rates recorded by ISS dosimetry instruments (DOSTEL, TEPC,
                ALTEA), requiring crew members to cycle into reinforced shelters before hitting safe
                operational limits.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Controls: Instrument Selector, Shielding Material, EVA Duration */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    Select RadLab ISS Dosimetry Instrument Feed:
                  </label>
                  <div className="space-y-2">
                    {RADLAB_INSTRUMENT_RECORDS.map((rec) => {
                      const isSel = selectedDetectorId === rec.detectorId;
                      return (
                        <button
                          key={rec.detectorId}
                          type="button"
                          onClick={() => setSelectedDetectorId(rec.detectorId)}
                          className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                            isSel
                              ? 'bg-slate-800 border-cyan-400 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-cyan-300">
                              {rec.instrumentName}
                            </span>
                            <span className="text-xs font-mono-tabular font-bold text-amber-300">
                              {rec.absorbedDoseRateMicroGyPerHour} μGy/hr
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {rec.recordedWindow} · {rec.dailyEquivalentMsv} mSv/day
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    Equip Shielding Material:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(Object.keys(SHIELDING_MATERIALS) as ShieldingMaterialId[]).map((matId) => {
                      const mat = SHIELDING_MATERIALS[matId];
                      const isSel = selectedMaterialId === matId;
                      return (
                        <button
                          key={matId}
                          type="button"
                          onClick={() => setSelectedMaterialId(matId)}
                          className={`text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                            isSel
                              ? 'bg-slate-800 border-cyan-400 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="text-xs font-bold text-white">{mat.name}</div>
                          <div className="text-[11px] font-mono-tabular text-cyan-300 mt-0.5">
                            Attenuation: {Math.round((1 - mat.doseAttenuationFactor) * 100)}% blocked ·{' '}
                            {mat.arealDensityGPerCm2} g/cm²
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label htmlFor="eva-hours-slider" className="font-bold text-slate-200">
                      Scheduled Spacewalk (EVA) Duration:
                    </label>
                    <span
                      data-testid="radlab-eva-hours-val"
                      className="font-mono-tabular font-bold text-cyan-300"
                    >
                      {evaHours.toFixed(1)} hours
                    </span>
                  </div>
                  <input
                    id="eva-hours-slider"
                    type="range"
                    min={0.5}
                    max={8.0}
                    step={0.5}
                    value={evaHours}
                    onChange={(e) => setEvaHours(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono-tabular text-slate-400 mt-0.5">
                    <span>0.5 hr (Quick Check)</span>
                    <span>4.0 hr (Standard EVA)</span>
                    <span>8.0 hr (Full Shift)</span>
                  </div>
                </div>
              </div>

              {/* Right Telemetry Output: Active Radiation Exposure Gauge & Shelter Cycling */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="text-xs font-mono-tabular text-slate-400">
                    ACTIVE RADIATION EXPOSURE GAUGE (RADLAB DOSIMETRY)
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 font-mono-tabular">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">ABSORBED DOSE RATE</div>
                      <div
                        data-testid="radlab-effective-rate"
                        className="text-xl font-bold text-cyan-300 mt-0.5"
                      >
                        {evaPlan.effectiveDoseRateMicroGyPerHour}{' '}
                        <span className="text-xs text-slate-400">μGy/hr</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">DAILY EQUIVALENT DOSE</div>
                      <div
                        data-testid="radlab-accumulated-msv"
                        className="text-xl font-bold text-amber-300 mt-0.5"
                      >
                        {evaPlan.accumulatedDoseMsv.toFixed(2)}
                        <span className="text-xs text-slate-400 ml-1">
                          / {evaPlan.dailyOperationalLimitMsv.toFixed(2)} mSv
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Visual Radiation Exposure Gauge Bar */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-200">
                        Radiation Exposure Gauge
                      </span>
                      <span
                        data-testid="radlab-gauge-pct"
                        className={`font-mono-tabular font-bold ${
                          evaPlan.requiresShelterCycle ? 'text-rose-400' : 'text-emerald-300'
                        }`}
                      >
                        {evaPlan.requiresShelterCycle
                          ? `▲ ${evaPlan.exposureGaugePct}% · CYCLE TO SHELTER`
                          : `● ${evaPlan.exposureGaugePct}% · WITHIN SAFE LIMIT`}
                      </span>
                    </div>
                    <div className="w-full h-3.5 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${
                          evaPlan.requiresShelterCycle
                            ? 'bg-rose-500'
                            : evaPlan.exposureGaugePct >= 50
                            ? 'bg-amber-400'
                            : 'bg-cyan-400'
                        }`}
                        style={{ width: `${evaPlan.exposureGaugePct}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-300 mt-2 leading-snug">
                      {evaPlan.statusSummary}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                    <strong className="text-cyan-300">Scientific Constraint:</strong>{' '}
                    {SHIELDING_MATERIALS[selectedMaterialId].scientificNote}
                  </div>
                </div>

                {/* Resource Delta Preview & Apply Action */}
                <div className="space-y-2.5 pt-2 border-t border-slate-800">
                  <div className="grid grid-cols-4 gap-2 text-center font-mono-tabular text-xs">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">POWER</div>
                      <div className="font-bold text-amber-300">
                        {fmtSigned(evaPlan.powerDelta)}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">O2 &amp; FOOD</div>
                      <div className="font-bold text-rose-300">
                        {fmtSigned(evaPlan.lifeSupportDelta)}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">SHIELDING</div>
                      <div
                        className={`font-bold ${
                          evaPlan.shieldingDelta >= 0 ? 'text-purple-300' : 'text-rose-400'
                        }`}
                      >
                        {fmtSigned(evaPlan.shieldingDelta)}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">SCIENCE</div>
                      <div className="font-bold text-sky-300">
                        {fmtSigned(evaPlan.scienceDelta, ' PTS')}
                      </div>
                    </div>
                  </div>

                  {onApplyProtocol && (
                    <button
                      type="button"
                      data-testid="apply-radlab-plan-btn"
                      onClick={() =>
                        handleApplyToMission(
                          `RadLab EVA Plan (${SHIELDING_MATERIALS[selectedMaterialId].name}, ${evaHours}h)`,
                          evaPlan
                        )
                      }
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-cyan-400 hover:bg-cyan-300 text-slate-950 border border-cyan-200 cursor-pointer"
                    >
                      Apply EVA &amp; Shielding Plan to Outpost
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            PARAMETER 2: SOLAR FLARE & CME ALERTS (DONKI) — EMERGENCY ALERT SYSTEM
           =================================================================== */}
        {activeTab === 'donki_alert' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs font-mono-tabular text-amber-400">
                SOURCE DATASET: Space Weather Database of Notifications, Knowledge, Information (DONKI)
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">
                Space Weather Emergency Alert System (Solar Flares &amp; CMEs)
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Real-time or saved DONKI alerts trigger red-alert procedures. Junior astronauts must
                make rapid tactical decisions—such as{' '}
                <strong className="text-amber-300">
                  securing external antenna arrays to prevent communication dropouts
                </strong>{' '}
                or{' '}
                <strong className="text-emerald-300">
                  retreating to safe modules during peak proton flux
                </strong>
                .
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Authentic DONKI Event Timing, Notification Status, and Severity */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="text-xs font-mono-tabular text-amber-300 font-bold">
                  ACTIVE DONKI TELEMETRY FEED ({liveWeather?.status || 'fallback'})
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Latest Solar Flare (FLR):</span>
                    <span className="font-mono-tabular font-bold text-amber-300">
                      {latestFlareClass} Class
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Peak Flux Timing:</span>
                    <span className="font-mono-tabular text-slate-200">
                      {liveWeather?.flares?.[0]?.peakTime || '2026-11-11T21:21Z'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Coronal Mass Ejection (CME):</span>
                    <span className="font-mono-tabular font-bold text-rose-300">
                      {latestCmeSpeed} km/s
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Geomagnetic Storm Kp Index:</span>
                    <span className="font-mono-tabular font-bold text-purple-300">
                      Kp {liveWeather?.storms?.[0]?.maxKp ?? 6}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-200">
                    Select Red-Alert Tactical Procedure:
                  </div>

                  {(
                    [
                      {
                        id: 'secure_antenna_arrays',
                        label: 'Secure External Antenna Arrays & Feather Solar Wings',
                        desc: 'Prevents Ka-band communication dropouts and protects array electronics during CME shock arrival.',
                      },
                      {
                        id: 'retreat_safe_module',
                        label: 'Retreat Crew to Reinforced Water-Wall Safe Module',
                        desc: 'Maximizes crew biological shielding during peak solar proton flux window.',
                      },
                      {
                        id: 'ride_out_flux',
                        label: 'Keep External Dish Active During Peak Flux (High Risk)',
                        desc: 'Saves battery power briefly, but risks severe communication dropout and hull shielding degradation.',
                      },
                    ] as const
                  ).map((opt) => {
                    const isSel = selectedDonkiAction === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedDonkiAction(opt.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                          isSel
                            ? 'bg-slate-800 border-amber-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="text-xs font-bold text-amber-300">{opt.label}</div>
                        <div className="text-[11px] text-slate-300 mt-0.5">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: Tactical Outcome & Live Mini-Game Trigger */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="text-xs font-mono-tabular text-slate-400">
                    RED-ALERT TACTICAL EVALUATION
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 font-mono-tabular text-xs">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">COMM ARRAY STATUS</div>
                      <div
                        data-testid="donki-comm-status"
                        className={`text-sm font-bold mt-1 ${
                          donkiOutcome.commDropoutPrevented ? 'text-emerald-300' : 'text-rose-400'
                        }`}
                      >
                        {donkiOutcome.commDropoutPrevented
                          ? '● PROTECTED (No Dropout)'
                          : '✖ DROPOUT RISK'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">PEAK FLUX SHELTER</div>
                      <div
                        data-testid="donki-flux-status"
                        className={`text-sm font-bold mt-1 ${
                          donkiOutcome.crewFluxProtected ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {donkiOutcome.crewFluxProtected
                          ? '● INNER SAFE BUNK'
                          : '▲ STANDARD HULL'}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed">
                    {donkiOutcome.summaryText}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                    <strong className="text-amber-300">Scientific Constraint:</strong> Space weather
                    events create immediate operational spikes in radiation risk and disrupt
                    spacecraft communications. Grounding risk mechanics in authentic DONKI records
                    ensures alert frequencies and danger windows align with actual solar activity.
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-800">
                  <div className="grid grid-cols-4 gap-2 text-center font-mono-tabular text-xs">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">POWER</div>
                      <div className="font-bold text-amber-300">
                        {fmtSigned(donkiOutcome.powerDelta)}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">O2 &amp; FOOD</div>
                      <div className="font-bold text-emerald-300">
                        {fmtSigned(donkiOutcome.lifeSupportDelta)}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">SHIELDING</div>
                      <div
                        className={`font-bold ${
                          donkiOutcome.shieldingDelta >= 0 ? 'text-purple-300' : 'text-rose-400'
                        }`}
                      >
                        {fmtSigned(donkiOutcome.shieldingDelta)}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">SCIENCE</div>
                      <div className="font-bold text-sky-300">
                        {fmtSigned(donkiOutcome.scienceDelta, ' PTS')}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {onApplyProtocol && (
                      <button
                        type="button"
                        data-testid="apply-donki-procedure-btn"
                        onClick={() =>
                          handleApplyToMission(
                            `DONKI Red-Alert (${donkiOutcome.actionTitle})`,
                            donkiOutcome
                          )
                        }
                        className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-200 cursor-pointer"
                      >
                        Execute Red-Alert Procedure
                      </button>
                    )}
                    {onTriggerScenarioByCode && (
                      <button
                        type="button"
                        onClick={() => onTriggerScenarioByCode('DONKI-FLR-2026-X2.4')}
                        className="py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/60 cursor-pointer"
                      >
                        Launch Interactive Flare Drill
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            PARAMETER 3: BONE DENSITY & MUSCLE MASS LOSS RATES (OSDR)
           =================================================================== */}
        {activeTab === 'osdr_conditioning' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs font-mono-tabular text-emerald-400">
                SOURCE DATASET: NASA Open Science Data Repository (OSDR) · Spaceflight Biology Studies
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">
                Crew Conditioning &amp; Countermeasure Scheduler (Bone &amp; Muscle Loss Rates)
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Trainees manage daily routine dials—balancing{' '}
                <strong className="text-emerald-300">resistive exercise</strong>,{' '}
                <strong className="text-sky-300">sleep schedules</strong>, and{' '}
                <strong className="text-amber-300">
                  nutritional intake (bio-regenerative food data)
                </strong>{' '}
                to counter biological atrophy. If daily exercise is neglected, crew stamina and
                mission performance stats degrade.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Daily Routine Dials */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label htmlFor="exercise-dial" className="font-bold text-slate-200">
                      1. ARED Resistive Exercise Dial:
                    </label>
                    <span
                      data-testid="osdr-exercise-val"
                      className="font-mono-tabular font-bold text-emerald-300"
                    >
                      {resistiveExerciseMin} min / day
                    </span>
                  </div>
                  <input
                    id="exercise-dial"
                    type="range"
                    min={0}
                    max={120}
                    step={15}
                    value={resistiveExerciseMin}
                    onChange={(e) => setResistiveExerciseMin(parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono-tabular text-slate-400 mt-0.5">
                    <span>0m (Neglected)</span>
                    <span>60m (Moderate)</span>
                    <span>90m+ (NASA Target)</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label htmlFor="sleep-dial" className="font-bold text-slate-200">
                      2. Circadian Sleep Schedule Dial:
                    </label>
                    <span
                      data-testid="osdr-sleep-val"
                      className="font-mono-tabular font-bold text-sky-300"
                    >
                      {sleepHours.toFixed(1)} hrs / night
                    </span>
                  </div>
                  <input
                    id="sleep-dial"
                    type="range"
                    min={4.0}
                    max={10.0}
                    step={0.5}
                    value={sleepHours}
                    onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono-tabular text-slate-400 mt-0.5">
                    <span>4.0h (Sleep Deprived)</span>
                    <span>8.0h (Optimal Rest)</span>
                    <span>10.0h (Extended)</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label htmlFor="nutrition-dial" className="font-bold text-slate-200">
                      3. Bio-Regenerative Nutritional Intake (Veggie &amp; Ca/Vit-D):
                    </label>
                    <span
                      data-testid="osdr-nutrition-val"
                      className="font-mono-tabular font-bold text-amber-300"
                    >
                      {bioRegenNutritionPct}% Ration
                    </span>
                  </div>
                  <input
                    id="nutrition-dial"
                    type="range"
                    min={25}
                    max={100}
                    step={5}
                    value={bioRegenNutritionPct}
                    onChange={(e) => setBioRegenNutritionPct(parseInt(e.target.value, 10))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono-tabular text-slate-400 mt-0.5">
                    <span>25% (Deficit)</span>
                    <span>75% (Standard)</span>
                    <span>100% (Full Fresh Crop)</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-300">
                    Reference OSDR Spaceflight Datasets:
                  </div>
                  {OSDR_MUSCULOSKELETAL_STUDIES.map((st) => (
                    <div
                      key={st.studyId}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px]"
                    >
                      <span className="font-mono-tabular font-bold text-emerald-300">
                        {st.studyId}:
                      </span>{' '}
                      <span className="text-slate-300">{st.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Quantitative Bone/Muscle Loss & Stamina Output */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="text-xs font-mono-tabular text-slate-400">
                    QUANTITATIVE MUSCULOSKELETAL TELEMETRY ({site.gravityG}g SURFACE GRAVITY)
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 font-mono-tabular">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">BONE MINERAL DENSITY</div>
                      <div
                        data-testid="osdr-bone-rate"
                        className={`text-xl font-bold mt-0.5 ${
                          conditioningResult.boneDensityChangePctPerMonth > -0.35
                            ? 'text-emerald-300'
                            : 'text-rose-400'
                        }`}
                      >
                        {conditioningResult.boneDensityChangePctPerMonth.toFixed(2)}%
                        <span className="text-xs text-slate-400 ml-1">/ mo</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">MUSCLE MASS CHANGE</div>
                      <div
                        data-testid="osdr-muscle-rate"
                        className={`text-xl font-bold mt-0.5 ${
                          conditioningResult.muscleMassChangePctPerMonth > -0.65
                            ? 'text-emerald-300'
                            : 'text-rose-400'
                        }`}
                      >
                        {conditioningResult.muscleMassChangePctPerMonth.toFixed(2)}%
                        <span className="text-xs text-slate-400 ml-1">/ mo</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-200">
                        Crew Stamina &amp; Mission Performance
                      </span>
                      <span
                        data-testid="osdr-stamina-score"
                        className="font-mono-tabular font-bold text-emerald-300"
                      >
                        {conditioningResult.crewStaminaScore}% Stamina ·{' '}
                        {conditioningResult.missionPerformanceMultiplier}x Output
                      </span>
                    </div>
                    <div className="w-full h-3.5 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${
                          conditioningResult.atrophyRiskLevel === 'OPTIMAL'
                            ? 'bg-emerald-400'
                            : conditioningResult.atrophyRiskLevel === 'MODERATE_ATROPHY'
                            ? 'bg-amber-400'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${conditioningResult.crewStaminaScore}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-300 mt-2 leading-snug">
                      {conditioningResult.scientificSummary}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-800">
                  <div className="grid grid-cols-4 gap-2 text-center font-mono-tabular text-xs">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">POWER</div>
                      <div className="font-bold text-amber-300">
                        {fmtSigned(conditioningResult.powerDelta)}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">O2 &amp; FOOD</div>
                      <div
                        className={`font-bold ${
                          conditioningResult.lifeSupportDelta >= 0
                            ? 'text-emerald-300'
                            : 'text-rose-400'
                        }`}
                      >
                        {fmtSigned(conditioningResult.lifeSupportDelta)}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">SHIELDING</div>
                      <div className="font-bold text-purple-300">
                        {fmtSigned(conditioningResult.shieldingDelta)}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">SCIENCE</div>
                      <div
                        className={`font-bold ${
                          conditioningResult.scienceDelta >= 0 ? 'text-sky-300' : 'text-rose-400'
                        }`}
                      >
                        {fmtSigned(conditioningResult.scienceDelta, ' PTS')}
                      </div>
                    </div>
                  </div>

                  {onApplyProtocol && (
                    <button
                      type="button"
                      data-testid="apply-osdr-schedule-btn"
                      onClick={() =>
                        handleApplyToMission(
                          `OSDR Crew Conditioning (${resistiveExerciseMin}m Exercise, ${sleepHours}h Sleep)`,
                          conditioningResult
                        )
                      }
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 border border-emerald-200 cursor-pointer"
                    >
                      Commit Daily Conditioning Schedule to Outpost
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 4: COMBINED JSON PAYLOAD STRUCTURE (DONKI + RADLAB + OSDR)
           =================================================================== */}
        {activeTab === 'json_feed' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-mono-tabular text-purple-300 font-bold">
                  ENDPOINT: GET /api/trainee-telemetry
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Live unified JSON payload combining NASA DONKI solar flare/CME alerts, RadLab ISS
                  dosimetry rates, and OSDR musculoskeletal atrophy parameters.
                </p>
              </div>
            </div>

            <pre
              data-testid="combined-json-payload"
              className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono-tabular text-cyan-200 overflow-x-auto max-h-[52vh] leading-relaxed"
            >
              {JSON.stringify(combinedPayload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
