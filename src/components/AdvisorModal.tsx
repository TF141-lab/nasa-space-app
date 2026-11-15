import React, { useState } from 'react';
import {
  computeDeterministicMissionAdvice,
  getTimeUnit,
  MISSION_SITES,
  OutpostGameState,
} from '../game/rules.ts';

interface AdvisorModalProps {
  gameState: OutpostGameState;
  onClose: () => void;
}

export const AdvisorModal: React.FC<AdvisorModalProps> = ({ gameState, onClose }) => {
  const [question, setQuestion] = useState(
    'Which station should I prioritize right now to survive the upcoming solar cycle?'
  );
  const [loading, setLoading] = useState(false);
  const [advisorResponse, setAdvisorResponse] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const site = MISSION_SITES[gameState.siteId];
  const deterministicAdvice = computeDeterministicMissionAdvice(gameState);

  const handleConsultCapcom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setStatusNotice(null);

    try {
      const resp = await fetch('/api/mission-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: question,
          siteId: gameState.siteId,
          siteName: site.name,
          timeUnit: getTimeUnit(gameState.siteId),
          sol: gameState.sol,
          power: gameState.power,
          lifeSupport: gameState.lifeSupport,
          shielding: gameState.shielding,
          activeEventTitle: gameState.activeEvent?.title || 'Nominal Quiet Sun',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setStatusNotice(
          data.message ||
            'Capcom AI uplink requires a configured GEMINI_API_KEY in .env. Displaying on-board Outpost Engineering Computer analysis below.'
        );
      } else {
        setAdvisorResponse(data.advice);
      }
    } catch {
      setStatusNotice(
        'Telemetry uplink unavailable. Showing on-board Outpost Engineering Computer analysis below.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Mission Capcom Tactical Advisory"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1226]/85 backdrop-blur-md pointer-events-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border-2 border-amber-400/80 p-6 text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <p className="text-xs font-mono text-amber-400 uppercase tracking-wider">
              MISSION ADVISORY · CAPCOM TACTICAL UPLINK
            </p>
            <h2 className="text-xl font-bold text-white">
              Consult Capcom on Outpost Trade-Offs &amp; Planetary Survival
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleConsultCapcom} className="mb-4">
          <label
            htmlFor="advisor-query-input"
            className="block text-xs font-semibold text-slate-300 mb-1.5"
          >
            Your Tactical Question for Capcom:
          </label>
          <div className="flex gap-2">
            <input
              id="advisor-query-input"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              placeholder="Ask about Power vs. O2 vs. Shielding trade-offs..."
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              {loading ? 'Consulting Capcom...' : 'Ask Capcom'}
            </button>
          </div>
        </form>

        {statusNotice && (
          <div className="p-3 mb-3 rounded-xl bg-slate-950/80 border border-amber-500/40 text-xs text-amber-300">
            {statusNotice}
          </div>
        )}

        {advisorResponse && (
          <div className="p-4 mb-4 rounded-xl bg-slate-950 border border-sky-500/60 shadow-lg">
            <div className="text-xs font-mono text-sky-400 font-semibold mb-1">
              CAPCOM FLIGHT DIRECTOR RECOMMENDATION:
            </div>
            <div className="text-xs text-slate-200 whitespace-pre-line leading-relaxed">
              {advisorResponse}
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400">
              Flight Director simulation · Grounded in authentic NASA mission science.
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 shadow-md">
          <div className="text-xs font-mono text-emerald-400 font-semibold mb-1">
            ON-BOARD OUTPOST COMPUTER (INSTANT ENGINEERING ANALYSIS):
          </div>
          <div className="text-xs text-slate-200 whitespace-pre-line leading-relaxed">
            {deterministicAdvice}
          </div>
        </div>
      </div>
    </div>
  );
};
