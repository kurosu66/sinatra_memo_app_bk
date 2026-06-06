import type { Metadata } from 'next';
import './globals.css';
import NavBar from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'Soccer Memo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-bg text-white min-h-screen">
        <NavBar />
        <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
