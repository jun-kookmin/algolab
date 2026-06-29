// src/hooks/lectures/useGetLectures.ts
"use client";

import BaseApi from "@/utils/api";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";

/** ===== 타입 ===== */
export interface LectureSummary {
  id: string;
  uuid: string;
  name: string;
  description: string;
  start_date: string;        // ISO (e.g., "2025-09-01")
  end_date: string;          // ISO
  problem_count: number;
  section_count: number;
  lecture_language: number[]; // backend language PK 목록
  language?: Array<{ id: number; language_name: string }>;
  curriculum_locked?: boolean;
}

export interface GetLecturesResponse {
  total: number;
  page?: number;
  size: number;
  data: LectureSummary[];
  lectures?: LectureSummary[];
}

export interface GetLecturesParams {
  page?: number;
  size?: number;
  q?: string; // 검색 기능 추가용
  all?: boolean;
  status?: "all" | "current" | "done";
}

/** ===== fetcher: 인자 → API 호출 → data 반환 ===== */
export const fetchLectures = async (
  params: GetLecturesParams = {}
): Promise<GetLecturesResponse> => {
  const { page = 1, size = 10, all, status } = params;
  const requestStatus = status === "current" ? "active" : status;
  const { data } = await BaseApi.get<unknown>("/instructor/lectures/", {
    params: { page, size, ...(all ? { all: "1" } : {}), ...(requestStatus ? { status: requestStatus } : {}) },
  });
  const payload = data as any;
  const items = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.lectures)
    ? payload.lectures
    : [];
  const normalized = items.map((lec: any) => ({
    ...lec,
    uuid: String(lec.uuid ?? lec.id ?? ""),
    id: String(lec.uuid ?? lec.id ?? ""),
    language: Array.isArray(lec.language) ? lec.language : [],
  }));
  return {
    total: payload?.total ?? normalized.length,
    size: payload?.size ?? normalized.length,
    page: payload?.page,
    data: normalized,
    lectures: normalized,
  };
};

/** ===== 커스텀 훅: 캐시 키/조건/옵션 설정 ===== */
export const useGetLectures = (
  params?: GetLecturesParams,
  options?: Omit<
    UseQueryOptions<GetLecturesResponse, Error, GetLecturesResponse>,
    "queryKey" | "queryFn"
  >
) => {
  const safeParams = {
    page: params?.page ?? 1,
    size: params?.size ?? 10,
    all: params?.all,
    status: params?.status,
  };
  return useQuery({
    queryKey: [
      "lectures",
      safeParams.page,
      safeParams.size,
      safeParams.all ? "all" : "page",
      safeParams.status ?? "all",
    ],
    queryFn: () => fetchLectures(safeParams),
    staleTime: safeParams.all ? 300_000 : 60_000,
    refetchOnWindowFocus: !safeParams.all,
    ...options,
  });
};
