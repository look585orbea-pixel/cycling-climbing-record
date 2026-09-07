import React, { useState, useEffect, useRef } from 'react';
import { ActivityRecord, GpxTrack, GpxPoint } from '../types';
import { LeafletMapView } from './LeafletMapView';
import { ElevationProfile } from './ElevationProfile';
import { parseGpxXml, convertGoogleDriveUrl, getGoogleDriveDownloadUrl, getCandidateGpxUrls } from '../utils/gpxParser';
import { getGpxFromIndexedDb, saveGpxToIndexedDb } from '../utils/gpxStorage';
import { getFirstPrefectureName } from '../utils/prefectureBounds';
import { ServiceIcon } from './ServiceIcon';
import { renderColorizedEmoji } from '../utils/emojiRenderer';
import {
  X,
  ExternalLink,
  MapPin,
  Calendar,
  Clock,
  TrendingUp,
  Maximize2,
  Minimize2,
  Upload,
  FileText,
  Compass,
  Bike,
  Mountain,
  Share2,
  Sparkles,
  AlertCircle,
  Download,
  Check,
  HelpCircle
} from 'lucide-react';

interface ActivityDetailWindowProps {
  activity: ActivityRecord | null;
  onClose: () => void;
}

// Client-side cache for parsed GPX tracks: ensures we fetch strictly ONE file per activity and never re-fetch
const clientGpxCache = new Map<string, { track: GpxTrack; text: string }>();

