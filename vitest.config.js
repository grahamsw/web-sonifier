import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    include: ['**/*.test.js', '**/*.spec.js'],
    exclude: ['**/node_modules/**', '**/.git/**']
  },
  resolve: {
    alias: {
      '@web-sonifier/core': path.resolve(__dirname, 'packages/core/src/index.js'),
      '@web-sonifier/wind': path.resolve(__dirname, 'packages/wind/src/index.js'),
      '@web-sonifier/rain': path.resolve(__dirname, 'packages/rain/src/index.js'),
      '@web-sonifier/ocean': path.resolve(__dirname, 'packages/ocean/src/index.js'),
      '@web-sonifier/chime': path.resolve(__dirname, 'packages/chime/src/index.js'),
      '@web-sonifier/bubble': path.resolve(__dirname, 'packages/bubble/src/index.js'),
      '@web-sonifier/eno-bed': path.resolve(__dirname, 'packages/eno-bed/src/index.js'),
      '@web-sonifier/eno-texture': path.resolve(__dirname, 'packages/eno-texture/src/index.js'),
      '@web-sonifier/eno-figure': path.resolve(__dirname, 'packages/eno-figure/src/index.js'),
      '@web-sonifier/mallet': path.resolve(__dirname, 'packages/mallet/src/index.js'),
      '@web-sonifier/purr': path.resolve(__dirname, 'packages/purr/src/index.js'),
      '@web-sonifier/vosc': path.resolve(__dirname, 'packages/vosc/src/index.js'),
      '@web-sonifier/engine': path.resolve(__dirname, 'packages/engine/src/index.js')
    }
  }
})
