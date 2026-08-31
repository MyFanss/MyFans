import { resolveAuthToken, clearStoredAuthToken } from "@/lib/auth-storage";
import { getApiBaseUrl } from "@/lib/api/base-url";

const API_BASE = getApiBaseUrl();

export type ServerOnboardingState = {
  currentStep?: string;
  completedSteps?: string[];
  skippedSteps?: string[];
  intent?: 'creator' | 'fan' | 'both' | null;
  updatedAt?: string;
};

export type MeResponse = {
  id: string;
  email: string;
  is_creator: boolean;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  website_url: string | null;
  x_handle: string | null;
  instagram_handle: string | null;
  other_url: string | null;
  onboarding_state?: ServerOnboardingState | null;
  creator: {
    id: string;
    bio: string | null;
    subscription_price: string;
    currency: string;
    banner_url: string | null;
    is_verified: boolean;
    followers_count: number;
  } | null;
};

export class ProfileUnauthorizedError extends Error {
  readonly status = 401;

  constructor(message = "Session expired. Please sign in again.") {
    super(message);
    this.name = "ProfileUnauthorizedError";
  }
}

function authHeaders(): HeadersInit {
  const token = resolveAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function handleProfileResponse<T>(res: Response, label: string): Promise<T> {
  if (res.status === 401) {
    clearStoredAuthToken();
    throw new ProfileUnauthorizedError();
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `${label} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchMe(): Promise<MeResponse> {
  const res = await fetch(`${API_BASE}/users/me`, {
    method: "GET",
    headers: authHeaders(),
    cache: "no-store",
  });
  return handleProfileResponse<MeResponse>(res, "GET /users/me");
}

export type PatchUserBody = Partial<{
  display_name: string;
  username: string;
  avatar_url: string;
  website_url: string;
  x_handle: string;
  instagram_handle: string;
  other_url: string;
}>;

export async function patchMe(body: PatchUserBody): Promise<MeResponse> {
  const res = await fetch(`${API_BASE}/users/me`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return handleProfileResponse<MeResponse>(res, "PATCH /users/me");
}

export type PatchOnboardingBody = Partial<{
  currentStep: string;
  completedSteps: string[];
  skippedSteps: string[];
  intent: string;
  updatedAt: string;
}>;

export async function patchMyOnboarding(
  body: PatchOnboardingBody,
): Promise<MeResponse> {
  const res = await fetch(`${API_BASE}/users/me/onboarding`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return handleProfileResponse<MeResponse>(res, "PATCH /users/me/onboarding");
}

export type PatchCreatorBody = Partial<{
  bio: string;
  subscription_price: number;
  currency: "XLM" | "USDC";
  banner_url: string;
}>;

export async function patchCreatorMe(
  body: PatchCreatorBody
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/creators/me`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return handleProfileResponse(res, "PATCH /creators/me");
}
