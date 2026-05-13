const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 15000,
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL || 'http://43.207.67.234:3000',
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'test-report' }],
  ],
});
