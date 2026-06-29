import axios from "axios";
import { getAuthApiBase } from "@/utils/apiBase";

const API_URL = getAuthApiBase();

const AuthApi = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
    "X-Algolab-Client": "web",
  },
});

const SESSION_EXPIRED_ALERT_KEY = "algolab_session_expired_alerted";
const CSRF_COOKIE_NAME = "csrftoken";
const CSRF_HEADER_NAME = "X-CSRFToken";
const CSRF_SAFE_METHODS = new Set(["get", "head", "options", "trace"]);
const CSRF_RETRY_HEADER = "x-csrf-retry";
let csrfBootstrapPromise: Promise<void> | null = null;
let csrfBootstrapDone = false;

const readCookieValues = (name: string): string[] => {
  if (typeof document === "undefined") return [];
  const cookiePrefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(cookiePrefix))
    .map((part) => {
      try {
        return decodeURIComponent(part.slice(cookiePrefix.length));
      } catch {
        return part.slice(cookiePrefix.length);
      }
    })
    .filter((value) => value.length > 0);
};

const readCookie = (name: string): string | null => {
  const values = readCookieValues(name);
  return values.length > 0 ? values[values.length - 1] : null;
};

const hasConflictingCookieValues = (name: string): boolean => {
  const distinctValues = Array.from(new Set(readCookieValues(name)));
  return distinctValues.length > 1;
};

const buildCookieDomainCandidates = (host: string): string[] => {
  if (!host) return [];
  const parts = host.split(".").filter(Boolean);
  const candidates = new Set<string>();
  for (let i = 0; i < parts.length; i += 1) {
    const domain = parts.slice(i).join(".");
    if (!domain) continue;
    candidates.add(domain);
    candidates.add(`.${domain}`);
  }
  return Array.from(candidates);
};

export const getCsrfTokenFromCookie = (): string | null => readCookie(CSRF_COOKIE_NAME);

export const resetCsrfState = (): void => {
  csrfBootstrapDone = false;
  csrfBootstrapPromise = null;
};

export const clearCsrfTokenCookie = (): void => {
  if (typeof document === "undefined") return;

  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isSecure = typeof window !== "undefined" ? window.location.protocol === "https:" : false;
  const samesite = isSecure ? "None" : "Lax";
  const entries = new Set<string>([
    `${CSRF_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=${samesite};${isSecure ? " Secure;" : ""}`,
  ]);
  buildCookieDomainCandidates(host).forEach((domain) => {
    entries.add(
      `${CSRF_COOKIE_NAME}=; Path=/; Domain=${domain}; Max-Age=0; SameSite=${samesite};${isSecure ? " Secure;" : ""}`
    );
  });

  entries.forEach((entry) => {
    document.cookie = entry;
  });
};

export const ensureCsrfToken = async (forceRefresh = false): Promise<void> => {
  if (typeof window === "undefined") return;
  if (!forceRefresh && csrfBootstrapDone) return;

  if (!forceRefresh && getCsrfTokenFromCookie()) {
    csrfBootstrapDone = true;
    return;
  }

  if (forceRefresh) {
    csrfBootstrapDone = false;
    clearCsrfTokenCookie();
  }
  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = axios
      .get(`${API_URL}/auth/csrf/`, {
        withCredentials: true,
        headers: {
          "X-Algolab-Client": "web",
        },
      })
      .then(() => {
        csrfBootstrapDone = true;
      })
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }
  await csrfBootstrapPromise;
};

export const isCsrfMismatch = (responseData: any): boolean => {
  const detail = String(readErrorMessage(responseData) || "").toLowerCase();
  const raw = JSON.stringify(responseData || "").toLowerCase();
  return (
    raw.includes("csrf") ||
    raw.includes("x-csrftoken") ||
    detail.includes("csrf") ||
    raw.includes("forgery")
  );
};

