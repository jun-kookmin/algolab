"use client";

import { useQuery } from "@tanstack/react-query";
import BaseApi from "@/utils/api";

export type HomeworkStatus = "CORRECT" | "WRONG" | "NOT_SUBMITTED";

export interface HomeworkProblem {
  uuid: string;
  problem_uuid: string;
  section_problem_uuid: string;
  title?: string;
  score: number;
  attempt_count: number;
  first_correct_attempt_count?: number;
  submission_count?: number;
  ju_count?: number;
  status: HomeworkStatus;
  is_late?: boolean;
  language?: number[];
  execution_time?: number;
  submission_time: string;
  memory?: number;
  code_length?: number;
}

export interface HomeworkSubmission {
  user_id: number;
  student_number: string;
  solved_count: number;
  total_count: number;
  problems: HomeworkProblem[];
}

export interface HomeworkSubmissionResponse {
  total: number;
  size: number;
  data: HomeworkSubmission[];
  problem_catalog?: Array<{
    section_problem_uuid: string;
    title: string;
  }>;
}

type Options = {
  lite?: boolean;
};

// API 호출 함수
async function fetchHomeworkSubmissions(lectureId: string, opts?: Options) {
  const params: Record<string, string | number> = {};
  if (opts?.lite) {
    params.lite = 1;
  }

  const res = await BaseApi.get<HomeworkSubmissionResponse>(
    `/instructor/lectures/${lectureId}/submissions/homework/homework/`,
    Object.keys(params).length ? { params } : undefined
  );
  return res.data;
}

// 훅
export function useGetHomeworkSubmissions(
  lectureId: string,
  enabled: boolean,
  opts?: Options
) {
  return useQuery({
    queryKey: ["homeworkSubmissions", lectureId, opts?.lite ? "lite" : "full"],
    queryFn: () => fetchHomeworkSubmissions(lectureId, opts),
    enabled,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
