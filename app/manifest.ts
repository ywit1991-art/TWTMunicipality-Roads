import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ระบบสำรวจแผนพัฒนาหมู่บ้าน',
    short_name: 'สำรวจแผน',
    description: 'ระบบสำรวจแผนพัฒนา เทศบาลตำบลท่าวังทอง (พย.11)',
    start_url: '/',
    display: 'standalone', // ⭐ ทำให้เปิดแอปแบบเต็มจอ ไม่มีแถบเบราว์เซอร์
    background_color: '#f8fafc',
    theme_color: '#1e3a8a', // ⭐ สีเดียวกับ Header ของเรา (สีน้ำเงินเข้ม)
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}