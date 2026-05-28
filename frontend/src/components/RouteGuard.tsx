"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const protectedRoutePatterns = [
  /^\/dashboard(\/|$)/,
  /^\/profile(\/|$)/,
  /^\/settings(\/|$)/,
  /^\/notifications(\/|$)/,
  /^\/subscriptions(\/|$)/,
  /^\/checkout(\/|$)/,
];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();

  const isAuthRoute = pathname.startsWith("/auth");
  const isProtectedRoute = protectedRoutePatterns.some((pattern) =>
    pattern.test(pathname),
  );

  const currentPath = useMemo(() => {
    const query = searchParams?.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const redirectPath = useMemo(() => {
    return searchParams?.get("redirectTo") || "/dashboard";
  }, [searchParams]);

  useEffect(() => {
    if (isLoading || isAuthRoute) return;
    if (isProtectedRoute && !isAuthenticated) {
      router.replace(
        `/auth/sign-in?redirectTo=${encodeURIComponent(currentPath)}`,
      );
    }
  }, [
    currentPath,
    isAuthRoute,
    isAuthenticated,
    isLoading,
    isProtectedRoute,
    router,
  ]);

  useEffect(() => {
    if (isLoading || !isAuthRoute) return;
    if (isAuthenticated) {
      router.replace(redirectPath);
    }
  }, [isAuthRoute, isAuthenticated, isLoading, redirectPath, router]);

  if ((isProtectedRoute || isAuthRoute) && isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 px-4 py-20">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <p className="text-lg font-semibold">Checking authentication…</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            We&apos;re verifying your wallet or session before continuing.
          </p>
        </div>
      </div>
    );
  }

  if (isProtectedRoute && !isAuthenticated && !isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 px-4 py-20">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <p className="text-lg font-semibold">Redirecting to sign in…</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            You need to sign in to view this page. Please wait while we take you
            there.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
