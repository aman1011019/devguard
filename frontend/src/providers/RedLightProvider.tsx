import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface RedLightContextType {
  redLightMode: boolean;
  toggleRedLightMode: () => void;
  setRedLightMode: (val: boolean) => void;
}

const RedLightContext = createContext<RedLightContextType | undefined>(undefined);

const STORAGE_KEY = "devguard_red_light_mode";

export function RedLightProvider({ children }: { children: ReactNode }) {
  const [redLightMode, setRedLightModeState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(redLightMode));
      if (redLightMode) {
        document.documentElement.classList.add("red-light-mode");
      } else {
        document.documentElement.classList.remove("red-light-mode");
      }
    } catch {
      // ignore
    }
  }, [redLightMode]);

  const toggleRedLightMode = () => setRedLightModeState((prev) => !prev);
  const setRedLightMode = (val: boolean) => setRedLightModeState(val);

  return (
    <RedLightContext.Provider value={{ redLightMode, toggleRedLightMode, setRedLightMode }}>
      {children}
    </RedLightContext.Provider>
  );
}

export function useRedLight(): RedLightContextType {
  const ctx = useContext(RedLightContext);
  if (!ctx) {
    throw new Error("useRedLight must be used within a RedLightProvider");
  }
  return ctx;
}
