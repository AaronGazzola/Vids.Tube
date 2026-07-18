import { defineConfig } from "@playwright/test";

const PORT = process.env.PLAYWRIGHT_PORT ?? "3000";
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  // The platform has a single owner channel and a one-active-stream unique
  // index, so spec files must never run concurrently against the shared DB.
  workers: 1,
  use: { baseURL },
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
