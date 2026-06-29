import type { FileData, LangKey, ProblemData } from "@/types/solve";

const STORAGE_PREFIX = "algolab:solveDraft:v1";
const STORAGE_VERSION = 1;
const SUPPORTED_LANGS = new Set<LangKey>(["c", "cpp", "python", "java"]);

export type PersistedProblemDraft = ProblemData & {
  activeFileIndex?: number;
};

const isSupportedLang = (value: unknown): value is LangKey =>
  typeof value === "string" && SUPPORTED_LANGS.has(value as LangKey);

const normalizeCode = (value: unknown): string =>
  typeof value === "string" ? value : "";

const normalizeFile = (raw: unknown): FileData | null => {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const filename = typeof candidate.filename === "string" ? candidate.filename : "";
  if (!filename) return null;

  return {
    filename,
    language: typeof candidate.language === "string" ? candidate.language : "",
    code: normalizeCode(candidate.code),
  };
};

const parseStoredDraft = (raw: unknown): PersistedProblemDraft | null => {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const language = candidate.language;
  if (!isSupportedLang(language)) return null;
  if (!Array.isArray(candidate.code)) return null;

  const code = candidate.code
    .map(normalizeFile)
    .filter((file): file is FileData => Boolean(file));

  if (!code.length) return null;
  const next: PersistedProblemDraft = { language, code };

  const activeFileIndex = candidate.activeFileIndex;
  if (typeof activeFileIndex === "number" && Number.isInteger(activeFileIndex)) {
    next.activeFileIndex = activeFileIndex;
  }

  return next;
};

const safeSegment = (value: string | null | undefined): string =>
  encodeURIComponent(value ?? "default");

export const buildSolveExamDraftKey = (params: {
  examId: string;
  problemId: string;
}): string =>
  `${STORAGE_PREFIX}:exam:${safeSegment(params.examId)}:problem:${safeSegment(
    params.problemId
  )}`;

export const buildSolveClassExamDraftKey = (params: {
  classId: string;
  examId: string;
  problemId: string;
}): string =>
  `${STORAGE_PREFIX}:class-exam:${safeSegment(
    params.classId
  )}:exam:${safeSegment(params.examId)}:problem:${safeSegment(params.problemId)}`;

export const buildSolveHomeworkDraftKey = (params: {
  classId: string;
  sectionId: string;
  problemId: string;
}): string =>
  `${STORAGE_PREFIX}:class-homework:${safeSegment(
    params.classId
  )}:section:${safeSegment(params.sectionId)}:problem:${safeSegment(
    params.problemId
  )}`;

export const readPersistedProblemDraft = (
  storageKey: string
): PersistedProblemDraft | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    return parseStoredDraft(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const writePersistedProblemDraft = (
  storageKey: string,
  data: PersistedProblemDraft
): void => {
  if (typeof window === "undefined") return;
  const payload = {
    version: STORAGE_VERSION,
    language: data.language,
    code: data.code,
    activeFileIndex: data.activeFileIndex,
    updatedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // storage unavailable or quota exceeded
  }
};
