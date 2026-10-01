import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // While auth state is being determined, render nothing (blank screen for a
  // single frame). This prevents a flash-redirect to /login before the
  // synchronous localStorage hydration in AuthContext has settled.
  // In practice isLoading is false on the very first render because AuthContext
  // now uses lazy useState initialisers, so this branch is almost never taken.
  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
