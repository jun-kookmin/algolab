// ──── FILE: src/app/class/[classid]/[sectionid]/solve/homework/[section_problem_id]/page.tsx ────
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams, useRouter } from "next/navigation";

import { useLocationState } from "@/hooks/useLocationState";
import SolveComponentLeft from "@/components/solve/homework/SolveComponentLeft";
import SolveComponentRight from "@/components/solve/homework/SolveComponentRight";

import type {
  FileData,
  ProblemUI,
  ProblemData,
  LangKey,
} from "@/types/solve";
import { ALL_LANGS } from "@/types/solve";
import { useGetLecture } from "@/hooks/lectures/Get/useGetLecture";
import { useServerNowMs } from "@/hooks/useServerNowMs";
import { coerceBoolean } from "@/utils/boolean";
import { useMe } from "@/hooks/auth/get/useMe";

import {
  useGetSectionProblem,
  type SectionProblemDetail,
  type ProblemDetailApiRaw,
} from "@/hooks/solve/homework/GET/useGetProblemInfo";

import { toLanguage, mapLanguages, toLanguageFromName } from "@/types/languages";

import { usePostHomeworkSubmission } from "@/hooks/solve/homework/POST/usePostHomeworkSubmission";
import { usePostHomeworkRun } from "@/hooks/solve/homework/POST/usePostHomeworkRun";

// 🔥 신규: 실행 결과 폴링 훅
import { useGetHomeworkRunResult } from "@/hooks/solve/homework/GET/useGetHomeworkRunResult";
// 🔥 신규: 채점 결과 폴링 훅
import { useGetHomeworkGradeResult } from "@/hooks/solve/homework/GET/useGetHomeworkGradeResult";
import { useGetHomeworkProblemSubmission } from "@/hooks/problems/get/homework/problem/useGetHomeworkProblemSubmission";
import {
  buildSolveHomeworkDraftKey,
  writePersistedProblemDraft,
} from "@/utils/solveDraftStorage";

/** API 언어(ID/문자열) → 내부 키(LangKey) */
const toLangKey = (apiLang: unknown): LangKey | null => {
  if (typeof apiLang === "number") {
    return mapLanguages([apiLang])[0] ?? null;
  }
  if (typeof apiLang === "string") {
    const s = apiLang.trim();
    const n = Number(s);
    if (Number.isFinite(n)) {
      return mapLanguages([n])[0] ?? null;
    }
    const direct = toLanguage(s);
    if (direct) return direct as LangKey;
    const byName = toLanguageFromName(s);
    return (byName as LangKey | undefined) ?? null;
  }
  return null;
};

/** 실행/런타임 API용 언어 문자열 매핑 */
const toRunLanguageName = (lang: LangKey): string => {
  switch (lang) {
    case "c":
      return "C";
    case "cpp":
      return "C++";
    case "python":
      return "Python";
    case "java":
      return "Java";
    default:
      return lang;
  }
};

const toPositiveInteger = (value: unknown): number | undefined => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.trunc(n);
};

const defaultFilenameByLangKey = (lang: LangKey): string => {
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
};

const ensureTemplateFiles = (
  lang: LangKey,
  files?: FileData[]
): FileData[] => {
  if (files && files.length > 0) return files;
  return [
    {
      filename: defaultFilenameByLangKey(lang),
      language: lang,
      code: "",
    },
  ];
};

const resolveProblemDraft = (problem: ProblemUI): ProblemData => {
  const language = problem.defaultLang;
  const templateFiles = ensureTemplateFiles(language, problem.templatesByLang[language]);
  return { code: templateFiles, language };
};

const clampActiveFileIndex = (files: FileData[], index?: number): number => {
    if (files.length === 0) return 0;
    const safeIndex = typeof index === "number" && Number.isInteger(index) ? index : 0;
    return Math.min(Math.max(safeIndex, 0), files.length - 1);
};

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err ?? "");
};

const isHomeworkUnavailableError = (err: unknown): boolean => {
  const message = getErrorMessage(err);
  return (
    message.includes("접근 가능 시간") ||
    message.includes("과제 시작 전")
  );
};

type SubmissionCodePayload = string | Record<string, string>;

const parseCodePayload = (
  rawCode: unknown,
  fallbackFilename: string
): Record<string, string> => {
  if (rawCode == null) return {};

  if (typeof rawCode === "string") {
    const trimmed = rawCode.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        const parsedMap: Record<string, string> = {};
        Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
          if (typeof key === "string" && key.trim()) {
            parsedMap[key] = value == null ? "" : String(value);
          }
        });
        return parsedMap;
      }
    } catch {
      return { [fallbackFilename]: trimmed };
    }
  }

  if (
    typeof rawCode === "object" &&
    !Array.isArray(rawCode) &&
    rawCode !== null
  ) {
    const parsedMap: Record<string, string> = {};
    Object.entries(rawCode as Record<string, unknown>).forEach(([key, value]) => {
      if (typeof key === "string" && key.trim()) {
        parsedMap[key] = value == null ? "" : String(value);
      }
    });
    return parsedMap;
  }

  return {};
};

const buildCodeMapFromFiles = (files: FileData[]): Record<string, string> => {
  const codeMap: Record<string, string> = {};
  files.forEach((file) => {
    if (file.filename) {
      codeMap[file.filename] = file.code ?? "";
    }
  });
  return codeMap;
};

const CODE_SIZE_LIMIT_BYTES = 128 * 1024;
const RUN_INPUT_SIZE_LIMIT_BYTES = 4 * 1024;
const DEFAULT_PROBLEM_PANEL_PERCENT = 50;
const MIN_PROBLEM_PANEL_PERCENT = 25;
const MAX_PROBLEM_PANEL_PERCENT = 75;
const utf8Encoder = new TextEncoder();

