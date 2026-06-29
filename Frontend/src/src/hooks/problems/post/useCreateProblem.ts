"use client";

import BaseApi from "@/utils/api";
import { useMutation, UseMutationOptions, useQueryClient } from "@tanstack/react-query";

/** 백엔드 스펙에 맞춘 POST 페이로드 타입들 */
export type Lang = "c" | "cpp" | "java" | "python";

export interface TemplateFilePost {
  filename: string;
  content: string;
}

export interface ProblemPostPayload {
  title: string;
  description: string; // ← content 아님
  type: "GENERAL" | "CHECKER";
  difficulty: "EASY" | "MEDIUM" | "HARD"; // ← level 아님
  limit_time: number;     // ms
  limit_memory: number;   // MB
  share: boolean;
  languages: number[];    // 예: [2,3,4,1]
  template_codes: Array<{
    language: Lang;       // "cpp" | "java" | ...
    files: TemplateFilePost[];
  }>;
  testcases?: Array<{
    input?: { index: number; content: string };
    output?: { index: number; content: string };
  }>;
  checker_code?: string;
  checker_lang?: Lang;
}

export interface CreateProblemBody {
  problemData: ProblemPostPayload;
}

export interface CreateProblemResponse {
  id?: string;
  uuid?: string;
  message?: string;
  [k: string]: unknown;
}

/** fetcher */
export const postCreateProblem = async (
  body: CreateProblemBody
): Promise<CreateProblemResponse> => {
  const { data } = await BaseApi.post<unknown>(
    "/instructor/problems/",
    body
  );
  const raw = data as any;
  const uuid = raw?.uuid ?? raw?.id;
  return { ...raw, uuid, id: uuid ? String(uuid) : raw?.id };
};

/** 훅 */
export const useCreateProblem = (
  options?: UseMutationOptions<CreateProblemResponse, unknown, CreateProblemBody>
) => {
  const queryClient = useQueryClient();
  const {
    onSuccess,
    onError,
    onSettled,
    onMutate,
    ...restOptions
  } = options ?? {};
  return useMutation({
    mutationKey: ["create-problem"],
    mutationFn: postCreateProblem,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: ["problems"] });
      onSuccess?.(data, variables, context);
    },
    onError,
    onSettled,
    onMutate,
    ...restOptions,
  });
};
