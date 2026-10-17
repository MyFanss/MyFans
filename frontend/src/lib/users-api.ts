export interface User {
  id: string;
  username: string;
  email: string;
}

/** Fetch the currently authenticated user. */
export async function fetchMe(): Promise<User | null> {
  const res = await fetch('/api/me', { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`);
  return res.json();
}
