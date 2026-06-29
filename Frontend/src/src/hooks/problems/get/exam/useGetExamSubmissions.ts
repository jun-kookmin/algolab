// src/hooks/lectures/useGetExamSubmissions.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import BaseApi from "@/utils/api";
import { formatDisplayName } from "@/utils/name";

export type ExamStatus = "CORRECT" | "WRONG" | "NOT_SUBMITTED";

export interface ExamLanguage {
  id: number;
  language_name: string;
}

export interface ExamProblem {
  uuid?: string;
  problem_uuid?: string;
  section_problem_uuid: string;
  title?: string;
  status: ExamStatus;
  score: number;
  submission_time: string; // ISO string
  language?: number[];
  attempt_count?: number;
  execution_time?: number;
  memory?: number;
  code_length?: number;
  ip?: string;
}

export interface ExamSubmission {
  user_id: number;
  student_number: string;
  name?: string;
  solved_count: number;
  total_count: number;
  total_problem_count?: number;
  problems: ExamProblem[];
  start_time?: string | null;
  finished_at?: string | null;
  finished_by_user?: boolean;
  // 파생 필드(편의): 정답률
  solved_rate?: number; // 0~1
}

export interface ExamSubmissionResponse {
  total: number;
  size: number;
  data: ExamSubmission[];
  problem_ids?: string[];
  problem_catalog?: Array<{
    section_problem_uuid: string;
    title: string;
    exam_id?: string;
  }>;
}

type Options = {
  page?: number; // 서버가 지원하면 사용
  size?: number; // 서버가 지원하면 사용
  enabled?: boolean;
  lite?: boolean;
  refetchIntervalMs?: number | false;
};

/** API 호출 함수 */
const isUuidLike = (value?: string): boolean => {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
};

export async function fetchExamSubmissions(
  lectureId: string,
  examId?: string,
  opts?: Options
) {
  const params: Record<string, string | number> = {};
  if (opts?.page !== undefined) params.page = opts.page;
  if (opts?.size !== undefined) params.size = opts.size;
  if (opts?.lite) params.lite = 1;
  if (examId) {
    if (isUuidLike(examId)) {
      params.exam_uuid = examId;
    } else {
      params.exam_id = examId;
    }
  }

  const res = await BaseApi.get<ExamSubmissionResponse>(
    `/instructor/lectures/${lectureId}/submissions/exam/exam/`,
    Object.keys(params).length ? { params } : undefined
  );
  return res.data;
}

/** 훅 */
export function useGetExamSubmissions(
  lectureId?: string,
  examId?: string,
  enabled?: boolean,
  opts?: Options
) {
  const canFetch = (enabled ?? true) && !!lectureId;
  return useQuery({
    queryKey: ["examSubmissions", lectureId, examId, opts?.lite ? "lite" : "full"],
    queryFn: () => fetchExamSubmissions(lectureId as string, examId, opts),
    enabled: canFetch,
    refetchInterval: opts?.refetchIntervalMs ?? false,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    select: (raw): ExamSubmissionResponse => ({
      ...raw,
      data: raw.data.map((s) => ({
        ...s,
        name: formatDisplayName(s.name ?? ""),
        solved_rate: s.total_count > 0 ? s.solved_count / s.total_count : 0,
      })),
    }),
  });
}
