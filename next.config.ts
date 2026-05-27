import type { NextConfig } from "next";
import { DEMO_AUTH_SECRET } from "./lib/auth/auth-env";

const isProd = process.env.NODE_ENV === "production";

function resolveBuildAuthUrl(): string {
  if (process.env.NEXTAUTH_URL?.trim()) {
    return process.env.NEXTAUTH_URL.trim().replace(/\/$/, "");
  }
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) {
    return productionHost.startsWith("http")
      ? productionHost.replace(/\/$/, "")
      : `https://${productionHost}`;
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim()}`;
  }
  return "http://localhost:3000";
}

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  env: {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || DEMO_AUTH_SECRET,
    NEXTAUTH_URL: resolveBuildAuthUrl(),
  },
  compiler: {
    removeConsole: isProd ? { exclude: ["error", "warn"] } : false,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  allowedDevOrigins: ["172.23.160.1"],
  experimental: {
    proxyClientMaxBodySize: "55mb",
  },
};

export default nextConfig;
