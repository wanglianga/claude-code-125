import './globals.css';

export const metadata = {
  title: '校服订购与售后平台',
  description: '校园校服订购、尺码试穿、生产发放与售后换码一体化平台',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
