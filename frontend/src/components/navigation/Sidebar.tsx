'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './../../components/ThemeToggle';

const navItems = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/creators', label: 'Creators', icon: '👥' },
  { href: '/subscribe', label: 'Subscribe', icon: '⭐' },
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
];

export default function Sidebar({ isOpen }: { isOpen: boolean }) {
  const pathname = usePathname();

  return (
    <aside style={{ transform: isOpen ? 'translateX(0)' : 'translateX(-100%)' }} className="fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-transform lg:translate-x-0 z-40">
      <div className="flex flex-col h-full">
        <div style={{ padding: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0ea5e9' }}>MyFans</h1>
        </div>
        <nav style={{ padding: '0 1rem' }} className="flex-1">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '0.5rem', minHeight: '44px', backgroundColor: pathname === item.href ? '#e0f2fe' : 'transparent' }} className={pathname === item.href ? 'dark:!bg-sky-900/30' : 'dark:hover:bg-gray-800'}>
              <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
              <span className="text-gray-900 dark:text-gray-100">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

