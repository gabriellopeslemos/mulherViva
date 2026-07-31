import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],

    server: {
      port: 5173,
      // Proxying /api in development keeps the browser on a single origin, so
      // CORS never enters the picture locally. Set VITE_API_URL='' to use it.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/health': { target: apiTarget, changeOrigin: true },
      },
    },

    preview: { port: 4173 },

    build: {
      // Source maps would publish readable source for the whole app.
      sourcemap: false,
      target: 'es2020',
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('index.html', import.meta.url)),
        },
        output: {
          // Split the large third-party dependencies out of the entry chunk.
          // They change rarely, so visitors keep them cached across deploys
          // instead of re-downloading them with every app update.
          // Rolldown (Vite 8) only accepts the function form here.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
              return 'react'
            }
            if (id.includes('framer-motion') || id.includes('motion-dom')) {
              return 'motion'
            }
            return 'vendor'
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
  }
})
