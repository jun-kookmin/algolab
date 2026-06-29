"use client";

import BaseApi from "@/utils/api";
import { formatDisplayName } from "@/utils/name";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";

export interface LectureStudentActivityRow {
  user_id: number | null;
  student_code: string;
  full_name: string;
  post_count: number;
  reply_count: number;
  total_count: number;
}

export interface LectureStudentActivitySummary {
  post_count: number;
  reply_count: number;
  total_count: number;
}

export interface LectureStudentActivityResponse {
  lecture_uuid: string;
  start_date: string | null;
  end_date: string | null;
  total: number;
  summary: LectureStudentActivitySummary;
  data: LectureStudentActivityRow[];
}

interface ActivityParams {
  startDate?: string;
  endDate?: string;
}

const fetchLectureStudentActivity = async (
  lectureId: string,
  params: ActivityParams
): Promise<LectureStudentActivityResponse> => {
  const { data } = await BaseApi.get<LectureStudentActivityResponse>(
    `/instructor/lectures/${lectureId}/student-activity/`,
    {
      params: {
        ...(params.startDate ? { start_date: params.startDate } : {}),
        ...(params.endDate ? { end_date: params.endDate } : {}),
      },
    }
  );

  return {
    ...data,
    data: (data.data ?? []).map((row) => ({
      ...row,
      full_name: formatDisplayName(row.full_name ?? ""),
      post_count: Number(row.post_count ?? 0),
      reply_count: Number(row.reply_count ?? 0),
      total_count: Number(row.total_count ?? 0),
    })),
    summary: {
      post_count: Number(data.summary?.post_count ?? 0),
      reply_count: Number(data.summary?.reply_count ?? 0),
      total_count: Number(data.summary?.total_count ?? 0),
    },
  };
};

export const useGetLectureStudentActivity = (
  lectureId: string,
  params: ActivityParams,
  options?: Omit<
    UseQueryOptions<
      LectureStudentActivityResponse,
      Error,
      LectureStudentActivityResponse
    >,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery({
    queryKey: [
      "lectureStudentActivity",
      lectureId,
      params.startDate ?? "",
      params.endDate ?? "",
    ],
    queryFn: () => fetchLectureStudentActivity(lectureId, params),
    enabled: (options?.enabled ?? true) && !!lectureId,
    staleTime: 60_000,
    ...(options ?? {}),
  });
};
