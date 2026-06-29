// ──── FILE: src/hooks/solve/homework/GET/useGetHomeworkRunResult.ts ────
"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiBase } from "@/utils/apiBase";

const API_BASE = getApiBase();

type RunResultQuery = {
    jobId?: string | null;
    runToken?: string | null;
    sectionProblemUuid?: string | null;
};

const DEFAULT_POLL_INTERVAL_MS = 2000;

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
const fetchHomeworkRunResult = async (
    query: RunResultQuery,
    signal?: AbortSignal
): Promise<unknown> => {
    const url = resolveRunResultUrl(query);
    if (!url) {
        throw new Error("job_id 또는 section_problem_uuid가 없습니다.");
    }

    console.debug("[poll][homework-run] request", {
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
            `실행 결과 조회 실패 (${res.status}): ${rawText || "<no response body>"}`
        );
    }

    try {
        return rawText ? JSON.parse(rawText) : null;
    } catch {
        return rawText || null;
    }
};

const normalizeStatus = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.toUpperCase();
};

const PENDING_STATUSES = new Set([
    "PENDING",
    "PD",
    "RUNNING",
    "QUEUED",
    "WAITING",
]);

/**
 * job_id 또는 section_problem_uuid 기반 실행 결과 폴링 훅
 *
 * - 2초마다 결과 조회
 * - status가 "PENDING" 또는 "PD"면 계속 폴링
 * - 그 외 상태면 폴링 중단
 */
export const useGetHomeworkRunResult = (query?: RunResultQuery) => {
    const jobId = query?.jobId ?? null;
    const runToken = query?.runToken ?? null;
    const sectionProblemUuid = query?.sectionProblemUuid ?? null;
    const enabled = !!jobId || !!sectionProblemUuid;

    return useQuery<unknown, Error>({
        queryKey: ["homework-run-result", jobId, runToken, sectionProblemUuid],
        queryFn: ({ signal }) =>
            fetchHomeworkRunResult({ jobId, runToken, sectionProblemUuid }, signal),
        enabled, // jobId 또는 section_problem_uuid가 있을 때만 시작
        refetchInterval: (data) => {
            if (!data) return DEFAULT_POLL_INTERVAL_MS;

            const status =
                normalizeStatus((data as any)?.status) ??
                normalizeStatus((data as any)?.state) ??
                normalizeStatus((data as any)?.execution_status);

            if (!status) return DEFAULT_POLL_INTERVAL_MS;

            return PENDING_STATUSES.has(status) ? DEFAULT_POLL_INTERVAL_MS : false;
        },
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
        staleTime: 0,
    });
};
