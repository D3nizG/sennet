import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { api, AuthResponse } from '../services/api';
import { emitLogout } from '../services/socket';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  username: string;
  displayName: string;
  houseColor: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// True right after Supabase redirects back from Google, before it has
// consumed the code/tokens from the URL. Used to keep the loading screen up
// instead of flashing the login form while the exchange is still pending.
function hasPendingOAuthRedirect(): boolean {
  return (
    window.location.hash.includes('access_token=') ||
    window.location.search.includes('code=')
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('sennet_token');
    const storedUser = localStorage.getItem('sennet_user');
    if (stored && storedUser) {
      setToken(stored);
      setUser(JSON.parse(storedUser));
    }
    // If a Google redirect is in flight, leave loading on — the auth-state
    // listener below will resolve it once the exchange finishes (success or
    // failure), so the login form never gets a chance to flash on screen.
    if (!hasPendingOAuthRedirect()) {
      setLoading(false);
    }
  }, []);

  const handleAuth = useCallback((res: AuthResponse) => {
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('sennet_token', res.token);
    localStorage.setItem('sennet_user', JSON.stringify(res.user));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    handleAuth(res);
  }, [handleAuth]);

  const register = useCallback(async (username: string, password: string, displayName: string) => {
    const res = await api.register(username, password, displayName);
    handleAuth(res);
  }, [handleAuth]);

  // Kick off the Google OAuth flow. This redirects the browser to Google and
  // back to our origin; the redirect is handled by the listener below.
  const loginWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Google sign-in is not configured');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  // When the browser returns from Google, Supabase parses the tokens from the
  // URL and fires an auth event. We exchange that Supabase access token for our
  // own first-party session, then drop the Supabase session (we don't use it
  // beyond this handshake).
  const exchangingRef = useRef(false);
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Already have a first-party session, or an exchange is in flight.
      if (localStorage.getItem('sennet_token') || exchangingRef.current) return;
      if (!session?.access_token) {
        // Nothing to exchange (no redirect pending, or it failed before a
        // session was established) — stop blocking on the loading screen.
        setLoading(false);
        return;
      }
      exchangingRef.current = true;
      setLoading(true);
      try {
        const res = await api.googleAuth(session.access_token);
        handleAuth(res);
      } catch (err) {
        window.dispatchEvent(
          new CustomEvent('auth:google-error', {
            detail: (err as Error)?.message || 'Google sign-in failed',
          }),
        );
      } finally {
        await supabase!.auth.signOut();
        exchangingRef.current = false;
        setLoading(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [handleAuth]);

  const logout = useCallback(() => {
    // Notify the server while the socket is still connected so it ends any
    // active game / lobby / queue immediately. The disconnect that follows
    // (triggered by token → null in SocketContext) happens on a later tick,
    // giving this emit time to flush.
    emitLogout();
    setToken(null);
    setUser(null);
    localStorage.removeItem('sennet_token');
    localStorage.removeItem('sennet_user');
  }, []);

  useEffect(() => {
    const handle = () => logout();
    window.addEventListener('auth:unauthorized', handle);
    return () => window.removeEventListener('auth:unauthorized', handle);
  }, [logout]);

  const updateUser = useCallback((data: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      localStorage.setItem('sennet_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, loginWithGoogle, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
