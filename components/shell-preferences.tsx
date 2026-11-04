"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Preferences = { theme: "dark" | "light"; collapsed: boolean };
type ShellPreferences = Preferences & {
  toggleTheme: () => void;
  toggleSidebar: () => void;
};

export const PREFERENCES_KEY = "outliaz-ui-v1";
const DEFAULTS: Preferences = { theme: "dark", collapsed: false };
const Context = createContext<ShellPreferences | null>(null);

// The root layout runs the same tiny preference reader before first paint.
// Store appearance only; prospect records and credentials never belong here.
function apply(preferences: Preferences) {
  const root = document.documentElement;
  root.classList.toggle("dark", preferences.theme === "dark");
  root.dataset.theme = preferences.theme;
  root.dataset.sidebar = preferences.collapsed ? "collapsed" : "expanded";
}

export function ShellPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    const root = document.documentElement;
    setPreferences({
      theme: root.dataset.theme === "light" ? "light" : "dark",
      collapsed: root.dataset.sidebar === "collapsed",
    });

    function sync(event: StorageEvent) {
      if (event.key !== PREFERENCES_KEY) return;
      try {
        const value = JSON.parse(event.newValue ?? "null");
        const next: Preferences = {
          theme: value?.theme === "light" ? "light" : "dark",
          collapsed: value?.collapsed === true,
        };
        apply(next);
        setPreferences(next);
      } catch {
        // A corrupt preference is not a reason to lose the current session.
      }
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function update(next: Preferences) {
    apply(next);
    setPreferences(next);
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
    } catch {
      // Appearance still works for this tab when browser storage is blocked.
    }
  }

  return (
    <Context.Provider
      value={{
        ...preferences,
        toggleTheme: () =>
          update({
            ...preferences,
            theme: preferences.theme === "dark" ? "light" : "dark",
          }),
        toggleSidebar: () =>
          update({ ...preferences, collapsed: !preferences.collapsed }),
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useShellPreferences() {
  const value = useContext(Context);
  if (!value) throw new Error("ShellPreferencesProvider is required");
  return value;
}
