import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Full-page renders in jsdom can take several seconds when files run in parallel.
    testTimeout: 15000,
    // Node 25+ ships its own localStorage, which hides jsdom's; switch it off in the test workers.
    poolOptions: { forks: { execArgv: ["--no-experimental-webstorage"] } },
  },
  resolve: {
    alias: {
      // Tests run as a build without CV_PASSPHRASE; they make their own vaults.
      "virtual:cv-vault": path.resolve(__dirname, "./src/test/fixtures/cv-vault.ts"),
      "@site": path.resolve(__dirname, "./src/sites/cyan"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
