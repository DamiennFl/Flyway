import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
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

export default defineConfig({
  plugins: [react(), serveLocalData()],
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
})
