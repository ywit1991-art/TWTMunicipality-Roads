import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // ⭐ ปิด Strict Mode เพื่อไม่ให้เรนเดอร์ซ้ำซ้อน
  swcMinify: true,
};

export default nextConfig;