import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Server Actions default to 1 MB. The import action rejects files over
      // 2 MB before parsing, while this remains the framework ceiling.
      bodySizeLimit: "4mb",
    },
  },
  // exceljs uses Node's native stream/zip runtime and must not be bundled.
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
