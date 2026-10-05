const THEME_KEY = "stozer-theme";

/**
 * Theme state helpers shared by the top-bar toggle and the account menu.
 * Theme is stored as a `data-theme` attribute on <html> and persisted in
 * localStorage. Default is light (no attribute).
 */

export function readTheme(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

export function applyTheme(dark: boolean) {
  if (dark) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    /* ignore */
  }
}

export function toggleTheme() {
  setTheme(!readTheme());
}

/** Explicitly set the theme and notify subscribers. */
export function setTheme(dark: boolean) {
  applyTheme(dark);
  notifyTheme();
}

const themeSubscribers = new Set<() => void>();

export function subscribeTheme(onChange: () => void) {
  themeSubscribers.add(onChange);
  return () => {
    themeSubscribers.delete(onChange);
  };
}

function notifyTheme() {
  themeSubscribers.forEach((cb) => cb());
}