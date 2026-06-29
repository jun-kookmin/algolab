"use client";

import {
  attachCsrfHeader,
  ensureCsrfToken,
  getCsrfTokenFromCookie,
  isCsrfMismatch,
} from "@/utils/authApi";

const CSRF_SAFE_METHODS = new Set(["get", "head", "options", "trace"]);

const normalizeHeaders = (headers?: HeadersInit): Record<string, string> => {
  const normalized: Record<string, string> = {};
  if (!headers) return normalized;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      normalized[key] = value;
    });
    return normalized;
  }
  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      normalized[key] = value;
    });
    return normalized;
  }
  return { ...headers };
};

export const getJsonHeadersWithCsrf = async (): Promise<Record<string, string>> => {
  await ensureCsrfToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getCsrfTokenFromCookie();
  if (token) {
    headers["X-CSRFToken"] = token;
  }

  return headers;
};

export const fetchWithCsrfRetry = async (
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> => {
  const method = String(init.method ?? "GET").toLowerCase();
  const headers = normalizeHeaders(init.headers);
  if (!headers["X-Algolab-Client"] && !headers["x-algolab-client"]) {
    headers["X-Algolab-Client"] = "web";
  }

  if (!CSRF_SAFE_METHODS.has(method)) {
    await attachCsrfHeader(headers);
  }

  let response = await fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  });

  if (!CSRF_SAFE_METHODS.has(method) && response.status === 403) {
    let responseText = "";
    try {
      responseText = await response.clone().text();
    } catch {
      responseText = "";
    }

    if (isCsrfMismatch(responseText)) {
      const retryHeaders = normalizeHeaders(init.headers);
      await attachCsrfHeader(retryHeaders, { forceRefresh: true });
      response = await fetch(input, {
        ...init,
        headers: retryHeaders,
        credentials: init.credentials ?? "include",
      });
    }
  }

  return response;
};
