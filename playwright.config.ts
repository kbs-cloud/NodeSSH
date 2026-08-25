import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
    video: 'off',
  },
  webServer: [
    {
      command: 'npm run dev --prefix server',
      port: 3001,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev --prefix client',
      port: 5173,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
