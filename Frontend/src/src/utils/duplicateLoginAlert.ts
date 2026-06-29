const DUPLICATE_LOGIN_ALERT_KEY = "algolab_duplicate_login_alerted";

const isAlertSuppressed = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(DUPLICATE_LOGIN_ALERT_KEY) === "1";
};

const toBooleanLike = (value: unknown): boolean => {
  if (value === true || value === 1 || value === "1" || value === "true") return true;
  return false;
};

export const markDuplicateLoginAlertShown = (): void => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DUPLICATE_LOGIN_ALERT_KEY, "1");
};

export const clearDuplicateLoginAlertFlag = (): void => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(DUPLICATE_LOGIN_ALERT_KEY);
};

export const shouldShowDuplicateLoginAlert = (replacedExistingSession?: unknown): boolean => {
  if (!toBooleanLike(replacedExistingSession)) return false;
  if (isAlertSuppressed()) return false;
  return true;
};

export const DUPLICATE_LOGIN_ALERT_MESSAGE =
  "중복 로그인 감지: 기존 기기의 세션이 종료되어 새 기기에서 접속되었습니다.";
