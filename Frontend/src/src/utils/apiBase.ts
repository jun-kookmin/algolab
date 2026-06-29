"use client";

const ABSOLUTE_HTTP_URL_RE = /^https?:\/\//i;

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

const ensureLeadingSlash = (value: string): string =>
  value.startsWith("/") ? value : `/${value}`;

const ensureApiSuffix = (value: string, fallbackPath: "/api" | "/api/v1"): string => {
  const normalized = trimTrailingSlashes(value);
  if (!normalized) return fallbackPath;

  if (fallbackPath === "/api/v1") {
    if (normalized.endsWith("/api/v1")) return normalized;
    if (normalized.endsWith("/api")) return `${normalized}/v1`;
    return `${normalized}/api/v1`;
  }

  if (normalized.endsWith("/api")) return normalized;
  return `${normalized}/api`;
};

const resolveClientFacingBase = (
  rawValue: string | undefined,
  fallbackPath: "/api" | "/api/v1",
): string => {
  const trimmed = rawValue?.trim();
  if (!trimmed) {
    return fallbackPath;
  }

  if (!ABSOLUTE_HTTP_URL_RE.test(trimmed)) {
    return ensureApiSuffix(ensureLeadingSlash(trimTrailingSlashes(trimmed)), fallbackPath);
  }

  if (typeof window === "undefined") {
    return ensureApiSuffix(trimTrailingSlashes(trimmed), fallbackPath);
  }

  try {
    const parsed = new URL(trimmed);
    return ensureApiSuffix(parsed.pathname || fallbackPath, fallbackPath);
  } catch {
    return fallbackPath;
  }
};

export const getApiBase = (): string => {
  const base = process.env.NEXT_PUBLIC_BASE_API_URL;
  if (!base && typeof window !== "undefined") {
    // 브라우저 실행 환경에서 환경변수가 누락된 경우에도
    // /api/v1 상대 경로로 안전하게 동작하도록 폴백.
    console.warn(
      "NEXT_PUBLIC_BASE_API_URL이 없어 상대 API 경로(/api/v1)로 처리합니다."
    );
  }
  return resolveClientFacingBase(base, "/api/v1");
};

export const getAuthApiBase = (): string => {
  return resolveClientFacingBase(process.env.NEXT_PUBLIC_AUTH_API_URL, "/api");
};

export const getOAuthApiBase = (): string => {
  const configuredBase =
    process.env.NEXT_PUBLIC_OAUTH_API_URL ?? process.env.NEXT_PUBLIC_AUTH_API_URL;
  if (!configuredBase && typeof window !== "undefined") {
    console.warn(
      "NEXT_PUBLIC_OAUTH_API_URL이 없어 상대 API 경로(/api)로 처리합니다."
    );
  }
  return resolveClientFacingBase(configuredBase, "/api");
};
