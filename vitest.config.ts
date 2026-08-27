import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    environmentMatchGlobs: [
      // Component / app tests render with jsdom; lib tests run under node.
      ["src/components/**/__tests__/**/*.test.ts", "jsdom"],
      ["src/components/**/__tests__/**/*.test.tsx", "jsdom"],
      ["src/app/**/__tests__/**/*.test.ts", "jsdom"],
      ["src/app/**/__tests__/**/*.test.tsx", "jsdom"],
    ],
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "src/lib/__tests__/**/*.test.ts",
      "src/components/**/__tests__/**/*.test.ts",
      "src/components/**/__tests__/**/*.test.tsx",
      "src/app/**/__tests__/**/*.test.ts",
      "src/app/**/__tests__/**/*.test.tsx",
    ],
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
});
