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
  loginUser: (data: AuthResponse) => void;
  logoutUser: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser) as AuthUser);
      } catch {
        // Corrupted storage — clear it
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
      }
    }
  }, []);

  const loginUser = useCallback((data: AuthResponse) => {
    const authUser: AuthUser = { userId: data.userId, username: data.username };
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('authUser', JSON.stringify(authUser));
    setToken(data.token);
    setUser(authUser);
  }, []);

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
    <AuthContext.Provider value={{ user, token, isAuthenticated, loginUser, logoutUser }}>
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
