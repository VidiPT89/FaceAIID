"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

interface DebugModeContextValue {
  debugMode: boolean;
  toggle: () => void;
}

const DebugModeContext = createContext<DebugModeContextValue | null>(null);

const STORAGE_KEY = "faceaiid-debug-mode";

/** Off by default: the raw per-frame numbers (thumb angle, pinch ratio,
 *  expression scores) are useful for diagnosing a specific gesture that
 *  won't classify right, but clutter the view for normal use — this makes
 *  them opt-in instead of always-on. */
export function DebugModeProvider({ children }: { children: React.ReactNode }) {
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    // Deliberately deferred to an effect: localStorage is only available
    // client-side, so the first render must match the server (off) before
    // this runs, avoiding a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDebugMode(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const toggle = () => {
    setDebugMode((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const value = useMemo<DebugModeContextValue>(() => ({ debugMode, toggle }), [debugMode]);

  return <DebugModeContext.Provider value={value}>{children}</DebugModeContext.Provider>;
}

export function useDebugMode() {
  const ctx = useContext(DebugModeContext);
  if (!ctx) throw new Error("useDebugMode must be used within DebugModeProvider");
  return ctx;
}
