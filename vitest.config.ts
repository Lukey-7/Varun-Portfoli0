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
  },
  resolve: {
    alias: {
      "@site": path.resolve(__dirname, "./src/sites/cyan"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
