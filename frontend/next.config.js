/** @type {import('next').NextConfig} */
const API_BASE = process.env.API_URL || "http://127.0.0.1:8000";

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.instagram.com" },
      { protocol: "https", hostname: "**.ytimg.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
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

module.exports = nextConfig;
