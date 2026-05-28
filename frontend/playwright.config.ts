import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command:
      'NEXT_PUBLIC_MYFANS_TOKEN_CONTRACT_ID=CC3KRIRFHMF5U2HEQBDDOL5OZUZ3SOJJIJE7EHFP3C6SJLONGJE4WNFF ' +
      'NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID=CDV2DF2BV3R7UM4LPETP77DAERE4DYX3FLC7HRVJV3KVHON7ZGLFLQ4U ' +
      'NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID=CC3KRIRFHMF5U2HEQBDDOL5OZUZ3SOJJIJE7EHFP3C6SJLONGJE4WNFF ' +
      'NEXT_PUBLIC_CONTENT_ACCESS_CONTRACT_ID=CDV2DF2BV3R7UM4LPETP77DAERE4DYX3FLC7HRVJV3KVHON7ZGLFLQ4U ' +
      'NEXT_PUBLIC_EARNINGS_CONTRACT_ID=CC3KRIRFHMF5U2HEQBDDOL5OZUZ3SOJJIJE7EHFP3C6SJLONGJE4WNFF ' +
      'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
