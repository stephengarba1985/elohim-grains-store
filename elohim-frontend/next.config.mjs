import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const backendRoot = apiUrl.replace(/\/api\/?$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "elohimgrains.com" },
      { protocol: "https", hostname: "www.elohimgrains.com" },
      { protocol: "https", hostname: "**.railway.app" },
      { protocol: "https", hostname: "**.vercel.app" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: `${backendRoot}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
