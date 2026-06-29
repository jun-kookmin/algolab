// src/hooks/lectures/useGetLectureProgress.ts
"use client";

import BaseApi from "@/utils/api";
import { formatDisplayName } from "@/utils/name";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";

export type ProblemStatus = "CORRECT" | "WRONG" | "NOT_SUBMITTED";

/** 클라이언트에서 쓰는 타입 */
export interface ProgressProblemDetail {
  uuid?: string;
  id?: string;
  problem_id: string;
  title: string;
  code: string;
  status: ProblemStatus;
  attempt_count: number;
  last_submitted_at: string | null;
  score: number;
  language: number[] | string[];
  execution_time: number;
  submission_time: string;
  memory: number;
  code_length: number;
}

export interface LectureProgressDetail {
  user_id?: number;
  name?: string;
  student_number?: string;
  solved_count: number;
  total_count: number;
  problems: ProgressProblemDetail[];
  language: number[] | string[];
  solved_rate: number;
}

/** 서버 응답 원본 타입 */
interface RawProgressProblemDetail {
  problem_uuid: string;
  uuid?: string;
  section_problem_uuid?: string;
  title?: string;
  code: string;
  status: ProblemStatus;
  is_late?: boolean;
  attempt_count?: number;
  last_submitted_at?: string | null;
  score: number;
  language: number[] | string[];
  execution_time: number;
  submission_time: string;
  memory: number;
  code_length: number;
}

interface RawLectureProgressDetail {
  user_id?: number;
  language: number[] | string[];
  name?: string;
  student_number?: string;
  solved_count: number;
  total_count: number;
  problems?: RawProgressProblemDetail[];
}

/** 문제 단건 매핑 */
const mapProblem = (p: RawProgressProblemDetail): ProgressProblemDetail => ({
  uuid: p.uuid ?? undefined,
  id: p.uuid ?? undefined,
  problem_id: String((p as any).section_problem_uuid ?? (p as any).problem_uuid ?? ""),
  title: p.title ?? "",
  code: p.code,
  status: p.status,
  score: p.score,
  attempt_count: p.attempt_count ?? 0,
  last_submitted_at: p.last_submitted_at ?? null,
  language: p.language,
  execution_time: p.execution_time,
  submission_time: p.submission_time,
  memory: p.memory,
  code_length: p.code_length,
});

/** API 호출 */
const fetchLectureProgress = async (
  lectureId: string,
  userId: number
): Promise<LectureProgressDetail> => {
  const { data } = await BaseApi.get<RawLectureProgressDetail>(
    `instructor/lectures/${lectureId}/submissions/homework/homework/${userId}/`
  );

  const problems = (data.problems ?? [])
    .map(mapProblem)
    .sort((a, b) => a.problem_id.localeCompare(b.problem_id));

  return {
    user_id: data.user_id ?? userId,
    name: formatDisplayName(data.name ?? ""),
    language: data.language,
    student_number: data.student_number ?? "",
    solved_count: data.solved_count ?? 0,
    total_count: data.total_count ?? 0,
    problems,
    solved_rate:
      (data.total_count ?? 0) > 0
        ? (data.solved_count ?? 0) / (data.total_count ?? 1)
        : 0,
  };
};

/** React Query 훅 */
export const useGetHomeworkUserSubmissions = (
  lectureId?: string,
  userId?: number,
  enabled?: boolean,
  options?: Omit<
    UseQueryOptions<LectureProgressDetail, Error, LectureProgressDetail>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery({
    queryKey: ["lectureProgress", lectureId, userId],
    queryFn: () => fetchLectureProgress(lectureId!, userId!),
    enabled: (enabled ?? true) && !!lectureId && typeof userId === "number",
    staleTime: 30_000,
    ...(options ?? {}),
  });
};
