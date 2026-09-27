/**
 * RouteGuard — client-side role enforcement.
 *
 * Wraps protected pages that require a specific role.  While the Next.js Edge
 * middleware (middleware.ts) guards against unauthenticated access, it cannot
 * perform a backend round-trip to check roles.  This component handles the
 * role check client-side by consuming UserContext.
 *
 * Behaviour:
 *   - Loading: renders null (no flash of protected content).
 *   - Unauthenticated: redirects to /auth/sign-in with returnUrl.
 *   - Wrong role (fan on creator route): redirects to /discover.
 *   - Correct role or no role restriction: renders children.
 *
 * Refs: #1828, #1829, ADR-001-role-model.md
 */
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/context/UserContext';

interface RouteGuardProps {
  /**
   * When true, only creator accounts (`is_creator: true`) are allowed.
   * Fan accounts are redirected to /discover.
   */
  requireCreator?: boolean;
  children: React.ReactNode;
}

export function RouteGuard({ requireCreator = false, children }: RouteGuardProps) {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      const signInUrl = `/auth/sign-in?returnUrl=${encodeURIComponent(pathname)}`;
      router.replace(signInUrl);
      return;
    }

    if (requireCreator && !user.is_creator) {
      // Fans attempting to open creator-only routes (e.g. /dashboard/earnings)
      // are redirected to their home — /discover.
      router.replace('/discover');
    }
  }, [user, loading, requireCreator, router, pathname]);

  if (loading) return null;
  if (!user) return null;
  if (requireCreator && !user.is_creator) return null;

  return <>{children}</>;
}
