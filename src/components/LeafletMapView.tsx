import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GpxTrack } from '../types';
import { Layers, Maximize2, MapPin } from 'lucide-react';

interface LeafletMapViewProps {
  track: GpxTrack | null;
  activityTitle?: string;
  height?: string;
}

// 完全に無料で利用可能な地図タイル（APIキー不要）
// 1. 国土地理院 標準地図（日本の登山・サイクリングに最適）
// 2. 国土地理院 写真（航空写真）
// 3. OpenStreetMap
// 4. 地形図 (OpenTopoMap)
const TILE_LAYERS = {
  gsiStandard: {
    name: '地理院地図 (標準)',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>',
    maxZoom: 18,
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    maxZoom: 19,
  },
  gsiPhoto: {
    name: '地理院 航空写真',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
    attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>',
    maxZoom: 18,
  },
  openTopo: {
    name: 'OpenTopoMap (地形図)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a>',
    maxZoom: 17,
  },
};

type LayerKey = keyof typeof TILE_LAYERS;

export const LeafletMapView: React.FC<LeafletMapViewProps> = ({
  track,
  activityTitle,
  height = '100%',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const trackLayersRef = useRef<L.LayerGroup | null>(null);

  const [activeLayer, setActiveLayer] = useState<LayerKey>('gsiStandard');
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [35.681236, 139.767125],
      zoom: 11,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);

    const layerConfig = TILE_LAYERS[activeLayer];
    const tileLayer = L.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
      maxZoom: layerConfig.maxZoom,
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    const layerGroup = L.layerGroup().addTo(map);
    trackLayersRef.current = layerGroup;

    mapInstanceRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Layer when switched
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const config = TILE_LAYERS[activeLayer];
    tileLayerRef.current.setUrl(config.url);
    tileLayerRef.current.options.attribution = config.attribution;
    tileLayerRef.current.options.maxZoom = config.maxZoom;
  }, [activeLayer]);

  // Render GPX Track
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = trackLayersRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    if (!track || !track.points || track.points.length === 0) return;

    const latlngs: L.LatLngTuple[] = track.points.map((p) => [p.lat, p.lng]);

    // Track casing
    const casing = L.polyline(latlngs, {
      color: '#ffffff',
      weight: 6,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    });
    layerGroup.addLayer(casing);

    // Track polyline
    const line = L.polyline(latlngs, {
      color: '#2563eb',
      weight: 4,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    });
    layerGroup.addLayer(line);

    // Start marker
    const startPoint = track.points[0];
    const startIcon = L.divIcon({
      className: 'start-marker',
      html: `
        <div style="
          width: 26px; height: 26px; border-radius: 50%;
          background: #10b981; color: white; border: 2px solid white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.35); display: flex;
          align-items: center; justify-content: center; font-weight: bold;
          font-size: 11px; font-family: sans-serif;
        ">S</div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    const startMarker = L.marker([startPoint.lat, startPoint.lng], {
      icon: startIcon,
      title: 'スタート地点',
    }).bindPopup(`
      <div style="font-size: 12px; font-family: sans-serif;">
        <strong style="color: #059669;">🚩 スタート地点</strong><br/>
        標高: ${startPoint.ele !== undefined ? `${startPoint.ele.toFixed(0)}m` : '不明'}
      </div>
    `);
    layerGroup.addLayer(startMarker);

    // Goal marker
    const endPoint = track.points[track.points.length - 1];
    const endIcon = L.divIcon({
      className: 'end-marker',
      html: `
        <div style="
          width: 26px; height: 26px; border-radius: 50%;
          background: #ef4444; color: white; border: 2px solid white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.35); display: flex;
          align-items: center; justify-content: center; font-weight: bold;
          font-size: 11px; font-family: sans-serif;
        ">G</div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    const endMarker = L.marker([endPoint.lat, endPoint.lng], {
      icon: endIcon,
      title: 'ゴール地点',
    }).bindPopup(`
      <div style="font-size: 12px; font-family: sans-serif;">
        <strong style="color: #dc2626;">🏁 ゴール地点</strong><br/>
        標高: ${endPoint.ele !== undefined ? `${endPoint.ele.toFixed(0)}m` : '不明'}
      </div>
    `);
    layerGroup.addLayer(endMarker);

    // Highest elevation peak marker
    let maxPoint = track.points[0];
    for (const p of track.points) {
      if (p.ele !== undefined && (maxPoint.ele === undefined || p.ele > maxPoint.ele)) {
        maxPoint = p;
      }
    }

    if (maxPoint && maxPoint.ele !== undefined && maxPoint.ele > 0) {
      const peakIcon = L.divIcon({
        className: 'peak-marker',
        html: `
          <div style="
            width: 24px; height: 24px; border-radius: 50%;
            background: #d97706; color: white; border: 2px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3); display: flex;
            align-items: center; justify-content: center; font-weight: bold;
            font-size: 11px; font-family: sans-serif;
          ">▲</div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const peakMarker = L.marker([maxPoint.lat, maxPoint.lng], {
        icon: peakIcon,
        title: `最高地点: ${maxPoint.ele.toFixed(0)}m`,
      }).bindPopup(`
        <div style="font-size: 12px; font-family: sans-serif;">
          <strong style="color: #b45309;">▲ 最高地点</strong><br/>
          標高: <strong>${maxPoint.ele.toFixed(0)}m</strong>
        </div>
      `);
      layerGroup.addLayer(peakMarker);
    }

    // Auto zoom to track reliably
    const bounds = L.latLngBounds(latlngs);
    if (bounds.isValid()) {
      const fitTrack = () => {
        if (!mapInstanceRef.current) return;
        mapInstanceRef.current.invalidateSize();
        mapInstanceRef.current.fitBounds(bounds, {
          padding: [40, 40],
          maxZoom: 15,
          animate: false,
        });
      };

      fitTrack();
      const t1 = setTimeout(fitTrack, 60);
      const t2 = setTimeout(fitTrack, 250);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [track]);

  const handleFit = () => {
    if (!mapInstanceRef.current || !track || !track.points.length) return;
    mapInstanceRef.current.invalidateSize();
    const latlngs: L.LatLngTuple[] = track.points.map((p) => [p.lat, p.lng]);
    const bounds = L.latLngBounds(latlngs);
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 15,
        animate: true,
      });
    }
  };

  return (
    <div className="w-full h-full relative overflow-hidden select-none" style={{ height }}>
      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Controls Top Right */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
        {/* Layer Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            title="地図レイヤー切替（完全無料・APIキー不要）"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 hover:bg-white text-slate-700 text-xs font-semibold rounded-xl shadow-md border border-slate-200 backdrop-blur-xs transition cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>{TILE_LAYERS[activeLayer].name}</span>
          </button>

          {showLayerMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 flex flex-col gap-1 z-20">
              <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 tracking-wider">
                無料地図レイヤー
              </div>
              {(Object.keys(TILE_LAYERS) as LayerKey[]).map((key) => {
                const layer = TILE_LAYERS[key];
                const isSelected = activeLayer === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setActiveLayer(key);
                      setShowLayerMenu(false);
                    }}
                    className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{layer.name}</span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Fit Bounds Button */}
        {track && track.points.length > 0 && (
          <button
            type="button"
            onClick={handleFit}
            title="トラック全体を表示"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 hover:bg-white text-slate-700 text-xs font-semibold rounded-xl shadow-md border border-slate-200 backdrop-blur-xs transition cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-600" />
            <span>全体表示</span>
          </button>
        )}
      </div>

      {/* Free Map Badge */}
      <div className="absolute top-3 left-14 z-10 pointer-events-none hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white/90 backdrop-blur-xs rounded-lg text-[11px] font-medium text-slate-600 border border-slate-200 shadow-2xs">
        <MapPin className="w-3 h-3 text-emerald-600" />
        <span>無料オープン地図（国土地理院・OSM）</span>
      </div>

      {/* Empty State */}
      {(!track || !track.points || track.points.length === 0) && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-100/80 backdrop-blur-xs p-4 text-center">
          <MapPin className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-xs font-semibold text-slate-700 mb-1">
            GPXログトラックがまだ読み込まれていません
          </p>
          <p className="text-[11px] text-slate-500 max-w-xs">
            右下の「.gpxファイルを読込」からファイルを読み込むことができます。
          </p>
        </div>
      )}
    </div>
  );
};