const getUtf8ByteLength = (value: string): number =>
  utf8Encoder.encode(value).byteLength;

const getCodeSizeBytes = (codeMap: Record<string, string>): number =>
  Object.values(codeMap).reduce(
    (total, code) => total + getUtf8ByteLength(code ?? ""),
    0
  );

const getCodeSizeLimitMessage = (): string =>
  "코드 크기가 128KB를 넘어 제출하거나 실행할 수 없습니다.";

const getRunInputSizeLimitMessage = (): string =>
  "입력 데이터셋이 4KB를 넘어 실행할 수 없습니다.";

const mergeTemplateWithCodeMap = (
  templateFiles: FileData[],
  rawCode: unknown,
  fallbackLang: LangKey
): FileData[] => {
  const fallbackFilename = defaultFilenameByLangKey(fallbackLang);
  const codeMap = parseCodePayload(rawCode, fallbackFilename);
  const baseFiles =
    templateFiles.length > 0
      ? templateFiles
      : [
          {
            filename: fallbackFilename,
            language: fallbackLang,
            code: "",
          },
        ];
  const nextFiles = baseFiles.map((f) => ({
    ...f,
    code: codeMap[f.filename] ?? "",
  }));
  const baseFileSet = new Set(nextFiles.map((f) => f.filename));
  const extras = Object.entries(codeMap)
    .filter(([filename]) => !baseFileSet.has(filename))
    .map(([filename, code]) => ({
      filename,
      language: fallbackLang,
      code,
    }));
  return [...nextFiles, ...extras];
};

const pickSubmissionLang = (value: unknown): LangKey | null => {
  if (Array.isArray(value)) {
    const nums = value.filter((v) => typeof v === "number") as number[];
    if (nums.length > 0) {
      return (mapLanguages(nums)[0] as LangKey | undefined) ?? null;
    }
    const strs = value.filter((v) => typeof v === "string") as string[];
    if (strs.length > 0) {
      const norm = strs[0].trim().toLowerCase();
      if (["c", "cpp", "python", "java"].includes(norm)) {
        return norm as LangKey;
      }
    }
  }
  return null;
};

const normalizeStatus = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
};

const GRADE_PENDING_STATUSES = new Set([
  "PENDING",
  "PD",
  "RUNNING",
  "QUEUED",
  "WAITING",
]);

const extractGradeStatus = (data: unknown): string | null => {
  if (!data || typeof data !== "object") return null;
  const d = data as any;
  return (
    normalizeStatus(d?.status) ??
    normalizeStatus(d?.grade_status) ??
    normalizeStatus(d?.execution_status) ??
    normalizeStatus(d?.grade_result?.status) ??
    normalizeStatus(d?.run_result?.status) ??
    null
  );
};

