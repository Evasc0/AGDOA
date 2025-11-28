import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist', // <- this is default, but be explicit
    rollupOptions: {
      output: {
        manualChunks: {
          chartjs: ['chart.js', 'react-chartjs-2'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['chart.js', 'react-chartjs-2'],
  },
});
