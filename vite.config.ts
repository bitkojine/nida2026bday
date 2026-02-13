import { defineConfig } from 'vite';

function getVilniusBuildStamp(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('lt-LT', {
    timeZone: 'Europe/Vilnius',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const pick = (type: string): string => parts.find((part) => part.type === type)?.value ?? '00';
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')}`;
}

export default defineConfig({
  base: '/nida2026bday/',
  define: {
    __BUILD_VILNIUS_TIME__: JSON.stringify(getVilniusBuildStamp()),
  },
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
