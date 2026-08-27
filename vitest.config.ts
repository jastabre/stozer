import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Shared plugins + alias applied to each project (Vitest 4 projects mode).
const shared = {
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@": "./src",
    },
  },
};

export default defineConfig({
  test: {
    // Vitest 4 removed environmentMatchGlobs; route environments via projects.
    // Lib tests run under node (default); component/app tests run under jsdom.
    projects: [
      {
        ...shared,
        test: {
          name: "lib",
          environment: "node",
          include: ["src/lib/__tests__/**/*.test.ts"],
        },
      },
      {
        ...shared,
        test: {
          name: "components",
          environment: "jsdom",
          include: [
            "src/components/**/__tests__/**/*.test.ts",
            "src/components/**/__tests__/**/*.test.tsx",
          ],
        },
      },
      {
        ...shared,
        test: {
          name: "app",
          environment: "jsdom",
          include: [
            "src/app/**/__tests__/**/*.test.ts",
            "src/app/**/__tests__/**/*.test.tsx",
          ],
        },
      },
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
});
