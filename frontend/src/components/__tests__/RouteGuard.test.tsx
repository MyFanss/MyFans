import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const replaceMock = vi.fn();
const usePathnameMock = vi.fn();
const useSearchParamsMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => usePathnameMock(),
  useSearchParams: () => useSearchParamsMock(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

import { RouteGuard } from "../RouteGuard";

describe("RouteGuard", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    usePathnameMock.mockReset();
    useSearchParamsMock.mockReset();
    useAuthMock.mockReset();
  });

  it("redirects unauthenticated users from protected routes to sign-in", async () => {
    usePathnameMock.mockReturnValue("/dashboard");
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      hasStoredSession: false,
    });

    render(
      <RouteGuard>
        <div>Protected content</div>
      </RouteGuard>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        "/auth/sign-in?redirectTo=%2Fdashboard",
      );
    });
    expect(screen.getByText("Redirecting to sign in…")).toBeInTheDocument();
  });

  it("allows authenticated users to keep protected content visible", async () => {
    usePathnameMock.mockReturnValue("/settings");
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      hasStoredSession: false,
    });

    render(
      <RouteGuard>
        <div>Protected content</div>
      </RouteGuard>,
    );

    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects authenticated users away from the sign-in page to destination", async () => {
    usePathnameMock.mockReturnValue("/auth/sign-in");
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams("redirectTo=/profile"),
    );
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      hasStoredSession: false,
    });

    render(
      <RouteGuard>
        <div>Sign in screen</div>
      </RouteGuard>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/profile");
    });
  });

  it("shows loading state when authentication is pending for a protected route", () => {
    usePathnameMock.mockReturnValue("/profile");
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      hasStoredSession: false,
    });

    render(
      <RouteGuard>
        <div>Protected content</div>
      </RouteGuard>,
    );

    expect(screen.getByText("Checking authentication…")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
