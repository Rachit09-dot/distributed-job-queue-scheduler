import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { getMe } from '../services/auth.service';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('jq_token');
    if (storedToken) {
      setToken(storedToken);
      getMe()
        .then((u) => setUser(u))
        .catch(() => {
          localStorage.removeItem('jq_token');
          localStorage.removeItem('jq_user');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback((u: User, t: string) => {
    localStorage.setItem('jq_token', t);
    localStorage.setItem('jq_user', JSON.stringify(u));
    setUser(u);
    setToken(t);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('jq_token');
    localStorage.removeItem('jq_user');
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, logout, isAdmin: user?.role === 'ADMIN' }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
