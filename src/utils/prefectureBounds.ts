export type LatLngBoundsTuple = [[number, number], [number, number]]; // [[south, west], [north, east]]

export interface PrefectureInfo {
  code: string;
  name: string; // e.g. "東京"
  fullName: string; // e.g. "東京都"
  bounds: LatLngBoundsTuple;
}

// 47都道府県の標準バウンディングボックス（Leaflet fitBounds用）
export const PREFECTURES: Record<string, PrefectureInfo> = {
  北海道: {
    code: '01',
    name: '北海道',
    fullName: '北海道',
    bounds: [[41.35, 139.33], [45.52, 145.82]],
  },
  青森: {
    code: '02',
    name: '青森',
    fullName: '青森県',
    bounds: [[40.22, 139.50], [41.56, 141.68]],
  },
  岩手: {
    code: '03',
    name: '岩手',
    fullName: '岩手県',
    bounds: [[38.74, 140.65], [40.45, 142.07]],
  },
  宮城: {
    code: '04',
    name: '宮城',
    fullName: '宮城県',
    bounds: [[37.77, 140.27], [39.00, 141.67]],
  },
  秋田: {
    code: '05',
    name: '秋田',
    fullName: '秋田県',
    bounds: [[38.90, 139.70], [40.52, 140.99]],
  },
  山形: {
    code: '06',
    name: '山形',
    fullName: '山形県',
    bounds: [[37.73, 139.55], [39.15, 140.64]],
  },
  福島: {
    code: '07',
    name: '福島',
    fullName: '福島県',
    bounds: [[36.79, 139.16], [37.98, 141.04]],
  },
  茨城: {
    code: '08',
    name: '茨城',
    fullName: '茨城県',
    bounds: [[35.74, 139.68], [36.94, 140.85]],
  },
  栃木: {
    code: '09',
    name: '栃木',
    fullName: '栃木県',
    bounds: [[36.20, 139.33], [37.15, 140.29]],
  },
  群馬: {
    code: '10',
    name: '群馬',
    fullName: '群馬県',
    bounds: [[35.98, 138.40], [37.06, 139.66]],
  },
  埼玉: {
    code: '11',
    name: '埼玉',
    fullName: '埼玉県',
    bounds: [[35.75, 138.71], [36.29, 139.90]],
  },
  千葉: {
    code: '12',
    name: '千葉',
    fullName: '千葉県',
    bounds: [[34.90, 139.74], [36.10, 140.88]],
  },
  東京: {
    code: '13',
    name: '東京',
    fullName: '東京都',
    // 本土（多摩・奥多摩〜23区）。島嶼部を除外して活動エリア全体を最適縮尺で表示
    bounds: [[35.51, 138.98], [35.89, 139.92]],
  },
  神奈川: {
    code: '14',
    name: '神奈川',
    fullName: '神奈川県',
    bounds: [[35.12, 138.91], [35.67, 139.79]],
  },
  新潟: {
    code: '15',
    name: '新潟',
    fullName: '新潟県',
    bounds: [[36.73, 137.63], [38.56, 139.90]],
  },
  富山: {
    code: '16',
    name: '富山',
    fullName: '富山県',
    bounds: [[36.27, 136.77], [36.98, 137.76]],
  },
  石川: {
    code: '17',
    name: '石川',
    fullName: '石川県',
    bounds: [[36.06, 136.24], [37.52, 137.36]],
  },
  福井: {
    code: '18',
    name: '福井',
    fullName: '福井県',
    bounds: [[35.34, 135.45], [36.30, 136.83]],
  },
  山梨: {
    code: '19',
    name: '山梨',
    fullName: '山梨県',
    bounds: [[35.17, 138.18], [35.97, 139.14]],
  },
  長野: {
    code: '20',
    name: '長野',
    fullName: '長野県',
    bounds: [[35.19, 137.32], [37.03, 138.75]],
  },
  岐阜: {
    code: '21',
    name: '岐阜',
    fullName: '岐阜県',
    bounds: [[35.14, 136.27], [36.47, 137.65]],
  },
  静岡: {
    code: '22',
    name: '静岡',
    fullName: '静岡県',
    bounds: [[34.59, 137.47], [35.65, 139.15]],
  },
  愛知: {
    code: '23',
    name: '愛知',
    fullName: '愛知県',
    bounds: [[34.58, 136.67], [35.43, 137.84]],
  },
  三重: {
    code: '24',
    name: '三重',
    fullName: '三重県',
    bounds: [[33.72, 135.85], [35.26, 136.99]],
  },
  滋賀: {
    code: '25',
    name: '滋賀',
    fullName: '滋賀県',
    bounds: [[34.79, 135.85], [35.71, 136.45]],
  },
  京都: {
    code: '26',
    name: '京都',
    fullName: '京都府',
    bounds: [[34.71, 134.85], [35.78, 136.04]],
  },
  大阪: {
    code: '27',
    name: '大阪',
    fullName: '大阪府',
    bounds: [[34.27, 135.09], [35.05, 135.75]],
  },
  兵庫: {
    code: '28',
    name: '兵庫',
    fullName: '兵庫県',
    bounds: [[34.15, 134.25], [35.68, 135.47]],
  },
  奈良: {
    code: '29',
    name: '奈良',
    fullName: '奈良県',
    bounds: [[33.93, 135.68], [34.78, 136.19]],
  },
  和歌山: {
    code: '30',
    name: '和歌山',
    fullName: '和歌山県',
    bounds: [[33.43, 135.03], [34.36, 135.99]],
  },
  鳥取: {
    code: '31',
    name: '鳥取',
    fullName: '鳥取県',
    bounds: [[35.13, 133.17], [35.61, 134.45]],
  },
  島根: {
    code: '32',
    name: '島根',
    fullName: '島根県',
    bounds: [[34.30, 131.67], [36.35, 133.39]],
  },
  岡山: {
    code: '33',
    name: '岡山',
    fullName: '岡山県',
    bounds: [[34.29, 133.34], [35.35, 134.41]],
  },
  広島: {
    code: '34',
    name: '広島',
    fullName: '広島県',
    bounds: [[34.03, 132.03], [35.10, 133.47]],
  },
  山口: {
    code: '35',
    name: '山口',
    fullName: '山口県',
    bounds: [[33.71, 130.76], [34.61, 132.20]],
  },
  徳島: {
    code: '36',
    name: '徳島',
    fullName: '徳島県',
    bounds: [[33.53, 133.69], [34.24, 134.82]],
  },
  香川: {
    code: '37',
    name: '香川',
    fullName: '香川県',
    bounds: [[34.01, 133.44], [34.56, 134.44]],
  },
  愛媛: {
    code: '38',
    name: '愛媛',
    fullName: '愛媛県',
    bounds: [[32.90, 132.01], [34.31, 133.70]],
  },
  高知: {
    code: '39',
    name: '高知',
    fullName: '高知県',
    bounds: [[32.70, 132.48], [33.88, 134.31]],
  },
  福岡: {
    code: '40',
    name: '福岡',
    fullName: '福岡県',
    bounds: [[33.00, 129.98], [33.95, 131.20]],
  },
  佐賀: {
    code: '41',
    name: '佐賀',
    fullName: '佐賀県',
    bounds: [[32.97, 129.74], [33.62, 130.55]],
  },
  長崎: {
    code: '42',
    name: '長崎',
    fullName: '長崎県',
    bounds: [[32.55, 128.60], [34.73, 130.40]],
  },
  熊本: {
    code: '43',
    name: '熊本',
    fullName: '熊本県',
    bounds: [[32.08, 129.98], [33.19, 131.33]],
  },
  大分: {
    code: '44',
    name: '大分',
    fullName: '大分県',
    bounds: [[32.72, 130.83], [33.74, 132.11]],
  },
  宮崎: {
    code: '45',
    name: '宮崎',
    fullName: '宮崎県',
    bounds: [[31.35, 130.70], [32.84, 131.89]],
  },
  鹿児島: {
    code: '46',
    name: '鹿児島',
    fullName: '鹿児島県',
    // 薩摩・大隅本土を中心としたエリア
    bounds: [[30.98, 129.90], [32.32, 131.20]],
  },
  沖縄: {
    code: '47',
    name: '沖縄',
    fullName: '沖縄県',
    bounds: [[26.05, 127.60], [26.88, 128.35]],
  },
};