const extractSubmissionUuid = (data: unknown): string | null => {
  if (typeof data === "string") {
    const trimmed = data.trim();
    return trimmed ? trimmed : null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as any;

  const candidates = [
    d?.submission_uuid,
    d?.submissionUuid,
    d?.submission_id,
    d?.submissionId,
    d?.uuid,
    d?.id,
    d?.data?.submission_uuid,
    d?.data?.submissionUuid,
    d?.result?.submission_uuid,
    d?.result?.submissionUuid,
  ];

  const found = candidates.find(
    (v) => typeof v === "string" || typeof v === "number"
  );
  return found != null ? String(found) : null;
};

const extractExecutionTime = (data: any): string | null => {
  const v =
    data?.excution_time ??
    data?.execution_time ??
    data?.run_result?.excution_time ??
    data?.run_result?.execution_time ??
    data?.grade_result?.excution_time ??
    data?.grade_result?.execution_time ??
    null;
  if (v === null || v === undefined) return null;
  return String(v);
};

const extractMemory = (data: any): string | null => {
  const v =
    data?.memory ??
    data?.run_result?.memory ??
    data?.grade_result?.memory ??
    null;
  if (v === null || v === undefined) return null;
  return String(v);
};

const extractResultStatus = (data: any): string | null => {
  return (
    normalizeStatus(data?.status) ??
    normalizeStatus(data?.grade_status) ??
    normalizeStatus(data?.execution_status) ??
    normalizeStatus(data?.run_result?.status) ??
    normalizeStatus(data?.grade_result?.status) ??
    null
  );
};

const extractErrorMessage = (data: any): string | null => {
  const v =
    data?.error_message ??
    data?.run_result?.error_message ??
    data?.grade_result?.error_message ??
    null;
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;

  const status = extractResultStatus(data);
  const normalized = trimmed.replace(/\s+/g, "").toLowerCase();
  if (
    (status === "SE" || status === "SERVER_ERROR") &&
    (normalized === "서버에러" || normalized === "servererror")
  ) {
    return "에러";
  }

  return trimmed;
};

const extractRunOutput = (data: any): string => {
  const output =
    data?.output ??
    data?.run_result?.output ??
    data?.result?.output ??
    "";
  if (Array.isArray(output)) {
    return output.join("");
  }
  if (typeof output === "string") return output;
  return output ? String(output) : "";
};

const extractScore = (data: any): string | null => {
  const v = data?.score ?? data?.grade_result?.score ?? null;
  if (v === null || v === undefined) return null;
  return String(v);
};

const formatRunResult = (data: any): string => {
  const execTime = extractExecutionTime(data);
  const memory = extractMemory(data);
  const output = extractRunOutput(data);
  const errorMessage = extractErrorMessage(data);
  const lines = [];
  if (execTime !== null) lines.push(`실행시간: ${execTime}`);
  if (memory !== null) lines.push(`메모리: ${memory}`);
  if (output) lines.push(`결과:\n${output}`);
  if (errorMessage) lines.push(errorMessage === "에러" ? "에러" : `에러:\n${errorMessage}`);
  return lines.length > 0 ? lines.join("\n\n") : "실행 결과가 없습니다.";
};

const formatGradeResult = (data: any): string => {
  const execTime = extractExecutionTime(data);
  const memory = extractMemory(data);
  const score = extractScore(data);
  const errorMessage = extractErrorMessage(data);
  const lines = [];
  if (execTime !== null) lines.push(`실행시간: ${execTime}`);
  if (memory !== null) lines.push(`메모리: ${memory}`);
  if (score !== null) lines.push(`점수: ${score}`);
  if (errorMessage) lines.push(errorMessage === "에러" ? "에러" : `에러:\n${errorMessage}`);
  return lines.length > 0 ? lines.join("\n\n") : "채점 결과가 없습니다.";
};

const toId = (v: unknown): string | null => {
  if (typeof v === "string") {
    const trimmed = v.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
};

const isSectionProblemDetail = (
  v: unknown
): v is SectionProblemDetail & { problem: ProblemDetailApiRaw } => {
  return (
    !!v &&
    typeof v === "object" &&
    v !== null &&
    "problem" in (v as any) &&
    (v as any).problem != null
  );
};

const Page: React.FC = () => {
  const examMode = false;
  const router = useRouter();

  const params = useParams<{
    classid: string;
    sectionid: string;
    section_problem_id: string;
  }>();

  const sectionProblemId = useMemo<string | null>(
    () => toId(params?.section_problem_id),
    [params?.section_problem_id]
  );

  const sectionId = useMemo<string | null>(
    () => toId(params?.sectionid),
    [params?.sectionid]
  );

  const searchParams = useSearchParams();
  const searchParamsKey = searchParams?.toString() ?? "";

  const location = useLocationState();

  const lecturePk = useMemo<string | null>(() => {
    const fromParams = toId(params?.classid);
    if (fromParams !== null) return fromParams;

    const s: any = location?.state;
    const fromState =
      toId(s?.lectureId) ??
      toId(s?.lecture_id) ??
      toId(s?.lectures_pk) ??
      null;

    const fromUrl =
      toId(searchParams?.get("lectureId")) ??
      toId(searchParams?.get("lecture_id")) ??
      toId(searchParams?.get("lecId")) ??
      null;

    return fromState ?? fromUrl;
  }, [params?.classid, location?.state, searchParamsKey]);

  const { data: lectureData } = useGetLecture(lecturePk ?? undefined);
  const { data: me } = useMe();
  const { data: homeworkSubmissions } = useGetHomeworkProblemSubmission(
    lecturePk ?? "",
    me?.pk ?? 0,
    sectionProblemId ?? "",
    { enabled: !!lecturePk && !!me?.pk && !!sectionProblemId }
  );
  const group = (me?.group ?? "").toLowerCase();
  const isPrivileged =
    group === "administrator" || group === "professor";
  const lectureLanguageKeys = useMemo<LangKey[] | null>(() => {
    const fromNames = (lectureData?.language ?? [])
      .map((lang) => toLanguageFromName(lang.language_name))
      .filter((v): v is LangKey => !!v);
    if (fromNames.length > 0) {
      return Array.from(new Set(fromNames));
    }

    const ids = mapLanguages(lectureData?.lecture_language ?? []);
    return ids.length ? Array.from(new Set(ids)) : null;
  }, [lectureData]);

  const curriculumLocked = coerceBoolean(lectureData?.curriculum_locked);
  const isAccessBlocked = curriculumLocked && !isPrivileged;
  const lectureBlockedRef = useRef(false);
  const homeworkUnavailableAlertedRef = useRef(false);

  useEffect(() => {
    if (!isAccessBlocked) return;
    if (lectureBlockedRef.current) return;
    lectureBlockedRef.current = true;
    if (typeof window !== "undefined") {
      window.alert("커리큘럼 접근이 제한되었습니다.");
    }
    if (lecturePk) {
      router.replace(`/class/${lecturePk}`);
    } else {
      router.replace("/studentdashboard");
    }
  }, [isAccessBlocked, lecturePk, router]);

  const qc = useQueryClient();
  const submitHomeworkMutation = usePostHomeworkSubmission();
  const runHomeworkMutation = usePostHomeworkRun();

  const {
    data,
    isLoading,
    isFetching,
    error: anyError,
    dataUpdatedAt,
  } = useGetSectionProblem(sectionProblemId ?? undefined);
  const serverNowMs = useServerNowMs(
    data?.server_time ?? lectureData?.server_time,
    1000
  );

  const problem: ProblemUI | undefined = useMemo(() => {
    if (!isSectionProblemDetail(data)) return undefined;
    const raw: ProblemDetailApiRaw = data.problem;

    const byLang: Record<LangKey, FileData[]> = {
      c: [],
      cpp: [],
      java: [],
      python: [],
    };

    (raw.template_codes ?? []).forEach((tc) => {
      const key = toLangKey(tc.language);
      if (!key) return;
      const files: FileData[] =
        (tc.files ?? []).map((f: any) => ({
          filename: f.filename,
          language: key,
          code: f.content ?? f.code ?? "",
        })) || [];
      byLang[key] = files;
    });

    const langs: LangKey[] = ALL_LANGS.filter((k) => byLang[k]?.length > 0);
    const filteredLangs =
      lectureLanguageKeys && lectureLanguageKeys.length > 0
        ? langs.filter((k) => lectureLanguageKeys.includes(k))
        : langs;
    const effectiveLangs = filteredLangs.length > 0 ? filteredLangs : langs;

    const defaultLang: LangKey = effectiveLangs[0] ?? "cpp";

    return {
      id: String((data as any).section_problem_id ?? sectionProblemId ?? ""),
      title: raw.problem_name,
      description: raw.description ?? "",
      pdf: raw.content_path ?? null,
      limit_time: toPositiveInteger(raw.limit_time ?? (data as any)?.problem?.limit_time),
      limit_memory: toPositiveInteger(raw.limit_memory ?? (data as any)?.problem?.limit_memory),
      languages: effectiveLangs,
      templatesByLang: byLang,
      defaultLang,
    };
  }, [data, dataUpdatedAt, sectionProblemId, lectureLanguageKeys]);

  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [myFiles, setMyFiles] = useState<ProblemData>({
    code: [],
    language: "cpp",
  });
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState("");
  const [resultMeta, setResultMeta] = useState<{
    status?: string | null;
    execTime?: string | null;
    memory?: string | null;
    score?: string | null;
    output?: string;
    error?: string | null;
  }>({});
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [isProblemPanelCollapsed, setIsProblemPanelCollapsed] = useState(false);
  const [problemPanelPercent, setProblemPanelPercent] = useState(
    DEFAULT_PROBLEM_PANEL_PERCENT
  );
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const isSplitResizingRef = useRef(false);

  // 🔥 새로 추가: 실행 결과를 폴링하기 위한 job_id / section_problem_uuid
  const [runJobId, setRunJobId] = useState<string | null>(null);
  const [runToken, setRunToken] = useState<string | null>(null);
  const [runSectionProblemUuid, setRunSectionProblemUuid] = useState<
    string | null
  >(null);
  // 🔥 새로 추가: 채점 결과를 폴링하기 위한 submission_uuid
  const [gradeSubmissionUuid, setGradeSubmissionUuid] = useState<string | null>(
    null
  );
  // 🔥 실행/채점 진행 상태 (버튼 비활성화, 로딩 표시)
  const [isRunning, setIsRunning] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const runTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gradeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // job_id 또는 section_problem_uuid가 생기면 2초마다 결과 poll
  const { data: runResultData } = useGetHomeworkRunResult({
    jobId: runJobId,
    runToken,
    sectionProblemUuid: runSectionProblemUuid,
  });
  // submission_uuid가 생기면 결과 poll
  const { data: gradeResultData } =
    useGetHomeworkGradeResult(gradeSubmissionUuid);
  const draftStorageKey = useMemo(() => {
    if (!lecturePk || !sectionId || !problem?.id) return "";
    return buildSolveHomeworkDraftKey({
      classId: lecturePk,
      sectionId,
      problemId: problem.id,
    });
  }, [lecturePk, sectionId, problem?.id]);

  // 실행 결과가 들어오면 testResult에 JSON 그대로 표시
  useEffect(() => {
    if (runResultData === undefined) return;

    const runStatus = normalizeStatus((runResultData as any)?.status);
    if (runStatus && GRADE_PENDING_STATUSES.has(runStatus)) {
      setTestResult("실행 결과를 가져오는 중입니다...");
      return;
    }

    try {
      setTestResult(formatRunResult(runResultData as any));
      setResultMeta({
        status: runStatus,
        execTime: extractExecutionTime(runResultData as any),
        memory: extractMemory(runResultData as any),
        output: extractRunOutput(runResultData as any),
        error: extractErrorMessage(runResultData as any),
        score: null,
      });
    } catch {
      setTestResult(String(runResultData));
    }

    const status = normalizeStatus((runResultData as any)?.status);
    if (status && !GRADE_PENDING_STATUSES.has(status)) {
      setRunJobId(null);
      setRunToken(null);
      setRunSectionProblemUuid(null);
      setIsRunning(false);
      if (runTimeoutRef.current) {
        clearTimeout(runTimeoutRef.current);
        runTimeoutRef.current = null;
      }
    }
  }, [runResultData]);

  // 채점 결과가 "최종 상태"로 도착하면 testResult에 표시
  useEffect(() => {
    if (gradeResultData === undefined) return;

    const status = extractGradeStatus(gradeResultData);
    if (status && GRADE_PENDING_STATUSES.has(status)) {
      setTestResult("채점 결과를 가져오는 중입니다...");
      return;
    }

    try {
      setTestResult(formatGradeResult(gradeResultData as any));
      setResultMeta({
        status,
        execTime: extractExecutionTime(gradeResultData as any),
        memory: extractMemory(gradeResultData as any),
        score: extractScore(gradeResultData as any),
        output: "",
        error: extractErrorMessage(gradeResultData as any),
      });
    } catch {
      setTestResult(String(gradeResultData));
    }

    // 최종 상태 도달 시 폴링 중단
    if (status) {
      setGradeSubmissionUuid(null);
      setIsGrading(false);
      if (gradeTimeoutRef.current) {
        clearTimeout(gradeTimeoutRef.current);
        gradeTimeoutRef.current = null;
      }
      if (lecturePk && me?.pk && sectionProblemId && sectionId) {
        qc.invalidateQueries({
          queryKey: ["homeworkUserSubmissions", lecturePk, me.pk, sectionProblemId],
          exact: true,
          refetchType: "all",
        });
        qc.invalidateQueries({
          queryKey: ["homework", lecturePk, sectionId],
          exact: true,
          refetchType: "all",
        });
      }
    }
  }, [gradeResultData, lecturePk, me?.pk, sectionProblemId, sectionId, qc]);

  useEffect(() => {
    if (!problem) return;
    const next = resolveProblemDraft(problem);
    setMyFiles(next);
    setActiveFileIndex(clampActiveFileIndex(next.code, 0));
    setTestResult("");
    setRunJobId(null); // 문제 바뀌면 기존 실행 결과 폴링도 초기화
    setRunToken(null);
    setRunSectionProblemUuid(null);
    setGradeSubmissionUuid(null); // 문제 바뀌면 기존 채점 결과 폴링도 초기화
    setResultMeta({});
    setIsRunning(false);
    setIsGrading(false);
    if (runTimeoutRef.current) {
      clearTimeout(runTimeoutRef.current);
      runTimeoutRef.current = null;
    }
    if (gradeTimeoutRef.current) {
      clearTimeout(gradeTimeoutRef.current);
      gradeTimeoutRef.current = null;
    }
  }, [problem?.id]);

  useEffect(() => {
    if (!problem || !draftStorageKey) return;
    if (myFiles.code.length > 0) {
      writePersistedProblemDraft(draftStorageKey, {
        ...myFiles,
        activeFileIndex,
      });
    }
  }, [myFiles, activeFileIndex, problem?.id, draftStorageKey]);

  const handleFilesChange = (newFiles: FileData[]) => {
    setMyFiles((prev) => {
      const sameLen = prev.code.length === newFiles.length;
      const sameFiles =
        sameLen &&
        prev.code.every(
          (f, i) =>
            f.filename === newFiles[i]?.filename && f.code === newFiles[i]?.code
        );
      if (sameFiles) return prev;
      return { ...prev, code: newFiles };
    });
  };

  const handleChangeLanguage = (newLang: string) => {
    if (!problem) return;
    const lang = newLang as LangKey;
    if (!problem.languages.includes(lang)) {
      setTestResult("선택한 언어에 대한 템플릿이 없습니다.");
      return;
    }
    const nextFiles = ensureTemplateFiles(lang, problem.templatesByLang[lang]);
    setMyFiles((prev) => {
      const sameLang = prev.language === lang;
      const sameLen = prev.code.length === nextFiles.length;
      const sameFiles =
        sameLen &&
        prev.code.every(
          (f, i) =>
            f.filename === nextFiles[i]?.filename &&
            f.code === nextFiles[i]?.code
        );
      if (sameLang && sameFiles) return prev;
      return { code: nextFiles, language: lang };
    });
    setActiveFileIndex(0);
    setTestResult("");
    setRunJobId(null);
    setRunToken(null);
    setRunSectionProblemUuid(null);
    setGradeSubmissionUuid(null);
    setResultMeta({});
    setIsRunning(false);
    setIsGrading(false);
    if (runTimeoutRef.current) {
      clearTimeout(runTimeoutRef.current);
      runTimeoutRef.current = null;
    }
    if (gradeTimeoutRef.current) {
      clearTimeout(gradeTimeoutRef.current);
      gradeTimeoutRef.current = null;
    }
  };

  const homeworkSubmissionsForProblem = useMemo(() => {
    const rows = (homeworkSubmissions ?? [])
      .map((sub) => ({
        id: String(sub?.id ?? ""),
        attempt: sub?.submissionCount ?? null,
        status: sub?.status ?? null,
        score: sub?.score ?? null,
        submission_time: sub?.submissionTime ?? null,
        code: sub?.code as SubmissionCodePayload,
        lang: pickSubmissionLang(sub?.languages),
      }))
      .filter((sub) => {
        const status = normalizeStatus(sub.status);
        return !status || !GRADE_PENDING_STATUSES.has(status);
      })
      .filter((r) => r.id);

    if (!rows.length) return rows;

    const asc = [...rows].sort((a, b) => {
      const ta = a.submission_time ? new Date(a.submission_time).getTime() : 0;
      const tb = b.submission_time ? new Date(b.submission_time).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });
    const attemptMap = new Map<string, number>();
    asc.forEach((r, idx) => {
      attemptMap.set(r.id, idx + 1);
    });

    return [...rows]
      .sort((a, b) => {
        const ta = a.submission_time ? new Date(a.submission_time).getTime() : 0;
        const tb = b.submission_time ? new Date(b.submission_time).getTime() : 0;
        if (ta !== tb) return tb - ta;
        return String(b.id).localeCompare(String(a.id));
      })
      .map((r) => ({
        ...r,
        attempt: attemptMap.get(r.id) ?? r.attempt ?? null,
      }));
  }, [homeworkSubmissions]);

  useEffect(() => {
    setSelectedSubmissionId("");
  }, [sectionProblemId]);

  const handleSplitResizeStart = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (isProblemPanelCollapsed) return;

    isSplitResizingRef.current = true;
    e.preventDefault();
    document.body.style.userSelect = "none";
    document.body.style.cursor = window.matchMedia("(min-width: 1024px)").matches
      ? "col-resize"
      : "row-resize";
  };

  useEffect(() => {
    const clampProblemPanelPercent = (value: number) =>
      Math.min(
        Math.max(value, MIN_PROBLEM_PANEL_PERCENT),
        MAX_PROBLEM_PANEL_PERCENT
      );

    const stopSplitResize = () => {
      if (!isSplitResizingRef.current) return;
      isSplitResizingRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isSplitResizingRef.current) return;
      if (isProblemPanelCollapsed) {
        stopSplitResize();
        return;
      }

      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      const basisSize = isDesktop ? rect.width : rect.height;
      if (basisSize <= 0) return;
      const rawPercent = isDesktop
        ? ((e.clientX - rect.left) / basisSize) * 100
        : ((e.clientY - rect.top) / basisSize) * 100;

      setProblemPanelPercent(clampProblemPanelPercent(rawPercent));
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopSplitResize);
    window.addEventListener("pointercancel", stopSplitResize);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopSplitResize);
      window.removeEventListener("pointercancel", stopSplitResize);
      stopSplitResize();
    };
  }, [isProblemPanelCollapsed]);

  const loadSubmissionIntoEditor = (submissionId: string) => {
    if (!problem) return;
    const target = homeworkSubmissionsForProblem.find((s) => s.id === submissionId);
    if (!target) return;

    const targetLang =
      (target.lang && problem.languages.includes(target.lang)
        ? target.lang
        : myFiles.language) ?? myFiles.language;
    const templateFiles = problem.templatesByLang[targetLang] ?? [];
    const nextFiles = mergeTemplateWithCodeMap(
      templateFiles,
      target.code,
      targetLang
    );

    setMyFiles({ code: nextFiles, language: targetLang });
    setActiveFileIndex(0);
    setTestResult("");
    setRunJobId(null);
    setRunToken(null);
    setRunSectionProblemUuid(null);
    setGradeSubmissionUuid(null);
    setResultMeta({});
    setIsRunning(false);
    setIsGrading(false);
    if (runTimeoutRef.current) {
      clearTimeout(runTimeoutRef.current);
      runTimeoutRef.current = null;
    }
    if (gradeTimeoutRef.current) {
      clearTimeout(gradeTimeoutRef.current);
      gradeTimeoutRef.current = null;
    }
  };

  /** 실행하기 */
  const handleRunCode = () => {
    if (!problem) {
      setTestResult("현재 선택된 문제가 없습니다.");
      return;
    }
    if (lectureLanguageKeys && !lectureLanguageKeys.includes(myFiles.language)) {
      setTestResult("허용되지 않은 언어입니다. 사용 가능한 언어를 선택해주세요.");
      return;
    }

    if (!sectionProblemId) {
      setTestResult("섹션 문제 ID(section_problem_id)를 찾을 수 없습니다.");
      return;
    }

    const codeMap: Record<string, string> = {};
    myFiles.code.forEach((f) => {
      if (f.filename) {
        codeMap[f.filename] = f.code ?? "";
      }
    });

    if (Object.keys(codeMap).length === 0) {
      setTestResult("실행할 코드가 없습니다.");
      return;
    }

    if (getCodeSizeBytes(codeMap) > CODE_SIZE_LIMIT_BYTES) {
      const message = getCodeSizeLimitMessage();
      window.alert(message);
      setTestResult(message);
      return;
    }

    if (getUtf8ByteLength(testInput || "") > RUN_INPUT_SIZE_LIMIT_BYTES) {
      const message = getRunInputSizeLimitMessage();
      window.alert(message);
      setTestResult(message);
      return;
    }

    const langNameForRun = toRunLanguageName(myFiles.language);

    const runBody = {
      section_problem_id: sectionProblemId as string,
      language: langNameForRun,
      code: codeMap,
      input_data: testInput || "",
    };

    // console.log("===== [실행] 코드 실행 요청 JSON (객체) =====");
    // console.log(runBody);
    // console.log(
      // "===== [실행] 코드 실행 요청 JSON (문자열) =====\n" +
      // JSON.stringify(runBody, null, 2)
    // );

    setTestResult("코드 실행 요청 중...");
    setRunJobId(null); // 새 실행 시작 시 이전 job 초기화
    setRunToken(null);
    setRunSectionProblemUuid(null);
    setIsRunning(true);
    if (runTimeoutRef.current) clearTimeout(runTimeoutRef.current);
    runTimeoutRef.current = setTimeout(() => {
      setIsRunning(false);
      setRunJobId(null);
      setRunToken(null);
      setRunSectionProblemUuid(null);
    }, 80000);

    runHomeworkMutation.mutate(runBody, {
      onSuccess: (data) => {
        // console.log("코드 실행 성공:", data);

        // 실행 API 응답에서 job_id / section_problem_uuid 추출
        const jobId =
          (data as any)?.job_id ??
          (data as any)?.jobId ??
          (data as any)?.id ??
          null;
        const runToken =
          (data as any)?.run_token ??
          (data as any)?.runToken ??
          null;
        const sectionProblemUuid =
          (data as any)?.section_problem_uuid ??
          (data as any)?.sectionProblemUuid ??
          (data as any)?.section_problem_id ??
          null;

        if (jobId) {
          setRunJobId(String(jobId));
          setRunToken(runToken ? String(runToken) : null);
          setTestResult("실행 결과를 가져오는 중입니다..."); // 결과는 runResultData effect에서 채워짐
        } else if (sectionProblemUuid) {
          setRunSectionProblemUuid(String(sectionProblemUuid));
          setRunToken(null);
          setTestResult("실행 결과를 가져오는 중입니다...");
        } else {
          setIsRunning(false);
          if (runTimeoutRef.current) {
            clearTimeout(runTimeoutRef.current);
            runTimeoutRef.current = null;
          }
          // job_id가 없으면 바로 응답 내용을 표시
          try {
            setTestResult(
              typeof data === "string"
                ? data
                : JSON.stringify(data, null, 2)
            );
          } catch {
            setTestResult(String(data));
          }
        }
      },
      onError: (err) => {
        // console.error("코드 실행 실패:", err);
        setTestResult(`코드 실행 요청 실패: ${(err as Error).message}`);
        setIsRunning(false);
        if (runTimeoutRef.current) {
          clearTimeout(runTimeoutRef.current);
          runTimeoutRef.current = null;
        }
      },
    });
  };

  /** 제출 후 채점하기 */
  const handleSubmitAndScore = () => {
    if (!problem) {
      setTestResult("현재 선택된 문제가 없습니다.");
      return;
    }
    if (lectureLanguageKeys && !lectureLanguageKeys.includes(myFiles.language)) {
      setTestResult("허용되지 않은 언어입니다. 사용 가능한 언어를 선택해주세요.");
      return;
    }

    if (!sectionId) {
      setTestResult("섹션 ID(section_id)를 찾을 수 없습니다.");
      return;
    }

    if (!sectionProblemId) {
      setTestResult("섹션 문제 ID(section_problem_id)를 찾을 수 없습니다.");
      return;
    }

    // console.log(
      // "route sectionProblemId vs problem.id =>",
      // sectionProblemId,
      // problem.id
    // );

    const codeMap = buildCodeMapFromFiles(myFiles.code);
    if (!Object.keys(codeMap).length || Object.values(codeMap).every((v) => !v.trim())) {
      setTestResult("제출할 코드가 없습니다.");
      return;
    }

    if (getCodeSizeBytes(codeMap) > CODE_SIZE_LIMIT_BYTES) {
      const message = getCodeSizeLimitMessage();
      window.alert(message);
      setTestResult(message);
      return;
    }

    const dueRaw = (data as any)?.due_date;
    if (dueRaw) {
      const dueMs = new Date(dueRaw).getTime();
      if (
        Number.isFinite(dueMs) &&
        serverNowMs !== null &&
        serverNowMs > dueMs
      ) {
        window.alert(
          "제출 기한이 지난 제출이므로 성적에 반영되지 않습니다"
        );
      }
    }

    const execBody = {
      section_id: sectionId,
      section_problem_id: sectionProblemId as string,
      language: toRunLanguageName(myFiles.language),
      code: codeMap,
      limit_time: toPositiveInteger(data?.problem?.limit_time),
      limit_memory: toPositiveInteger(data?.problem?.limit_memory),
    };

    // console.log("===== [제출] 실행/채점 요청 JSON (객체) =====");
    // console.log(execBody);
    // console.log(
      // "===== [제출] 실행/채점 요청 JSON (문자열) =====\n" +
      // JSON.stringify(execBody, null, 2)
    // );

    setTestResult("제출 후 채점하기 요청 중...");
    setRunJobId(null);
    setRunToken(null);
    setGradeSubmissionUuid(null);
    setIsGrading(true);
    if (gradeTimeoutRef.current) clearTimeout(gradeTimeoutRef.current);
    gradeTimeoutRef.current = setTimeout(() => {
      setIsGrading(false);
      setGradeSubmissionUuid(null);
    }, 80000);

    submitHomeworkMutation.mutate(execBody, {
      onSuccess: (data) => {
        // console.log("숙제 실행/채점 성공:", data);
        if (lecturePk && sectionId) {
          qc.invalidateQueries({
            queryKey: ["homework", lecturePk, sectionId],
            exact: true,
            refetchType: "all",
          });
        }
        const submissionUuid = extractSubmissionUuid(data);
        if (submissionUuid) {
          setGradeSubmissionUuid(submissionUuid);
          setTestResult("채점 결과를 가져오는 중입니다...");
          return;
        }

        setIsGrading(false);
        if (gradeTimeoutRef.current) {
          clearTimeout(gradeTimeoutRef.current);
          gradeTimeoutRef.current = null;
        }
        try {
          setTestResult(
            typeof data === "string" ? data : JSON.stringify(data, null, 2)
          );
        } catch {
          setTestResult(String(data));
        }
      },
      onError: (err) => {
        // console.error("숙제 실행/채점 실패:", err);
        setTestResult(
          `제출 후 채점하기 요청 실패: ${(err as Error).message}`
        );
        setIsGrading(false);
        if (gradeTimeoutRef.current) {
          clearTimeout(gradeTimeoutRef.current);
          gradeTimeoutRef.current = null;
        }
      },
    });
  };

  const handleEndHomework = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/solve/homework");
    }
  };

  useEffect(() => {
    if (!anyError) return;
    if (!isHomeworkUnavailableError(anyError)) return;
    if (homeworkUnavailableAlertedRef.current) return;
    homeworkUnavailableAlertedRef.current = true;
    if (typeof window !== "undefined") {
      window.alert("접근 가능 시간이 아닙니다.");
    }
    if (lecturePk) {
      router.replace(`/class/${lecturePk}`);
      return;
    }
    router.replace("/studentdashboard");
  }, [anyError, lecturePk, router]);

  if (!sectionProblemId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">잘못된 경로입니다.</p>
          <p className="text-sm text-gray-400">
            /class/{"{classid}"}/{"{sectionid}"}/solve/homework/
            {"{section_problem_id}"} 형태로 접근해주세요.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <p>문제 불러오는 중...</p>
      </div>
    );
  }

  if (anyError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">
            문제 로딩 중 오류가 발생했습니다.
          </p>
          <p className="text-sm text-gray-400">{(anyError as Error).message}</p>
        </div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <p>표시할 문제가 없습니다.</p>
      </div>
    );
  }

  return (
    <div
      ref={splitContainerRef}
      className="flex w-full flex-1 overflow-hidden bg-gray-900 text-white relative flex-col lg:flex-row"
    >
      {isFetching && (
        <div className="absolute top-2 right-3 text-xs text-gray-300 bg-gray-700/70 px-2 py-1 rounded">
          동기화 중...
        </div>
      )}

      {/* LEFT */}
      <div
        id="homework-problem-panel"
        aria-hidden={isProblemPanelCollapsed}
        className={`${isProblemPanelCollapsed ? "hidden" : "flex"} pt-4 px-4 flex-col min-h-0 overflow-auto`}
        style={
          isProblemPanelCollapsed
            ? undefined
            : {
                flexBasis: `${problemPanelPercent}%`,
                flexGrow: 0,
                flexShrink: 0,
              }
        }
      >
        <SolveComponentLeft
          pdfFile={problem.pdf ?? ""}
          markdownContent={
            problem.description
              ? `# ${problem.title || "문제"}\n###### 제한시간: ${typeof problem.limit_time === "number" ? `${problem.limit_time}ms` : "-"} / 제한 메모리: ${typeof problem.limit_memory === "number" ? `${problem.limit_memory}MB` : "-"}\n\n${problem.description}`
              : undefined
          }
        />
      </div>

      {!isProblemPanelCollapsed && (
        <button
          type="button"
          role="separator"
          aria-label="문제 영역과 코드 영역 크기 조절"
          onPointerDown={handleSplitResizeStart}
          className="group relative flex h-4 w-full flex-none cursor-row-resize touch-none items-center justify-center lg:h-auto lg:w-4 lg:cursor-col-resize"
        >
          <span className="absolute h-px w-full bg-slate-700/80 transition-colors group-hover:bg-indigo-400 lg:h-full lg:w-px" />
          <span className="relative h-2 w-10 rounded-full bg-slate-600 transition-colors group-hover:bg-indigo-400 lg:h-10 lg:w-2" />
        </button>
      )}

      {/* RIGHT */}
      <div
        className={`${isProblemPanelCollapsed ? "flex-1" : ""} p-4 flex flex-col min-h-0 overflow-auto`}
        style={
          isProblemPanelCollapsed
            ? undefined
            : {
                flexBasis: `calc(${100 - problemPanelPercent}% - 16px)`,
                flexGrow: 1,
                flexShrink: 1,
              }
        }
      >
        <SolveComponentRight
          isExam={examMode}
          files={myFiles.code}
          onFilesChange={handleFilesChange}
          currentProblemIndex={0}
          activeFileIndex={activeFileIndex}
          onChangeActiveFileIndex={setActiveFileIndex}
          testInput={testInput}
          onTestInputChange={setTestInput}
          testResult={testResult}
          isLoadingResult={isRunning || isGrading}
          outputText={resultMeta.output ?? ""}
          errorText={resultMeta.error ?? ""}
          diffText=""
          statusText={resultMeta.status ?? ""}
          execTimeText={resultMeta.execTime ?? ""}
          memoryText={resultMeta.memory ?? ""}
          scoreText={resultMeta.score ?? ""}
          languageText={toRunLanguageName(myFiles.language)}
          currentLanguage={myFiles.language}
          onChangeLanguage={handleChangeLanguage}
          availableLanguages={problem.languages}
          headerLeftControl={
            <>
              <button
                type="button"
                onClick={() => setIsProblemPanelCollapsed((prev) => !prev)}
                aria-expanded={!isProblemPanelCollapsed}
                aria-controls="homework-problem-panel"
                className="rounded border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-200 hover:bg-gray-700"
              >
                {isProblemPanelCollapsed ? "문제 펼치기" : "문제 접기"}
              </button>
              {homeworkSubmissionsForProblem.length > 0 ? (
                <>
                  <select
                    value={selectedSubmissionId}
                    onChange={(e) => setSelectedSubmissionId(e.target.value)}
                    className="min-w-[220px] rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200"
                  >
                    <option value="">회차 선택</option>
                    {homeworkSubmissionsForProblem.map((s) => (
                      <option key={s.id} value={s.id}>
                        {`${s.attempt ?? "-"}회 · 점수 ${s.score ?? "-"} · ${
                          s.lang ? toRunLanguageName(s.lang) : "-"
                        }`}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => loadSubmissionIntoEditor(selectedSubmissionId)}
                    disabled={!selectedSubmissionId}
                    className={`rounded px-3 py-1 text-xs ${
                      selectedSubmissionId
                        ? "bg-gray-700 hover:bg-gray-600"
                        : "bg-gray-700/50 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    불러오기
                  </button>
                </>
              ) : null}
            </>
          }
        />

        <div className="flex-none flex justify-end space-x-4 mt-2">
          <button
            onClick={handleRunCode}
            disabled={isRunning || isGrading}
            className={`font-kr w-[85px] h-[32px] text-xs rounded-[8px] ${
              isRunning || isGrading
                ? "bg-gray-500 cursor-not-allowed opacity-60"
                : "bg-gray-600 hover:bg-gray-700"
            }`}
          >
            코드실행
          </button>
          <button
            onClick={handleSubmitAndScore}
            disabled={isRunning || isGrading}
            className={`font-kr w-[120px] h-[32px] text-xs rounded-[8px] ${
              isRunning || isGrading
                ? "bg-[rgba(78,97,246,1)] cursor-not-allowed opacity-60"
                : "bg-[rgba(78,97,246,1)] hover:bg-[rgba(55,69,175,1)]"
            }`}
          >
            제출 후 채점하기
          </button>
          <button
            onClick={handleEndHomework}
            className="font-kr w-[85px] h-[32px] text-xs rounded-[8px] bg-[rgba(78,97,246,1)] hover:bg-[rgba(55,69,175,1)]"
          >
            종료하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default Page;
