import { fileURLToPath } from 'node:url'
import { createReadStream, existsSync, readdirSync, copyFileSync, mkdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const imagesDir = fileURLToPath(new URL('images', import.meta.url))

const imgMime = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

function rootImagesPlugin() {
  return {
    name: 'root-images',
    configureServer(server) {
      server.middlewares.use('/images', (req, res, next) => {
        const file = join(imagesDir, req.url.split('?')[0])
        if (!existsSync(file)) return next()
        const type = imgMime[extname(file).toLowerCase()] ?? 'application/octet-stream'
        res.setHeader('Content-Type', type)
        createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      if (!existsSync(imagesDir)) return
      const dist = join(fileURLToPath(new URL('.', import.meta.url)), 'dist', 'images')
      mkdirSync(dist, { recursive: true })
      for (const file of readdirSync(imagesDir)) {
        copyFileSync(join(imagesDir, file), join(dist, file))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), rootImagesPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
      },
    },
  },
})
