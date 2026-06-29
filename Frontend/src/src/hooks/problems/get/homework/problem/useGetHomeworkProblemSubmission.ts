// src/hooks/submissions/useGetHomeworkUserSubmission.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import BaseApi from "@/utils/api";

// 뷰 공통 정규화 타입 (exam과 동일 구조)
export type JudgeStatus = "CORRECT" | "WRONG" | "NOT_SUBMITTED";

export interface SubmissionDetail {
  source: "EXAM" | "HOMEWORK";
  id: string;
  lectureId: string;
  userId: number;
  problemId: string;
  code: string;
  score: number;
  status: JudgeStatus;
  // 서버가 id 배열만 주므로 number[]
  languages: number[];
  submissionTime: string;
  executionTime: number;
  submissionCount: number;
  memory: number;
}

// 서버 응답 타입(배열 구조)
interface HomeworkUserSubmissionRaw {
  lecture_uuid: string;
  user_id?: number;
  section_problem_uuid: string;
  count: number;
  results: HomeworkSubmissionResultRaw[];
}

interface HomeworkSubmissionResultRaw {
  uuid: string;
  user: number;
  section_problem_uuid: string;
  code: string;
  score: number;
  language: number[]; // ✔ 서버 필드명: language
  submission_time: string;
  execution_time: number;
  submission_count: number;
  status: JudgeStatus;
  memory: number;
}

async function fetchHomeworkUserSubmission(
  lectureId: string,
  userId: number,
  sectionProblemId: string
) {
  const res = await BaseApi.get<HomeworkUserSubmissionRaw>(
    `/instructor/lectures/${lectureId}/submissions/homework/homework/${userId}/users/${sectionProblemId}/`
  );
  return res.data;
}

export function useGetHomeworkProblemSubmission(
  lectureId: string,
  userId: number,
  sectionProblemId: string,
  opts?: { enabled?: boolean }
) {
  const enabled = opts?.enabled ?? !!(lectureId && userId && sectionProblemId);

  return useQuery({
    queryKey: ["homeworkUserSubmissions", lectureId, userId, sectionProblemId],
    queryFn: () =>
      fetchHomeworkUserSubmission(lectureId, userId, sectionProblemId),
    enabled,
    select: (raw): SubmissionDetail[] =>
      raw.results
        .slice()
        .sort(
          (a, b) =>
            new Date(b.submission_time).getTime() -
            new Date(a.submission_time).getTime()
        )
        .map((r) => ({
          source: "HOMEWORK",
          id: String(r.uuid ?? ""),
          lectureId: raw.lecture_uuid,
          userId: raw.user_id ?? userId,
          problemId: raw.section_problem_uuid, // 정규화
          code: r.code,
          score: r.score,
          status: r.status,
          languages: r.language, // ✔ number[] 그대로
          submissionTime: r.submission_time,
          executionTime: r.execution_time,
          submissionCount: r.submission_count,
          memory: r.memory,
        })),
  });
}
