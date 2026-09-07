import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function gpxProxyPlugin(): Plugin {
  return {
    name: 'gpx-proxy-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || (!req.url.startsWith('/api/gpx-proxy') && !req.url.startsWith('/api/gpx-download'))) {
          return next();
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        try {
          const urlObj = new URL(req.url, 'http://localhost:3000');
          const rawTargetUrl = urlObj.searchParams.get('url');
          const filename = urlObj.searchParams.get('filename') || 'activity.gpx';

          if (!rawTargetUrl) {
            res.statusCode = 400;
            res.end('Missing url parameter');
            return;
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
                // Continue to next candidate
              }
            }
          }

          if (!gpxContent) {
            // General direct fetch for any other raw target URL
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
              // Failed direct fetch
            }
          }

          if (!gpxContent) {
            res.statusCode = 502;
            res.end('Failed to retrieve valid GPX data from URL');
            return;
          }

          if (req.url.startsWith('/api/gpx-download')) {
            res.setHeader('Content-Type', 'application/gpx+xml; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          } else {
            res.setHeader('Content-Type', 'application/xml; charset=utf-8');
          }
          res.statusCode = 200;
          res.end(gpxContent);
        } catch (error) {
          console.error('GPX proxy error:', error);
          res.statusCode = 500;
          res.end('Error proxying GPX file');
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    base: './', // 追記
    plugins: [react(), tailwindcss(), gpxProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-leaflet': ['leaflet'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

