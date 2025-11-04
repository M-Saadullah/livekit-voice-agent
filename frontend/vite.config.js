import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {}  // prevent undefined reference errors
  },
  server: {
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      }
    }
  }
})
