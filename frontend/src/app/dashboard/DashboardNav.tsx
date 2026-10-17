'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const navLinks = [
  { href: '/dashboard/plans', label: 'Plans' },
  { href: '/dashboard/content', label: 'Content' },
  { href: '/dashboard/subscribers', label: 'Subscribers' },
  { href: '/dashboard/earnings', label: 'Earnings' },
];

export default function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav>
      <ul style={styles.navList}>
        {navLinks.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <li key={href}>
              <Link
                href={href}
                style={isActive ? { ...styles.navLink, ...styles.navLinkActive } : styles.navLink}
                aria-current={isActive ? 'page' : undefined}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const styles = {
  navList: {
    listStyle: 'none',
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
    margin: 0,
  },
  navLink: {
    display: 'block',
    padding: '0.55rem 0.75rem',
    borderRadius: '8px',
    color: '#ccc',
    textDecoration: 'none',
    fontSize: '0.9rem',
    transition: 'background 0.15s',
  },
  navLinkActive: {
    background: '#1e1e40',
    color: '#a78bfa',
    fontWeight: 600,
  },
} as const;
