'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

/** Human-readable overrides for path segments */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  creators: 'Creators',
  creator: 'Creator',
  discover: 'Discover',
  subscriptions: 'Subscriptions',
  subscribe: 'Subscribe',
  notifications: 'Notifications',
  settings: 'Settings',
  profile: 'Profile',
  earnings: 'Earnings',
  content: 'Content',
  plans: 'Plans',
  subscribers: 'Subscribers',
  checkout: 'Checkout',
  onboarding: 'Onboarding',
};

function toLabel(segment: string): string {
  return SEGMENT_LABELS[segment.toLowerCase()] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  // Don't render on the homepage
  if (segments.length === 0) return null;

  const crumbs = segments.map((seg: string, i: number) => ({
    href: '/' + segments.slice(0, i + 1).join('/'),
    label: toLabel(seg),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex items-center gap-1 text-sm"
    >
      <ol className="flex items-center gap-1 flex-wrap">
        <li>
          <Link
            href="/"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors min-h-[44px] inline-flex items-center"
          >
            Home
          </Link>
        </li>
        {crumbs.map((crumb: { href: string; label: string; isLast: boolean }) => (
          <li key={crumb.href} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-slate-400 dark:text-slate-600 shrink-0" aria-hidden="true" />
            {crumb.isLast ? (
              <span
                className="text-slate-900 dark:text-slate-100 font-medium min-h-[44px] inline-flex items-center"
                aria-current="page"
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors min-h-[44px] inline-flex items-center"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
