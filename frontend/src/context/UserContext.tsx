'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { fetchMe, type User } from '@/lib/users-api';

/**
 * UserContext — global authenticated user state.
 *
 * Provides the current user record (or null when unauthenticated) and a
 * `refreshUser` helper so any component can trigger a re-fetch after an
 * onboarding step or profile update.
 *
 * Refs: #1828 (role persistence), ADR-001-role-model.md
 */
interface UserContextValue {
  user: User | null;
  loading: boolean;
  /**
   * Re-fetch /users/me, update the context, and resolve with the fresh
   * user record (or `null` on failure/unauthenticated) so callers that
   * need the just-refreshed value — e.g. to pick a post-auth redirect
   * destination — don't have to issue a second /users/me request of
   * their own.
   */
  refreshUser: () => Promise<User | null>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  refreshUser: async () => null,
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    setLoading(true);
    try {
      const me = await fetchMe();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  return (
    <UserContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  return useContext(UserContext);
}
