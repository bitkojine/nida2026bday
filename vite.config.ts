import { defineConfig } from 'vite';

export default defineConfig({
  base: '/nida2026bday/',
  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'coverage/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/core/timingCalculator.ts',
        'src/core/scoreSystem.ts',
        'src/core/errorTranslator.ts',
        'src/core/inputController.ts',
        'src/core/dedicationBanner.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 90,
      },
    },
  },
});
