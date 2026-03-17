/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require("next-intl/plugin");
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const API_BASE = process.env.API_URL || "http://127.0.0.1:8000";

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.instagram.com" },
      { protocol: "https", hostname: "**.ytimg.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async redirects() {
    return [
      { source: "/app", destination: "/dashboard", permanent: true },
      { source: "/app/:path*", destination: "/dashboard/:path*", permanent: true },
      { source: "/connect", destination: "/dashboard/connect", permanent: true },
      { source: "/logs", destination: "/dashboard/logs", permanent: true },
      { source: "/compare", destination: "/dashboard/analysis", permanent: true },
      { source: "/alerts", destination: "/dashboard/alerts", permanent: true },
      { source: "/settings", destination: "/dashboard/settings", permanent: true },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_BASE}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${API_BASE}/health`,
      },
      {
        source: "/docs",
        destination: `${API_BASE}/docs`,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
