import { resolveUserId } from "@/lib/auth-storage";

const API_BASE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")
    : "http://localhost:3000";

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

function authHeaders(): HeadersInit {
  const id = resolveUserId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (id) {
    headers["Authorization"] = `Bearer ${id}`;
    headers["X-User-Id"] = id;
  }
  return headers;
}

export async function fetchMe(): Promise<MeResponse> {
  const res = await fetch(`${API_BASE}/users/me`, {
    method: "GET",
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `GET /users/me failed: ${res.status}`);
  }
  return res.json() as Promise<MeResponse>;
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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `PATCH /users/me failed: ${res.status}`);
  }
  return res.json() as Promise<MeResponse>;
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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `PATCH /creators/me failed: ${res.status}`);
  }
  return res.json();
}
