"use client";

const LOCK_KEY = "algolab_exam_lock";
const LOCK_PATH_KEY = "algolab_exam_lock_path";
const LOCK_EXAM_ID_KEY = "algolab_exam_lock_exam_id";
const LOCK_EXPIRES_AT_KEY = "algolab_exam_lock_expires_at";
const LOCK_ALERT_TS_KEY = "algolab_exam_lock_alert_ts";
const FINISHED_PREFIX = "algolab_exam_finished_";
const DEFAULT_LOCK_WINDOW_MS = 15 * 60 * 1000;

export type ExamLockInfo = {
  active: boolean;
  path: string;
  examId: string;
  expiresAt: number | null;
};

const normalizeExpiresAt = (value?: number | string | null): number | null => {
  if (value == null) return null;
  const next = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(next)) return null;
  return Math.max(0, Math.floor(next));
};

export const setExamLock = (
  path: string,
  examId?: string | null,
  options?: { expiresAt?: number | string | null }
) => {
  if (typeof window === "undefined") return;
  if (!path) return;
  const expiresAt = normalizeExpiresAt(options?.expiresAt);
  sessionStorage.setItem(LOCK_KEY, "1");
  sessionStorage.setItem(LOCK_PATH_KEY, path);
  if (examId) {
    sessionStorage.setItem(LOCK_EXAM_ID_KEY, String(examId));
  } else {
    sessionStorage.removeItem(LOCK_EXAM_ID_KEY);
  }
  if (expiresAt === null) {
    sessionStorage.removeItem(LOCK_EXPIRES_AT_KEY);
  } else {
    sessionStorage.setItem(LOCK_EXPIRES_AT_KEY, String(expiresAt));
  }
};

export const clearExamLock = () => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(LOCK_KEY);
  sessionStorage.removeItem(LOCK_PATH_KEY);
  sessionStorage.removeItem(LOCK_EXAM_ID_KEY);
  sessionStorage.removeItem(LOCK_EXPIRES_AT_KEY);
  sessionStorage.removeItem(LOCK_ALERT_TS_KEY);
};

export const getExamLock = (): ExamLockInfo => {
  if (typeof window === "undefined") {
    return { active: false, path: "", examId: "", expiresAt: null };
  }
  const rawActive = sessionStorage.getItem(LOCK_KEY);
  const rawExpiresAt = sessionStorage.getItem(LOCK_EXPIRES_AT_KEY);
  const expiresAt = normalizeExpiresAt(rawExpiresAt);
  if (rawActive === "1" && rawExpiresAt === null) {
    const fallbackExpiresAt = Date.now() + DEFAULT_LOCK_WINDOW_MS;
    sessionStorage.setItem(LOCK_EXPIRES_AT_KEY, String(fallbackExpiresAt));
    return {
      active: true,
      path: sessionStorage.getItem(LOCK_PATH_KEY) ?? "",
      examId: sessionStorage.getItem(LOCK_EXAM_ID_KEY) ?? "",
      expiresAt: fallbackExpiresAt,
    };
  }
  const hasExpired =
    expiresAt !== null ? Date.now() >= expiresAt : false;

  if (rawActive === "1" && hasExpired) {
    clearExamLock();
    return { active: false, path: "", examId: "", expiresAt: null };
  }

  const active = rawActive === "1";
  const path = sessionStorage.getItem(LOCK_PATH_KEY) ?? "";
  const examId = sessionStorage.getItem(LOCK_EXAM_ID_KEY) ?? "";
  return { active, path, examId, expiresAt };
};

export const isExamLocked = (): boolean => getExamLock().active;

export const shouldAlertExamLock = (cooldownMs = 1500): boolean => {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  const last = Number(sessionStorage.getItem(LOCK_ALERT_TS_KEY) || "0");
  if (Number.isFinite(last) && now - last < cooldownMs) return false;
  sessionStorage.setItem(LOCK_ALERT_TS_KEY, String(now));
  return true;
};

export const markExamFinishedByUser = (examId?: string | null) => {
  if (typeof window === "undefined") return;
  if (!examId) return;
  sessionStorage.setItem(`${FINISHED_PREFIX}${examId}`, "1");
};

export const isExamFinishedByUser = (examId?: string | null): boolean => {
  if (typeof window === "undefined") return false;
  if (!examId) return false;
  return sessionStorage.getItem(`${FINISHED_PREFIX}${examId}`) === "1";
};

export const clearExamFinishedByUser = (examId?: string | null) => {
  if (typeof window === "undefined") return;
  if (!examId) return;
  sessionStorage.removeItem(`${FINISHED_PREFIX}${examId}`);
};
