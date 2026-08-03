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
