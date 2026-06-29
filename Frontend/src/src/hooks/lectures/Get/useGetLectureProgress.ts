// src/hooks/lectures/useGetLectureProgress.ts
"use client";

import BaseApi from "@/utils/api";
import { useQuery } from "@tanstack/react-query";

export type ProblemStatus = "CORRECT" | "WRONG" | "NOT_SUBMITTED";

// 클라이언트에서 쓰는 타입
export interface ProgressProblemDetail {
  problem_id: string;
  title: string;
  status: ProblemStatus;
  attempt_count: number;
  last_submitted_at: string | null;
}

export interface LectureProgressDetail {
  user_id: number;
  name: string;
  student_number: string;
  solved_count: number;
  total_count: number;
  problems: ProgressProblemDetail[];
  solved_rate: number; // 파생값
}

// 서버에서 내려오는 원본 타입
interface RawProgressProblemDetail {
  id?: number | string;
  problem_uuid?: string;
  problem_id?: number | string;
  status: ProblemStatus;
  attempt_count: number;
  last_submitted_at?: string | null;
  score?: number;
  language?: number[];
  title?: string; // 서버에 없을 수도 있음
}

interface RawLectureProgressDetail {
  user_id: number;
  name: string;
  student_number: string;
  solved_count: number;
  total_count: number;
  problems: RawProgressProblemDetail[];
}

const normalizeProblemId = (p: RawProgressProblemDetail) =>
  String(p.problem_uuid ?? p.problem_id ?? p.id ?? "");

const mapProblem = (p: RawProgressProblemDetail): ProgressProblemDetail => ({
  problem_id: normalizeProblemId(p),
  title: p.title ?? "", // 없으면 빈 문자열로 안전 처리
  status: p.status,
  attempt_count: p.attempt_count ?? 0,
  last_submitted_at: p.last_submitted_at ?? null,
});

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
    name: data.name,
    student_number: data.student_number,
    solved_count: data.solved_count,
    total_count: data.total_count,
    problems,
    solved_rate:
      data.total_count > 0 ? data.solved_count / data.total_count : 0,
  };
};

export const useGetLectureProgress = (lectureId?: string, userId?: number) => {
  return useQuery({
    queryKey: ["lectureProgress", lectureId, userId],
    queryFn: () => fetchLectureProgress(lectureId!, userId!),
    enabled: !!lectureId && !!userId,
    staleTime: 60_000,
  });
};
