import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: [
      'db38-175-156-136-71.ngrok-free.app'
    ],
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
});
