import { GpxPoint, GpxTrack } from '../types';

export function parseGpxXml(xmlText: string): GpxTrack {
  let points: GpxPoint[] = [];
  let name: string | undefined = undefined;

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const hasParserError = xmlDoc.querySelector('parsererror') !== null;

    if (!hasParserError) {
      // Name
      const nameEl = xmlDoc.querySelector('trk > name') || xmlDoc.querySelector('name');
      name = nameEl?.textContent || undefined;

      // Use getElementsByTagName for namespace-agnostic matching
      let trkptEls = xmlDoc.getElementsByTagName('trkpt');
      if (trkptEls.length === 0) {
        trkptEls = xmlDoc.getElementsByTagName('rtept');
      }
      if (trkptEls.length === 0) {
        trkptEls = xmlDoc.getElementsByTagName('wpt');
      }

      for (let i = 0; i < trkptEls.length; i++) {
        const el = trkptEls[i];
        const latStr = el.getAttribute('lat');
        const lonStr = el.getAttribute('lon');
        if (!latStr || !lonStr) continue;

        const lat = parseFloat(latStr);
        const lng = parseFloat(lonStr);
        if (isNaN(lat) || isNaN(lng)) continue;

        const eleEl = el.getElementsByTagName('ele')[0];
        const ele = eleEl && eleEl.textContent ? parseFloat(eleEl.textContent) : undefined;

        const timeEl = el.getElementsByTagName('time')[0];
        const time = timeEl ? timeEl.textContent || undefined : undefined;

        points.push({ lat, lng, ele, time });
      }
    }
  } catch (domErr) {
    console.warn('DOMParser failed, falling back to regex extraction:', domErr);
  }

  // Robust Regex Fallback if DOMParser failed or returned no points
  if (points.length === 0) {
    // Attempt name match
    const nameMatch = xmlText.match(/<name>(.*?)<\/name>/i);
    if (nameMatch) name = nameMatch[1];

    // Regex for trackpoints supporting both lat..lon and lon..lat attribute orders
    const ptRegex = /<(?:[\w:]+)?(?:trkpt|rtept|wpt)\b([^>]*)>([\s\S]*?)<\/(?:[\w:]+)?(?:trkpt|rtept|wpt)>/gi;
    let match: RegExpExecArray | null;

    while ((match = ptRegex.exec(xmlText)) !== null) {
      const attrs = match[1];
      const inner = match[2];

      const latM = attrs.match(/lat=["']([-\d.]+)["']/i);
      const lonM = attrs.match(/lon=["']([-\d.]+)["']/i);
      if (!latM || !lonM) continue;

      const lat = parseFloat(latM[1]);
      const lng = parseFloat(lonM[1]);
      if (isNaN(lat) || isNaN(lng)) continue;

      const eleM = inner.match(/<ele>([-\d.]+)<\/ele>/i);
      const ele = eleM ? parseFloat(eleM[1]) : undefined;

      const timeM = inner.match(/<time>(.*?)<\/time>/i);
      const time = timeM ? timeM[1] : undefined;

      points.push({ lat, lng, ele, time });
    }
  }

  if (points.length === 0) {
    throw new Error('GPXファイル内に有効な位置情報（trkpt）が見つかりませんでした');
  }

  // Calculate stats
  let totalDistanceKm = 0;
  let elevationGainM = 0;
  let maxElevationM = -Infinity;
  let minElevationM = Infinity;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.ele !== undefined && !isNaN(p.ele)) {
      if (p.ele > maxElevationM) maxElevationM = p.ele;
      if (p.ele < minElevationM) minElevationM = p.ele;
    }

    if (i > 0) {
      const prev = points[i - 1];
      const d = haversineDistance(prev.lat, prev.lng, p.lat, p.lng);
      totalDistanceKm += d;

      if (prev.ele !== undefined && p.ele !== undefined && p.ele > prev.ele) {
        elevationGainM += p.ele - prev.ele;
      }
    }
  }

  return {
    name,
    points,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    elevationGainM: Math.round(elevationGainM),
    maxElevationM: maxElevationM !== -Infinity ? Math.round(maxElevationM) : 0,
    minElevationM: minElevationM !== Infinity ? Math.round(minElevationM) : 0,
  };
}

// Calculate distance in km between two lat/lng
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Convert Google Drive view URL to direct export download URL
export function convertGoogleDriveUrl(url: string): string | null {
  if (!url) return null;
  // Patterns:
  // https://drive.google.com/file/d/{ID}/view...
  // https://drive.google.com/open?id={ID}
  // https://docs.google.com/file/d/{ID}/...
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }
  return null;
}

// Get direct downloadable URL with CORS enabled and native filename from Google Drive
export function getGoogleDriveDownloadUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.usercontent.google.com/download?id=${match[1]}&export=download`;
  }
  return null;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Generate standard GPX 1.1 XML string from GpxTrack
export function exportTrackToGpxXml(track: GpxTrack, title?: string): string {
  const trackName = escapeXml(track.name || title || 'Activity Track');
  const nowIso = new Date().toISOString();

  let trkptsXml = '';
  for (let i = 0; i < track.points.length; i++) {
    const p = track.points[i];
    const eleTag = p.ele !== undefined && !isNaN(p.ele) ? `        <ele>${p.ele.toFixed(1)}</ele>\n` : '';
    const timeTag = p.time ? `        <time>${escapeXml(p.time)}</time>\n` : '';
    trkptsXml += `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">\n${eleTag}${timeTag}      </trkpt>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CyclingClimbingLog" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${trackName}</name>
    <time>${nowIso}</time>
  </metadata>
  <trk>
    <name>${trackName}</name>
    <trkseg>
${trkptsXml}    </trkseg>
  </trk>
</gpx>`;
}

// Trigger client-side file download
export function triggerDownload(filename: string, content: string, mimeType = 'application/gpx+xml') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
