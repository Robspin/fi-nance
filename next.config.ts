import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'exceljs'],
  allowedDevOrigins: ['192.168.3.31'],
};

export default nextConfig;
