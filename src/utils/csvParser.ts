import { ActivityRecord } from '../types';

export function parseCsv(text: string): ActivityRecord[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  // Clean BOM if present
  const cleanText = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(c => c !== '')) {
      rows.push(currentRow);
    }
  }

  if (rows.length <= 1) return [];

  // Skip header if it starts with 日付
  const dataRows = rows[0][0]?.includes('日付') ? rows.slice(1) : rows;

  return dataRows.map((r, index) => {
    // Expected header:
    // 0: 日付, 1: 活動区分, 2: ｱｸﾃｨﾋﾞﾃｨ, 3: タイトル, 4: 記録リンク, 5: GPSログ,
    // 6: 主な訪問地, 7: 都道府県, 8: 補足, 9: 距離[km], 10: 獲得標高[m], 11: 走行・歩行時間,
    // 12: 車種, 13: メーカー, 14: モデル
    const dateStr = (r[0] || '').trim();
    // Normalize date (YYYY-MM-DD or YYYY/MM/DD)
    const normalizedDate = dateStr.replace(/-/g, '/');
    const year = normalizedDate.split('/')[0] || '';

    const cat = (r[1] || '').trim();
    const act = (r[2] || '').trim();
    const title = (r[3] || '').trim();
    const link = (r[4] || '').trim();
    const gpsLogUrl = (r[5] || '').trim();
    const spots = (r[6] || '').trim();
    const prefStr = (r[7] || '').trim();
    const note = (r[8] || '').trim();

    // Parse distance
    const rawDist = (r[9] || '').replace(/,/g, '').trim();
    const distVal = rawDist !== '' && !isNaN(Number(rawDist)) ? parseFloat(rawDist) : null;
    const distStr = distVal !== null ? distVal.toString() : '';

    // Parse elevation
    const rawElev = (r[10] || '').replace(/,/g, '').trim();
    const elevVal = rawElev !== '' && !isNaN(Number(rawElev)) ? Math.round(parseFloat(rawElev)) : null;
    const elevStr = elevVal !== null ? elevVal.toLocaleString() : '';

    const time = (r[11] || '').trim();
    const type = (r[12] || '').trim();
    const maker = (r[13] || '').trim();
    const model = (r[14] || '').trim();

    const gearArr = [type, maker, model].filter(v => v && v !== '－' && v !== '-');
    const gearStr = gearArr.join(' ');

    const prefList = prefStr
      ? prefStr.split(/[,、]/).map(p => p.trim()).filter(Boolean)
      : [];

    return {
      id: `act-${index}-${normalizedDate}`,
      dateStr: normalizedDate,
      year,
      cat,
      act,
      title,
      link,
      gpsLogUrl,
      spots,
      prefStr,
      prefList,
      note,
      distVal,
      distStr,
      elevVal,
      elevStr,
      time,
      type,
      maker,
      model,
      gearStr
    };
  });
}
