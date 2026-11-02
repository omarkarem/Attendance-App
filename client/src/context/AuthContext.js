import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import api, { ACT_AS_KEY, readActAs } from '../utils/api';

export const AuthContext = createContext(null);

// How often a focused tab may re-read the account (team requests, access changes).
const FOCUS_REFRESH_MS = 30 * 1000;

const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem(ACT_AS_KEY);
};

// The stored account to work in, if it still belongs to this user and is still allowed.
const validActAs = (user) => {
  const stored = readActAs();
  if (!stored || !user || stored.userId !== user.id) return null;
  const ws = (user.workspaces || []).find((w) => w.id === stored.id);
  return ws ? { userId: user.id, id: ws.id, name: ws.name, email: ws.email, access: ws.access, relation: ws.relation } : null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [actingAs, setActingAs] = useState(null);
  const [loading, setLoading] = useState(true);
  const actingRef = useRef(null);
  actingRef.current = actingAs;

  // Keeps the account being worked in consistent with what the server allows.
  const applyUser = useCallback((next) => {
    setUser(next);
    const act = validActAs(next);
    if (act) localStorage.setItem(ACT_AS_KEY, JSON.stringify(act));
    else localStorage.removeItem(ACT_AS_KEY);
    const prev = actingRef.current;
    if (prev && !act) toast.error(`You no longer have access to ${prev.name}'s account`);
    setActingAs(act);
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');

      // The token alone is enough; /auth/me returns the user.
      if (token) {
        try {
          const { data } = await api.get('/auth/me');
          applyUser(data.user);
        } catch (error) {
          // Token expired or invalid
          clearSession();
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [applyUser]);

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
    applyUser(data.user);
    return data.user;
  }, [applyUser]);

  // Access to a team account was taken away while it was open.
  useEffect(() => {
    const onDenied = () => refreshUser().catch(() => {});
    window.addEventListener('auth:actas-denied', onDenied);
    return () => window.removeEventListener('auth:actas-denied', onDenied);
  }, [refreshUser]);

  // Coming back to the tab picks up new team requests and access changes.
  useEffect(() => {
    if (!user) return undefined;
    let last = Date.now();
    const onFocus = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < FOCUS_REFRESH_MS) return;
      last = Date.now();
      refreshUser().catch(() => {});
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, refreshUser]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    applyUser(data.user);
    return data;
  }, [applyUser]);

  const signup = useCallback(async (name, email, password) => {
    const { data } = await api.post('/auth/signup', { name, email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    applyUser(data.user);
    return data;
  }, [applyUser]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore errors
    }
    clearSession();
    setActingAs(null);
    setUser(null);
  }, []);

  // Work in a team coach's account (null = your own). Every coaching page then shows
  // and changes that account's data.
  const switchAccount = useCallback((workspace) => {
    if (!workspace || workspace.id === user?.id) {
      localStorage.removeItem(ACT_AS_KEY);
      setActingAs(null);
      return;
    }
    const act = {
      userId: user.id,
      id: workspace.id,
      name: workspace.name,
      email: workspace.email,
      access: workspace.access,
      relation: workspace.relation
    };
    localStorage.setItem(ACT_AS_KEY, JSON.stringify(act));
    setActingAs(act);
  }, [user]);

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    refreshUser,
    actingAs,
    switchAccount,
    viewOnly: actingAs?.access === 'view',
    isAuthenticated: !!user,
    hasAccess: user?.status === 'active',
    isAdmin: user?.role === 'admin' && user?.status === 'active',
    financeAccess: !!user?.financeAccess
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
