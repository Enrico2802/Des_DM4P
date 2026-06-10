/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Phase-1/2 logic (B0,B2,B3,B4,B5) is pure and has no DOM dependency, so the
    // fast Node environment is enough. B1/B5 tests use mocks / fake timers.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
