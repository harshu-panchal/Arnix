import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  use: {
    baseURL: process.env.PW_BASE_URL || "http://localhost:5173",
    headless: true,
    viewport: { width: 1280, height: 720 },
    // Many delivery screens rely on location; provide a stable geolocation in CI/smoke runs.
    permissions: ["geolocation"],
    geolocation: { latitude: 22.7196, longitude: 75.8577 }, // Indore (approx)
  },
  reporter: [["line"]],
});
