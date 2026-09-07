import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { GpxPoint } from '../types';
import { Mountain, MoveHorizontal } from 'lucide-react';
import { haversineDistance } from '../utils/gpxParser';

interface ElevationProfileProps {
  points: GpxPoint[];
  totalDistanceKm: number;
  elevationGainM: number;
  maxElevationM: number;
  minElevationM: number;
  selectedPoint?: GpxPoint | null;
  onPointSelect?: (point: GpxPoint | null) => void;
}

interface PointWithDist extends GpxPoint {
  distKm: number;
  x: number;
  y: number;
}

export const ElevationProfile: React.FC<ElevationProfileProps> = ({
  points,
  totalDistanceKm,
  elevationGainM,
  maxElevationM,
  minElevationM,
  selectedPoint,
  onPointSelect,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastClientXRef = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [internalPoint, setInternalPoint] = useState<GpxPoint | null>(null);

  const width = 640;
  const height = 130;
  const padLeft = 45;
  const padRight = 16;
  const padTop = 22;
  const padBottom = 26;

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const eleRange = (maxElevationM - minElevationM) || 100;

  // Filter and pre-compute distance and (x, y) coordinates for all points with elevation
  const processedData = useMemo(() => {
    const validPoints = points.filter((p) => p.ele !== undefined);
    if (validPoints.length < 2) return { pointsWithCoords: [], maxDist: 0, pathD: '', areaD: '' };

    let accumDist = 0;
    const pointsWithDist: { pt: GpxPoint; dist: number }[] = [];

    for (let i = 0; i < validPoints.length; i++) {
      const p = validPoints[i];
      if (p.distKm !== undefined && p.distKm >= 0) {
        accumDist = p.distKm;
      } else if (i > 0) {
        accumDist += haversineDistance(validPoints[i - 1].lat, validPoints[i - 1].lng, p.lat, p.lng);
      }
      pointsWithDist.push({ pt: p, dist: accumDist });
    }

    const calculatedMaxDist = pointsWithDist[pointsWithDist.length - 1].dist;
    const maxDist = totalDistanceKm > 0 ? totalDistanceKm : (calculatedMaxDist > 0 ? calculatedMaxDist : 1);

    const pointsWithCoords: PointWithDist[] = pointsWithDist.map(({ pt, dist }) => {
      const clampedDist = Math.max(0, Math.min(dist, maxDist));
      const x = padLeft + (clampedDist / maxDist) * plotWidth;
      const y = height - padBottom - (((pt.ele ?? minElevationM) - minElevationM) / eleRange) * plotHeight;
      return {
        ...pt,
        distKm: Math.round(clampedDist * 100) / 100,
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
      };
    });

    // Build SVG path (if more than 800 points, downsample path for buttery-smooth tablet rendering while keeping peaks)
    let pathPoints = pointsWithCoords;
    if (pointsWithCoords.length > 800) {
      const step = Math.ceil(pointsWithCoords.length / 600);
      pathPoints = pointsWithCoords.filter((_, idx) => idx === 0 || idx === pointsWithCoords.length - 1 || idx % step === 0);
    }

    const pathD = pathPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');

    const areaD = `${pathD} L ${width - padRight} ${height - padBottom} L ${padLeft} ${height - padBottom} Z`;

    return { pointsWithCoords, maxDist, pathD, areaD };
  }, [points, totalDistanceKm, maxElevationM, minElevationM, eleRange, plotWidth, plotHeight]);

  const { pointsWithCoords, maxDist, pathD, areaD } = processedData;

  // Sync initial selection when points load
  useEffect(() => {
    if (pointsWithCoords.length > 0 && !selectedPoint && !internalPoint) {
      const initial = pointsWithCoords[0];
      setInternalPoint(initial);
      onPointSelect?.(initial);
    }
  }, [pointsWithCoords, selectedPoint, internalPoint, onPointSelect]);

  // Current active point (either from external prop or internal state, falling back to first point)
  const activePoint: PointWithDist | null = useMemo(() => {
    if (pointsWithCoords.length === 0) return null;
    const target = selectedPoint || internalPoint;
    if (!target) return pointsWithCoords[0];

    // Find matching point by reference, or closest by distance/latlng
    if (target.distKm !== undefined) {
      let closest = pointsWithCoords[0];
      let minDiff = Math.abs(closest.distKm - target.distKm);
      for (let i = 1; i < pointsWithCoords.length; i++) {
        const diff = Math.abs(pointsWithCoords[i].distKm - target.distKm);
        if (diff < minDiff) {
          minDiff = diff;
          closest = pointsWithCoords[i];
        }
      }
      return closest;
    }

    return pointsWithCoords[0];
  }, [pointsWithCoords, selectedPoint, internalPoint]);

  // Find nearest point from client X coordinate
  const pickPointAtClientX = useCallback(
    (clientX: number) => {
      if (!svgRef.current || pointsWithCoords.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;

      const svgX = ((clientX - rect.left) / rect.width) * width;
      const clampedX = Math.max(padLeft, Math.min(width - padRight, svgX));
      const ratio = (clampedX - padLeft) / plotWidth;
      const targetDist = ratio * maxDist;

      // Binary/linear search for closest point by distKm
      let closest = pointsWithCoords[0];
      let minDiff = Math.abs(closest.distKm - targetDist);

      for (let i = 1; i < pointsWithCoords.length; i++) {
        const diff = Math.abs(pointsWithCoords[i].distKm - targetDist);
        if (diff < minDiff) {
          minDiff = diff;
          closest = pointsWithCoords[i];
        }
      }

      setInternalPoint(closest);
      onPointSelect?.(closest);
    },
    [pointsWithCoords, width, padLeft, padRight, plotWidth, maxDist, onPointSelect]
  );

  // Pointer interactions for drag & click
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Only primary left button or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    pickPointAtClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    lastClientXRef.current = e.clientX;
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        pickPointAtClientX(lastClientXRef.current);
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  if (pointsWithCoords.length < 2) return null;

  const activeX = activePoint?.x ?? padLeft;
  const activeY = activePoint?.y ?? (height - padBottom);

  // Determine tooltip label X position so it stays within chart borders
  const badgeWidth = 76;
  const badgeX = Math.max(padLeft + badgeWidth / 2, Math.min(width - padRight - badgeWidth / 2, activeX));

  return (
    <div className="w-full bg-slate-900 text-slate-100 rounded-xl p-3 shadow-md border border-slate-800/80 select-none">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between text-xs mb-2 border-b border-slate-800 pb-2 gap-2">
        <div className="flex items-center gap-2 font-bold text-slate-200">
          <Mountain className="w-4 h-4 text-emerald-400" />
          <span>標高プロファイル</span>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-600/30 text-sky-300 text-[10px] font-normal">
            <MoveHorizontal className="w-3 h-3 text-sky-400" />
            縦線を左ドラッグで地図と連動
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300 font-mono">
          {activePoint && (
            <div className="flex items-center gap-2 px-2 py-0.5 bg-blue-950/70 border border-blue-500/50 rounded-md text-blue-300 font-bold">
              <span>位置: <strong className="text-white">{activePoint.distKm.toFixed(1)}km</strong></span>
              <span>標高: <strong className="text-amber-300">{Math.round(activePoint.ele ?? 0)}m</strong></span>
            </div>
          )}
          <span className="hidden md:inline">最低: <strong>{minElevationM}m</strong></span>
          <span className="hidden md:inline">最高: <strong className="text-amber-400">{maxElevationM}m</strong></span>
          <span>獲得標高: <strong className="text-emerald-400">{elevationGainM}m</strong></span>
          <span>距離: <strong>{totalDistanceKm}km</strong></span>
        </div>
      </div>

      {/* SVG Elevation Chart Area */}
      <div className="w-full overflow-hidden relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className={`w-full h-28 touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-ew-resize'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <defs>
            <linearGradient id="eleGradInteractive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.03" />
            </linearGradient>

            {/* Subtle glow filter for the interactive scrubber line */}
            <filter id="scrubberGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line x1={padLeft} y1={padTop} x2={width - padRight} y2={padTop} stroke="#334155" strokeDasharray="3,3" />
          <line x1={padLeft} y1={height - padBottom} x2={width - padRight} y2={height - padBottom} stroke="#475569" />

          {/* Elevation Labels */}
          <text x={padLeft - 6} y={padTop + 4} fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">
            {maxElevationM}m
          </text>
          <text x={padLeft - 6} y={height - padBottom} fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">
            {minElevationM}m
          </text>

          {/* Distance Labels */}
          <text x={padLeft} y={height - 8} fill="#94a3b8" fontSize="9" fontFamily="monospace">
            0km
          </text>
          <text x={width - padRight} y={height - 8} fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">
            {totalDistanceKm}km
          </text>

          {/* Fill and Stroke */}
          <path d={areaD} fill="url(#eleGradInteractive)" />
          <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Interactive Vertical Scrubber Line & Plot Point */}
          {activePoint && (
            <g className="pointer-events-none">
              {/* Vertical guideline */}
              <line
                x1={activeX}
                y1={padTop - 4}
                x2={activeX}
                y2={height - padBottom}
                stroke="#38bdf8"
                strokeWidth={isDragging ? 2.5 : 2}
                strokeDasharray={isDragging ? undefined : '2,2'}
                filter="url(#scrubberGlow)"
              />

              {/* Top Handle / Badge */}
              <g transform={`translate(${badgeX}, ${padTop - 11})`}>
                <rect
                  x={-badgeWidth / 2}
                  y="-1"
                  width={badgeWidth}
                  height="14"
                  rx="7"
                  fill="#0369a1"
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                />
                <text
                  x="0"
                  y="9"
                  fill="#ffffff"
                  fontSize="8.5"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {activePoint.distKm.toFixed(1)}k | {Math.round(activePoint.ele ?? 0)}m
                </text>
              </g>

              {/* Intersection Node on Elevation Track */}
              <circle
                cx={activeX}
                cy={activeY}
                r="7"
                fill="#38bdf8"
                fillOpacity={isDragging ? 0.6 : 0.3}
              />
              <circle
                cx={activeX}
                cy={activeY}
                r="4"
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
