'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Compass, Star, LayoutDashboard, Bell, Settings,
} from 'lucide-react';
import { getBottomNav, isNavActive, type NavRole, type NavItem } from './nav-config';

const ICONS: Record<string, React.ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>> = {
  Home, Compass, Star, LayoutDashboard, Bell, Settings,
};

interface BottomNavProps {
  role?: NavRole;
}

function BottomNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavActive(item.href, pathname, item.exact);
  const Icon = ICONS[item.icon];

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      aria-label={item.label}
      className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[56px] min-w-[44px] px-1 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset ${
        active
          ? 'text-sky-600 dark:text-sky-400'
          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
      }`}
    >
      {Icon && <Icon size={22} aria-hidden="true" />}
      <span>{item.label}</span>
    </Link>
  );
}

export default function BottomNav({ role = 'fan' }: BottomNavProps) {
  const pathname = usePathname();
  const items = getBottomNav(role);

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 safe-area-inset-bottom"
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch">
        {items.map((item) => (
          <BottomNavItem key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}