/**
 * 都道府県名の表記揺れ（「東京都」「東京」等）を正規化
 */
export function normalizePrefName(raw?: string | null): string {
  if (!raw) return '';
  let s = raw.trim();
  if (s === '北海道') return '北海道';
  // 「東京都」→「東京」、「大阪府」→「大阪」、「神奈川県」→「神奈川」
  s = s.replace(/(都|府|県)$/, '');
  return s;
}

/**
 * 都道府県の完全名（「東京都」「神奈川県」「京都府」「北海道」）を取得
 */
export function getPrefectureFullName(raw?: string | null): string {
  const norm = normalizePrefName(raw);
  if (PREFECTURES[norm]) {
    return PREFECTURES[norm].fullName;
  }
  return raw || '';
}

/**
 * 指定された都道府県のバウンディングボックスを取得
 */
export function getPrefectureBounds(raw?: string | null): LatLngBoundsTuple | null {
  const norm = normalizePrefName(raw);
  if (PREFECTURES[norm]) {
    return PREFECTURES[norm].bounds;
  }
  return null;
}

/**
 * アクティビティ情報から第1番目の都道府県名を取得
 * 例: "東京、山梨" または ['東京', '山梨'] → "東京"
 */
export function getFirstPrefectureName(activity: {
  prefList?: string[];
  prefStr?: string;
}): string | null {
  if (activity.prefList && activity.prefList.length > 0) {
    const first = activity.prefList[0].trim();
    if (first) return normalizePrefName(first);
  }
  if (activity.prefStr) {
    const parts = activity.prefStr.split(/[,、/ ]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      return normalizePrefName(parts[0]);
    }
  }
  return null;
}
