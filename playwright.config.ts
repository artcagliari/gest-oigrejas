import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    timezoneId: "America/Sao_Paulo",
  },
  webServer: {
    command: "VITE_FORCE_DEMO=true npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
