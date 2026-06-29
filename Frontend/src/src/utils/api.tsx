import axios from "axios";
import AuthApi, {
  attachCsrfHeader,
  isCsrfMismatch,
  isSessionExpiredError,
  notifySessionExpired,
} from "@/utils/authApi";
import { getApiBase } from "@/utils/apiBase";

const API_URL = getApiBase();
// 자유게시판 전체 데이터
const BaseApi = axios.create({
  baseURL: API_URL,
  withCredentials: true, // ← 쿠키 자동 첨부
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
    "X-Algolab-Client": "web",
  },
});

BaseApi.interceptors.request.use(async (config) => {
  const method = String(config?.method ?? "get").toLowerCase();
  if (!["get", "head", "options", "trace"].includes(method)) {
    const headers = (config.headers ?? {}) as Record<string, string>;
    await attachCsrfHeader(headers);
    config.headers = headers as any;
  }
  return config;
});

// BaseApi도 인증 만료 시 refresh 시도
BaseApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!error.response) {
      return Promise.reject(error);
    }

    const status = error.response.status;

    if (
      status === 403 &&
      !originalRequest._csrfRetry &&
      isCsrfMismatch(error.response.data)
    ) {
      originalRequest._csrfRetry = true;
      const headers = (originalRequest.headers ?? {}) as Record<string, string>;
      await attachCsrfHeader(headers, { forceRefresh: true });
      originalRequest.headers = headers as any;
      return BaseApi(originalRequest);
    }

    const shouldTryRefresh =
      !originalRequest?._retry &&
      (
        status === 401 ||
        (status === 403 && isSessionExpiredError(error.response.data))
      );

    if (!shouldTryRefresh) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      await AuthApi.post("/auth/token/refresh/", {});
      return BaseApi(originalRequest);
    } catch (refreshError) {
      const responseData = (refreshError as any)?.response?.data;
      if (isSessionExpiredError(responseData)) {
        notifySessionExpired(responseData);
      }
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    }
  }
);

export default BaseApi;
