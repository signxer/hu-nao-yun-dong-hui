import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '胡闹运动会',
  description: '一场怪诞、热闹、充满反转的在线桌游竞速小游戏。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
