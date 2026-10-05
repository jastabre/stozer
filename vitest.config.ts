import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Shared plugins + alias applied to each project (Vitest 4 projects mode).
// The alias must be absolute: a relative value is re-resolved from the
// importing file, which breaks imports that live a few directories deep.
const shared = {
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
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
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/lib/__tests__/**/*.test.ts"],
        },
      },
      {
        ...shared,
        test: {
          name: "components",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
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
          setupFiles: ["./vitest.setup.ts"],
          include: [
            "src/app/**/__tests__/**/*.test.ts",
            "src/app/**/__tests__/**/*.test.tsx",
          ],
        },
      },
    ],
  },
});
