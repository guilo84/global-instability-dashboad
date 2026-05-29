import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 1. Fix the Pre-Bundling Error: Drop 'lodash' since it's handled via recharts
  optimizeDeps: {
    include: ['recharts']
  },
  // 2. Fix the Empty Map: Proxy development API traffic to the FastAPI server
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
