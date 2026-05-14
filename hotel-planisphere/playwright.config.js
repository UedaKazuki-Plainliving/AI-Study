const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'https://hotel-example-site.takeyaqa.dev/ja/',
    locale: 'ja-JP',
    headless: true,
  },
  workers: 1,
});
