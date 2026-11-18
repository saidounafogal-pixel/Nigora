import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
    locale: 'fr-FR',
    timezoneId: 'Africa/Niamey',
    geolocation: { latitude: 13.5116, longitude: 2.1254, accuracy: 25 },
    permissions: ['geolocation', 'notifications'],
    launchOptions: {
      executablePath: process.env.CHROME_PATH || undefined,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
  },
  webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 120000 },
})
