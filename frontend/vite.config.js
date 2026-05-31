import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['recharts']
  },
  server: {
    // Whitelist your Cloudflare domain to bypass the strict host check
    allowedHosts: ['dashboard.polykratia.com'], 
    proxy: {
      '/api/v1/kalshi': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        secure: false
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
