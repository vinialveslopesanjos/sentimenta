/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require("next-intl/plugin");
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const API_BASE = process.env.API_URL || "http://127.0.0.1:8000";

const nextConfig = {
  poweredByHeader: false,
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
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://www.googletagmanager.com https://www.clarity.ms https://*.clarity.ms",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://sentimenta.com.br https://api.sentimenta.com.br https://accounts.google.com https://*.clarity.ms",
      "frame-src 'self' https://accounts.google.com",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
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
