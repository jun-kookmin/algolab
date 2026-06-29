// src/hooks/lectures/useGetLectureProgresses.ts
"use client";

import BaseApi from "@/utils/api";
import { useQuery } from "@tanstack/react-query";

export type ProblemStatus = "CORRECT" | "WRONG" | "NOT_SUBMITTED";

export interface ProgressProblem {
  problem_id: string;
  status: ProblemStatus;
  attempt_count: number;
  score: number;
}

export interface LectureProgressItem {
  user_id: number;
  name: string;
  student_number: string;
  solved_count: number;
  total_count: number;
  problems: ProgressProblem[];
  /** 파생 필드: 해결률 (0~1) */
  solved_rate: number;
}

interface RawLectureProgressesResponse {
  total: number;
  page?: number;
  size: number;
  data: Array<{
    user_id: number;
    name: string;
    student_number: string;
    solved_count: number;
    total_count: number;
    problems: Array<{
      problem_uuid?: string;
      problem_id?: number | string;
      id?: number | string;
      status: ProblemStatus;
      attempt_count?: number;
      score?: number;
    }>;
  }>;
}

export interface LectureProgressesResponse {
  total: number;
  page?: number;
  size: number;
  progresses: LectureProgressItem[];
}

const fetchLectureProgresses = async (
  lectureId: string
): Promise<LectureProgressesResponse> => {
  const { data } = await BaseApi.get<RawLectureProgressesResponse>(
    `instructor/lectures/${lectureId}/progresses/`
  );

  // console.log("data구조", data); // 확인용

  const progresses: LectureProgressItem[] = data.data.map((p) => ({
    ...p,
    problems: (p.problems ?? []).map((prob) => ({
      problem_id: String(prob.problem_uuid ?? prob.problem_id ?? prob.id ?? ""),
      status: prob.status,
      attempt_count: prob.attempt_count ?? 0,
      score: prob.score ?? 0,
    })),
    solved_rate: p.total_count > 0 ? p.solved_count / p.total_count : 0,
  }));

  return {
    total: data.total,
    page: data.page,
    size: data.size,
    progresses,
  };
};

/**
 * 수업 진행도 목록 조회 훅
 * - GET /api/v1/lectures/{lid}/progresses
 * - 페이지네이션: page(기본 1), size(기본 10)
 * - 목록 훅과 동일 정책으로 30초마다 갱신
 */
export const useGetLectureProgresses = (lectureId?: string) => {
  return useQuery({
    queryKey: ["lectureProgresses", lectureId],
    queryFn: () => fetchLectureProgresses(lectureId!),
    enabled: !!lectureId,
    staleTime: 60_000,
  });
};
