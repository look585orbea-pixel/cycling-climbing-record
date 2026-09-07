import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ActivityRecord } from './types';
import { parseCsv } from './utils/csvParser';
import { getGoogleDriveDownloadUrl, convertGoogleDriveUrl } from './utils/gpxParser';
import { ActivityDetailWindow } from './components/ActivityDetailWindow';
import { PrefectureModal } from './components/PrefectureModal';
import { ServiceIcon } from './components/ServiceIcon';
import { renderColorizedEmoji } from './utils/emojiRenderer';
import {
  Search,
  Download,
  Check,
  RotateCcw,
  MapPin,
  ExternalLink,
  Map as MapIcon,
  Filter,
  Layers,
  ChevronDown,
  Compass,
  FileSpreadsheet
} from 'lucide-react';

export default function App() {
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [isLoadingCsv, setIsLoadingCsv] = useState(true);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Selected Activity for Detail Window
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecord | null>(null);

  // Filters
  const [fSort, setFSort] = useState<'desc' | 'asc'>('desc');
  const [fYear, setFYear] = useState<string>('');
  const [fCat, setFCat] = useState<string>('');
  const [fAct, setFAct] = useState<string>('');
  const [fNote, setFNote] = useState<string>('');
  const [fDist, setFDist] = useState<string>('');
  const [fElev, setFElev] = useState<string>('');
  const [fGear, setFGear] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedPrefs, setSelectedPrefs] = useState<Set<string>>(new Set());

  // Modal for Prefecture Selection
  const [isPrefModalOpen, setIsPrefModalOpen] = useState(false);

  // Automatically load CyclingClimbingList.csv on launch
  useEffect(() => {
    const fetchCsv = async () => {
      setIsLoadingCsv(true);
      setCsvError(null);
      try {
        let text = '';
        const timestamp = Date.now();
        const res = await fetch(`./CyclingClimbingList.csv?t=${timestamp}`, { cache: 'no-cache' });
        if (res.ok) {
          text = await res.text();
        } else {
          const fallbackRes = await fetch(`/CyclingClimbingList.csv?t=${timestamp}`, { cache: 'no-cache' });
          if (fallbackRes.ok) {
            text = await fallbackRes.text();
          } else {
            throw new Error(`HTTP ${res.status}`);
          }
        }
        const parsed = parseCsv(text);
        setRecords(parsed);
      } catch (err: any) {
        console.error('Failed to load CSV:', err);
        setCsvError('CyclingClimbingList.csv の読み込みに失敗しました。');
      } finally {
        setIsLoadingCsv(false);
      }
    };

    fetchCsv();
  }, []);

  // Derive unique filter options from records
  const { years, cats, acts, notes, gears, activePrefsInRecords, maxElevValue } = useMemo(() => {
    const yearsSet = new Set<string>();
    const catsSet = new Set<string>();
    const actsSet = new Set<string>();
    const notesSet = new Set<string>();
    const gearsSet = new Set<string>();
    const prefsSet = new Set<string>();
    let maxElev = 1000;

    records.forEach(r => {
      if (r.year) yearsSet.add(r.year);
      if (r.cat) catsSet.add(r.cat);
      if (r.act) actsSet.add(r.act);
      if (r.note) notesSet.add(r.note);
      if (r.gearStr) gearsSet.add(r.gearStr);
      r.prefList.forEach(p => prefsSet.add(p));
      if (r.elevVal && r.elevVal > maxElev) maxElev = r.elevVal;
    });

    return {
      years: Array.from(yearsSet).sort().reverse(),
      cats: Array.from(catsSet).sort(),
      acts: Array.from(actsSet).sort(),
      notes: Array.from(notesSet).sort(),
      gears: Array.from(gearsSet).sort(),
      activePrefsInRecords: prefsSet,
      maxElevValue: maxElev,
    };
  }, [records]);

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    return records
      .filter(r => {
        if (fYear && r.year !== fYear) return false;
        if (fCat && r.cat !== fCat) return false;
        if (fAct && r.act !== fAct) return false;
        if (fNote && r.note !== fNote) return false;
        if (fGear && r.gearStr !== fGear) return false;

        // Distance range
        if (fDist) {
          if (r.distVal === null) return false;
          if (fDist === '0-49' && (r.distVal < 0 || r.distVal > 49)) return false;
          if (fDist === '50-99' && (r.distVal < 50 || r.distVal > 99)) return false;
          if (fDist === '100-149' && (r.distVal < 100 || r.distVal > 149)) return false;
          if (fDist === '150-plus' && r.distVal < 150) return false;
        }

        // Elevation range
        if (fElev) {
          if (r.elevVal === null) return false;
          if (fElev === '0-499' && (r.elevVal < 0 || r.elevVal > 499)) return false;
          if (fElev === '500-999' && (r.elevVal < 500 || r.elevVal > 999)) return false;
          if (fElev === '1000-1999' && (r.elevVal < 1000 || r.elevVal > 1999)) return false;
          if (fElev === '2000-plus' && r.elevVal < 2000) return false;
        }

        // Prefecture selection
        if (selectedPrefs.size > 0) {
          if (!r.prefList.some(p => selectedPrefs.has(p))) return false;
        }

        // Keyword search across title, spots, note
        if (searchKeyword.trim()) {
          const kw = searchKeyword.toLowerCase();
          const matchTitle = r.title.toLowerCase().includes(kw);
          const matchSpots = r.spots.toLowerCase().includes(kw);
          const matchNote = r.note.toLowerCase().includes(kw);
          const matchDate = r.dateStr.includes(kw);
          if (!matchTitle && !matchSpots && !matchNote && !matchDate) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (fSort === 'asc') {
          return a.dateStr.localeCompare(b.dateStr);
        }
        return b.dateStr.localeCompare(a.dateStr);
      });
  }, [records, fYear, fCat, fAct, fNote, fGear, fDist, fElev, selectedPrefs, searchKeyword, fSort]);

  // Aggregate stats
  const { totalDistance, totalElevation } = useMemo(() => {
    let dist = 0;
    let elev = 0;
    filteredRecords.forEach(r => {
      if (r.distVal) dist += r.distVal;
      if (r.elevVal) elev += r.elevVal;
    });
    return {
      totalDistance: Math.round(dist),
      totalElevation: elev,
    };
  }, [filteredRecords]);

  const handleTogglePref = (p: string) => {
    setSelectedPrefs(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const resetAllFilters = () => {
    setFYear('');
    setFCat('');
    setFAct('');
    setFNote('');
    setFDist('');
    setFElev('');
    setFGear('');
    setSearchKeyword('');
    setSelectedPrefs(new Set());
  };

  // Direct GPX download for a specific record using the GPS log URL without changing the file
  const handleDownloadGpxForRecord = async (r: ActivityRecord) => {
    if (!r.gpsLogUrl) {
      return;
    }
    setDownloadingId(r.id);
    // Format: YYYYMMDD.gpx (e.g., 2026-07-25 -> 20260725.gpx)
    const cleanDate = r.dateStr ? r.dateStr.replace(/[^0-9]/g, '') : '';
    const filename = cleanDate ? `${cleanDate}.gpx` : 'activity.gpx';

    const directUrl = getGoogleDriveDownloadUrl(r.gpsLogUrl) || convertGoogleDriveUrl(r.gpsLogUrl) || r.gpsLogUrl;

    const triggerBlobDownload = (blob: Blob, name: string) => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 300);
    };

    try {
      // 1. Direct fetch from Google Drive (CORS enabled, original raw GPX file)
      const res = await fetch(directUrl);
      if (res.ok) {
        const text = await res.text();
        if (text.includes('<gpx') || text.includes('<?xml')) {
          const blob = new Blob([text], { type: 'application/gpx+xml;charset=utf-8' });
          triggerBlobDownload(blob, filename);
          setTimeout(() => setDownloadingId(null), 1000);
          return;
        }
      }
    } catch (e) {
      console.warn('Direct fetch from Google Drive usercontent had restriction:', e);
    }

    try {
      // 2. Server proxy fallback if available
      const proxyUrl = `/api/gpx-download?url=${encodeURIComponent(r.gpsLogUrl)}&filename=${filename}`;
      const pRes = await fetch(proxyUrl);
      if (pRes.ok) {
        const text = await pRes.text();
        if (text.includes('<gpx') || text.includes('<?xml')) {
          const blob = new Blob([text], { type: 'application/gpx+xml;charset=utf-8' });
          triggerBlobDownload(blob, filename);
          setTimeout(() => setDownloadingId(null), 1000);
          return;
        }
      }
    } catch (e) {
      console.warn('Proxy fetch failed:', e);
    }

    // 3. Fallback: Native browser download directly from Google Drive URL
    const a = document.createElement('a');
    a.href = directUrl;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 300);
    setTimeout(() => setDownloadingId(null), 1000);
  };

  return (
    <div className="flex flex-col h-[100dvh] min-h-[100dvh] w-full bg-[#F1F5F9] text-slate-800 font-sans select-none overflow-hidden pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
      {/* Sleek Top Header & Summary Area */}
      <header className="min-h-16 h-auto sm:h-16 py-2.5 sm:py-0 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-xs z-20 gap-2 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm shadow-blue-500/20 shrink-0">
            🚲
          </div>
          <div className="shrink-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-snug whitespace-nowrap">
              CyclingClimbing <span className="text-blue-600 font-medium">Log</span>
            </h1>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 whitespace-nowrap mt-0.5">
              <span className="hidden xs:inline">CyclingClimbingList.csv</span>
              {isLoadingCsv ? (
                <span className="text-blue-600 animate-pulse font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping inline-block"></span>
                  読込中...
                </span>
              ) : (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                  {records.length.toLocaleString()}件
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats Banner - Compact & Responsive */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center shadow-2xs shrink-0">
            <div className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider">件数</div>
            <div className="text-xs sm:text-sm font-black text-slate-900 font-mono">
              {filteredRecords.length.toLocaleString()}
              <span className="text-[9px] sm:text-[10px] font-normal text-slate-500 ml-0.5">件</span>
            </div>
          </div>
          <div className="px-2 sm:px-3.5 py-1 sm:py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center shadow-2xs shrink-0">
            <div className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider">合計距離</div>
            <div className="text-xs sm:text-sm font-black text-blue-600 font-mono">
              {totalDistance.toLocaleString()}
              <span className="text-[9px] sm:text-[10px] font-normal text-slate-500 ml-0.5">km</span>
            </div>
          </div>
          <div className="px-2 sm:px-3.5 py-1 sm:py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center shadow-2xs shrink-0">
            <div className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider">累計獲得標高</div>
            <div className="text-xs sm:text-sm font-black text-emerald-600 font-mono">
              {totalElevation.toLocaleString()}
              <span className="text-[9px] sm:text-[10px] font-normal text-slate-500 ml-0.5">m</span>
            </div>
          </div>
        </div>
      </header>

      {/* Sleek Filter Bar - Single Row from '新しい順' to '地図絞り込み' with Horizontal Scrollbar */}
      <div className="bg-white/95 backdrop-blur-xs border-b border-slate-200 px-3 sm:px-6 py-2 shrink-0 shadow-2xs">
        <div
          id="filter-menu-scroll-container"
          className="filter-scrollbar flex items-center gap-2 overflow-x-auto overflow-y-hidden pb-2 pt-0.5 whitespace-nowrap"
        >
          {/* 1. Sort Order */}
          <select
            id="filter-sort"
            value={fSort}
            onChange={(e) => setFSort(e.target.value as 'desc' | 'asc')}
            className="h-8 shrink-0 bg-slate-50 hover:bg-white text-slate-700 border border-slate-200 rounded-xl px-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition shadow-2xs"
          >
            <option value="desc">新しい順</option>
            <option value="asc">古い順</option>
          </select>

          {/* 2. Year */}
          <select
            id="filter-year"
            value={fYear}
            onChange={(e) => setFYear(e.target.value)}
            className={`h-8 shrink-0 border rounded-xl px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition shadow-2xs ${
              fYear ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold' : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200'
            }`}
          >
            <option value="">年（すべて）</option>
            {years.map(y => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>

          {/* 3. Activity Category */}
          <select
            id="filter-category"
            value={fCat}
            onChange={(e) => setFCat(e.target.value)}
            className={`h-8 shrink-0 border rounded-xl px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition shadow-2xs ${
              fCat ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold' : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200'
            }`}
          >
            <option value="">活動（すべて）</option>
            {cats.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* 4. Activity Type */}
          <select
            id="filter-activity"
            value={fAct}
            onChange={(e) => setFAct(e.target.value)}
            className={`h-8 shrink-0 border rounded-xl px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition shadow-2xs ${
              fAct ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold' : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200'
            }`}
          >
            <option value="">ｱｸﾃｨﾋﾞﾃｨ（すべて）</option>
            {acts.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* 5. Prefecture Map Filter Button (アクティビティのメニューの右隣) */}
          <button
            id="btn-open-pref-map"
            type="button"
            onClick={() => setIsPrefModalOpen(true)}
            className={`h-8 shrink-0 px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              selectedPrefs.size > 0
                ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-sm shadow-blue-500/25'
                : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200 shadow-2xs'
            }`}
          >
            <span>🗾</span>
            <span>地図絞り込み</span>
            {selectedPrefs.size > 0 && (
              <span className="bg-white text-blue-600 font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {selectedPrefs.size}
              </span>
            )}
          </button>

          {/* 6. Note / Tag */}
          <select
            id="filter-note"
            value={fNote}
            onChange={(e) => setFNote(e.target.value)}
            className={`h-8 shrink-0 border rounded-xl px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition shadow-2xs ${
              fNote ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold' : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200'
            }`}
          >
            <option value="">補足（すべて）</option>
            {notes.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          {/* 7. Distance */}
          <select
            id="filter-dist"
            value={fDist}
            onChange={(e) => setFDist(e.target.value)}
            className={`h-8 shrink-0 border rounded-xl px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition shadow-2xs ${
              fDist ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold' : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200'
            }`}
          >
            <option value="">距離［km］（すべて）</option>
            <option value="0-49">0～49 km</option>
            <option value="50-99">50～99 km</option>
            <option value="100-149">100～149 km</option>
            <option value="150-plus">150 km ～</option>
          </select>

          {/* 8. Elevation */}
          <select
            id="filter-elev"
            value={fElev}
            onChange={(e) => setFElev(e.target.value)}
            className={`h-8 shrink-0 border rounded-xl px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition shadow-2xs ${
              fElev ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold' : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200'
            }`}
          >
            <option value="">獲得標高［m］（すべて）</option>
            <option value="0-499">0～499 m</option>
            <option value="500-999">500～999 m</option>
            <option value="1000-1999">1000～1999 m</option>
            <option value="2000-plus">2000 m ～</option>
          </select>

          {/* 9. Gear */}
          <select
            id="filter-gear"
            value={fGear}
            onChange={(e) => setFGear(e.target.value)}
            className={`h-8 shrink-0 border rounded-xl px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition shadow-2xs max-w-[140px] ${
              fGear ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold' : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200'
            }`}
          >
            <option value="">機材（すべて）</option>
            {gears.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {/* 10. Keyword Search */}
          <div className="relative flex items-center shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="タイトル・地名で検索..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs w-44 sm:w-56 shrink-0"
            />
          </div>

          {/* 11. Reset Filters */}
          {(fYear || fCat || fAct || fNote || fDist || fElev || fGear || selectedPrefs.size > 0 || searchKeyword) && (
            <button
              onClick={resetAllFilters}
              title="絞り込みを解除"
              className="h-8 shrink-0 px-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-medium flex items-center gap-1 transition shadow-2xs cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>リセット</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table Area */}
      <main className="flex-1 overflow-auto p-2 sm:p-4 bg-[#F1F5F9]">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto overflow-y-auto max-h-full">
          <table className="min-w-[1380px] w-full border-collapse text-left text-xs">
            <thead className="bg-slate-50/95 backdrop-blur-xs text-slate-500 font-bold tracking-wider text-[11px] sticky top-0 z-20 shadow-2xs border-b border-slate-200">
              <tr>
                <th className="py-3 px-1 font-semibold text-center w-[48px] min-w-[48px] max-w-[48px] sticky left-0 bg-slate-50/95 z-30">
                  詳細
                </th>
                <th
                  className="py-3 px-0.5 font-semibold text-center w-[38px] min-w-[38px] max-w-[38px] sticky left-[48px] bg-slate-50/95 z-30"
                  title="GPXダウンロード"
                >
                  DL
                </th>
                <th
                  className="py-1.5 px-0.5 font-semibold text-center w-[48px] min-w-[48px] max-w-[48px] sticky left-[86px] bg-slate-50/95 z-30 shadow-[1px_0_0_0_#e2e8f0] leading-tight text-[10px]"
                  title="記録リンク"
                >
                  記録<br />リンク
                </th>
                <th className="py-3 px-3.5 font-semibold whitespace-nowrap">日付</th>
                <th className="py-3 px-3 font-semibold text-center">活動区分</th>
                <th className="py-3 px-3.5 font-semibold">ｱｸﾃｨﾋﾞﾃｨ</th>
                <th className="py-3 px-3.5 font-semibold w-[200px] min-w-[200px] max-w-[200px]">
                  タイトル
                </th>
                <th className="py-3 px-3.5 font-semibold w-[200px] min-w-[200px] max-w-[200px]">
                  主な訪問地
                </th>
                <th className="py-3 px-3.5 font-semibold w-[100px] min-w-[100px] max-w-[100px]">都道府県</th>
                <th className="py-3 px-3 font-semibold w-[100px] min-w-[100px] max-w-[100px]">
                  補足
                </th>
                <th className="py-3 px-3.5 font-semibold text-right">距離［km］</th>
                <th className="py-3 px-3.5 font-semibold text-right min-w-[110px]">
                  獲得標高［m］
                </th>
                <th className="py-3 px-3.5 font-semibold text-right">走行・歩行時間</th>
                <th className="py-3 px-3.5 font-semibold">車種</th>
                <th className="py-3 px-3.5 font-semibold">メーカー</th>
                <th className="py-3 px-3.5 font-semibold">モデル</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-14 text-center text-slate-400">
                    {isLoadingCsv ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-medium text-slate-600">データを読み込み中...</span>
                      </div>
                    ) : (
                      <span className="text-xs font-medium">該当する記録が見つかりませんでした。条件を変更してください。</span>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const elevPct = r.elevVal ? Math.min(100, (r.elevVal / maxElevValue) * 100) : 0;

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedActivity(r)}
                      title="行をクリックすると詳細情報と地図を表示します"
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors duration-100 group border-b border-slate-100 last:border-0"
                    >
                      {/* 詳細ボタン (Sticky Left: left-0) */}
                      <td
                        className="py-2 px-1 text-center sticky left-0 bg-white group-hover:bg-[#F4F8FD] z-10 transition-colors w-[48px] min-w-[48px] max-w-[48px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedActivity(r);
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedActivity(r);
                          }}
                          className="px-1.5 py-0.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200/70 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 font-semibold text-[11px] transition shadow-2xs cursor-pointer"
                          title="詳細情報と地図を表示"
                        >
                          詳細
                        </button>
                      </td>

                      {/* ダウンロードボタン (Sticky Left: left-[48px]) */}
                      <td
                        className="py-2 px-0.5 text-center sticky left-[48px] bg-white group-hover:bg-[#F4F8FD] z-10 transition-colors w-[38px] min-w-[38px] max-w-[38px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadGpxForRecord(r);
                          }}
                          disabled={!r.gpsLogUrl}
                          title={
                            r.gpsLogUrl
                              ? `${r.dateStr ? r.dateStr.replace(/[^0-9]/g, '') + '.gpx' : 'GPX'}をダウンロード`
                              : 'GPSログのリンクがありません'
                          }
                          className={`p-1 rounded-lg border transition shadow-2xs inline-flex items-center justify-center ${
                            r.gpsLogUrl
                              ? 'bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border-slate-200/80 hover:border-blue-200 cursor-pointer'
                              : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-30'
                          }`}
                        >
                          {downloadingId === r.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>

                      {/* 記録リンク (Sticky Left: left-[86px] - 詳細・ダウンロードの右隣で固定) */}
                      <td
                        className="py-2 px-0.5 text-center whitespace-nowrap sticky left-[86px] bg-white group-hover:bg-[#F4F8FD] z-10 shadow-[1px_0_0_0_#e2e8f0] transition-colors w-[48px] min-w-[48px] max-w-[48px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.link ? (
                          <a
                            href={r.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-5 h-5 rounded hover:opacity-75 transition-opacity"
                            title={r.link}
                          >
                            <ServiceIcon url={r.link} size={18} />
                          </a>
                        ) : (
                          <span className="text-slate-300">－</span>
                        )}
                      </td>

                      {/* 日付 */}
                      <td className="py-2.5 px-3.5 font-mono font-medium text-slate-700 whitespace-nowrap">
                        {r.dateStr}
                      </td>

                      {/* 活動区分 */}
                      <td className="py-2.5 px-3 text-center text-sm whitespace-nowrap">
                        {renderColorizedEmoji(r.cat)}
                      </td>

                      {/* ｱｸﾃｨﾋﾞﾃｨ */}
                      <td className="py-2.5 px-3.5 font-medium text-slate-700 whitespace-nowrap">
                        {r.act}
                      </td>

                      {/* タイトル (col-title: 200px, pre-wrap, break-word) */}
                      <td className="py-2.5 px-3.5 font-bold text-slate-900 group-hover:text-blue-700 transition-colors w-[200px] min-w-[200px] max-w-[200px] whitespace-pre-wrap break-words leading-relaxed">
                        {r.title}
                      </td>

                      {/* 主な訪問地 (col-spots: 200px, pre-wrap, break-word) */}
                      <td className="py-2.5 px-3.5 text-slate-600 w-[200px] min-w-[200px] max-w-[200px] whitespace-pre-wrap break-words leading-relaxed">
                        {r.spots || '－'}
                      </td>

                      {/* 都道府県 (幅100px) */}
                      <td className="py-2.5 px-3.5 text-slate-600 w-[100px] min-w-[100px] max-w-[100px] whitespace-pre-wrap break-words">
                        {r.prefStr || '－'}
                      </td>

                      {/* 補足 (col-note: 100px, pre-wrap, break-word, emoji colored) */}
                      <td className="py-2.5 px-3 text-slate-600 w-[100px] min-w-[100px] max-w-[100px] whitespace-pre-wrap break-words leading-relaxed">
                        {renderColorizedEmoji(r.note) || '－'}
                      </td>

                      {/* 距離［km］ (右寄せ) */}
                      <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-slate-800 whitespace-nowrap tabular-nums">
                        {r.distStr || '－'}
                      </td>

                      {/* 獲得標高［m］(右寄せ + 緑バー elevation-bar) */}
                      <td className="py-2.5 px-3.5 text-right font-mono whitespace-nowrap relative">
                        {r.elevVal ? (
                          <div className="relative flex items-center justify-end min-w-[90px] h-full pr-1">
                            <div
                              className="absolute right-0 top-1 bottom-1 bg-[#4ade80]/40 rounded-xs pointer-events-none transition-all duration-300"
                              style={{ width: `${elevPct}%` }}
                            />
                              <span className="relative z-10 font-medium tabular-nums text-slate-900">
                              {r.elevStr}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">－</span>
                        )}
                      </td>

                      {/* 走行・歩行時間 (右寄せ) */}
                      <td className="py-2.5 px-3.5 text-right font-mono text-slate-700 whitespace-nowrap tabular-nums">
                        {r.time || '－'}
                      </td>

                      {/* 車種 */}
                      <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                        {r.type || '－'}
                      </td>

                      {/* メーカー */}
                      <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                        {r.maker || '－'}
                      </td>

                      {/* モデル */}
                      <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                        {r.model || '－'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Activity Detail Window (Modal Window on Row Click) */}
      <ActivityDetailWindow
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />

      {/* Prefecture Map Selection Modal */}
      <PrefectureModal
        isOpen={isPrefModalOpen}
        onClose={() => setIsPrefModalOpen(false)}
        activePrefsInRecords={activePrefsInRecords}
        selectedPrefs={selectedPrefs}
        onTogglePref={handleTogglePref}
        onReset={() => setSelectedPrefs(new Set())}
      />
    </div>
  );
}
