import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // ⭐ บังคับให้ Root คือโฟลเดอร์ที่โปรเจกต์นี้อยู่จริงๆ
    root: process.cwd(),
  },
};

export default nextConfig;