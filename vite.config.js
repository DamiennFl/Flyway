import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Serves data-build/publish at /data in dev, with the same headers the files need on Azure.
function serveLocalData() {
  const root = path.resolve('data-build/publish')
  return {
    name: 'serve-local-data',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const file = path.join(root, decodeURIComponent(req.url.split('?')[0]))
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next()
        res.setHeader('Content-Type', 'application/json')
        if (file.endsWith('.gz')) res.setHeader('Content-Encoding', 'gzip')
        fs.createReadStream(file).pipe(res)
      })
    },
  }
}

// On damienf.com, /api/flyway/recent/<region>/<species>/ is a Django view that calls eBird with a server-side
// key. In development this answers the same address by calling eBird directly with the key from .env.
// It lives only in the dev server, so the key is never part of a built app.
const RECENT_SIGHTINGS = /^\/api\/flyway\/recent\/([^/]+)\/([^/]+)\/?$/

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), serveLocalData()],
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },
    server: {
      proxy: {
        '/api/flyway/recent': {
          target: 'https://api.ebird.org',
          changeOrigin: true,
          headers: { 'X-eBirdApiToken': env.EBIRD_API_KEY ?? env.VITE_EBIRD_API_KEY ?? '' },
          rewrite: (url) => url.replace(RECENT_SIGHTINGS, '/v2/data/obs/$1/recent/$2?back=30&maxResults=10000'),
        },
      },
    },
    test: {
      environment: 'node',
      globals: true,
      setupFiles: ['./src/test/setup.js'],
    },
  }
})
