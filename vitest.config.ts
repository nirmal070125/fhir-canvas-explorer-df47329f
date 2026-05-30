import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Kept separate from vite.config.ts so the TanStack Router plugin (which scans
// routes and generates code) doesn't run during unit tests. We only need the
// React transform and the "@/..." path alias here.
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
