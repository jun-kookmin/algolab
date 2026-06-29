// src/hooks/submissions/useGetExamUserSubmission.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import BaseApi from "@/utils/api";

export type JudgeStatus = "CORRECT" | "WRONG" | "NOT_SUBMITTED";

export interface Language {
  id: number;
  language_name: string;
}

// 서버 응답 타입 (바뀐 구조 반영)
export interface ExamUserSubmissionRaw {
  lecture_uuid: string;
  user_id?: number;
  exam_problem_uuid: string;
  count: number;
  results: ExamSubmissionResultRaw[];
}

export interface ExamSubmissionResultRaw {
  uuid: string;
  user: number;
  problem_uuid: string; // exam problem (서버 필드)
  code: string;
  score: number;
  language: number[]; // 서버는 id 배열만 줌
  submission_time: string;
  execution_time: number;
  submission_count: number;
  status: JudgeStatus;
  memory: number;
}

// 뷰에서 쓰기 좋은 정규화 타입
export interface SubmissionDetail {
  source: "EXAM" | "HOMEWORK";
  id: string;
  lectureId: string;
  userId: number;
  problemId: string;
  code: string;
  score: number;
  status: JudgeStatus;
  languages: number[]; // 지금은 id 배열이므로 그대로 둠
  submissionTime: string;
  executionTime: number;
  submissionCount: number;
  memory: number;
}

async function fetchExamUserSubmission(
  lectureId: string,
  userId: number,
  examProblemId: string
) {
  const res = await BaseApi.get<ExamUserSubmissionRaw>(
    `/instructor/lectures/${lectureId}/submissions/exam/exam/${userId}/users/${examProblemId}/`
  );
  return res.data;
}

export function useGetExamProblemSubmission(
  lectureId: string,
  userId: number,
  examProblemId: string,
  opts?: { enabled?: boolean }
) {
  const enabled = opts?.enabled ?? !!(lectureId && userId && examProblemId);

  return useQuery({
    queryKey: ["examUserSubmissions", lectureId, userId, examProblemId],
    queryFn: () => fetchExamUserSubmission(lectureId, userId, examProblemId),
    enabled,
    select: (raw): SubmissionDetail[] =>
      raw.results
        .slice() // 원본 배열 변형 방지
        .sort(
          (a, b) =>
            new Date(b.submission_time).getTime() -
            new Date(a.submission_time).getTime()
        )
        .map((r) => ({
          source: "EXAM",
          id: String(r.uuid ?? ""),
          lectureId: raw.lecture_uuid,
          userId: raw.user_id ?? userId,
          problemId: raw.exam_problem_uuid,
          code: r.code,
          score: r.score,
          status: r.status,
          languages: r.language,
          submissionTime: r.submission_time,
          executionTime: r.execution_time,
          submissionCount: r.submission_count,
          memory: r.memory,
        })),
  });
}
