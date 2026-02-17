"use client";

import { createContext, useContext, useLayoutEffect, useEffect, useState, useCallback, type ReactNode } from "react";
import { themes, type ThemeId, type ThemeTokens } from "./themes";

export type ColorMode = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: ThemeId;
  colorMode: ColorMode;
  resolvedMode: "light" | "dark";
  setTheme: (t: ThemeId) => void;
  setColorMode: (m: ColorMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function applyTokens(tokens: ThemeTokens) {
  const el = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    el.style.setProperty(`--th-${camelToKebab(key)}`, value as string);
  }
}

function resolveSystemMode(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function loadPref<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeRaw] = useState<ThemeId>(() => loadPref("cp-theme", "modern" as ThemeId));
  const [colorMode, setColorModeRaw] = useState<ColorMode>(() => loadPref("cp-mode", "system" as ColorMode));
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(() =>
    colorMode === "system" ? resolveSystemMode() : colorMode as "light" | "dark"
  );

  const setTheme = useCallback((t: ThemeId) => {
    setThemeRaw(t);
    try { localStorage.setItem("cp-theme", t); } catch {}
  }, []);

  const setColorMode = useCallback((m: ColorMode) => {
    setColorModeRaw(m);
    try { localStorage.setItem("cp-mode", m); } catch {}
  }, []);

  // Resolve system preference
  useEffect(() => {
    function resolve() {
      setResolvedMode(colorMode === "system" ? resolveSystemMode() : (colorMode as "light" | "dark"));
    }
    resolve();
    if (colorMode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", resolve);
      return () => mq.removeEventListener("change", resolve);
    }
  }, [colorMode]);

  // Apply tokens to DOM
  useIsoLayoutEffect(() => {
    const tokens = themes[theme][resolvedMode];
    applyTokens(tokens);
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-mode", resolvedMode);
  }, [theme, resolvedMode]);

  return (
    <ThemeContext.Provider value={{ theme, colorMode, resolvedMode, setTheme, setColorMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
