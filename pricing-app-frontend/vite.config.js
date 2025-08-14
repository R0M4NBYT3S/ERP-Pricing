// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy ALL /api requests to the backend on :3001
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        // no rewrite: we want /api to stay /api on the target
      },
    },
  },
});
