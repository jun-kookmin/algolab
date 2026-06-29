"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiBase } from "@/utils/apiBase";

export interface ExamStatusResponse {
  started: boolean;
  finished: boolean;
  finished_at?: string | null;
  finished_by_user?: boolean | null;
  not_started?: boolean | null;
  start_date?: string | null;
  due_date?: string | null;
  server_time?: string | null;
  remaining_seconds?: number | null;
}

const DEFAULT_POLL_INTERVAL_MS = 10_000;
const IDLE_POLL_INTERVAL_MS = 30_000;
const FINISHED_POLL_INTERVAL_MS = 10_000;

const getStatusUrl = (examId: string): string => {
  const base = getApiBase();
  return `${base}/instructor/solve/exam/${encodeURIComponent(
    examId
  )}/status/`;
};

const fetchExamStatus = async (examId: string): Promise<ExamStatusResponse> => {
  const url = getStatusUrl(examId);
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-Algolab-Client": "web",
    },
  });
  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    let msg = raw || `상태 조회 실패 (${res.status})`;
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      msg = parsed?.detail || parsed?.message || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  try {
    return raw ? JSON.parse(raw) : { started: false, finished: false };
  } catch {
    return { started: false, finished: false };
  }
};

const parseDateMs = (value?: string | null): number | null => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

export const useGetExamStatus = (examId?: string | null, enabled?: boolean) => {
  type ExamStatusError = Error;

  const shouldPoll = (query: {
    state?: { data?: ExamStatusResponse | null };
  }): number | false => {
    const status = query?.state?.data;
    if (!examId) return false;

    if (!status) return DEFAULT_POLL_INTERVAL_MS;
    // 종료 상태도 감독 해제/시험시간 연장으로 재개될 수 있으므로 일정 간격으로 재확인
    if (status.finished || status.finished_by_user) {
      return FINISHED_POLL_INTERVAL_MS;
    }

    // 시험이 시작 전이면 짧지 않은 간격으로 유지(너무 잦은 폴링 방지)
    if (status.not_started) return IDLE_POLL_INTERVAL_MS;

    const dueMs = parseDateMs(status.due_date);
    const serverNowMs = parseDateMs(status.server_time);
    if (dueMs !== null && serverNowMs !== null && serverNowMs > dueMs && !status.finished) {
      return false;
    }

    if (status.started) return DEFAULT_POLL_INTERVAL_MS;

    return DEFAULT_POLL_INTERVAL_MS;
  };

  return useQuery<ExamStatusResponse, ExamStatusError, ExamStatusResponse>({
    queryKey: ["examStatus", examId],
    queryFn: () => fetchExamStatus(examId as string),
    enabled: !!examId && (enabled ?? true),
    refetchInterval: shouldPoll,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5_000,
  });
};
