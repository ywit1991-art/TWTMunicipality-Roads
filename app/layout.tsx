import type { Metadata } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import './globals.css';

const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-thai',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ระบบสารสนเทศข้อมูลถนนท้องถิ่น - เทศบาลตำบลท่าวังทอง',
  description:
    'ระบบสารสนเทศข้อมูลถนนท้องถิ่น เทศบาลตำบลท่าวังทอง อำเภอเมืองพะเยา จังหวัดพะเยา (พย.11)',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${notoSansThai.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}