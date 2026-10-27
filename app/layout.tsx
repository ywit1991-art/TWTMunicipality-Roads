import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import './globals.css';

const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-thai',
  display: 'swap',
});

// ⭐ ตั้งค่าสีแถบด้านบนของมือถือ
export const viewport: Viewport = {
  themeColor: '#1e3a8a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// ⭐ ตั้งค่าข้อมูลแอปสำหรับ iOS และระบบอื่นๆ
export const metadata: Metadata = {
  title: 'ระบบสำรวจแผนพัฒนาหมู่บ้าน',
  description: 'เทศบาลตำบลท่าวังทอง อำเภอเมืองพะเยา จังหวัดพะเยา (พย.11)',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'สำรวจแผน',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icon-192x192.png',
    apple: '/icon-192x192.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${notoSansThai.variable} font-sans antialiased text-slate-800 bg-slate-50`}>
        {children}
      </body>
    </html>
  );
}