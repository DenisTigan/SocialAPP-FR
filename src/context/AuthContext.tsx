import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { AuthResponse } from '../types/api';
import { unsubscribePush } from '../api/notifications';

interface AuthUser {
  userId: string;
  username: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  /** True only during the very first render while localStorage is being read.
   *  ProtectedRoute must wait for this to be false before making any redirect
   *  decision, to prevent a flash-to-/login on deep-link navigation. */
  isLoading: boolean;
  loginUser: (data: AuthResponse) => void;
  logoutUser: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Synchronous localStorage hydration helpers ────────────────────────────────
// These run inside useState lazy initialisers so the FIRST render already has
// the correct auth state — no useEffect delay, no flash of /login.

function readStoredToken(): string | null {
  return localStorage.getItem('authToken');
}

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem('authUser');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    // Corrupted JSON — remove it so we don't keep trying
    localStorage.removeItem('authUser');
    localStorage.removeItem('authToken');
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // ── Lazy initialisers run synchronously — first render already correct ──────
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [user,  setUser]  = useState<AuthUser | null>(readStoredUser);

  // isLoading is false from the very first render because we hydrated above.
  // We keep it in state (not a plain const) so future async-validation use cases
  // (e.g. token refresh) can flip it back to true without an API change.
  const [isLoading, setIsLoading] = useState(false);

  // ── Optional: detect storage corruption where token exists but user doesn't ─
  // e.g. someone manually edited localStorage. Clear both and stay logged out.
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser  = localStorage.getItem('authUser');
    const hasToken = Boolean(storedToken);
    const hasUser  = Boolean(storedUser);

    if (hasToken !== hasUser) {
      // Inconsistent — clear everything
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      setToken(null);
      setUser(null);
    }

    // Always mark loading as complete after this check (in case a subclass
    // changes this to async validation, this is the correct place to settle).
    setIsLoading(false);
  }, []);

  // ── loginUser ─────────────────────────────────────────────────────────────
  const loginUser = useCallback((data: AuthResponse) => {
    const authUser: AuthUser = { userId: data.userId, username: data.username };
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('authUser', JSON.stringify(authUser));
    setToken(data.token);
    setUser(authUser);
  }, []);

  // ── logoutUser ────────────────────────────────────────────────────────────
  const logoutUser = useCallback(() => {
    // Step 1: Clean up push subscription for this device before clearing auth.
    // This prevents the next person logging in on the same device from receiving
    // notifications intended for this user.
    // Wrapped in try/catch and async IIFE so we never block logout if it fails.
    (async () => {
      try {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await unsubscribePush(sub.endpoint);
            await sub.unsubscribe();
          }
        }
      } catch {
        // Never block logout — silently ignore errors
      }
    })();

    // Step 2: Clear credentials
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = token !== null && user !== null;

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, isLoading, loginUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook for convenient access
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
