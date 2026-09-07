export interface ActivityRecord {
  id: string;
  dateStr: string; // YYYY-MM-DD or YYYY/MM/DD
  year: string;
  cat: string; // 活動区分 (🚲, 🏔, etc.)
  act: string; // ｱｸﾃｨﾋﾞﾃｨ (サイクリング, 登山, etc.)
  title: string;
  link: string; // 記録リンク (YAMAP, Garmin Connect, etc.)
  gpsLogUrl: string; // GPSログ (Google Driveリンク等)
  spots: string; // 主な訪問地
  prefStr: string; // 都道府県
  prefList: string[];
  note: string; // 補足
  distVal: number | null; // 距離[km]
  distStr: string;
  elevVal: number | null; // 獲得標高[m]
  elevStr: string;
  time: string; // 走行・歩行時間
  type: string; // 車種 (ロード, MTB, etc.)
  maker: string; // メーカー
  model: string; // モデル
  gearStr: string; // 車種/メーカー/モデル
}

export interface GpxPoint {
  lat: number;
  lng: number;
  ele?: number;
  time?: string;
  distKm?: number;
}

export interface GpxTrack {
  name?: string;
  points: GpxPoint[];
  totalDistanceKm: number;
  elevationGainM: number;
  maxElevationM: number;
  minElevationM: number;
}
