// src/hooks/lectures/useGetHomework.ts
"use client";


import { HomeworkProblem } from "@/types/class";

import BaseApi from "@/utils/api";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";

/* --- API 원본 타입 --- */

export interface RawHomeworkProblem {

  uuid: string;
  problem_uuid: string;
  title: string;
  description?: string;
  language?: number[];
  start_date: string;
  end_date: string;
  isExam: false;
  points: number;
  solve_state?: string;
  attempt_count?: number;
  first_correct_attempt_count?: number | null;
  all_attempt_count?: number;
  all_first_correct_attempt_count?: number | null;
}
export interface HomeworkDetail {
  id: string;
  title: string;
  description?: string;
  problems: HomeworkProblem[];
}
export interface GetHomeworkResponse {

  section_uuid?: string;
  title?: string;
  description?: string;
  problems?: RawHomeworkProblem[];   // 혹은 루트에 줄 수도 있음
}

/* --- 프론트에서 사용할 가공 타입(TData) --- */
export interface NormalizedHomeworkResponse {
  homework?: HomeworkDetail;      // 필요하면 유지
  section_uuid?: string;

  problems: HomeworkProblem[];       // 화면/편집용 표준 구조

}

const defaultDate = "2025-01-01T00:00";

const normalizeSolveState = (
  value: unknown
): "solved" | "wrong" | "none" => {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (raw === "solved" || raw === "correct" || raw === "ac") {
    return "solved";
  }
  if (raw === "wrong" || raw === "incorrect" || raw === "wa") {
    return "wrong";
  }
  if (raw === "none" || raw === "not_submitted" || raw === "pending") {
    return "none";
  }

  return "none";
};


/** RAW → UI 변환 */
export const normalizeHomework = (raw: GetHomeworkResponse): NormalizedHomeworkResponse => {
  const src: RawHomeworkProblem[] = raw.problems ?? [];

  const normalized: HomeworkProblem[] = src.map((p) => ({
    id: String(p.uuid ?? ""),
    title: p.title,
    problem_id: String(p.problem_uuid ?? ""),
    language: p.language ?? [],
    points: p.points ?? 100,
    startAt: p.start_date ?? defaultDate, // UI 표준 필드
    endAt:   p.end_date   ?? defaultDate,
    isExam: false,
    solveState: normalizeSolveState(p.solve_state),
    attemptCount: p.attempt_count ?? 0,
    firstCorrectAttemptCount: p.first_correct_attempt_count ?? null,
    allAttemptCount: p.all_attempt_count ?? 0,
    allFirstCorrectAttemptCount: p.all_first_correct_attempt_count ?? null,
  }));

  return {
    section_uuid: raw.section_uuid,
    problems: normalized,
  };
};


/* fetcher */
export const fetchHomework = async (
  lectureId: string,
  homeworkId: string
): Promise<GetHomeworkResponse> => {
  const { data } = await BaseApi.get<GetHomeworkResponse>(
    `/instructor/lectures/${lectureId}/homework/${homeworkId}/`
  );

  return data;
};

/** queryKey 튜플 타입 고정 */
type Key = ["homework", string, string];

/** 외부 옵션에서 queryKey / queryFn 제외, TData는 가공 타입으로 */
type Opts = Omit<

  UseQueryOptions<NormalizedHomeworkResponse, Error, NormalizedHomeworkResponse, Key>,
  "queryKey" | "queryFn"
>;

export const useGetHomework = (
  lectureId?: string,
  homeworkId?: string,
  options?: Opts
) => {
  const enabled = !!lectureId && !!homeworkId && (options?.enabled ?? true);


  return useQuery<NormalizedHomeworkResponse, Error, NormalizedHomeworkResponse, Key>({
    queryKey: ["homework", lectureId as string, homeworkId as string],
    queryFn: async () => {
      const raw = await fetchHomework(lectureId as string, homeworkId as string);
      return normalizeHomework(raw); // 분리한 함수 사용
    },

    enabled,
    staleTime: 60_000,
    retry: 1,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    ...options,

  });
};
