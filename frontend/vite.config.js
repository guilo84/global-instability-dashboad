import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Add this block to force CommonJS resolution
  optimizeDeps: {
    include: ['recharts', 'lodash']
  }
})
