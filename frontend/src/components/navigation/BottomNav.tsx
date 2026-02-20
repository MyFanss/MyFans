'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/creators', label: 'Creators', icon: '👥' },
  { href: '/subscribe', label: 'Subscribe', icon: '⭐' },
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderTop: '1px solid #e5e7eb', zIndex: 50 }} className="lg:hidden">
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.5rem 0.75rem', minHeight: '56px', minWidth: '44px', justifyContent: 'center', color: pathname === item.href ? '#0ea5e9' : '#6b7280' }}>
            <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
            <span style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
