/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

/**
 * Vitest läuft NUR für die reine Logik-Engine (B0–B5, B1) unter src/engine.
 * Diese Module sind framework-unabhängig und brauchen kein DOM — die schnelle
 * Node-Umgebung genügt (B1/B5 nutzen Mocks bzw. Fake-Timer). Die Angular-App
 * selbst wird separat über `ng build` gebaut.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/engine/**/*.test.ts'],
  },
});
