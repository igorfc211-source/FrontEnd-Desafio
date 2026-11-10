import { defineConfig } from '@playwright/test'

const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  workers: 2,
  retries: 0,
  timeout: 45_000,
  expect: {
    timeout: 7_000,
    toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.002 },
  },
  snapshotPathTemplate: '{testDir}/baselines/{projectName}/{arg}{ext}',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: 'chromium',
    baseURL: origin,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--force-color-profile=srgb'] },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'tablet',
      grep: /@visual|responsive layout/,
      use: { viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort',
        url: origin,
        reuseExistingServer: !process.env.CI,
      },
})