export const attachCsrfHeader = async (
  headers: Record<string, string>,
  options: { forceRefresh?: boolean } = {},
): Promise<void> => {
  let token = getCsrfTokenFromCookie();
  const forceRefresh = Boolean(options.forceRefresh);
  const hasConflictingCsrfCookies = hasConflictingCookieValues(CSRF_COOKIE_NAME);

  if (!token || forceRefresh || hasConflictingCsrfCookies) {
    resetCsrfState();
    if (hasConflictingCsrfCookies) {
      clearCsrfTokenCookie();
    }
    await ensureCsrfToken(true);
    token = getCsrfTokenFromCookie();
  } else {
    await ensureCsrfToken();
  }

  if (token) {
    headers[CSRF_HEADER_NAME] = token;
  }
};

const toTextChunks = (value: any, out: string[] = []): string[] => {
  if (!value) return out;

  if (typeof value === "string") {
    out.push(value);
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => toTextChunks(item, out));
    return out;
  }

  if (typeof value === "object") {
    if ("message" in value) toTextChunks((value as any).message, out);
    if ("detail" in value) toTextChunks((value as any).detail, out);
    if ("non_field_errors" in value) toTextChunks((value as any).non_field_errors, out);
    if ("messages" in value) toTextChunks((value as any).messages, out);
  }

  return out;
};

const readErrorMessage = (data: any): string => {
  if (!data) return "";
  return toTextChunks(data).filter(Boolean).join(", ");
};

const extractErrorCodes = (data: any): string[] => {
  const codes: string[] = [];
  const toCodes = (value: any) => {
    if (!value) return;

    if (typeof value === "string") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(toCodes);
      return;
    }

    if (typeof value === "object") {
      if (typeof value.code === "string") {
        codes.push(value.code.toLowerCase());
      }
      if ("detail" in value) toCodes((value as any).detail);
      if ("messages" in value) toCodes((value as any).messages);
      if ("non_field_errors" in value) toCodes((value as any).non_field_errors);
    }
  };

  toCodes(data);
  return [...new Set(codes)];
};

export const isSessionExpiredError = (data: any): boolean => {
  const codes = extractErrorCodes(data);
  const hasSessionExpiredCode =
    codes.includes("session_expired") ||
    codes.includes("session_presence_expired") ||
    codes.includes("session_idle_expired") ||
    codes.includes("oauth_session_expired");
  const detail = readErrorMessage(data).toLowerCase();
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const raw = JSON.stringify(messages).toLowerCase();

  return (
    hasSessionExpiredCode ||
    detail.includes("session expired by another login") ||
    detail.includes("브라우저 세션이 종료") ||
    detail.includes("session expired") ||
    detail.includes("다른 기기에서") ||
    detail.includes("세션이 만료") ||
    raw.includes("session expired by another login") ||
    raw.includes("다른 기기에서") ||
    raw.includes("세션이 만료")
  );
};

const isDuplicateLoginError = (data: any): boolean => {
  const codes = extractErrorCodes(data);
  const hasDuplicateCode = codes.includes("session_expired");
  const detail = readErrorMessage(data).toLowerCase();
  const raw = JSON.stringify(data).toLowerCase();
  return (
    hasDuplicateCode ||
    detail.includes("session expired by another login") ||
    detail.includes("다른 기기에서") ||
    detail.includes("중복 로그인") ||
    detail.includes("현재 세션이 만료되었습니다") ||
    detail.includes("현재 세션이 만료") ||
    detail.includes("other device") ||
    raw.includes("session_expired") ||
    raw.includes("session expired by another login")
  );
};

