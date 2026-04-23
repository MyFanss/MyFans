'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import Breadcrumbs from './Breadcrumbs';
import type { NavRole } from './nav-config';

const COLLAPSE_KEY = 'nav-sidebar-collapsed';

interface NavLayoutProps {
  children: ReactNode;
  role?: NavRole;
}

export default function NavLayout({ children, role = 'fan' }: NavLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Restore collapse preference
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSE_KEY);
    if (stored !== null) setCollapsed(stored === 'true');
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_KEY, String(next));
  };

  const sidebarWidth = collapsed ? 72 : 256;

  // Close sidebar with Escape key for keyboard users
  useEffect(() => {
    if (!sidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  return (
    <>
      {/* Skip to content — visible on focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-sky-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          aria-label="Open navigation menu"
          aria-expanded={sidebarOpen}
          aria-controls="mobile-sidebar"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <span className="text-base font-bold text-sky-500">MyFans</span>
      </header>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={role}
        isCollapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />

      {/* Page content */}
      <div
        className="lg:transition-all lg:duration-300"
        style={{ paddingLeft: `${sidebarWidth}px` }}
      >
        {/* On mobile, account for top bar height */}
        <main
          id="main-content"
          className="min-h-screen px-4 pb-24 pt-16 lg:px-8 lg:pb-8 lg:pt-6"
          tabIndex={-1}
        >
          <Breadcrumbs />
          {children}
        </main>
      </div>

      <BottomNav role={role} />
    </>
  );
}
