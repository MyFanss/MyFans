"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { fetchMe } from "@/lib/api/profile";
import { isFlowFinished, STEP_ORDER, type OnboardingStep } from "@/lib/onboarding-types";

const protectedRoutePatterns = [
  /^\/dashboard(\/|$)/,
  /^\/profile(\/|$)/,
  /^\/settings(\/|$)/,
  /^\/notifications(\/|$)/,
  /^\/subscriptions(\/|$)/,
  /^\/checkout(\/|$)/,
];

// The creator dashboard is a creator-only area (see DashboardLayout's
// "Creator Dashboard" header): a fan account must not be able to open it,
// and a creator whose onboarding isn't finished must be sent back to finish
// it rather than seeing an incomplete/broken dashboard.
const creatorOnlyRoutePatterns = [/^\/dashboard(\/|$)/];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();

  const isAuthRoute = pathname.startsWith("/auth");
  const isProtectedRoute = protectedRoutePatterns.some((pattern) =>
    pattern.test(pathname),
  );
  const isCreatorOnlyRoute = creatorOnlyRoutePatterns.some((pattern) =>
    pattern.test(pathname),
  );

  // Gates the creator dashboard: fans are redirected away, and creators who
  // haven't finished onboarding are sent back to finish it. Best-effort —
  // if we can't resolve the profile (e.g. wallet-only fan bearer with no
  // `/users/me` access) we fail open rather than lock out a real creator.
  const [roleGateChecked, setRoleGateChecked] = useState(false);
  const [roleGateRedirect, setRoleGateRedirect] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !isCreatorOnlyRoute) {
      setRoleGateChecked(true);
      setRoleGateRedirect(null);
      return;
    }

    let cancelled = false;
    setRoleGateChecked(false);
    (async () => {
      try {
        const me = await fetchMe();
        if (cancelled) return;

        if (!me.is_creator) {
          setRoleGateRedirect("/discover");
          return;
        }

        const state = me.onboarding_state;
        const completed = (state?.completedSteps ?? []).filter((s): s is OnboardingStep =>
          (STEP_ORDER as string[]).includes(s),
        );
        const skipped = (state?.skippedSteps ?? []).filter((s): s is OnboardingStep =>
          (STEP_ORDER as string[]).includes(s),
        );
        if (!isFlowFinished(completed, skipped)) {
          setRoleGateRedirect("/onboarding");
          return;
        }

        setRoleGateRedirect(null);
      } catch {
        // Can't verify — fail open.
        if (!cancelled) setRoleGateRedirect(null);
      } finally {
        if (!cancelled) setRoleGateChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isCreatorOnlyRoute, isLoading, pathname]);

  useEffect(() => {
    if (roleGateRedirect) {
      router.replace(roleGateRedirect);
    }
  }, [roleGateRedirect, router]);

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

  if (isCreatorOnlyRoute && isAuthenticated && (!roleGateChecked || roleGateRedirect)) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 px-4 py-20">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <p className="text-lg font-semibold">Checking your account…</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            The creator dashboard is only available to creators who have
            finished onboarding.
          </p>
        </div>
      </div>
    );
  }

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