export const getSessionExpiredMessage = (data: any) => {
  const codes = extractErrorCodes(data);
  const hasSessionExpiredCode = codes.includes("session_expired");
  const hasSessionPresenceCode = codes.includes("session_presence_expired");
  const hasSessionIdleCode = codes.includes("session_idle_expired");
  const hasOauthSessionExpiredCode = codes.includes("oauth_session_expired");
  const detail = readErrorMessage(data).toLowerCase();
  if (
    hasSessionPresenceCode ||
    detail.includes("브라우저 세션이 종료")
  ) {
    return "브라우저 세션이 종료되었습니다. 다시 로그인해 주세요.";
  }
  if (
    hasSessionExpiredCode ||
    detail.includes("다른 기기") ||
    detail.includes("session expired by another login")
  ) {
    return "다른 기기에서 접속이 확인되어 현재 세션이 만료되었습니다. 다시 로그인해 주세요.";
  }
  if (
    hasSessionIdleCode ||
    hasOauthSessionExpiredCode ||
    detail.includes("세션이 만료") ||
    detail.includes("account session")
  ) {
    return "세션이 만료되었습니다. 다시 로그인해 주세요.";
  }
  return "다른 기기에서 접속이 확인되어 현재 세션이 만료되었습니다. 다시 로그인해 주세요.";
};

export const notifySessionExpired = (data: any) => {
  if (typeof window === "undefined") return;
  if (!isDuplicateLoginError(data)) return;
  if (sessionStorage.getItem(SESSION_EXPIRED_ALERT_KEY) === "1") return;
  sessionStorage.setItem(SESSION_EXPIRED_ALERT_KEY, "1");
  window.alert(getSessionExpiredMessage(data));
};

const shouldSuppressSessionAlert = (
  config: any,
  responseData: any
): boolean => {
  const url = String(config?.url ?? "").toLowerCase();
  // 세션 만료 재확인/프로필 폴링은 조용히 처리하되,
  // 다른 기기 중복 로그인은 반드시 사용자에게 알려야 함.
  if (
    config?.silentSessionExpired &&
    !url.includes("/auth/token/refresh/") &&
    !isDuplicateLoginError(responseData)
  ) {
    return true;
  }
  return false;
};

AuthApi.interceptors.request.use(async (config) => {
  const method = String(config?.method ?? "get").toLowerCase();
  const headers = (config.headers ?? {}) as Record<string, string>;
  headers["X-Algolab-Client"] = "web";

  if (!CSRF_SAFE_METHODS.has(method)) {
    await attachCsrfHeader(headers);
  }

  config.headers = headers as any;
  return config;
});

AuthApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 응답 자체가 없으면(네트워크 에러 등) 그냥 넘김
    if (!error.response) {
      return Promise.reject(error);
    }

    const status = error.response.status;
    const responseData = error.response.data;

    // auth 관련 엔드포인트는 refresh 재시도 대상에서 제외
    if (
      originalRequest.url.includes("/auth/token/refresh/") ||
      originalRequest.url.includes("/auth/login/")
    ) {
      return Promise.reject(error);
    }

    if ((status === 401 || status === 403) && isSessionExpiredError(responseData)) {
      if (!shouldSuppressSessionAlert(originalRequest, responseData)) {
        notifySessionExpired(responseData);
      }
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    if (status === 403 && !originalRequest[CSRF_RETRY_HEADER] && isCsrfMismatch(responseData)) {
      originalRequest[CSRF_RETRY_HEADER] = true;
      resetCsrfState();

      try {
        await attachCsrfHeader(
          (originalRequest.headers ?? {}) as Record<string, string>,
          { forceRefresh: true },
        );
        return AuthApi(originalRequest);
      } catch {
        return Promise.reject(error);
      }
    }

    const shouldTryRefresh =
      !originalRequest._retry &&
      (
        status === 401 ||
        (status === 403 && isSessionExpiredError(responseData))
      );

    if (shouldTryRefresh) {
      originalRequest._retry = true;

      try {
        // refresh 시도 (쿠키는 HttpOnly + withCredentials 로 자동 전송)
        await AuthApi.post("/auth/token/refresh/", {});

        // refresh 성공하면 원래 요청 다시 보내기
        return AuthApi(originalRequest);
      } catch (refreshError) {
        if (isSessionExpiredError((refreshError as any)?.response?.data)) {
          notifySessionExpired((refreshError as any)?.response?.data);
        }
        // refresh 실패 → 토큰 둘 다 만료 or 없음 → 로그인 페이지로
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default AuthApi;
