import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // In development, proxy API calls to the local backend
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // In development, proxy HLS segment requests to MediaMTX directly
      '/hls': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hls/, ''),
      },
    },
  },
});
