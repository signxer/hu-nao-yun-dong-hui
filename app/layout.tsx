import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '胡闹运动会 · Magical Athlete',
  description: 'A private web prototype of the chaotic racing board game.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
