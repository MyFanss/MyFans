'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/creators', label: 'Creators', icon: '👥' },
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/notifications', label: 'Alerts', icon: '🔔' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50 }} className="lg:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.5rem 0.75rem', minHeight: '56px', minWidth: '44px', justifyContent: 'center' }} className={pathname === item.href ? 'text-sky-500 dark:text-sky-400' : 'text-gray-500 dark:text-gray-400'}>
            <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
            <span style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
