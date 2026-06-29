// ──── FILE: src/hooks/solve/GET/useGetProblemInfo.ts ────
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  toLanguage,         // 문자열 → 내부 키('c'|'cpp'|'python'|'java')
  mapLanguages,       // number[] → 내부 키[]
  type Language,      // 'c' | 'cpp' | 'python' | 'java'
} from "@/types/languages";
import { getApiBase } from "@/utils/apiBase";

/** 화면에서 사용하는 원시 문제 스키마 (필드 확장) */
export interface ProblemDetailApiRaw {
  problem_name: string;
  description?: string | null;
  content_path?: string | null;

  // 추가 필드(백엔드 새 스키마)
  difficulty?: string | null;
  language?: string | null;  // 단일 언어 힌트 (내부 키 문자열로 정규화: 'cpp' 등)
  type?: string | null;
  limit_time?: number | null;
  limit_memory?: number | null;
  checker_code?: string | null;

  /** 최종적으로는 배열로 정규화해서 내려줍니다. (language는 내부 키 문자열) */
  template_codes?: Array<{
    language: string; // 'c' | 'cpp' | 'python' | 'java'
    files?: Array<{
      filename: string;
      content?: string | null;
    }>;
  }>;
}

export interface SectionProblemDetail {
  section_problem_id: string;
  due_date?: string | null;
  start_date?: string | null;
  server_time?: string | null;
  problem: ProblemDetailApiRaw;
}

const API_BASE = getApiBase();

/** 내부 키(Language) → 기본 파일명 */
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

/** 다양한 API 입력(숫자/이름/내부키)을 내부 키(Language)로 느슨히 정규화 */
function toInternalLanguage(v: unknown): Language | undefined {
  // 숫자 ID
  if (typeof v === "number") return mapLanguages([v])[0];
  // "0" 같은 숫자 문자열
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return mapLanguages([Number(v)])[0];
  }
  // 문자열 이름/내부키
  if (typeof v === "string") {
    // 1차: 중앙 유틸로 시도 (내부키 'cpp' 등은 바로 매칭)
    const direct = toLanguage(v);
    if (direct) return direct;
    // 2차: 표기 차이 흡수 ("C++" → "cpp", 공백 제거)
    const norm = v.trim().toLowerCase().replace(/\s+/g, "").replace(/\+\+/g, "pp");
    return toLanguage(norm);
  }
  return undefined;
}

/** 다양한 형태의 template_codes를 화면에서 쓰는 배열 형태로 정규화 (언어는 내부 키 문자열로 통일) */
function normalizeTemplateCodes(
  value: unknown,
  fallbackLanguage?: Language
): ProblemDetailApiRaw["template_codes"] {
  const fallback: Language = fallbackLanguage ?? "cpp";

  // 이미 배열 형태
  if (Array.isArray(value)) {
    return value.map((t: any) => {
      const lang = toInternalLanguage(t?.language) ?? fallback;
      const files = Array.isArray(t?.files) ? (t.files as any[]) : [];
      return { language: lang, files };
    });
  }

  // 문자열: JSON 파싱 시도 → 실패하면 단일 코드 문자열로 간주
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return normalizeTemplateCodes(parsed, fallback);
    } catch {
      return [
        {
          language: fallback,
          files: [{ filename: defaultFilenameByLangKey(fallback), content: value }],
        },
      ];
    }
  }

  // 객체: {language, files} 또는 { "C++": "code...", "Python": [...] } 같은 맵
  if (value && typeof value === "object") {
    const obj = value as any;

    // 형태: { language, files }
    if (obj.language) {
      const lang = toInternalLanguage(obj.language) ?? fallback;
      const files = Array.isArray(obj.files) ? (obj.files as any[]) : [];
      return [{ language: lang, files }];
    }

    // 형태: 키가 언어, 값이 files 또는 code 문자열
    const entries = Object.entries(obj);
    if (entries.length) {
      return entries.map(([langKey, filesOrCode]) => {
        const lang = toInternalLanguage(langKey) ?? fallback;
        if (Array.isArray(filesOrCode)) {
          return { language: lang, files: filesOrCode as any[] };
        }
        if (typeof filesOrCode === "string") {
          return {
            language: lang,
            files: [{ filename: defaultFilenameByLangKey(lang), content: filesOrCode }],
          };
        }
        return { language: lang, files: [] };
      });
    }
  }

  // 없거나 알 수 없는 형태
  return [];
}

/** 내부: API 호출 + 새 스키마 → 화면 스키마 정규화 */
async function fetchSectionProblem(
  sectionProblemId: string,
  signal?: AbortSignal
): Promise<SectionProblemDetail> {
  const encodedId = encodeURIComponent(sectionProblemId);
  const url = API_BASE
    ? `${API_BASE}/instructor/solve/homework/problem/${encodedId}/`
    : `/api/v1/instructor/solve/homework/problem/${encodedId}/`;

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
    } catch {}
    throw new Error(message);
  }

  const json = await res.json();
  const root = json?.data ?? json;

  // ✅ section_problem_id 매핑: uuid/section_problem_uuid 우선, 구스키마는 section_problem_id
  const rawId =
    root?.section_problem_uuid ??
    root?.section_problem_id ??
    root?.uuid ??
    root?.id;
  const section_problem_id = rawId ? String(rawId) : "";
  if (!section_problem_id) {
    throw new Error("응답에 uuid/section_problem_id가 없습니다.");
  }

  // 🔑 단일 언어 힌트(숫자/문자열/내부키)를 내부 키(Language)로 정규화
  const langHint = toInternalLanguage(root.language ?? root?.problem?.language);

  // ✅ problem 객체로 재구성 (최상위 필드를 모아 화면에서 쓰는 구조 유지)
  const rawProblem: ProblemDetailApiRaw = {
    problem_name: root.problem_name ?? root?.problem?.problem_name ?? "",
    description: root.description ?? root?.problem?.description ?? null,
    content_path: root.content_path ?? root?.problem?.content_path ?? null,

    difficulty: root.difficulty ?? root?.problem?.difficulty ?? null,
    language: langHint ?? null, // 내부 키 문자열('cpp' 등)로 저장
    type: root.type ?? root?.problem?.type ?? null,
    limit_time: root.limit_time ?? root?.problem?.limit_time ?? null,
    limit_memory: root.limit_memory ?? root?.problem?.limit_memory ?? null,
    checker_code: root.checker_code ?? root?.problem?.checker_code ?? null,

    // 🔧 핵심: template_codes 정규화 (string/array/object/ID 모두 대응, 내부 키로 통일)
    template_codes: normalizeTemplateCodes(
      root.template_codes ?? root?.problem?.template_codes,
      langHint ?? undefined
    ),
  };

  return {
    section_problem_id,
    due_date: root?.due_date ?? root?.dueDate ?? null,
    start_date: root?.start_date ?? root?.startDate ?? null,
    server_time: root?.server_time ?? root?.serverTime ?? null,
    problem: rawProblem,
  };
}

/** 섹션 문제 상세 조회 훅: section_problem_id만 필요 */
export const useGetSectionProblem = (sectionProblemId?: string) =>
  useQuery<SectionProblemDetail, Error>({
    queryKey: ["section-problem.detail", sectionProblemId],
    queryFn: ({ signal }) => fetchSectionProblem(sectionProblemId!, signal),
    enabled: !!sectionProblemId,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,   // ← 여기로 교체
  });

export type { ProblemDetailApiRaw as ProblemDetailApiRawType };
