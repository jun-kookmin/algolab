"use client";

import { useQuery } from "@tanstack/react-query";
import BaseApi from "@/utils/api";

export interface HomeworkSolvedSubmissionItem {
  submissionUuid: string;
  userId?: number;
  isOwner?: boolean;
  username?: string;
  name?: string;
  userGroup?: string;
  studentNumber?: string;
  status: string;
  score: number | null;
  code: string;
  codeLength: number;
  canViewCode: boolean;
  language: number[];
  executionTime: number | null;
  memory: number | null;
  submissionTime: string;
  viewCount: number;
  likeCount: number;
  likedByMe: boolean;
}

export interface HomeworkSolvedSummaryStats {
  total: number;
  correct: number;
  wrong: number;
  timeout: number;
  memoryOver: number;
  compileError: number;
  runtimeError: number;
  serverError: number;
}

export interface HomeworkSolvedSubmissionResponse {
  lectureUuid: string;
  sectionUuid: string;
  sectionProblemUuid: string;
  problemUuid: string;
  problemTitle: string;
  count: number;
  summaryStats: HomeworkSolvedSummaryStats;
  results: HomeworkSolvedSubmissionItem[];
}

interface HomeworkSolvedSubmissionRaw {
  lecture_uuid: string;
  section_uuid: string;
  section_problem_uuid: string;
  problem_uuid: string;
  problem_title: string;
  count: number;
  summary_stats?: {
    total?: number;
    correct?: number;
    wrong?: number;
    timeout?: number;
    memory_over?: number;
    compile_error?: number;
    runtime_error?: number;
    server_error?: number;
  };
  results: Array<{
  submission_uuid: string;
    user_id?: number;
    is_owner?: boolean;
    username?: string;
    name?: string;
    user_group?: string;
    student_number?: string;
    status: string;
    score?: number | null;
    code?: string;
    code_length?: number;
    can_view_code?: boolean;
    language: number[];
    execution_time: number | null;
    memory: number | null;
    submission_time: string;
    view_count: number;
    like_count: number;
    liked_by_me?: boolean;
  }>;
}

interface HomeworkSolvedInteractionRaw {
  submission_uuid: string;
  like_count: number;
  view_count: number;
  code?: string;
  liked_by_me?: boolean;
}

async function fetchHomeworkSolvedSubmissions(
  lectureId: string,
  sectionProblemId: string
): Promise<HomeworkSolvedSubmissionResponse> {
  const { data } = await BaseApi.get<HomeworkSolvedSubmissionRaw>(
    `/instructor/lectures/${lectureId}/submissions/homework/problem/${sectionProblemId}/solved/`
  );

  return {
    lectureUuid: data.lecture_uuid,
    sectionUuid: data.section_uuid,
    sectionProblemUuid: data.section_problem_uuid,
    problemUuid: data.problem_uuid,
    problemTitle: data.problem_title,
    count: data.count,
    summaryStats: {
      total: data.summary_stats?.total ?? 0,
      correct: data.summary_stats?.correct ?? 0,
      wrong: data.summary_stats?.wrong ?? 0,
      timeout: data.summary_stats?.timeout ?? 0,
      memoryOver: data.summary_stats?.memory_over ?? 0,
      compileError: data.summary_stats?.compile_error ?? 0,
      runtimeError: data.summary_stats?.runtime_error ?? 0,
      serverError: data.summary_stats?.server_error ?? 0,
    },
    results: (data.results ?? []).map((r) => ({
      submissionUuid: r.submission_uuid,
      userId: r.user_id,
      isOwner: r.is_owner ?? false,
      username: r.username,
      name: r.name || r.username,
      userGroup: (r.user_group ?? "").toLowerCase(),
      studentNumber: r.student_number,
      status: r.status,
      score: typeof r.score === "number" ? r.score : null,
      code: r.code ?? "",
      codeLength: r.code_length ?? (r.code?.length ?? 0),
      canViewCode: !!r.can_view_code,
      language: r.language ?? [],
      executionTime: r.execution_time,
      memory: r.memory,
      submissionTime: r.submission_time,
      viewCount: r.view_count ?? 0,
      likeCount: r.like_count ?? 0,
      likedByMe: !!r.liked_by_me,
    })),
  };
}

export async function postHomeworkSolvedCodeView(
  lectureId: string,
  sectionProblemId: string,
  submissionUuid: string
) {
  const { data } = await BaseApi.post<HomeworkSolvedInteractionRaw>(
    `/instructor/lectures/${lectureId}/submissions/homework/problem/${sectionProblemId}/solved/${submissionUuid}/view/`
  );

  return {
    submissionUuid: data.submission_uuid,
    likeCount: data.like_count ?? 0,
    viewCount: data.view_count ?? 0,
    code: data.code ?? "",
    likedByMe: !!data.liked_by_me,
  };
}

export async function postHomeworkSolvedCodeLike(
  lectureId: string,
  sectionProblemId: string,
  submissionUuid: string
) {
  const { data } = await BaseApi.post<HomeworkSolvedInteractionRaw>(
    `/instructor/lectures/${lectureId}/submissions/homework/problem/${sectionProblemId}/solved/${submissionUuid}/like/`
  );

  return {
    submissionUuid: data.submission_uuid,
    likeCount: data.like_count ?? 0,
    viewCount: data.view_count ?? 0,
    likedByMe: !!data.liked_by_me,
  };
}

export function useGetHomeworkSolvedSubmissions(
  lectureId?: string,
  sectionProblemId?: string,
  opts?: { enabled?: boolean }
) {
  const enabled =
    opts?.enabled ?? Boolean(lectureId && sectionProblemId);

  return useQuery({
    queryKey: ["homeworkSolvedSubmissions", lectureId, sectionProblemId],
    queryFn: () =>
      fetchHomeworkSolvedSubmissions(lectureId as string, sectionProblemId as string),
    enabled,
    staleTime: 30_000,
  });
}
