import React from 'react';
import { GpxPoint } from '../types';
import { Mountain } from 'lucide-react';

interface ElevationProfileProps {
  points: GpxPoint[];
  totalDistanceKm: number;
  elevationGainM: number;
  maxElevationM: number;
  minElevationM: number;
}

export const ElevationProfile: React.FC<ElevationProfileProps> = ({
  points,
  totalDistanceKm,
  elevationGainM,
  maxElevationM,
  minElevationM,
}) => {
  const pointsWithEle = points.filter(p => p.ele !== undefined);
  if (pointsWithEle.length < 2) return null;

  const width = 600;
  const height = 120;
  const padLeft = 45;
  const padRight = 15;
  const padTop = 15;
  const padBottom = 25;

  const eleRange = (maxElevationM - minElevationM) || 100;

  // Build SVG path
  const pathD = pointsWithEle.map((p, i) => {
    const x = padLeft + (i / (pointsWithEle.length - 1)) * (width - padLeft - padRight);
    const y = height - padBottom - (((p.ele ?? minElevationM) - minElevationM) / eleRange) * (height - padTop - padBottom);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  const areaD = `${pathD} L ${width - padRight} ${height - padBottom} L ${padLeft} ${height - padBottom} Z`;

  return (
    <div className="w-full bg-slate-900 text-slate-100 rounded-lg p-3 shadow">
      <div className="flex items-center justify-between text-xs mb-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-200">
          <Mountain className="w-4 h-4 text-emerald-400" />
          <span>標高プロファイル</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-300 font-mono">
          <span>最低: <strong>{minElevationM}m</strong></span>
          <span>最高: <strong className="text-amber-400">{maxElevationM}m</strong></span>
          <span>獲得標高: <strong className="text-emerald-400">{elevationGainM}m</strong></span>
          <span>距離: <strong>{totalDistanceKm}km</strong></span>
        </div>
      </div>

      <div className="w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24">
          <defs>
            <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padLeft} y1={padTop} x2={width - padRight} y2={padTop} stroke="#334155" strokeDasharray="3,3" />
          <line x1={padLeft} y1={height - padBottom} x2={width - padRight} y2={height - padBottom} stroke="#475569" />

          {/* Elevation Labels */}
          <text x={padLeft - 6} y={padTop + 4} fill="#94a3b8" fontSize="9" textAnchor="end">{maxElevationM}m</text>
          <text x={padLeft - 6} y={height - padBottom} fill="#94a3b8" fontSize="9" textAnchor="end">{minElevationM}m</text>

          {/* Distance Labels */}
          <text x={padLeft} y={height - 8} fill="#94a3b8" fontSize="9">0km</text>
          <text x={width - padRight} y={height - 8} fill="#94a3b8" fontSize="9" textAnchor="end">{totalDistanceKm}km</text>

          {/* Fill and Stroke */}
          <path d={areaD} fill="url(#eleGrad)" />
          <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
};
