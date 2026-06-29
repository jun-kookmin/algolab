// src/hooks/problems/get/all/useGetSubmissionCode.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import BaseApi from "@/utils/api";

export interface SubmissionCodeResponse {
  uuid: string;
  kind: "exam" | "homework";
  code: string;
  language: (number | null)[];
  execution_time: number | null;
  submission_time: string | null;
  memory: number | null;
  score: number | null;
  status: string | null;
  code_length: number;
}

export function useGetSubmissionCode(
  userId: number | null | undefined,
  submissionId: string | null | undefined,
  enabled = true
) {
  const canFetch = enabled && !!userId && !!submissionId;
  return useQuery<SubmissionCodeResponse>({
    queryKey: ["submissionCode", userId, submissionId],
    queryFn: async () => {
      const { data } = await BaseApi.get<SubmissionCodeResponse>(
        `/instructor/submissions/user/${userId}/code/${submissionId}/`
      );
      return {
        ...data,
        uuid: String(data?.uuid ?? submissionId ?? ""),
      };
    },
    enabled: canFetch,
  });
}
