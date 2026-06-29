// src/hooks/lectures/useGetLectureProgress.ts
"use client";

import BaseApi from "@/utils/api";
import { useQuery } from "@tanstack/react-query";

export type ProblemStatus = "CORRECT" | "WRONG" | "NOT_SUBMITTED";

/** 클라이언트에서 쓰는 타입 */
export interface ProgressProblemDetail {
  problem_id: string;
  title: string;
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
  user_id: number;
  name: string;
  student_number: string;
  solved_count: number;
  total_count: number;
  problems: ProgressProblemDetail[];
  language: number[] | string[];
  solved_rate: number;
}

/** 서버 응답 원본 타입 */
interface RawProgressProblemDetail {
  problem_uuid?: string;
  problem_id?: number | string;
  title?: string;
  status: ProblemStatus;
  attempt_count?: number;
  last_submitted_at?: string | null;
  id?: number | string;
  score: number;
  language: number[] | string[];
  execution_time: number;
  submission_time: string;
  memory: number;
  code_length: number;
}

interface RawLectureProgressDetail {
  user_id: number;
  language: number[] | string[];
  name: string;
  student_number: string;
  solved_count: number;
  total_count: number;
  problems?: RawProgressProblemDetail[];
}

/** 문제 단건 매핑 */
const normalizeProblemId = (p: RawProgressProblemDetail) =>
  String(p.problem_uuid ?? p.problem_id ?? p.id ?? "");

const mapProblem = (p: RawProgressProblemDetail): ProgressProblemDetail => ({
  problem_id: normalizeProblemId(p),
  title: p.title ?? "",
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
    `instructor/lectures/${lectureId}/progresses/${userId}/`
  );

  const problems = (data.problems ?? [])
    .map(mapProblem)
    .sort((a, b) => {
      const an = Number(a.problem_id);
      const bn = Number(b.problem_id);
      if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
      return a.problem_id.localeCompare(b.problem_id);
    });

  return {
    user_id: data.user_id,
    name: data.name ?? "",
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
export const useGetMemberProgress = (lectureId?: string, userId?: number) => {
  const enabled = !!lectureId && !!userId;

  return useQuery({
    queryKey: ["lectureProgress", lectureId, userId],
    queryFn: () => fetchLectureProgress(lectureId!, userId!),
    enabled,
    staleTime: 60_000,
  });
};
