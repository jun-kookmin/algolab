// ──── FILE: src/hooks/solve/exam/GET/useGetExamRunResult.ts ────
"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiBase } from "@/utils/apiBase";

type RunResultQuery = {
  jobId?: string | null;
  runToken?: string | null;
  sectionProblemUuid?: string | null;
};

const API_BASE = getApiBase();

const DEFAULT_POLL_INTERVAL_MS = 2000;
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
    normalizeStatus(d?.execution_status) ??
    normalizeStatus(d?.run_result?.status) ??
    null
  );
};

const resolveRunResultUrl = (query: RunResultQuery): string | null => {
  const jobId = query.jobId?.trim();
  const runToken = query.runToken?.trim();
  if (jobId) {
    const params = new URLSearchParams();
    params.set("job_id", jobId);
    if (runToken) {
      params.set("run_token", runToken);
    }
    return `${API_BASE}/instructor/execution/run/result/?${params.toString()}`;
  }

  const sectionProblemUuid = query.sectionProblemUuid?.trim();
  if (sectionProblemUuid) {
    return `${API_BASE}/instructor/execution/run/result/?section_problem_uuid=${encodeURIComponent(
      sectionProblemUuid
    )}`;
  }

  return null;
};

/**
 * 단일 실행 결과 조회 fetcher
 * GET /instructor/execution/run/result/?job_id=uuid
 * GET /instructor/execution/run/result/?section_problem_uuid=uuid
 */
const fetchExamRunResult = async (
  query: RunResultQuery,
  signal?: AbortSignal
): Promise<unknown> => {
  const url = resolveRunResultUrl(query);
  if (!url) {
    throw new Error("job_id 또는 section_problem_uuid가 없습니다.");
  }

  console.debug("[poll][exam-run] request", {
    at: new Date().toISOString(),
    jobId: query.jobId ?? null,
    runToken: query.runToken ?? null,
    sectionProblemUuid: query.sectionProblemUuid ?? null,
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
      `시험 실행 결과 조회 실패 (${res.status}): ${rawText || "<no response body>"}`
    );
  }

  try {
    return rawText ? JSON.parse(rawText) : null;
  } catch {
    return rawText || null;
  }
};

type RunResultPollingOptions = {
  pollIntervalMs?: number;
  pendingStatuses?: string[];
  stopStatuses?: string[];
};

/**
 * job_id 또는 section_problem_uuid 기반 실행 결과 폴링 훅
 *
 * - 기본: 2초마다 결과 조회
 * - pending 상태(PENDING/PD/...)면 계속 폴링
 * - stopStatuses가 주어지면 해당 상태 도달 시 폴링 중단
 */
export const useGetExamRunResult = (
  query?: RunResultQuery,
  options?: RunResultPollingOptions
): any => {
  const jobId = query?.jobId ?? null;
  const runToken = query?.runToken ?? null;
  const sectionProblemUuid = query?.sectionProblemUuid ?? null;
  const enabled = !!jobId || !!sectionProblemUuid;
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
    queryKey: ["exam-run-result", jobId, runToken, sectionProblemUuid],
    queryFn: ({ signal }) =>
      fetchExamRunResult({ jobId, runToken, sectionProblemUuid }, signal),
    enabled,
    refetchInterval: (data) => {
      if (!enabled) return false;
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
