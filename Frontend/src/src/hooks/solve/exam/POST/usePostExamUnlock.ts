// ──── FILE: src/hooks/solve/exam/POST/usePostExamUnlock.ts ────
"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { getApiBase } from "@/utils/apiBase";
import { fetchWithCsrfRetry } from "@/utils/csrf";

export interface ExamUnlockPayload {
  examId: string;
  userId: string | number;
}

const getUnlockUrl = (examId: string): string => {
  const base = getApiBase();
  return `${base}/instructor/solve/exam/${encodeURIComponent(
    examId
  )}/unlock/`;
};

const postExamUnlock = async (payload: ExamUnlockPayload): Promise<unknown> => {
  const url = getUnlockUrl(payload.examId);
  const res = await fetchWithCsrfRetry(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ user_id: payload.userId }),
  });

  const rawText = await res.text().catch(() => "");
  if (!res.ok) {
    let msg = rawText || `시험 해제 실패 (${res.status})`;
    try {
      const parsed = rawText ? JSON.parse(rawText) : null;
      msg = parsed?.detail || parsed?.message || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  try {
    return rawText ? JSON.parse(rawText) : null;
  } catch {
    return rawText || null;
  }
};

export const usePostExamUnlock = (): UseMutationResult<
  unknown,
  Error,
  ExamUnlockPayload
> => {
  return useMutation<unknown, Error, ExamUnlockPayload>({
    mutationFn: postExamUnlock,
  });
};
