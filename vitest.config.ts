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
    // The cyan page prints a one-line greeting to the console when it first mounts. Keep that one
    // line out of every file's output; the test that checks it spies on console.info itself.
    onConsoleLog: (log) => (log.startsWith("Hello. This page is built with") ? false : undefined),
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
