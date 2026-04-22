'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Compass, Star, LayoutDashboard, Bell,
  Settings, User, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NetworkStatus from './NetworkStatus';
import {
  getPrimaryNav, SECONDARY_NAV, isNavActive,
  type NavItem, type NavRole,
} from './nav-config';

const ICONS: Record<string, React.ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>> = {
  Home, Compass, Star, LayoutDashboard, Bell, Settings, User,
};

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  role?: NavRole;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

function NavLink({
  item,
  pathname,
  collapsed = false,
}: {
  item: NavItem;
  pathname: string;
  collapsed?: boolean;
}) {
  const active = isNavActive(item.href, pathname, item.exact);
  const Icon = ICONS[item.icon];

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
        collapsed ? 'justify-center' : ''
      } ${
        active
          ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {Icon && <Icon size={20} aria-hidden="true" />}
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

export default function Sidebar({
  isOpen,
  onClose,
  role = 'fan',
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const primaryItems = getPrimaryNav(role);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-40 transition-all duration-300 ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className={`flex items-center h-16 border-b border-slate-200 dark:border-slate-800 px-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <Link href="/" className="text-xl font-bold text-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded">
              MyFans
            </Link>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          )}
        </div>

        {/* Primary nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Primary">
          {primaryItems.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} collapsed={isCollapsed} />
          ))}
        </nav>

        {/* Secondary nav + theme */}
        <div className="border-t border-slate-200 dark:border-slate-800 px-3 py-3 space-y-1">
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} collapsed={isCollapsed} />
          ))}
          {!isCollapsed && (
            <div className="px-3 py-2 opacity-80">
              <NetworkStatus />
            </div>
          )}
          <div className={`flex items-center mt-2 px-3 py-2 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isCollapsed && <span className="text-xs text-slate-500 dark:text-slate-400">Theme</span>}
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-40 flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Main navigation"
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between h-16 border-b border-slate-200 dark:border-slate-800 px-4">
          <Link href="/" className="text-xl font-bold text-sky-500" onClick={onClose}>
            MyFans
          </Link>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Primary">
          {primaryItems.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-800 px-3 py-3 space-y-1">
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
          <div className="px-3 py-2 opacity-80">
            <NetworkStatus />
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
}
