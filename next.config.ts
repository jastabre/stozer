import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // D-13 server-side import sends the uploaded file through a Server Action;
  // the default 1MB body limit silently truncates larger rosters. Raising to
  // 4mb here matches the cap applied in parseUploadAction (which rejects
  // >2 MB files with a user-facing error before parsing) — the config is the
  // ceiling, the action is the enforced guard (02-RESEARCH.md Pattern 5).
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  // exceljs dynamically requires native Node modules (stream, etc.) — keep it
  // external from the bundler so it runs natively in the Node runtime
  // (02-RESEARCH.md pattern 5: exceljs streaming in server actions/route
  // handlers). csv-parse is pure JS and bundles fine.
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
