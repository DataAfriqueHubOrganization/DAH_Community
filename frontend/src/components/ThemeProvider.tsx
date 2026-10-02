"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "dah-theme";

/** Script exécuté avant le premier rendu (dans <head>) pour poser la classe
 *  .dark sans flash de thème clair. Doit rester autonome (pas d'import). */
export const themeInitScript = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // null tant que la préférence enregistrée n'est pas lue : la classe .dark posée
  // par themeInitScript fait foi jusque-là (évite un flash au montage).
  const [stored, setStored] = useState<ThemePreference | null>(null);
  const preference = stored ?? "system";
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    setStored(readPreference());
  }, []);

  useEffect(() => {
    if (stored === null) return;
    const apply = () => {
      const dark = preference === "dark" || (preference === "system" && systemPrefersDark());
      document.documentElement.classList.toggle("dark", dark);
      setResolved(dark ? "dark" : "light");
    };
    apply();
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [stored, preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    try {
      if (p === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* stockage indisponible : le choix vaut pour la session */
    }
    setStored(p);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme doit être utilisé sous <ThemeProvider>");
  return ctx;
}
