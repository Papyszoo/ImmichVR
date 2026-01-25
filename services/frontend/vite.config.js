import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo';
  const baseUrl = process.env.VITE_BASE_URL || '/';

  return {
    base: baseUrl,
    plugins: [
      react()
    ],
    resolve: {
      alias: {
        three: path.resolve(__dirname, 'node_modules/three'),
      },
    },
    server: {
      port: 3000,
      host: true,
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
    },
    build: {
      outDir: 'build',
      sourcemap: true,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
      css: true,
    },
    define: {
      'import.meta.env.VITE_DEMO_MODE': isDemo,
      'import.meta.env.VITE_BASE_URL': JSON.stringify(baseUrl),
    }
  }
})
