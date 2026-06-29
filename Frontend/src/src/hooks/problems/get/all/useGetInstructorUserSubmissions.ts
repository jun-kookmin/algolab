"use client";

import { useQuery } from "@tanstack/react-query";
import BaseApi from "@/utils/api";

export interface InstructorSubmission {
  id: string;
  username?: string;
  student_number?: string;
  display_name?: string;
  problem_id: string;
  problem_uuid?: string;
  exam_problem_uuid?: string;
  exam_problem_id?: string | number;
  title: string;
  score: number;
  attempt_count: number;
  ju_count: number;
  status: "CORRECT" | "WRONG" | "NOT_SUBMITTED";
  language: (number | null)[];
  code: string;
  execution_time: number;
  submission_time: string;
  memory: number;
  code_length: number;
}

export function useGetInstructorUserSubmissions(
  userId: number,
  enabled = true,
  options?: {
    includeCode?: boolean;
    initialData?: InstructorSubmission[];
    staleTime?: number;
    refetchOnWindowFocus?: boolean;
  }
) {
  const includeCode = options?.includeCode ?? true;
  return useQuery<InstructorSubmission[]>({
    queryKey: ["instructorUserSubmissions", userId, includeCode],
    queryFn: async () => {
      const res = await BaseApi.get(
        `/instructor/submissions/user/${userId}/`,
        includeCode ? undefined : { params: { include_code: 0 } }
      );
      const rows = Array.isArray(res.data) ? res.data : [];
      return rows.map((r: any) => ({
        ...r,
        id: String(r.uuid ?? r.id ?? ""),
        username:
          r?.username != null ? String(r.username) : undefined,
        student_number:
          r?.student_number != null ? String(r.student_number) : undefined,
        display_name:
          r?.display_name != null ? String(r.display_name) : undefined,
        problem_id: String(r.problem_uuid ?? r.problem_id ?? ""),
        problem_uuid:
          r.problem_uuid != null ? String(r.problem_uuid) : undefined,
        exam_problem_uuid:
          r.exam_problem_uuid != null ? String(r.exam_problem_uuid) : undefined,
        exam_problem_id: r.exam_problem_id ?? undefined,
      }));
    },
    enabled: enabled && !!userId,
    initialData: options?.initialData,
    staleTime: options?.staleTime,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
  });
}
