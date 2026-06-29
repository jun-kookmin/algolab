// src/hooks/lectures/useGetExam.ts
"use client";

import BaseApi from "@/utils/api";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";

/** 서버 응답 스펙 */
export interface ExamProblemLite {
  id: string;
  problem_id: string;
  title: string;
  language: number[];
  score: number;
}

export interface ExamDetail {
  exam_id: string;
  title: string;
  problems: ExamProblemLite[];
  start_date: string;
  due_date: string;
}

/** fetcher */
export const fetchExam = async (
  lectureId: string,
  examId: string
): Promise<ExamDetail> => {
  const { data } = await BaseApi.get<unknown>(
    `/instructor/lectures/${lectureId}/exams/${examId}/`
  );
  const raw = data as any;
  return {
    exam_id: String(raw?.exam_uuid ?? raw?.exam_id ?? raw?.uuid ?? ""),
    title: raw?.title ?? "",
    problems: (raw?.problems ?? []).map((p: any) => ({
      id: String(p.exam_problem_uuid ?? p.exam_problem_id ?? p.id ?? ""),
      problem_id: String(p.problem_uuid ?? p.problem_id ?? p.uuid ?? ""),
      title: p.title ?? p.problem_name ?? "",
      language: p.language ?? [],
      score: p.score ?? p.points ?? 100,
    })),
    start_date: raw?.start_date ?? "",
    due_date: raw?.due_date ?? "",
  };
};

/** 커스텀 훅 */
export const useGetExam = (
  lectureId?: string,
  examId?: string,
  options?: Omit<
    UseQueryOptions<ExamDetail, Error, ExamDetail>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery({
    queryKey: ["exam", lectureId, examId],
    queryFn: () => fetchExam(lectureId as string, examId as string),
    enabled: !!lectureId && !!examId,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    ...options,
  });
};
