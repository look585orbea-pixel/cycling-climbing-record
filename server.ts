import express, { type Request, type Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// In-memory cache for fetched GPX XML contents to prevent excessive calls to Google Drive
// and completely prevent Google Drive rate limit / download quota restrictions.
const gpxMemoryCache = new Map<string, string>();
const MAX_CACHE_SIZE = 100;

function setGpxCache(key: string, content: string) {
  if (gpxMemoryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = gpxMemoryCache.keys().next().value;
    if (oldestKey) gpxMemoryCache.delete(oldestKey);
  }
  gpxMemoryCache.set(key, content);
}

// Fetch GPX data for a single target URL from Google Drive or direct web
async function fetchGpxFromSource(rawTargetUrl: string): Promise<string | null> {
  // Check memory cache first
  if (gpxMemoryCache.has(rawTargetUrl)) {
    return gpxMemoryCache.get(rawTargetUrl)!;
  }

  let gpxContent: string | null = null;
  const match = rawTargetUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || rawTargetUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (match && match[1]) {
    const fileId = match[1];
    const candidateUrls = [
      `https://drive.usercontent.google.com/download?id=${fileId}&export=download`,
      `https://drive.google.com/uc?export=download&id=${fileId}`,
      `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`,
      `https://docs.google.com/uc?export=download&id=${fileId}`,
    ];

    for (const cUrl of candidateUrls) {
      try {
        const response = await fetch(cUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
          },
          redirect: 'follow',
        });
        if (response.ok) {
          const candidateText = await response.text();
          if (candidateText.includes('<gpx') || candidateText.includes('<?xml')) {
            gpxContent = candidateText;
            break;
          }
        }
      } catch (candidateErr) {
        // Try next candidate URL
      }
    }
  }

  // Fallback direct fetch if not Google Drive or candidate failed
  if (!gpxContent) {
    try {
      const response = await fetch(rawTargetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        redirect: 'follow',
      });
      if (response.ok) {
        const directText = await response.text();
        if (directText.includes('<gpx') || directText.includes('<?xml')) {
          gpxContent = directText;
        }
      }
    } catch (err) {
      // Direct fetch failed
    }
  }

  if (gpxContent) {
    setGpxCache(rawTargetUrl, gpxContent);
  }

  return gpxContent;
}

// 1. Health check API
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// 2. GPX Proxy API: fetches exactly ONE requested GPX file on-demand
app.get('/api/gpx-proxy', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawTargetUrl = req.query.url as string;
    if (!rawTargetUrl) {
      res.status(400).send('Missing url parameter');
      return;
    }

    const gpxContent = await fetchGpxFromSource(rawTargetUrl);
    if (!gpxContent) {
      res.status(502).send('Failed to retrieve valid GPX data from URL');
      return;
    }

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(gpxContent);
  } catch (error) {
    console.error('GPX proxy error:', error);
    res.status(500).send('Error proxying GPX file');
  }
});

// 3. GPX Download API: attachment download for a single requested file
app.get('/api/gpx-download', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawTargetUrl = req.query.url as string;
    const filename = (req.query.filename as string) || 'track.gpx';
    if (!rawTargetUrl) {
      res.status(400).send('Missing url parameter');
      return;
    }

    const gpxContent = await fetchGpxFromSource(rawTargetUrl);
    if (!gpxContent) {
      res.status(502).send('Failed to retrieve valid GPX data for download');
      return;
    }

    res.setHeader('Content-Type', 'application/gpx+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.status(200).send(gpxContent);
  } catch (error) {
    console.error('GPX download proxy error:', error);
    res.status(500).send('Error preparing GPX download');
  }
});

async function startServer() {
  // Vite dev middleware or production static files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
