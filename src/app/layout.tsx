import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = {
  title: '校园校服订购与售后换码平台',
  description: '试穿、订购、生产、发放、换码补发退款全流程协同平台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Nav />
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
