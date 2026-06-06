'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavBar() {
  const path = usePathname();
  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={
        path.startsWith(href)
          ? 'text-white font-medium'
          : 'text-muted hover:text-white transition-colors'
      }
    >
      {label}
    </Link>
  );

  return (
    <nav className="bg-bg2 border-b border-white/10 px-4 py-3 flex items-center gap-6">
      <span className="text-accent font-bold text-lg mr-2">⚽ Soccer Memo</span>
      {link('/matches', '試合')}
      {link('/players', '選手')}
    </nav>
  );
}
