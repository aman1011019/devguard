import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeChoice = "light" | "dark" | "system";
const STORAGE_KEY = "devguard.theme";

type ThemeContextValue = {
  /** What the user picked. */
  choice: ThemeChoice;
  /** What is actually on screen right now. */
  resolved: "light" | "dark";
  setChoice: (next: ThemeChoice) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const readChoice = (): ThemeChoice => {
  return "light";
};

function apply() {
  const root = document.documentElement;
  root.classList.remove("dark");
  root.classList.add("light");
  root.dataset.theme = "light";
  root.style.colorScheme = "light";
  const color = "#f8fafc";
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", color));
}

/**
 * Pure light mode theme provider. Ensures DevGuard renders with a crisp,
 * modern enterprise light palette across all routes and devices.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice] = useState<ThemeChoice>("light");

  useEffect(() => {
    apply();
    try {
      localStorage.setItem(STORAGE_KEY, "light");
    } catch {
      /* private mode */
    }
  }, []);

  const setChoice = useCallback((_next: ThemeChoice) => {
    apply();
  }, []);

  const toggle = useCallback(() => {
    apply();
  }, []);

  const value = useMemo(
    () => ({ choice: "light" as ThemeChoice, resolved: "light" as const, setChoice, toggle }),
    [setChoice, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
