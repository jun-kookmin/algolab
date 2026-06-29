// ──── FILE: /algolab/Frontend/src/src/hooks/solve/GET/useGetExamInfo.ts ────
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  toLanguage,
  mapLanguages,
  type Language,
} from "@/types/languages";
import type { FileData, LangKey, ProblemUI } from "@/types/solve";
import { getApiBase } from "@/utils/apiBase";

const API_BASE = getApiBase();

interface ExamProblemApiItem {
  id?: number | string;
  uuid?: string;
  section_problem_uuid?: string;
  exam_problem_uuid?: string;
  problem_name: string;
  description?: string | null;
  difficulty?: string | null;
  language?: number[] | string[] | string | number | null;
  type?: string | null;
  limit_time?: number | null;
  limit_memory?: number | null;
  content_path?: string | null;
  checker_code?: string | null;
  template_codes?: Array<{
    language: unknown;
    files?: Array<{ filename: string; content?: string | null }>;
  }>;
}

interface UseGetExamProblemsOptions {
  compact?: boolean;
  enabled?: boolean;
}

function defaultFilenameByLangKey(lang: Language) {
  switch (lang) {
    case "c":
      return "main.c";
    case "cpp":
      return "main.cpp";
    case "java":
      return "Main.java";
    case "python":
      return "main.py";
    default:
      return "main.txt";
  }
}

function toInternalLanguage(v: unknown): Language | undefined {
  if (typeof v === "number") return mapLanguages([v])[0];
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return mapLanguages([Number(v)])[0];
  }
  if (typeof v === "string") {
    const direct = toLanguage(v);
    if (direct) return direct;
    const norm = v.trim().toLowerCase().replace(/\s+/g, "").replace(/\+\+/g, "pp");
    return toLanguage(norm);
  }
  return undefined;
}

function normalizeTemplateCodes(
  value: unknown,
  fallbackLanguage?: Language
): Array<{ language: LangKey; files: FileData[] }> {
  const fallback: Language = fallbackLanguage ?? "cpp";

  if (Array.isArray(value)) {
    return value.map((t: any) => {
      const lang = (toInternalLanguage(t?.language) ?? fallback) as LangKey;
      const files = (Array.isArray(t?.files) ? t.files : []).map((f: any) => ({
        filename: String(f?.filename ?? defaultFilenameByLangKey(lang)),
        language: lang,
        code: String(f?.content ?? f?.code ?? ""),
      })) as FileData[];
      return { language: lang, files };
    });
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return normalizeTemplateCodes(parsed, fallback);
    } catch {
      const lang = fallback as LangKey;
      return [
        {
          language: lang,
          files: [
            {
              filename: defaultFilenameByLangKey(lang),
              language: lang,
              code: value,
            },
          ],
        },
      ];
    }
  }

  if (value && typeof value === "object") {
    const obj = value as any;
    const entries = Object.entries(obj);
    if (entries.length) {
      return entries.map(([langKey, filesOrCode]) => {
        const lang = (toInternalLanguage(langKey) ?? fallback) as LangKey;
        if (Array.isArray(filesOrCode)) {
          const files = (filesOrCode as any[]).map((f) => ({
            filename: String(f?.filename ?? defaultFilenameByLangKey(lang)),
            language: lang,
            code: String(f?.content ?? ""),
          })) as FileData[];
          return { language: lang, files };
        }
        if (typeof filesOrCode === "string") {
          return {
            language: lang,
            files: [
              {
                filename: defaultFilenameByLangKey(lang),
                language: lang,
                code: filesOrCode,
              },
            ],
          };
        }
        return { language: lang, files: [] as FileData[] };
      });
    }
  }

  return [];
}

