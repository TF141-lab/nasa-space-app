import React from 'react';
import { DATA_SOURCES } from '../data/sources';
import type { SpaceWeatherSummary } from '../types/spaceWeather';

interface CreditsModalProps {
  liveWeather: SpaceWeatherSummary | null;
  onClose: () => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({ liveWeather, onClose }) => {
  const fetchedAtText = liveWeather?.fetchedAt
    ? new Date(liveWeather.fetchedAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }) + ' UTC'
    : 'Saved reference copy';

  const statusText =
    liveWeather?.status === 'live'
      ? 'live'
      : liveWeather?.status === 'stale'
      ? 'saved copy (stale cache)'
      : 'saved copy';

  return (
    <div
      role="dialog"
      aria-label="Data & Credits"
      data-testid="credits-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1226] pointer-events-auto"
    >
      <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl bg-slate-900 border-2 border-sky-400 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <p className="text-xs font-mono-tabular text-sky-400">
              ATTRIBUTION · DISCLAIMERS · SOURCE REGISTRY
            </p>
            <h2 className="text-xl font-bold text-white mt-0.5">
              Data &amp; Credits
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="space-y-3 text-xs leading-relaxed text-slate-200 mb-5">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-400/50">
            <p className="font-semibold text-amber-200">
              Starbound Outpost is an independent educational game. It is not affiliated with,
              endorsed or sponsored by NASA or any other government agency.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <p>
              Space-weather data: NASA DONKI (Space Weather Database Of Notifications, Knowledge,
              Information), operated by NASA&apos;s Community Coordinated Modeling Center (CCMC),
              retrieved through NASA&apos;s Open APIs (api.nasa.gov). We acknowledge the Community
              Coordinated Modeling Center (CCMC) at Goddard Space Flight Center for the use of
              DONKI. The Moon to Mars Space Weather Analysis Office and other entities provide data
              to DONKI as a courtesy to the community.
            </p>
            <p className="text-slate-300">
              DONKI data is preliminary, experimental research information provided &apos;as is&apos;.
              For official space-weather forecasts, see{' '}
              <a
                href="https://www.spaceweather.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-300 underline hover:text-sky-200"
              >
                NOAA&apos;s Space Weather Prediction Center
              </a>
              .
            </p>
            <p className="font-mono-tabular text-emerald-300">
              Data last updated: {fetchedAtText} ({statusText}).
            </p>
            <p className="text-amber-300 font-semibold">
              Links open in a new tab (rel=noopener noreferrer). Ask a grown-up before visiting
              other websites.
            </p>
          </div>
        </div>

        <h3 className="text-xs font-bold tracking-wider uppercase text-slate-400 mb-2.5">
          Verified Data Sources &amp; Guidelines ({DATA_SOURCES.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {DATA_SOURCES.map((src) => (
            <div
              key={src.id}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2 text-xs"
            >
              <div>
                <div className="font-bold text-white">{src.name}</div>
                <div className="text-[11px] text-amber-300 mt-0.5">{src.publisher}</div>
                <p className="text-[11px] text-slate-300 mt-1.5 leading-snug">{src.usedFor}</p>
                <p className="text-[11px] text-slate-400 mt-1 italic">{src.creditLine}</p>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80">
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-sky-300 underline hover:text-sky-200 truncate"
                >
                  {src.url}
                </a>
                <span className="text-[10px] font-mono-tabular text-slate-500 shrink-0">
                  {src.retrievedOn}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
