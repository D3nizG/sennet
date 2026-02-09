import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, AuthResponse } from '../services/api';

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
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
    setLoading(false);
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

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('sennet_token');
    localStorage.removeItem('sennet_user');
  }, []);

  const updateUser = useCallback((data: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      localStorage.setItem('sennet_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
