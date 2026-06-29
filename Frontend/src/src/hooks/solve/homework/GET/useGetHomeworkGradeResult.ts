// ──── FILE: src/hooks/solve/homework/GET/useGetHomeworkGradeResult.ts ────
"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiBase } from "@/utils/apiBase";

const API_BASE = getApiBase();

const DEFAULT_POLL_INTERVAL_MS = 4000;
const DEFAULT_PENDING_STATUSES = new Set(["PENDING", "PD"]);

const normalizeStatus = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
};

const extractStatus = (data: unknown): string | null => {
  if (!data || typeof data !== "object") return null;
  const d = data as any;
  return (
    normalizeStatus(d?.status) ??
    normalizeStatus(d?.grade_result?.status) ??
    normalizeStatus(d?.state) ??
    normalizeStatus(d?.grade_status) ??
    normalizeStatus(d?.execution_status) ??
    normalizeStatus(d?.run_result?.status) ??
    null
  );
};

/**
 * 단일 채점 결과 조회 fetcher
 * GET /instructor/execution/grade/result/?submission_uuid=uuid
 */
const fetchHomeworkGradeResult = async (
  submissionUuid: string,
  signal?: AbortSignal
): Promise<unknown> => {
  if (!submissionUuid) {
    throw new Error("submission_uuid가 없습니다.");
  }

  const url = `${API_BASE}/instructor/execution/grade/result/?submission_uuid=${encodeURIComponent(
    submissionUuid
  )}`;

  console.debug("[poll][homework-grade] request", {
    at: new Date().toISOString(),
    submissionUuid,
    url,
  });

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Algolab-Client": "web",
    },
    credentials: "include",
    signal,
  });

  const rawText = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(
      `채점 결과 조회 실패 (${res.status}): ${rawText || "<no response body>"}`
    );
  }

  try {
    return rawText ? JSON.parse(rawText) : null;
  } catch {
    return rawText || null;
  }
};

type GradeResultPollingOptions = {
  pollIntervalMs?: number;
  pendingStatuses?: string[];
  stopStatuses?: string[];
};

/**
 * submission_uuid 기반 채점 결과 폴링 훅
 *
 * - 기본: 4초마다 결과 조회
 * - pending 상태(PENDING/PD/...)면 계속 폴링
 * - stopStatuses가 주어지면 해당 상태 도달 시 폴링 중단
 */
export const useGetHomeworkGradeResult = (
  submissionUuid?: string | null,
  options?: GradeResultPollingOptions
) => {
  const pollInterval = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const pendingSet = new Set(
    (options?.pendingStatuses ?? Array.from(DEFAULT_PENDING_STATUSES))
      .map(normalizeStatus)
      .filter((v): v is string => !!v)
  );
  const stopSet =
    options?.stopStatuses && options.stopStatuses.length > 0
      ? new Set(
          options.stopStatuses
            .map(normalizeStatus)
            .filter((v): v is string => !!v)
        )
      : null;

  return useQuery<unknown, Error>({
    queryKey: ["homework-grade-result", submissionUuid],
    queryFn: ({ signal }) =>
      fetchHomeworkGradeResult(submissionUuid as string, signal),
    enabled: !!submissionUuid,
    refetchInterval: (data) => {
      if (!submissionUuid) return false;
      if (!data) return pollInterval;

      const status = extractStatus(data);
      if (!status) return pollInterval;

      if (stopSet && stopSet.has(status)) return false;

      return pendingSet.has(status) ? pollInterval : false;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
};