export const ActivityDetailWindow: React.FC<ActivityDetailWindowProps> = ({ activity, onClose }) => {
  const [gpxTrack, setGpxTrack] = useState<GpxTrack | null>(null);
  const [rawGpxText, setRawGpxText] = useState<string | null>(null);
  const [highlightPoint, setHighlightPoint] = useState<GpxPoint | null>(null);
  const [isLoadingGpx, setIsLoadingGpx] = useState(false);
  const [downloadingGpx, setDownloadingGpx] = useState(false);
  const [gpxError, setGpxError] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'info'>('map');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showGpxHelp, setShowGpxHelp] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const firstPrefecture = activity ? getFirstPrefectureName(activity) : null;

  const handleDownloadGpx = async () => {
    if (!activity?.gpsLogUrl) return;
    setDownloadingGpx(true);
    const cleanDate = activity.dateStr ? activity.dateStr.replace(/[^0-9]/g, '') : '';
    const filename = cleanDate ? `${cleanDate}.gpx` : 'activity.gpx';

    const triggerBlob = (text: string) => {
      const blob = new Blob([text], { type: 'application/gpx+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        setDownloadingGpx(false);
      }, 300);
    };

    if (rawGpxText) {
      triggerBlob(rawGpxText);
      return;
    }

    // 1. Try candidate URLs (relative paths in repo: ./gpx/${filename}, ./${filename}, Google Drive direct)
    const candidateUrls = getCandidateGpxUrls(activity.gpsLogUrl, activity.dateStr);
    for (const url of candidateUrls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          if (text.includes('<gpx') || text.includes('<?xml')) {
            triggerBlob(text);
            return;
          }
        }
      } catch (e) {
        // Continue to next candidate
      }
    }

    // 2. Try proxy with relative base URL
    try {
      const baseUrl = import.meta.env.BASE_URL || './';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const proxyUrl = `${cleanBase}api/gpx-download?url=${encodeURIComponent(activity.gpsLogUrl)}&filename=${filename}`;
      const pRes = await fetch(proxyUrl);
      if (pRes.ok) {
        const text = await pRes.text();
        if (text.includes('<gpx') || text.includes('<?xml')) {
          triggerBlob(text);
          return;
        }
      }
    } catch (e) {
      console.warn('Proxy download note:', e);
    }

    const directUrl = getGoogleDriveDownloadUrl(activity.gpsLogUrl) || convertGoogleDriveUrl(activity.gpsLogUrl) || activity.gpsLogUrl;
    window.open(directUrl, '_blank');
    setDownloadingGpx(false);
  };

  const loadGpx = async () => {
    if (!activity) return;

    // Abort previous in-flight request if user rapidly changed activities
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (activity.gpsLogUrl) {
      // 1. Check local client cache first: instant load with 0 network calls
      const cacheKey = activity.gpsLogUrl.trim();
      const cleanDate = activity.dateStr ? activity.dateStr.replace(/[^0-9]/g, '') : '';
      const filename = cleanDate ? `${cleanDate}.gpx` : 'activity.gpx';

      if (clientGpxCache.has(cacheKey)) {
        const cached = clientGpxCache.get(cacheKey)!;
        setGpxTrack(cached.track);
        setRawGpxText(cached.text);
        setGpxError(null);
        setIsLoadingGpx(false);
        return;
      }

      setIsLoadingGpx(true);
      setGpxError(null);
      setGpxTrack(null);
      setRawGpxText(null);

      // Check IndexedDB persistence (allows GPX files to load instantly even offline or on GitHub Pages)
      try {
        const idbText = (await getGpxFromIndexedDb(cacheKey)) || (cleanDate ? await getGpxFromIndexedDb(cleanDate) : null);
        if (idbText && (idbText.includes('<gpx') || idbText.includes('<?xml'))) {
          const parsed = parseGpxXml(idbText);
          setGpxTrack(parsed);
          setRawGpxText(idbText);
          setGpxError(null);
          setIsLoadingGpx(false);
          clientGpxCache.set(cacheKey, { track: parsed, text: idbText });
          return;
        }
      } catch (idbErr) {
        console.warn('IndexedDB check note:', idbErr);
      }

      try {
        let text = '';
        const candidateUrls = getCandidateGpxUrls(activity.gpsLogUrl, activity.dateStr);

        // Step A: Fetch candidate URLs directly.
        // This handles:
        // 1) Relative static files in the GitHub Pages repo (e.g. ./gpx/20090221.gpx or ./20090221.gpx)
        // 2) Direct Google Drive download URLs with CORS enabled (drive.usercontent.google.com)
        // 3) Relative paths from CSV (e.g. gpx/foo.gpx normalized to ./gpx/foo.gpx)
        for (const url of candidateUrls) {
          if (controller.signal.aborted) return;
          try {
            const res = await fetch(url, { signal: controller.signal });
            if (res.ok) {
              const fetchedText = await res.text();
              if (fetchedText.includes('<gpx') || fetchedText.includes('<?xml')) {
                text = fetchedText;
                break;
              }
            }
          } catch (fetchErr: any) {
            if (fetchErr.name === 'AbortError') return;
          }
        }

        // Step B: Try backend proxy if available (using relative path compatible with GitHub Pages subpath)
        if (!text && !controller.signal.aborted) {
          try {
            const baseUrl = import.meta.env.BASE_URL || './';
            const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
            const proxyUrl = `${cleanBase}api/gpx-proxy?url=${encodeURIComponent(activity.gpsLogUrl)}`;
            const res = await fetch(proxyUrl, { signal: controller.signal });
            if (res.ok) {
              const proxyText = await res.text();
              if (proxyText.includes('<gpx') || proxyText.includes('<?xml')) {
                text = proxyText;
              }
            }
          } catch (proxyErr: any) {
            if (proxyErr.name === 'AbortError') return;
            console.warn('Backend GPX proxy note:', proxyErr);
          }
        }

        // Step C: Fallback to public CORS proxies if still no text (e.g. for Google Drive URLs on GitHub Pages)
        if (!text && !controller.signal.aborted) {
          const directDriveUrl = getGoogleDriveDownloadUrl(activity.gpsLogUrl) || convertGoogleDriveUrl(activity.gpsLogUrl);
          if (directDriveUrl) {
            const corsProxies = [
              `https://corsproxy.io/?url=${encodeURIComponent(directDriveUrl)}`,
              `https://api.allorigins.win/raw?url=${encodeURIComponent(directDriveUrl)}`,
            ];
            for (const cProxy of corsProxies) {
              if (controller.signal.aborted) return;
              try {
                const proxyController = new AbortController();
                const timeoutId = setTimeout(() => proxyController.abort(), 4000);
                const res = await fetch(cProxy, { signal: proxyController.signal });
                clearTimeout(timeoutId);
                if (res.ok) {
                  const proxyText = await res.text();
                  if (proxyText.includes('<gpx') || proxyText.includes('<?xml')) {
                    text = proxyText;
                    break;
                  }
                }
              } catch (cpErr: any) {
                if (cpErr.name === 'AbortError') return;
              }
            }
          }
        }

        if (controller.signal.aborted) return;

        if (text) {
          const parsed = parseGpxXml(text);
          setGpxTrack(parsed);
          setRawGpxText(text);
          setGpxError(null);
          // Save to client memory cache & IndexedDB persistent storage
          clientGpxCache.set(cacheKey, { track: parsed, text });
          saveGpxToIndexedDb(cacheKey, filename, text);
          if (cleanDate) saveGpxToIndexedDb(cleanDate, filename, text);
        } else {
          setGpxTrack(null);
          setGpxError('GPXデータの自動取得に失敗しました。');
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('GPX load note:', err.message);
        setGpxTrack(null);
        setGpxError('GPXデータの自動取得に失敗しました。');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingGpx(false);
        }
      }
    } else {
      // 記録リンク（GPSログURL）が無い場合：
      // 地図表示に対して線をプロットせず、その都道府県全体を表示する
      setGpxTrack(null);
      setRawGpxText(null);
      setGpxError(null);
      setIsLoadingGpx(false);
    }
  };

  useEffect(() => {
    loadGpx();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [activity?.id, activity?.gpsLogUrl]);

  if (!activity) return null;

  const applyGpxContent = (text: string) => {
    try {
      const parsed = parseGpxXml(text);
      setGpxTrack(parsed);
      setRawGpxText(text);
      setGpxError(null);
      const cacheKey = activity.gpsLogUrl ? activity.gpsLogUrl.trim() : (activity.dateStr || 'default');
      const cleanDate = activity.dateStr ? activity.dateStr.replace(/[^0-9]/g, '') : '';
      const filename = cleanDate ? `${cleanDate}.gpx` : 'activity.gpx';
      clientGpxCache.set(cacheKey, { track: parsed, text });
      saveGpxToIndexedDb(cacheKey, filename, text);
      if (cleanDate) saveGpxToIndexedDb(cleanDate, filename, text);
    } catch (err: any) {
      setGpxError('GPXファイルの解析に失敗しました: ' + err.message);
    }
  };

  // Handle local GPX file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) applyGpxContent(text);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) applyGpxContent(text);
      };
      reader.readAsText(file);
    }
  };

  // Open in real popup window if user clicks open in new window
  const openInNewWindow = () => {
    try {
      const popup = window.open(
        '',
        '_blank',
        'width=1000,height=800,menubar=no,toolbar=no,location=no,status=no'
      );
      if (popup) {
        popup.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${activity.title} - ${activity.dateStr}</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; line-height: 1.6; color: #1e293b; }
                h1 { font-size: 1.4rem; margin-bottom: 8px; }
                table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 0.9rem; }
                th { background-color: #f1f5f9; width: 160px; }
              </style>
            </head>
            <body>
              <h1>${activity.title}</h1>
              <p style="color: #64748b;">${activity.dateStr} | ${activity.cat} ${activity.act}</p>
              <table>
                <tr><th>日付</th><td>${activity.dateStr}</td></tr>
                <tr><th>活動区分</th><td>${activity.cat}</td></tr>
                <tr><th>ｱｸﾃｨﾋﾞﾃｨ</th><td>${activity.act}</td></tr>
                <tr><th>タイトル</th><td>${activity.title}</td></tr>
                <tr><th>記録リンク</th><td>${activity.link ? `<a href="${activity.link}" target="_blank">${activity.link}</a>` : 'なし'}</td></tr>
                <tr><th>GPSログ</th><td>${activity.gpsLogUrl ? `<a href="${activity.gpsLogUrl}" target="_blank">${activity.gpsLogUrl}</a>` : 'なし'}</td></tr>
                <tr><th>主な訪問地</th><td>${activity.spots || '－'}</td></tr>
                <tr><th>都道府県</th><td>${activity.prefStr || '－'}</td></tr>
                <tr><th>補足</th><td>${activity.note || '－'}</td></tr>
                <tr><th>距離[km]</th><td>${activity.distStr ? `${activity.distStr} km` : '－'}</td></tr>
                <tr><th>獲得標高[m]</th><td>${activity.elevStr ? `${activity.elevStr} m` : '－'}</td></tr>
                <tr><th>走行・歩行時間</th><td>${activity.time || '－'}</td></tr>
                <tr><th>車種/メーカー/モデル</th><td>${activity.gearStr || '－'}</td></tr>
              </table>
            </body>
          </html>
        `);
        popup.document.close();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isYamap = activity.link.includes('yamap');
  const isGarmin = activity.link.toLowerCase().includes('garmin');

  return (
    <div
      id="activity-detail-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="activity-detail-window"
        className={`bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 transition-all duration-300 ${
          isMaximized ? 'w-full h-full max-w-none rounded-none' : 'w-full max-w-5xl h-[92vh] max-h-[900px]'
        }`}
      >
        {/* Sleek Window Header: 左上のアイコンとｱｸﾃｨﾋﾞﾃｨを消し、タイトルを日付の右隣に配置 */}
        <div className="h-14 sm:h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between select-none shrink-0 shadow-2xs z-10">
          <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
            <span className="text-xs sm:text-sm font-mono font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 shrink-0">
              {activity.dateStr}
            </span>
            <h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 tracking-tight truncate flex-1 min-w-0" title={activity.title}>
              {activity.title}
            </h2>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-3">
            <button
              id="btn-open-popup-window"
              onClick={openInNewWindow}
              title="別ウィンドウで開く"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              id="btn-toggle-maximize"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? '縮小' : '最大化'}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition hidden sm:inline-flex"
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              id="btn-close-activity-window"
              onClick={onClose}
              title="閉じる"
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body - 詳細表示画面全体を縦スクロール（全13項目は内部スクロールせず常にすべて完全表示） */}
        <div id="activity-detail-scroll-body" className="flex-1 overflow-y-auto custom-scrollbar-y">
          <div className="flex flex-col md:flex-row w-full">
            {/* Map & Elevation Area: デスクトップではsticky表示で地図を見失わず、モバイルでは縦高さ520pxで表示 */}
            <div
              className="w-full shrink-0 h-[520px] sm:h-[580px] md:h-[680px] lg:h-[750px] md:w-3/5 lg:w-2/3 md:self-start md:sticky md:top-0 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 bg-slate-100 relative"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Drag-over dropzone overlay */}
              {isDragOver && (
                <div className="absolute inset-0 z-50 bg-blue-600/85 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 border-2 border-dashed border-white pointer-events-none">
                  <Upload className="w-12 h-12 mb-2 animate-bounce" />
                  <p className="font-bold text-base">GPXファイルをここにドロップ</p>
                  <p className="text-xs text-blue-100 mt-1">地図と標高グラフが即座に表示され、端末に自動保存されます</p>
                </div>
              )}

              <div className="flex-1 relative overflow-hidden min-h-[380px] md:min-h-0">
              {isLoadingGpx ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-500 text-xs gap-2">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-semibold text-slate-700 text-sm">GPXログデータを読み込み中...</span>
                  <span className="text-slate-400 text-xs">ルートと標高データを取得・解析しています</span>
                </div>
              ) : (
                <>
                  <LeafletMapView
                    key={activity.id}
                    activityId={activity.id}
                    track={gpxTrack}
                    activityTitle={activity.title}
                    currentPoint={highlightPoint}
                    prefecture={firstPrefecture}
                  />

                  {gpxError && activity.gpsLogUrl && (
                    <div className="absolute top-3 left-3 right-3 z-1000 bg-white/95 border border-amber-300 rounded-2xl shadow-xl backdrop-blur-xs overflow-hidden text-xs text-slate-800 animate-in fade-in duration-200">
                      <div className="bg-amber-50/90 px-3.5 py-2.5 flex items-center justify-between border-b border-amber-200">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="font-bold text-slate-800 truncate">GPXログの自動取得について</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowGpxHelp(v => !v)}
                            className="px-2 py-0.5 text-[11px] font-semibold text-amber-800 bg-amber-200/70 hover:bg-amber-200 rounded-md transition cursor-pointer"
                          >
                            {showGpxHelp ? '閉じる' : '詳細・解決策'}
                          </button>
                          <button
                            type="button"
                            onClick={loadGpx}
                            className="px-2.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-bold shrink-0 transition cursor-pointer"
                          >
                            再試行
                          </button>
                        </div>
                      </div>

                      <div className="p-3 bg-white space-y-2">
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          GitHub Pages等の静的サイト環境では、ブラウザのセキュリティ制限（CORS）によりGoogle Driveからの直接自動ダウンロードがブロックされる場合があります。
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {/* Direct download button */}
                          <a
                            href={getGoogleDriveDownloadUrl(activity.gpsLogUrl) || convertGoogleDriveUrl(activity.gpsLogUrl) || activity.gpsLogUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-2xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>1. Google Driveから直接DL</span>
                          </a>

                          {/* File picker */}
                          <label
                            htmlFor="gpx-file-fallback-input"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition border border-slate-200"
                          >
                            <Upload className="w-3.5 h-3.5 text-slate-500" />
                            <span>2. ダウンロードしたGPXを選択</span>
                            <input
                              id="gpx-file-fallback-input"
                              type="file"
                              accept=".gpx,application/gpx+xml,text/xml"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {showGpxHelp && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 space-y-1.5 bg-slate-50 -mx-3 -mb-3 p-3 rounded-b-2xl">
                            <p className="font-bold text-slate-700">💡 GitHub Pagesで全端末自動表示させる推奨方法：</p>
                            <p className="leading-relaxed">
                              リポジトリ内の <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-blue-600 font-semibold">public/gpx/</code>（または <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-blue-600 font-semibold">gpx/</code>）フォルダに、
                              日付ファイル名 <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-blue-600 font-semibold">{activity.dateStr ? activity.dateStr.replace(/[^0-9]/g, '') : 'YYYYMMDD'}.gpx</code> としてファイルを配置してGitHubにpushすると、
                              外部制限を受けずにGitHub Pagesから高速・完全に自動読み込みされます。
                            </p>
                            <p className="text-[10px] text-slate-400">
                              ※手動で読み込んだGPXファイルはこのブラウザ（IndexedDB）に永続保存され、次回以降自動的に即時表示されます。
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Upload GPX overlay button (always accessible) */}
                  <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
                    <label
                      htmlFor="gpx-file-input"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/95 hover:bg-white text-slate-700 text-xs font-semibold rounded-xl shadow-sm border border-slate-200/80 cursor-pointer backdrop-blur-xs transition"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>.gpxファイルを読込</span>
                      <input
                        id="gpx-file-input"
                        type="file"
                        accept=".gpx,application/gpx+xml,text/xml"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Elevation Profile Graph */}
            {gpxTrack && gpxTrack.points.some(p => p.ele !== undefined) && (
              <div className="shrink-0 p-3 bg-slate-950 border-t border-slate-800">
                <ElevationProfile
                  points={gpxTrack.points}
                  totalDistanceKm={gpxTrack.totalDistanceKm}
                  elevationGainM={gpxTrack.elevationGainM}
                  maxElevationM={gpxTrack.maxElevationM}
                  minElevationM={gpxTrack.minElevationM}
                  selectedPoint={highlightPoint}
                  onPointSelect={setHighlightPoint}
                />
              </div>
            )}
          </div>

          {/* Activity Data Details Panel: 内部スクロールせず、全13項目を常にそのまま完全表示 */}
          <div className="w-full md:w-2/5 lg:w-1/3 bg-[#F8FAFC] p-4 sm:p-5 flex flex-col gap-4 shrink-0">
            {/* Quick Stat Cards */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-2xs text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">距離</div>
                <div className="text-base sm:text-lg font-black text-blue-600 font-mono">
                  {activity.distStr || '0'}
                  <span className="text-xs text-slate-500 font-normal ml-0.5">km</span>
                </div>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-2xs text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">獲得標高</div>
                <div className="text-base sm:text-lg font-black text-emerald-600 font-mono">
                  {activity.elevStr || '0'}
                  <span className="text-xs text-slate-500 font-normal ml-0.5">m</span>
                </div>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-2xs text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">所要時間</div>
                <div className="text-xs sm:text-sm font-bold text-slate-900 font-mono mt-0.5">
                  {activity.time || '－'}
                </div>
              </div>
            </div>

            {/* Notification / notice if sample GPX shown */}
            {gpxError && (
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 text-xs text-amber-800 flex items-start gap-2 shadow-2xs">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-tight">{gpxError}</span>
              </div>
            )}

            {/* Complete Activity Table (All 13 required fields) */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
              <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>記録の詳細情報</span>
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">13項目</span>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {/* 1. 日付 */}
                <div className="flex py-2.5 px-4 items-center">
                  <div className="w-28 text-slate-400 font-medium shrink-0">日付</div>
                  <div className="font-semibold text-slate-900 font-mono">{activity.dateStr}</div>
                </div>

                {/* 2. 活動区分 */}
                <div className="flex py-2.5 px-4 items-center">
                  <div className="w-28 text-slate-400 font-medium shrink-0">活動区分</div>
                  <div className="font-bold text-slate-900 text-sm">
                    {renderColorizedEmoji(activity.cat) || '－'}
                  </div>
                </div>

                {/* 3. ｱｸﾃｨﾋﾞﾃｨ */}
                <div className="flex py-2.5 px-4 items-center">
                  <div className="w-28 text-slate-400 font-medium shrink-0">ｱｸﾃｨﾋﾞﾃｨ</div>
                  <div>
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full font-semibold text-[11px]">
                      {activity.act}
                    </span>
                  </div>
                </div>

                {/* 4. タイトル */}
                <div className="flex py-2.5 px-4 items-start">
                  <div className="w-28 text-slate-400 font-medium shrink-0 pt-0.5">タイトル</div>
                  <div className="font-bold text-slate-900 leading-snug">{activity.title}</div>
                </div>

                {/* 5. 記録リンク */}
                <div className="flex py-2.5 px-4 items-center">
                  <div className="w-28 text-slate-400 font-medium shrink-0">記録リンク</div>
                  <div>
                    {activity.link ? (
                      <a
                        href={activity.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-800 hover:text-blue-700 rounded-xl border border-slate-200 text-xs font-semibold transition"
                      >
                        <ServiceIcon url={activity.link} size={18} />
                        {isYamap && <span className="font-bold text-red-600">YAMAPで見る</span>}
                        {isGarmin && <span className="font-bold text-sky-600">Garmin Connectで見る</span>}
                        {!isYamap && !isGarmin && <span>記録リンクを開く</span>}
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    ) : (
                      <span className="text-slate-400">－</span>
                    )}
                  </div>
                </div>

                {/* 6. GPSログ */}
                <div className="flex py-2.5 px-4 items-center">
                  <div className="w-28 text-slate-400 font-medium shrink-0">GPSログ</div>
                  <div className="min-w-0 flex-1 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      {activity.gpsLogUrl ? (
                        <button
                          type="button"
                          onClick={handleDownloadGpx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200/80 transition cursor-pointer shadow-2xs"
                          title={`${activity.dateStr ? activity.dateStr.replace(/[^0-9]/g, '') + '.gpx' : 'activity.gpx'} をダウンロード`}
                        >
                          {downloadingGpx ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Download className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>.gpxダウンロード</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">－</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 7. 主な訪問地 */}
                <div className="flex py-2.5 px-4 items-start">
                  <div className="w-28 text-slate-400 font-medium shrink-0 pt-0.5">主な訪問地</div>
                  <div className="text-slate-800 leading-relaxed break-words flex-1">
                    {activity.spots || '－'}
                  </div>
                </div>

                {/* 8. 都道府県 */}
                <div className="flex py-2.5 px-4 items-center">
                  <div className="w-28 text-slate-400 font-medium shrink-0">都道府県</div>
                  <div className="flex flex-wrap gap-1">
                    {activity.prefList.length > 0 ? (
                      activity.prefList.map(p => (
                        <span key={p} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[11px] font-medium">
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400">－</span>
                    )}
                  </div>
                </div>

                {/* 9. 補足 */}
                <div className="flex py-2.5 px-4 items-center">
                  <div className="w-28 text-slate-400 font-medium shrink-0">補足</div>
                  <div className="text-slate-800 font-medium">{renderColorizedEmoji(activity.note) || '－'}</div>
                </div>

                {/* 10. 距離[km] */}
                <div className="flex py-2.5 px-4 items-center">
                  <div className="w-28 text-slate-400 font-medium shrink-0">距離［km］</div>
                  <div className="font-mono text-slate-900 font-semibold">
                    {activity.distStr ? `${activity.distStr} km` : '－'}
                  </div>
                </div>

                {/* 11. 獲得標高[m] */}
                <div className="flex py-2.5 px-4 items-center">
                  <div className="w-28 text-slate-400 font-medium shrink-0">獲得標高［m］</div>
                  <div className="font-mono text-slate-900 font-semibold">
                    {activity.elevStr ? `${activity.elevStr} m` : '－'}
                  </div>
                </div>

                {/* 12. 走行・歩行時間 */}
                <div className="flex py-2.5 px-4 items-center">
                  <div className="w-28 text-slate-400 font-medium shrink-0">走行・歩行時間</div>
                  <div className="font-mono text-slate-900 font-semibold">{activity.time || '－'}</div>
                </div>

                {/* 13. 車種/メーカー/モデル */}
                <div className="flex py-2.5 px-4 items-start">
                  <div className="w-28 text-slate-400 font-medium shrink-0 pt-0.5">機材</div>
                  <div className="text-slate-800">
                    {activity.gearStr ? (
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-900">{activity.type}</div>
                        <div className="text-xs text-slate-500">{activity.maker} {activity.model}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400">－</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* GPX Track Summary Box */}
            {gpxTrack && (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 text-xs shadow-2xs">
                <div className="font-bold text-slate-900 mb-2 flex items-center justify-between">
                  <span>GPSログ追跡データ情報</span>
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {gpxTrack.points.length} ポイント
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px]">
                  <div>GPS総距離: <strong className="text-slate-900">{gpxTrack.totalDistanceKm} km</strong></div>
                  <div>GPS累積上昇: <strong className="text-slate-900">{gpxTrack.elevationGainM} m</strong></div>
                  <div>最低標高: <strong className="text-slate-900">{gpxTrack.minElevationM} m</strong></div>
                  <div>最高地点: <strong className="text-blue-600">{gpxTrack.maxElevationM} m</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};
