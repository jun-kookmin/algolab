export const ADMIN_REMEMBER_KEY = "adminRememberedUsername";
const ADMIN_REMEMBER_COOKIE = "adminRememberedUsername";
const ADMIN_REMEMBER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 6개월
let memoryFallback = "";

const readCookie = (name: string): string => {
  if (typeof document === "undefined") return "";
  const target = `${name}=`;
  const cookies = document.cookie.split(";");

  for (const raw of cookies) {
    const c = raw.trim();
    if (!c.startsWith(target)) continue;
    const value = c.slice(target.length);
    return decodeURIComponent(value);
  }
  return "";
};

const writeCookie = (name: string, value: string, maxAgeSeconds: number) => {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
};

const removeCookie = (name: string) => {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
};

export const getStoredAdminUsername = (): string => {
  if (typeof window === "undefined") return "";

  try {
    const fromLocalStorage = window.localStorage.getItem(ADMIN_REMEMBER_KEY);
    if (fromLocalStorage) {
      const trimmed = fromLocalStorage.trim();
      if (trimmed) return trimmed;
    }
  } catch {
    // ignore
  }

  try {
    const fromSessionStorage = window.sessionStorage.getItem(ADMIN_REMEMBER_KEY);
    if (fromSessionStorage) {
      const trimmed = fromSessionStorage.trim();
      if (trimmed) return trimmed;
    }
  } catch {
    // ignore
  }

  const fromCookie = readCookie(ADMIN_REMEMBER_COOKIE).trim();
  if (fromCookie) return fromCookie;
  return memoryFallback;
};

export const setStoredAdminUsername = (username: string): void => {
  if (typeof window === "undefined") return;
  const value = username.trim();
  if (!value) {
    clearStoredAdminUsername();
    return;
  }

  try {
    window.localStorage.setItem(ADMIN_REMEMBER_KEY, value);
  } catch {
    // ignore
  }
  try {
    window.sessionStorage.setItem(ADMIN_REMEMBER_KEY, value);
  } catch {
    // ignore
  }
  writeCookie(ADMIN_REMEMBER_COOKIE, value, ADMIN_REMEMBER_COOKIE_MAX_AGE_SECONDS);
  memoryFallback = value;
};

export const clearStoredAdminUsername = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ADMIN_REMEMBER_KEY);
  } catch {
    // ignore
  }
  try {
    window.sessionStorage.removeItem(ADMIN_REMEMBER_KEY);
  } catch {
    // ignore
  }
  removeCookie(ADMIN_REMEMBER_COOKIE);
  memoryFallback = "";
};
