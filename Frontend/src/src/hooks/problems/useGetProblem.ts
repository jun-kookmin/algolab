// ──── FILE: src/hooks/problems/useGetProblem.ts ────
"use client";

import BaseApi from "@/utils/api";
import { useQuery, useQueries } from "@tanstack/react-query";
import { DIFFICULTIES, toDifficulty } from "@/types/difficulties";
import { QusetionDetail } from "@/types/class";
import { Language, mapLanguages, toLanguageFromName } from "@/types/languages";
import { fetchProblems } from "@/hooks/problems/useGetProblems";

const PROBLEM_BATCH_SIZE = 100;

/** 서버 상세 응답 스키마 (raw) */
export type ProblemTypeApi = "GENERAL" | "CHECKER";

export interface ProblemCaseItem {
  index: number;
  content: string;
}

export interface ProblemTestcasePayload {
  input?: ProblemCaseItem;
  output?: ProblemCaseItem;
}

export interface ProblemDetailApiRaw {
  uuid: string;
  problem_name?: string;
  problemName?: string;
  description?: string | null;
  content?: string | null;
  title?: string;
  difficulty: string;
  type: ProblemTypeApi;
  limit_time: number;
  limit_memory: number;
  language: number[];
  template_codes?: Array<{
    language: Language;
    files: Array<{ filename: string; content: string }>;
  }>;
  testcases?: ProblemTestcasePayload[];
  checker_code?: string | null;
  share?: boolean;
  can_edit?: boolean;
  content_path?: string | null;
}

export interface ProblemDetailForEdit extends Omit<QusetionDetail, "language" | "template_codes"> {
  id: string;
  title: string;
  uuid: string;
  problem_name: string;
  content: string;
  checker_code: string | null;
  share: boolean;
  canEdit: boolean;
  content_path: string | null;
  language: Language[];
  template_codes: Array<{
    language: Language;
    files: Array<{ filename: string; content: string }>;
  }>;
  testcases: ProblemTestcasePayload[];
}

type FetchProblemOptions = {
  includeTestcases?: boolean;
};

/** raw → QusetionDetail 변환 */
const toQDetail = (
  n: ProblemDetailApiRaw,
  includeTestcases = false,
): ProblemDetailForEdit => {
  const title = n.problem_name ?? n.problemName ?? n.title ?? "";
  const description = n.description ?? n.content ?? "";

  // 템플릿 언어 수집 (중복 제거)
  const langs: Language[] = mapLanguages(n.language);
  const templateCodes = (Array.isArray(n.template_codes) ? n.template_codes : [])
    .map((tc) => {
      const language = toLanguageFromName(tc.language);
      if (!language) return undefined;
      return {
        language,
        files: tc.files,
      };
    })
    .filter((tc): tc is { language: Language; files: Array<{ filename: string; content: string }> } => tc !== undefined);

  const testcases = includeTestcases
    ? Array.isArray(n.testcases)
      ? n.testcases
      : []
    : [];

  return {
    id: String((n as any).uuid ?? (n as any).id ?? ""),
    title,
    content: description,
    description,
    tags: [], // 서버에 태그가 없으므로 빈 배열
    difficulty: toDifficulty(n.difficulty) ?? DIFFICULTIES.MEDIUM,
    language: langs,
    type: n.type, // "GENERAL" | "CHECKER" (string 유지)
    limit_time: n.limit_time,
    limit_memory: n.limit_memory,
    template_codes: templateCodes,
    testcases,
    uuid: n.uuid,
    problem_name: title,
    checker_code: n.checker_code ?? null,
    share: Boolean(n.share),
    canEdit: Boolean(n.can_edit),
    content_path: n.content_path ?? null,
  };
};

/** 단건 fetcher (QusetionDetail 반환) */
export const fetchProblem = async (
  problemId: string,
  options: FetchProblemOptions = {},
): Promise<ProblemDetailForEdit> => {
  const includeTestcases = options.includeTestcases === true;
  const { data } = await BaseApi.get<ProblemDetailApiRaw>(
    `/instructor/problems/${problemId}/`,
    includeTestcases ? undefined : { params: { lite: 1 } }
  );
  const convertData = toQDetail(data, includeTestcases);
  return convertData;
};

/** 단건 훅 (v5) — QusetionDetail */
export const useGetProblem = (
  problemId?: string,
  options: FetchProblemOptions = {},
) => {
  const includeTestcases = options.includeTestcases === true;
  return useQuery({
    queryKey: ["problem", problemId, includeTestcases],
    queryFn: () => fetchProblem(problemId as string, { includeTestcases }),
    enabled: !!problemId,
    refetchOnMount: false,
    staleTime: 30_000,
  });
};

/** 여러 ID를 일괄 조회하고, 상세가 필요할 때만 단건 상세 API를 사용한다. */
export const useGetProblemsByIds = (
  ids: string[],
  options: FetchProblemOptions = {},
) => {
  const includeTestcases = options.includeTestcases === true;
  const normalizedIds = Array.from(
    new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean))
  );

  const liteBatchQuery = useQuery({
    queryKey: ["problems-by-ids", normalizedIds],
    queryFn: async () => {
      const chunks: string[][] = [];
      for (let i = 0; i < normalizedIds.length; i += PROBLEM_BATCH_SIZE) {
        chunks.push(normalizedIds.slice(i, i + PROBLEM_BATCH_SIZE));
      }

      const responses = await Promise.all(
        chunks.map((chunk) =>
          fetchProblems({
            page: 1,
            size: chunk.length,
            uuids: chunk,
          })
        )
      );
      return responses.flatMap((response) => response.problems);
    },
    enabled: !includeTestcases && normalizedIds.length > 0,
    staleTime: 30_000,
  });

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["problem", id, includeTestcases],
      queryFn: () => fetchProblem(id, { includeTestcases }),
      enabled: includeTestcases && !!id,
      staleTime: 30_000,
    })),
  });

  const map = new Map<string, ProblemDetailForEdit>();
  if (!includeTestcases) {
    for (const problem of liteBatchQuery.data ?? []) {
      map.set(problem.id, {
        id: problem.id,
        title: problem.title,
        content: problem.description,
        description: problem.description,
        tags: problem.tags ?? [],
        difficulty: problem.difficulty,
        language: problem.language,
        type: String((problem as any).type ?? "GENERAL"),
        limit_time: 0,
        limit_memory: 0,
        template_codes: [],
        testcases: [],
        uuid: problem.id,
        problem_name: problem.title,
        checker_code: null,
        share: false,
        canEdit: Boolean((problem as any).canEdit),
        content_path: null,
      });
    }
  } else {
    results.forEach((r, i) => {
      const id = ids[i];
      if (r.data) map.set(id, r.data);
    });
  }

  const data = ids.map((id) => map.get(id)); // 순서/중복 보존, 로딩 중은 undefined
  const isLoading = includeTestcases
    ? ids.length > 0 && results.some((r) => r.isLoading && !r.data)
    : !!liteBatchQuery.isLoading;
  const isFetching = includeTestcases
    ? results.some((r) => r.isFetching)
    : !!liteBatchQuery.isFetching;
  const error = includeTestcases
    ? (results.find((r) => r.error)?.error as Error | undefined)
    : (liteBatchQuery.error as Error | undefined);

  return { data, isLoading, isFetching, error };
};
