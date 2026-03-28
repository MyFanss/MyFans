'use client';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import Hamburger from './Hamburger';
import Breadcrumbs from './Breadcrumbs';

export default function NavLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <Hamburger isOpen={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} />
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 30 }}
          className="lg:hidden"
          onClick={() => setSidebarOpen(false)}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
      <div style={{ paddingBottom: '5rem' }} className="lg:ml-64 lg:pb-0">
        <main style={{ padding: '1rem' }} className="lg:p-8">
          <Breadcrumbs />
          {children}
        </main>
      </div>
      <BottomNav />
    </>
  );
}
