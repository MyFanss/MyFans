/**
 * UserContext — global authenticated user state.
 *
 * Provides the current user record (or null when unauthenticated) and a
 * `refreshUser` helper so any component can trigger a re-fetch after an
 * onboarding step or profile update.
 *
 * Refs: #1828 (role persistence), ADR-001-role-model.md
 */
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

interface UserContextValue {
  user: User | null;
  loading: boolean;
  /** Re-fetch /users/me and update the context. */
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  refreshUser: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    setLoading(true);
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      setUser(null);
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
