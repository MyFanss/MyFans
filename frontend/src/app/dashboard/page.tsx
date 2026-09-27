/**
 * Creator dashboard — /dashboard
 *
 * Creator-only route.  RouteGuard redirects fan accounts to /discover.
 *
 * Refs: #1828, ADR-001-role-model.md §3
 */
'use client';

import { RouteGuard } from '@/components/RouteGuard';
import { useUser } from '@/context/UserContext';

export default function DashboardPage() {
  const { user } = useUser();

  return (
    <RouteGuard requireCreator>
      <main className="dashboard-page">
        <h1 className="dashboard-page__title">Creator Dashboard</h1>
        {user && (
          <p className="dashboard-page__welcome">
            Welcome back, {user.displayName ?? user.username ?? 'creator'}.
          </p>
        )}

        <nav aria-label="Dashboard sections" className="dashboard-page__nav">
          <ul>
            <li><a href="/dashboard/earnings">Earnings</a></li>
            <li><a href="/dashboard/subscribers">Subscribers</a></li>
            <li><a href="/dashboard/content">Content</a></li>
            <li><a href="/dashboard/plans">Plans</a></li>
          </ul>
        </nav>
      </main>
    </RouteGuard>
  );
}
