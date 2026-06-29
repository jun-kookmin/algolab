// ──── FILE: src/hooks/solve/exam/POST/usePostExamFinish.ts ────
"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { getApiBase } from "@/utils/apiBase";
import { fetchWithCsrfRetry } from "@/utils/csrf";

const getFinishUrl = (examId: string): string => {
  const base = getApiBase();
  return `${base}/instructor/solve/exam/${encodeURIComponent(
    examId
  )}/finish/`;
};

const postExamFinish = async (examId: string): Promise<unknown> => {
  const url = getFinishUrl(examId);
  const res = await fetchWithCsrfRetry(url, {
    method: "POST",
    credentials: "include",
  });

  const rawText = await res.text().catch(() => "");
  if (!res.ok) {
    let msg = rawText || `시험 종료 실패 (${res.status})`;
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

export const usePostExamFinish = (): UseMutationResult<
  unknown,
  Error,
  string
> => {
  return useMutation<unknown, Error, string>({
    mutationFn: postExamFinish,
  });
};
