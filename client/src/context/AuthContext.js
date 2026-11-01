import React, { createContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');

      // The token alone is enough; /auth/me returns the user.
      if (token) {
        try {
          const { data } = await api.get('/auth/me');
          setUser(data.user);
        } catch (error) {
          // Token expired or invalid
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  // A request was refused because the account lost (or never had) access.
  useEffect(() => {
    const onStatus = (e) => setUser((u) => (u && u.status !== e.detail ? { ...u, status: e.detail } : u));
    window.addEventListener('auth:status', onStatus);
    return () => window.removeEventListener('auth:status', onStatus);
  }, []);

  // Re-reads the account, e.g. to see whether an admin has granted access yet.
  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  }, []);

  const signup = useCallback(async (name, email, password) => {
    const { data } = await api.post('/auth/signup', { name, email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore errors
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    hasAccess: user?.status === 'active',
    isAdmin: user?.role === 'admin' && user?.status === 'active'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
