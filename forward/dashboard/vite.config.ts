/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// No network access beyond this origin: no fonts, telemetry or CDNs. Added to the
// production build only, because the dev server injects an inline refresh preamble.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";

const csp = {
  name: 'revforge-csp',
  apply: 'build' as const,
  transformIndexHtml: (html: string) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
};

// Relative base so the production build also works from any static folder.
export default defineConfig({
  base: './',
  plugins: [react(), csp],
  server: { port: 5180, strictPort: false },
  preview: { port: 5181, strictPort: false },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 60000,
    hookTimeout: 120000,
    pool: 'forks',
  },
});
