import { GpxTrack } from '../types';

// Creates a realistic track around given base coords
export function generateSampleGpxTrack(
  title: string,
  distanceKm: number,
  elevGainM: number,
  prefStr?: string,
  spots?: string
): GpxTrack {
  // Center coordinates depending on prefecture, spots, or title
  const context = `${title} ${prefStr || ''} ${spots || ''}`;
  let startLat = 35.918;
  let startLng = 139.155; // Saitama / Okumusashi

  if (context.includes('山口') || context.includes('秋吉台') || context.includes('周南') || context.includes('一位ヶ岳')) {
    startLat = 34.295;
    startLng = 131.066;
  } else if (context.includes('広島') || context.includes('聖湖') || context.includes('深入山') || context.includes('八幡高原')) {
    startLat = 34.685;
    startLng = 132.223;
  } else if (context.includes('徳島') || context.includes('天狗塚') || context.includes('剣山')) {
    startLat = 33.858;
    startLng = 134.004;
  } else if (context.includes('愛媛') || context.includes('高知') || context.includes('UFOライン') || context.includes('瓶ヶ森') || context.includes('石鎚')) {
    startLat = 33.771;
    startLng = 133.242;
  } else if (context.includes('大分') || context.includes('平治岳') || context.includes('くじゅう') || context.includes('阿蘇')) {
    startLat = 33.112;
    startLng = 131.258;
  } else if (context.includes('福岡') || context.includes('英彦山') || context.includes('八丁峠') || context.includes('香春')) {
    startLat = 33.585;
    startLng = 130.932;
  } else if (context.includes('島根') || context.includes('津和野') || context.includes('日原')) {
    startLat = 34.528;
    startLng = 131.835;
  } else if (context.includes('乗鞍') || context.includes('長野') || context.includes('北アルプス') || context.includes('美ヶ原')) {
    startLat = 36.128;
    startLng = 137.554;
  } else if (context.includes('しまなみ')) {
    startLat = 34.341;
    startLng = 133.084;
  } else if (context.includes('大弛峠') || context.includes('山梨') || context.includes('八ヶ岳')) {
    startLat = 35.867;
    startLng = 138.655;
  } else if (context.includes('富士')) {
    startLat = 35.360;
    startLng = 138.727;
  } else if (context.includes('東京') || context.includes('多摩川') || context.includes('奥多摩')) {
    startLat = 35.782;
    startLng = 139.268;
  }

  const numPoints = Math.max(40, Math.min(200, Math.round((distanceKm || 30) * 3)));
  const points = [];
  const dist = distanceKm > 0 ? distanceKm : 35;
  const elev = elevGainM > 0 ? elevGainM : 1200;

  let curLat = startLat;
  let curLng = startLng;
  const baseElev = 300;

  for (let i = 0; i < numPoints; i++) {
    const progress = i / (numPoints - 1);
    // Sinusoidal elevation profile (goes up then down)
    const curElev = baseElev + Math.sin(progress * Math.PI) * elev + (Math.random() * 20 - 10);

    // Curvy track
    const angle = progress * Math.PI * 4;
    const r = (progress * (dist / 111)) * 0.4;
    curLat = startLat + Math.sin(angle) * r + (progress * 0.1);
    curLng = startLng + Math.cos(angle) * r + (progress * 0.12);

    points.push({
      lat: Number(curLat.toFixed(6)),
      lng: Number(curLng.toFixed(6)),
      ele: Math.round(curElev),
      time: new Date(Date.now() - (numPoints - i) * 60000).toISOString(),
      distKm: Number((progress * dist).toFixed(2)),
    });
  }

  return {
    name: `${title} (GPXログ)`,
    points,
    totalDistanceKm: dist,
    elevationGainM: elev,
    maxElevationM: Math.round(baseElev + elev),
    minElevationM: Math.round(baseElev),
  };
}
