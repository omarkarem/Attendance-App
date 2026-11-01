import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useAuth from '../hooks/useAuth';
import {
  createStopwatch, start, stop, lap, reset, isRunning, nextColor, nextName, sanitize,
  MAX_STOPWATCHES, MAX_NAME_LENGTH, TAG_COLORS
} from '../utils/stopwatch';

const StopwatchContext = createContext(null);

const DEFAULT_NAME = 'Stopwatch';

const storageKey = (userId) => `attendtrack.stopwatches.${userId}`;

const read = (key) => {
  try {
    return sanitize(JSON.parse(localStorage.getItem(key)));
  } catch {
    return null;
  }
};

const write = (key, session) => {
  try {
    if (session) localStorage.setItem(key, JSON.stringify(session));
    else localStorage.removeItem(key);
  } catch {
    // Private mode or full storage: the stopwatches still work until the page closes.
  }
};

/**
 * Keeps the screen on while a stopwatch runs, so a phone on the pool deck does not lock
 * mid-set. Silently does nothing where the Wake Lock API is missing.
 */
const useWakeLock = (active) => {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.wakeLock) return undefined;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) next.release().catch(() => {});
        else lock = next;
      } catch {
        // Low battery mode or a denied permission.
      }
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      lock?.release().catch(() => {});
    };
  }, [active]);
};

/**
 * One stopwatch session per coach, kept in localStorage until the coach closes it.
 * Every action reads the clock at the moment of the tap, and other open tabs follow along.
 */
export const StopwatchProvider = ({ children }) => {
  const { user } = useAuth();
  const key = user?.id ? storageKey(user.id) : null;
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null);

  useEffect(() => {
    const loaded = key ? read(key) : null;
    sessionRef.current = loaded;
    setSession(loaded);
    if (!key) return undefined;
    const onStorage = (e) => {
      if (e.key !== key && e.key !== null) return;
      const next = read(key);
      sessionRef.current = next;
      setSession(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  const commit = useCallback((updater) => {
    const next = updater(sessionRef.current);
    if (next === sessionRef.current) return;
    sessionRef.current = next;
    setSession(next);
    if (key) write(key, next);
  }, [key]);

  // Applies fn to the stopwatches with the given ids (all of them when ids is null).
  const mapWatches = useCallback((ids, fn) => commit((s) => {
    if (!s) return s;
    const now = Date.now();
    const pick = ids ? new Set(ids) : null;
    return { ...s, watches: s.watches.map((w) => (!pick || pick.has(w.id) ? fn(w, now) : w)) };
  }), [commit]);

  const actions = useMemo(() => ({
    open: (count = 1) => commit(() => {
      const watches = [];
      const n = Math.max(1, Math.min(MAX_STOPWATCHES, count));
      for (let i = 0; i < n; i += 1) {
        watches.push(createStopwatch(n === 1 ? DEFAULT_NAME : nextName(watches), nextColor(watches)));
      }
      return { watches, openedAt: Date.now() };
    }),
    close: () => commit(() => null),
    add: () => {
      let id = null;
      commit((s) => {
        let watches = s?.watches || [];
        if (watches.length >= MAX_STOPWATCHES) return s;
        // A lone stopwatch still on its default name becomes Lane 1 once it has company.
        if (watches.length === 1 && watches[0].name === DEFAULT_NAME) watches = [{ ...watches[0], name: 'Lane 1' }];
        const w = createStopwatch(nextName(watches), nextColor(watches));
        id = w.id;
        return { openedAt: s?.openedAt || Date.now(), watches: [...watches, w] };
      });
      return id;
    },
    remove: (id) => commit((s) => {
      if (!s) return s;
      const watches = s.watches.filter((w) => w.id !== id);
      return watches.length ? { ...s, watches } : null;
    }),
    edit: (id, { name, color }) => mapWatches([id], (w) => ({
      ...w,
      name: (name || '').trim().slice(0, MAX_NAME_LENGTH) || w.name,
      color: TAG_COLORS.some((c) => c.value === color) ? color : w.color
    })),
    start: (id) => mapWatches([id], start),
    stop: (id) => mapWatches([id], stop),
    lap: (id) => mapWatches([id], lap),
    reset: (id) => mapWatches([id], (w) => reset(w)),
    // One timestamp for every stopwatch, so lanes started together read exactly the same.
    startAll: () => mapWatches(null, start),
    stopAll: () => mapWatches(null, stop),
    resetAll: () => mapWatches(null, (w) => reset(w))
  }), [commit, mapWatches]);

  const watches = session?.watches;
  const runningCount = watches ? watches.filter(isRunning).length : 0;
  useWakeLock(runningCount > 0);

  const value = useMemo(() => ({
    watches: watches || [],
    hasSession: !!watches,
    openedAt: session?.openedAt || null,
    runningCount,
    ...actions
  }), [watches, session, runningCount, actions]);

  return <StopwatchContext.Provider value={value}>{children}</StopwatchContext.Provider>;
};

export const useStopwatches = () => {
  const ctx = useContext(StopwatchContext);
  if (!ctx) throw new Error('useStopwatches must be used inside StopwatchProvider');
  return ctx;
};
