"use client";

import * as React from "react";

const THEME_STORAGE_KEY = "fondoseg-theme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

type ThemeProviderProps = {
  attribute?: "class";
  children: React.ReactNode;
  defaultTheme?: Theme;
  disableTransitionOnChange?: boolean;
  enableSystem?: boolean;
};

type ThemeContextValue = {
  resolvedTheme: ResolvedTheme | undefined;
  setTheme: (theme: Theme | ((currentTheme: Theme) => Theme)) => void;
  systemTheme: ResolvedTheme | undefined;
  theme: Theme;
  themes: Theme[];
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function normalizeTheme(theme: string | null | undefined, enableSystem: boolean, fallbackTheme: Theme): Theme {
  if (theme === "light" || theme === "dark") {
    return theme;
  }

  if (enableSystem && theme === "system") {
    return "system";
  }

  if (fallbackTheme === "system" && !enableSystem) {
    return "light";
  }

  return fallbackTheme;
}

function resolveTheme(theme: Theme, enableSystem: boolean, systemTheme: ResolvedTheme | undefined): ResolvedTheme {
  if (theme === "system") {
    if (enableSystem && systemTheme) {
      return systemTheme;
    }

    return "light";
  }

  return theme;
}

function applyTheme(theme: ResolvedTheme, attribute: "class") {
  const root = document.documentElement;

  if (attribute === "class") {
    root.classList.toggle("dark", theme === "dark");
  }

  root.style.colorScheme = theme;
}

export function ThemeProvider({
  attribute = "class",
  children,
  defaultTheme = "system",
  disableTransitionOnChange = false,
  enableSystem = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() =>
    normalizeTheme(undefined, enableSystem, defaultTheme),
  );
  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme | undefined>(undefined);

  React.useEffect(() => {
    const nextSystemTheme = getSystemTheme();
    setSystemTheme(nextSystemTheme);

    try {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      setThemeState(normalizeTheme(storedTheme, enableSystem, defaultTheme));
    } catch {
      setThemeState(normalizeTheme(undefined, enableSystem, defaultTheme));
    }
  }, [defaultTheme, enableSystem]);

  const resolvedTheme = React.useMemo(
    () => resolveTheme(theme, enableSystem, systemTheme),
    [theme, enableSystem, systemTheme],
  );

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(MEDIA_QUERY);

    const syncSystemTheme = (event?: MediaQueryListEvent) => {
      const nextMatches = event?.matches ?? mediaQuery.matches;
      const nextSystemTheme = nextMatches ? "dark" : "light";
      setSystemTheme(nextSystemTheme);
    };

    syncSystemTheme();
    mediaQuery.addEventListener("change", syncSystemTheme);

    return () => {
      mediaQuery.removeEventListener("change", syncSystemTheme);
    };
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    const previousTransition = root.style.transition;

    if (disableTransitionOnChange) {
      root.style.transition = "none";
    }

    applyTheme(resolvedTheme, attribute);

    if (disableTransitionOnChange) {
      window.requestAnimationFrame(() => {
        root.style.transition = previousTransition;
      });
    }
  }, [attribute, disableTransitionOnChange, resolvedTheme]);

  const setTheme = React.useCallback(
    (value: Theme | ((currentTheme: Theme) => Theme)) => {
      setThemeState((currentTheme) => {
        const nextTheme = normalizeTheme(
          typeof value === "function" ? value(currentTheme) : value,
          enableSystem,
          defaultTheme,
        );

        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        } catch {
          // Ignore storage errors so theme switching still works in-memory.
        }

        return nextTheme;
      });
    },
    [defaultTheme, enableSystem],
  );

  const contextValue = React.useMemo<ThemeContextValue>(
    () => ({
      resolvedTheme,
      setTheme,
      systemTheme,
      theme,
      themes: enableSystem ? ["light", "dark", "system"] : ["light", "dark"],
    }),
    [enableSystem, resolvedTheme, setTheme, systemTheme, theme],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}

export const themeScript = `
(() => {
  try {
    const storageKey = "${THEME_STORAGE_KEY}";
    const mediaQuery = "${MEDIA_QUERY}";
    const root = document.documentElement;
    const storedTheme = window.localStorage.getItem(storageKey);
    const systemTheme = window.matchMedia(mediaQuery).matches ? "dark" : "light";
    const theme = storedTheme === "light" || storedTheme === "dark" || storedTheme === "system"
      ? storedTheme
      : "system";
    const resolvedTheme = theme === "system" ? systemTheme : theme;

    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
  } catch {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
  }
})();
`;
