import { defineConfig, devices } from '@playwright/test';

const webServerCommand =
  process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ?? 'npm run dev -- --host 127.0.0.1 --port 4173';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  expect: {
    timeout: 7_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'iphone-12-pro-max',
      use: {
        browserName: 'webkit',
        ...devices['iPhone 12 Pro Max'],
      },
    },
    {
      name: 'iphone-15-pro',
      use: {
        browserName: 'webkit',
        ...devices['iPhone 15 Pro'],
      },
    },
    {
      name: 'desktop-chromium',
      use: {
        browserName: 'chromium',
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
