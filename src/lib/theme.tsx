"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { readStorage, writeStorage } from "@/lib/storage";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Also read by the inline script in app/layout.tsx, which applies the
 *  saved theme before first paint. */
export const THEME_STORAGE_KEY = "faceaiid-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const loadedRef = useRef(false);

  useEffect(() => {
    // Deliberately deferred to an effect: localStorage is only available
    // client-side, so the first render must match the server ("system")
    // before this runs, avoiding a hydration mismatch. The <html> attribute
    // itself was already set before paint by the inline script in layout.
    const stored = readStorage(THEME_STORAGE_KEY);
    loadedRef.current = true;
    if (stored === "light" || stored === "dark" || stored === "system") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
      setThemeState(stored);
    }
  }, []);

  useEffect(() => {
    // Skip the pre-load render, which would briefly reset the attribute the
    // inline script applied back to "system".
    if (loadedRef.current) document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = (next: ThemeMode) => {
    setThemeState(next);
    writeStorage(THEME_STORAGE_KEY, next);
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