function normalizeProblemItem(item: ExamProblemApiItem): ProblemUI {
  const apiLanguages: LangKey[] = [];

  if (Array.isArray(item.language)) {
    for (const langValue of item.language) {
      const converted = toInternalLanguage(langValue);
      if (converted && !apiLanguages.includes(converted)) {
        apiLanguages.push(converted);
      }
    }
  } else if (item.language != null) {
    const converted = toInternalLanguage(item.language);
    if (converted && !apiLanguages.includes(converted)) {
      apiLanguages.push(converted);
    }
  }

  const hintLang: Language | undefined = apiLanguages[0];
  const normalizedTC = normalizeTemplateCodes(item.template_codes, hintLang);

  const byLang: Record<LangKey, FileData[]> = {
    c: [],
    cpp: [],
    python: [],
    java: [],
  };
  for (const t of normalizedTC) {
    byLang[t.language] = t.files ?? [];
  }

  const ALL_LANGS: LangKey[] = ["c", "cpp", "python", "java"];
  const languageSet = new Set<LangKey>(apiLanguages);
  for (const lang of ALL_LANGS) {
    if ((byLang[lang]?.length ?? 0) > 0) languageSet.add(lang);
  }
  const langs = ALL_LANGS.filter((lang) => languageSet.has(lang));

  const defaultLang: LangKey =
    (["cpp", "python", "java", "c"] as const).find((k) => langs.includes(k)) ??
    "cpp";

  const problemId = String(
    (item as any).section_problem_uuid ??
      (item as any).exam_problem_uuid ??
      (item as any).uuid ??
      (item as any).id ??
      ""
  );
  const problemUuid = (item as any).uuid ?? (item as any).problem_uuid ?? null;

  return {
    id: problemId,
    problemUuid: problemUuid ? String(problemUuid) : undefined,
    title: item.problem_name,
    description: item.description ?? "",
    pdf: item.content_path ?? null,
    limit_time: item.limit_time ?? null,
    limit_memory: item.limit_memory ?? null,
    languages: langs,
    templatesByLang: byLang,
    defaultLang,
  };
}

async function fetchExamProblems(
  examId: string,
  ids: string[],
  signal?: AbortSignal,
  options: UseGetExamProblemsOptions = {}
): Promise<ProblemUI[]> {
  const compact = Boolean(options.compact);
  const idsParam = ids.map((id) => encodeURIComponent(id)).join(",");
  const encodedExamId = encodeURIComponent(examId);
  const params = new URLSearchParams({ ids: idsParam });
  if (compact) {
    params.set("compact", "1");
  }

  const url = `${API_BASE}/instructor/solve/exam/${encodedExamId}/problem/?${params.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Algolab-Client": "web",
    },
    credentials: "include",
    signal,
  });

  if (!res.ok) {
    let message = `요청 실패 (HTTP ${res.status})`;
    try {
      const err = await res.json();
      message = err?.message || err?.detail || message;
    } catch {
    }
    throw new Error(message);
  }

  const arr = (await res.json()) as ExamProblemApiItem[];
  return arr.map((item) => normalizeProblemItem(item));
}

async function fetchExamProblem(
  examId: string,
  problemId: string,
  signal?: AbortSignal
): Promise<ProblemUI> {
  const problems = await fetchExamProblems(examId, [problemId], signal, { compact: false });
  if (!problems.length) {
    throw new Error("문제를 찾지 못했습니다.");
  }
  return problems[0];
}

export const useGetExamProblems = (
  examId?: string,
  ids?: string[],
  options: UseGetExamProblemsOptions = {}
) =>
  useQuery<ProblemUI[], Error>({
    queryKey: ["exam-problems", examId, (ids ?? []).join(","), options.compact ? "compact" : "full"],
    queryFn: ({ signal }) =>
      fetchExamProblems(examId as string, ids ?? [], signal, options),
    enabled: !!examId && !!ids && ids.length > 0 && options.enabled !== false,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

export const useGetExamProblem = (
  examId?: string,
  problemId?: string,
  options: { enabled?: boolean } = {}
) =>
  useQuery<ProblemUI, Error>({
    queryKey: ["exam-problem", examId, problemId],
    queryFn: ({ signal }) => fetchExamProblem(examId as string, problemId as string, signal),
    enabled: !!examId && !!problemId && options.enabled !== false,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
