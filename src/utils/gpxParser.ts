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
    p.distKm = Math.round(totalDistanceKm * 100) / 100;
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

/**
 * Helper to get the absolute base URL of the currently hosted app,
 * resolving repository subpaths on GitHub Pages (e.g. https://user.github.io/repo/).
 */
export function getAppBaseUrl(): string {
  if (typeof window === 'undefined') return './';
  const pathname = window.location.pathname;
  // If the path doesn't end with a slash and has no extension, treat as directory
  let dirPath = pathname;
  if (!dirPath.endsWith('/')) {
    const lastSlash = dirPath.lastIndexOf('/');
    if (lastSlash >= 0) {
      dirPath = dirPath.substring(0, lastSlash + 1);
    } else {
      dirPath = '/';
    }
  }
  return `${window.location.origin}${dirPath}`;
}

/**
 * Resolves all candidate URLs / paths for a given GPX log entry,
 * prioritizing relative paths (./), subpath-aware repository paths,
 * and CDN/raw fallbacks for GitHub Pages compatibility.
 */
export function getCandidateGpxUrls(gpsLogUrl?: string | null, dateStr?: string | null): string[] {
  const candidates: string[] = [];
  const cleanDate = dateStr ? dateStr.replace(/[^0-9]/g, '') : '';
  const dateTrimmed = dateStr ? dateStr.trim() : '';

  // 1. If gpsLogUrl is specified as a local file or relative/absolute path:
  // e.g. "gpx/20090221.gpx", "/gpx/20090221.gpx", "./gpx/20090221.gpx", "20090221.gpx"
  if (gpsLogUrl && !/^(https?:|\/\/|data:|blob:)/i.test(gpsLogUrl.trim())) {
    const raw = gpsLogUrl.trim();
    // Strip leading slashes to prevent root-domain resolution on GitHub Pages
    const stripped = raw.replace(/^\/+/, '');
    const rel = stripped.startsWith('./') ? stripped : `./${stripped}`;
    candidates.push(rel);

    if (!stripped.startsWith('gpx/')) {
      candidates.push(`./gpx/${stripped}`);
    }

    if (typeof window !== 'undefined') {
      const base = getAppBaseUrl();
      candidates.push(`${base}${stripped}`);
      if (!stripped.startsWith('gpx/')) {
        candidates.push(`${base}gpx/${stripped}`);
      }
    }
  }

  // 2. Local static GPX files in repository (vital for GitHub Pages static hosting):
  // Checks if the user uploaded YYYYMMDD.gpx into ./gpx/ or the root repository folder
  if (cleanDate) {
    candidates.push(`./gpx/${cleanDate}.gpx`);
    candidates.push(`./${cleanDate}.gpx`);

    if (typeof window !== 'undefined') {
      const base = getAppBaseUrl();
      candidates.push(`${base}gpx/${cleanDate}.gpx`);
      candidates.push(`${base}${cleanDate}.gpx`);
      candidates.push(`${base}public/gpx/${cleanDate}.gpx`);

      // If running on GitHub Pages (username.github.io/repo)
      const hostname = window.location.hostname;
      if (hostname.endsWith('github.io')) {
        const username = hostname.replace('.github.io', '');
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        const repo = pathSegments[0];
        if (username && repo) {
          // GitHub Raw & jsDelivr (Both have Access-Control-Allow-Origin: * without CORP blocks)
          candidates.push(`https://raw.githubusercontent.com/${username}/${repo}/main/public/gpx/${cleanDate}.gpx`);
          candidates.push(`https://raw.githubusercontent.com/${username}/${repo}/main/gpx/${cleanDate}.gpx`);
          candidates.push(`https://raw.githubusercontent.com/${username}/${repo}/master/public/gpx/${cleanDate}.gpx`);
          candidates.push(`https://raw.githubusercontent.com/${username}/${repo}/master/gpx/${cleanDate}.gpx`);
          candidates.push(`https://cdn.jsdelivr.net/gh/${username}/${repo}@main/public/gpx/${cleanDate}.gpx`);
          candidates.push(`https://cdn.jsdelivr.net/gh/${username}/${repo}@main/gpx/${cleanDate}.gpx`);
        }
      }
    }
  }

  if (dateTrimmed && dateTrimmed !== cleanDate) {
    candidates.push(`./gpx/${dateTrimmed}.gpx`);
    candidates.push(`./${dateTrimmed}.gpx`);
  }

  // 3. Google Drive download URLs (with direct download parameters)
  if (gpsLogUrl && (gpsLogUrl.includes('drive.google.com') || gpsLogUrl.includes('docs.google.com') || gpsLogUrl.includes('drive.usercontent.google.com'))) {
    const match = gpsLogUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || gpsLogUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const fileId = match[1];
      candidates.push(`https://drive.usercontent.google.com/download?id=${fileId}&export=download`);
      candidates.push(`https://drive.google.com/uc?export=download&id=${fileId}`);
      candidates.push(`https://docs.google.com/uc?export=download&id=${fileId}`);
      candidates.push(`https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`);
    }
  } else if (gpsLogUrl && /^(https?:|\/\/)/i.test(gpsLogUrl.trim())) {
    candidates.push(gpsLogUrl.trim());
  }

  // Deduplicate while maintaining priority order
  return Array.from(new Set(candidates));
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
