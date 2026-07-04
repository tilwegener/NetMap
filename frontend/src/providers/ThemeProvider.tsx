import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { storageKeys, readString, writeString } from "../utils/storage";

export type Theme = "light" | "dark";

type ThemeApi = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeCtx = createContext<ThemeApi | null>(null);

export function useTheme(): ThemeApi {
  const api = useContext(ThemeCtx);
  if (!api) throw new Error("useTheme must be used inside <ThemeProvider>");
  return api;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return readString(storageKeys.theme) === "light" ? "light" : "dark";
  });

  useEffect(() => {
    writeString(storageKeys.theme, theme);
    document.body.classList.toggle("theme-dark", theme === "dark");
  }, [theme]);

  const api = useMemo<ThemeApi>(() => ({
    theme,
    toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
  }), [theme]);

  return <ThemeCtx.Provider value={api}>{children}</ThemeCtx.Provider>;
}
