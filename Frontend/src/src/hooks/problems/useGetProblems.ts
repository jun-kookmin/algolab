// src/hooks/problems/useGetProblems.ts
"use client";

import BaseApi from "@/utils/api";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { Question } from "@/types/class";
import { ProblemDifficulty, toDifficulty, DIFFICULTIES } from "@/types/difficulties";
import { Language, mapLanguages } from "@/types/languages";

// API 원본 타입
export interface ProblemItemRaw {
  uuid: string;
  problem_name: string;
  description?: string;
  tags?: string[];
  difficulty: string;
  type?: string;
  language: number[];
  can_edit?: boolean;
  maker_name?: string;
}

export type ProblemListItem = Question & {
  canEdit?: boolean;
};

// API 응답 원본
export interface GetProblemsResponseRaw {
  data: ProblemItemRaw[];
  total?: number;
  page?: number;
  size?: number;
}

// 변환 후 응답
export interface GetProblemsResponse {
  problems: ProblemListItem[];
  total?: number;
  page?: number;
  size?: number;
}

/** 옵션 파라미터(선택) */
export interface GetProblemsParams {
  page?: number;
  size?: number;
  name?: string;
  uuids?: string[];
  tags?: string[];
  difficulty?: ProblemDifficulty;
  language?: Language[];
  // 이 아래는 백엔드와 협의하여 진행해야 함. 아직은 구현 안됨.
  sortBy?: string; // "difficulty" 등
  order?: string; // "asc" 또는 "desc"
}

/** ===== fetcher ===== */
export const fetchProblems = async (
  params: GetProblemsParams = {}
): Promise<GetProblemsResponse> => {
  const requestParams: Record<string, unknown> = { ...params };
  if (Array.isArray(params.uuids)) {
    requestParams.uuids = params.uuids.join(",");
  }
  const { data: rawData } = await BaseApi.get<GetProblemsResponseRaw>(
    `/instructor/problems/`,
    { params: requestParams }
  );
  const convertData = {
    total: rawData.total,
    page: rawData.page,
    size: rawData.size,
    problems: rawData.data.map((p) => ({
      id: String((p as any).uuid ?? (p as any).id ?? ""),
      title: p.problem_name,
      description: p.description ?? "",
      tags: [],
      language: mapLanguages(p.language),
      difficulty: toDifficulty(p.difficulty) ?? DIFFICULTIES.MEDIUM,
      type: p.type ?? "GENERAL",
      canEdit: Boolean(p.can_edit),
      makerName: p.maker_name ?? "",
    })),
  };
  return convertData;
};

/** ===== 훅 ===== */
export const useGetProblems = (
  params: GetProblemsParams = {},
  options?: Omit<
    UseQueryOptions<GetProblemsResponse, Error, GetProblemsResponse>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery({
    queryKey: ["problems", params],
    queryFn: () => fetchProblems(params),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    ...options,
  });
};
