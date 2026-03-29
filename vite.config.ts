import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist') || id.includes('pdf-lib')) {
            return 'pdf-runtime';
          }

          if (id.includes('svgo')) {
            return 'svg-runtime';
          }

          if (id.includes('@jsquash/jpeg')) {
            return 'jpeg-runtime';
          }

          if (id.includes('@jsquash/oxipng')) {
            return 'png-lossless-runtime';
          }

          if (id.includes('upng-js') || id.includes('pako')) {
            return 'png-lossy-runtime';
          }

          if (id.includes('jszip')) {
            return 'zip-runtime';
          }

          if (id.includes('browser-image-compression')) {
            return 'browser-fallback-runtime';
          }
        },
      },
    },
  },
});
