// ──── FILE: src/app/solve/exam/[exam_id]/page.tsx ────
"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/auth/AuthGuardProvider";
import { useGetLecture } from "@/hooks/lectures/Get/useGetLecture";
import { useGetExam } from "@/hooks/lectures/Get/useGetExam";
import SolveComponentLeft from "@/components/solve/exam/SolveComponentLeft";
import SolveComponentRight from "@/components/solve/exam/SolveComponentRight";

import type {
  FileData,
  ProblemUI,
  ProblemData,
  LangKey,
} from "@/types/solve";
import {
  useGetExamProblem,
  useGetExamProblems,
} from "@/hooks/solve/exam/GET/useGetExamInfo";
import { usePostExamRun } from "@/hooks/solve/exam/POST/usePostExamRun";
import { usePostExamSubmission } from "@/hooks/solve/exam/POST/usePostExamSubmission";
import { usePostExamStart } from "@/hooks/solve/exam/POST/usePostExamStart";
import { usePostExamFinish } from "@/hooks/solve/exam/POST/usePostExamFinish";
import { useGetExamStatus } from "@/hooks/solve/exam/GET/useGetExamStatus";
import { useExamCountdown } from "@/hooks/solve/exam/useExamCountdown";
import { useGetExamRunResult } from "@/hooks/solve/exam/GET/useGetExamRunResult";
import { useGetExamGradeResult } from "@/hooks/solve/exam/GET/useGetExamGradeResult";
import { useGetInstructorUserSubmissions } from "@/hooks/problems/get/all/useGetInstructorUserSubmissions";
import { useGetExamUserSubmissions } from "@/hooks/problems/get/exam/user/useGetExamUserSubmissions";
import { mapLanguages, toLanguageFromName } from "@/types/languages";
import useExamNoticeToasts from "@/hooks/board/useExamNoticeToast";
import {
  clearExamLock,
  setExamLock,
  isExamFinishedByUser,
  markExamFinishedByUser,
  clearExamFinishedByUser,
} from "@/utils/examLock";
import {
  type PersistedProblemDraft,
  buildSolveClassExamDraftKey,
  readPersistedProblemDraft,
  writePersistedProblemDraft,
} from "@/utils/solveDraftStorage";

const parseIdsParam = (idsParam: string | null): string[] =>
  (idsParam ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const POST_EXAM_LOCK_MINUTES = 15;

const isUuidLike = (v: string | null): boolean =>
  !!v &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );

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

const resolveProblemDraft = (
  problem: ProblemUI,
  draft: ProblemData | null
): ProblemData => {
  const language =
    draft?.language && problem.languages.includes(draft.language)
      ? draft.language
      : problem.defaultLang;
  const templateFiles = ensureTemplateFiles(language, problem.templatesByLang[language]);
  if (!draft || !draft.code.length || language !== draft.language) {
    return { code: templateFiles, language };
  }
  return { code: draft.code, language };
};

const clampActiveFileIndex = (files: FileData[], index?: number): number => {
  if (files.length === 0) return 0;
  const safeIndex = typeof index === "number" && Number.isInteger(index) ? index : 0;
  return Math.min(Math.max(safeIndex, 0), files.length - 1);
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
        Object.entries(parsed as Record<string, unknown>).forEach(
          ([key, value]) => {
            if (typeof key === "string" && key.trim()) {
              parsedMap[key] = value == null ? "" : String(value);
            }
          }
        );
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

const pickDefaultLang = (langs: LangKey[], preferred?: LangKey): LangKey => {
  if (preferred && langs.includes(preferred)) return preferred;
  return (
    (["cpp", "python", "java", "c"] as const).find((k) => langs.includes(k)) ??
    langs[0] ??
    "cpp"
  );
};

const restrictLanguages = (
  langs: LangKey[],
  allowed: LangKey[] | null
): LangKey[] => {
  if (!allowed || allowed.length === 0) return langs;
  const filtered = langs.filter((lang) => allowed.includes(lang));
  if (filtered.length === 0) return langs;
  if (
    filtered.length === langs.length &&
    filtered.every((lang, idx) => lang === langs[idx])
  ) {
    return langs;
  }
  return filtered;
};

const applyLectureLanguageLimit = (
  problem: ProblemUI,
  allowed: LangKey[] | null
): ProblemUI => {
  if (!allowed || allowed.length === 0) return problem;
  const nextLangs = restrictLanguages(problem.languages, allowed);
  const nextDefault = pickDefaultLang(nextLangs, problem.defaultLang);
  if (nextLangs === problem.languages && nextDefault === problem.defaultLang) {
    return problem;
  }
  return {
    ...problem,
    languages: nextLangs,
    defaultLang: nextDefault,
  };
};

const formatNoticeDate = (value?: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
};

const formatRemaining = (value: number | null | undefined): string => {
  if (value == null) return "";
  const total = Math.max(0, Math.floor(value));
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
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
const SOLVED_STATUSES = new Set(["CORRECT", "AC", "SV", "SUCCESS", "SOLVED"]);
const INCORRECT_STATUSES = new Set([
  "WRONG",
  "WA",
  "TLE",
  "MLE",
  "RE",
  "RUNTIME_ERROR",
  "COMPILE_ERROR",
  "CE",
  "ERROR",
  "FAILED",
  "FAIL",
]);

const extractGradeStatus = (data: unknown): string | null => {
  if (!data || typeof data !== "object") return null;
  const d = data as any;
  const candidates = [
    normalizeStatus(d?.grade_result?.status),
    normalizeStatus(d?.run_result?.status),
    normalizeStatus(d?.execution_status),
    normalizeStatus(d?.grade_status),
    normalizeStatus(d?.status),
  ].filter((v): v is string => !!v);
  const nonPending = candidates.find((v) => !GRADE_PENDING_STATUSES.has(v));
  return nonPending ?? candidates[0] ?? null;
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

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message ?? "";
  if (typeof err === "string") return err;
  return String(err ?? "");
};

const isFinishedByUserMessage = (message: string): boolean =>
  message.includes("시험을 종료하여") || message.includes("다시 접근할 수 없습니다");

const isExitRequiresConfirm = (message?: string): boolean => {
  if (!message) return false;
  return (
    message.includes("시험이 종료") ||
    message.includes("종료되었습니다") ||
    message.includes("시험을 종료하여") ||
    message.includes("다시 접근할 수 없습니다")
  );
};

const isExamFinishedError = (err: unknown): boolean => {
  const message = getErrorMessage(err);
  return (
    message.includes("시험이 종료") ||
    message.includes("시험 시간이 종료") ||
    message.includes("시험을 종료하여") ||
    message.includes("다시 접근할 수 없습니다")
  );
};

const isExamUnavailableError = (err: unknown): boolean => {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : String(err ?? "");
  return (
    message.includes("접근 가능 시간") ||
    message.includes("시험 시작 전")
  );
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

const Page: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const examMode = true;

  // [exam_id]
  const params = useParams<{ classid: string; exam_id: string }>();
  const examId = useMemo<string | null>(
    () => params?.exam_id ?? null,
    [params?.exam_id]
  );
  const [finishedByUserLocal, setFinishedByUserLocal] = useState(() => {
    if (typeof window === "undefined") return false;
    return isExamFinishedByUser(params?.exam_id ?? null);
  });
  useEffect(() => {
    if (!examId) return;
    if (isExamFinishedByUser(examId)) {
      setFinishedByUserLocal(true);
    }
  }, [examId]);
  const lectureId = useMemo<string | null>(
    () => params?.classid ?? null,
    [params?.classid]
  );
  const { data: lectureData } = useGetLecture(lectureId ?? undefined);
  const { data: examDetail } = useGetExam(lectureId ?? undefined, examId ?? undefined);
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
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const [localSolvedIds, setLocalSolvedIds] = useState<Set<string>>(new Set());
  const [localIncorrectIds, setLocalIncorrectIds] = useState<Set<string>>(
    new Set()
  );
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>("");
  const [isProblemPanelCollapsed, setIsProblemPanelCollapsed] = useState(false);
  const [problemPanelPercent, setProblemPanelPercent] = useState(
    DEFAULT_PROBLEM_PANEL_PERCENT
  );
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const isSplitResizingRef = useRef(false);
  const [examBlocked, setExamBlocked] = useState(false);
  const [exitMessage, setExitMessage] = useState<string | null>(null);
  const [, setExitManual] = useState(false);
  const examBlockAlertedRef = useRef(false);
  const startRequestedRef = useRef(false);
  const startExamMutation = usePostExamStart();
  const finishExamMutation = usePostExamFinish();
  const { data: examStatus } = useGetExamStatus(examId, !!examId);
  const { remainingSeconds } = useExamCountdown(examStatus);
  const examListPath = lectureId ? `/class/${lectureId}?tab=exam` : "/solve/exam";
  const group = (me?.group ?? "").toLowerCase();
  const isPrivileged =
    group === "administrator" || group === "professor";
  const examDueMs = useMemo(() => {
    if (!examStatus?.due_date) return null;
    const dueMs = new Date(examStatus.due_date).getTime();
    return Number.isFinite(dueMs) ? dueMs : null;
  }, [examStatus?.due_date]);
  const examServerOffsetMs = useMemo(() => {
    if (!examStatus?.server_time) return 0;
    const serverMs = new Date(examStatus.server_time).getTime();
    return Number.isFinite(serverMs) ? serverMs - Date.now() : 0;
  }, [examStatus?.server_time]);

  const isExamTimeOver = useMemo(() => {
    if (isPrivileged) return false;
    if (!examStatus?.due_date) return false;
    if (!Number.isFinite(remainingSeconds ?? NaN)) return false;
    if (remainingSeconds === null) return false;
    return remainingSeconds <= 0;
  }, [isPrivileged, examStatus?.due_date, remainingSeconds]);

  const isBeforeStart = useMemo(() => {
    if (isPrivileged) return false;
    if (examStatus?.not_started) return true;
    const startRaw = examStatus?.start_date;
    const serverRaw = examStatus?.server_time;
    if (!startRaw || !serverRaw) return false;
    const startMs = new Date(startRaw).getTime();
    const serverMs = new Date(serverRaw).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(serverMs)) return false;
    return serverMs < startMs;
  }, [examStatus, isPrivileged]);
  const canResumeFromBlockedState = useMemo(() => {
    if (isPrivileged) return false;
    if (!examStatus) return false;
    if (examStatus.not_started) return false;
    if (examStatus.finished || examStatus.finished_by_user) return false;
    if (!examStatus.started) return false;
    if (isExamTimeOver) return false;
    return true;
  }, [
    examStatus,
    isPrivileged,
    isExamTimeOver,
  ]);
  const canLoadExamNotice = useMemo(() => {
    if (isPrivileged || !lectureId || !examId) return false;
    if (!examStatus) return false;
    if (examStatus.not_started) return false;
    if (examStatus.finished || examStatus.finished_by_user) return false;
    return true;
  }, [
    examId,
    examStatus,
    isPrivileged,
    lectureId,
  ]);
  const {
    notices: examNotices,
    unreadCount: unreadNoticeCount,
    markAllAsRead: markAllExamNoticesAsRead,
  } = useExamNoticeToasts({
    lectureId,
    examId,
    enabled: canLoadExamNotice,
    pollIntervalMs: 7000,
  });
  const examNoticePanelStorageKey = `examNoticePanelOpen:${examId ?? "default"}`;
  const [showNoticePanel, setShowNoticePanel] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem(examNoticePanelStorageKey);
    if (!stored) return false;
    return stored === "1";
  });
  const [activeNoticeUuid, setActiveNoticeUuid] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!canLoadExamNotice) {
      setShowNoticePanel(false);
      return;
    }
    const stored = window.localStorage.getItem(examNoticePanelStorageKey);
    if (!stored) return;
    setShowNoticePanel(stored === "1");
  }, [canLoadExamNotice, examNoticePanelStorageKey]);

  useEffect(() => {
    if (!canLoadExamNotice || !examId) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(examNoticePanelStorageKey, showNoticePanel ? "1" : "0");
  }, [showNoticePanel, canLoadExamNotice, examNoticePanelStorageKey]);

  const selectedNotice = useMemo(
    () =>
      examNotices.find((notice) => notice.uuid === activeNoticeUuid) ??
      examNotices[0] ??
      null,
    [activeNoticeUuid, examNotices]
  );

  useEffect(() => {
    if (!showNoticePanel) return;
    const firstNoticeUuid = examNotices[0]?.uuid ?? "";
    if (!firstNoticeUuid) return;
    if (!activeNoticeUuid || !examNotices.some((notice) => notice.uuid === activeNoticeUuid)) {
      setActiveNoticeUuid(firstNoticeUuid);
    }
  }, [showNoticePanel, examNotices, activeNoticeUuid]);

  const openNoticePanel = () => {
    setActiveNoticeUuid((prev) => {
      if (prev) return prev;
      return examNotices[0]?.uuid ?? "";
    });
    setShowNoticePanel(true);
  };

  const closeNoticePanel = () => setShowNoticePanel(false);

  const examLockExpiresAt = useMemo(() => {
    if (!examStatus?.due_date) return null;
    const dueMs = new Date(examStatus.due_date).getTime();
    if (!Number.isFinite(dueMs)) return null;
    return dueMs + POST_EXAM_LOCK_MINUTES * 60 * 1000;
  }, [examStatus?.due_date]);
  const provisionalExamLockExpiresAt = useMemo(() => {
    const dueDate = examStatus?.due_date ?? examDetail?.due_date;
    if (!dueDate) return null;
    const dueMs = new Date(dueDate).getTime();
    if (!Number.isFinite(dueMs)) return null;
    return dueMs + POST_EXAM_LOCK_MINUTES * 60 * 1000;
  }, [examDetail?.due_date, examStatus?.due_date]);
  const [lockWindowNow, setLockWindowNow] = useState(() => Date.now());
  const examLockWindowExpired = !!(
    examLockExpiresAt && lockWindowNow >= examLockExpiresAt
  );
  useEffect(() => {
    const id = window.setInterval(() => setLockWindowNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  const exitExam = useCallback(
    (
      message?: string,
      options?: { manual?: boolean; keepOnPage?: boolean }
    ) => {
      if (examBlockAlertedRef.current) return;
      examBlockAlertedRef.current = true;
      setExamBlocked(true);
      clearExamLock();
      setExitMessage(message ?? "다시 시험에 접근할 수 없습니다.");
      const requiresConfirm =
        isExitRequiresConfirm(message) || Boolean(options?.manual);
      setExitManual(requiresConfirm);
      if (!requiresConfirm && !options?.keepOnPage) {
        router.replace(examListPath);
      }
    },
    [router, examListPath]
  );

  // ?ids=1,2,3 (exam_problem_id 배열)
  const searchParams = useSearchParams();
  const ids = useMemo<string[]>(
    () => parseIdsParam(searchParams?.get("ids")),
    [searchParams]
  );
  const lockPath = useMemo(() => {
    const qs = searchParams?.toString();
    if (!pathname) return "";
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

  useLayoutEffect(() => {
    if (isPrivileged || !examId || !lockPath) return;
    if (examBlocked || finishedByUserLocal) return;
    if (examStatus?.finished || examStatus?.finished_by_user || examStatus?.not_started) {
      return;
    }

    setExamLock(lockPath, examId, {
      expiresAt:
        provisionalExamLockExpiresAt ??
        Date.now() + POST_EXAM_LOCK_MINUTES * 60 * 1000,
    });
  }, [
    examBlocked,
    examId,
    examStatus?.finished,
    examStatus?.finished_by_user,
    examStatus?.not_started,
    finishedByUserLocal,
    isPrivileged,
    lockPath,
    provisionalExamLockExpiresAt,
  ]);

  useEffect(() => {
    if (!examStatus) return;
    const active =
      !!examStatus.started &&
      !examStatus.finished &&
      !examStatus.finished_by_user &&
      !examLockWindowExpired &&
      !finishedByUserLocal;
    if (active) {
      const fallbackExpiresAt = Date.now() + POST_EXAM_LOCK_MINUTES * 60 * 1000;
      setExamLock(lockPath, examId ?? undefined, {
        expiresAt: examLockExpiresAt ?? fallbackExpiresAt,
      });
    } else {
      clearExamLock();
    }
  }, [
    examStatus?.started,
    examStatus?.finished,
    examStatus?.finished_by_user,
    lockPath,
    examId,
    examLockExpiresAt,
    examLockWindowExpired,
    finishedByUserLocal,
  ]);

  const { data: examUserData, isError: isExamUserError } =
    useGetExamUserSubmissions(
      lectureId ?? undefined,
      me?.pk,
      !!lectureId && !!me?.pk,
      examId ?? undefined
    );
  const useUnifiedSubmissions = !lectureId || isExamUserError;
  const { data: userSubmissions } = useGetInstructorUserSubmissions(
    me?.pk ?? 0,
    !!me?.pk && useUnifiedSubmissions
  );
  const canUseExamScopedSubmissions =
    !!lectureId && !isExamUserError && examUserData !== undefined;

  const submissionRows = useMemo(() => {
    if (canUseExamScopedSubmissions) {
      const problems = examUserData?.problems ?? [];
      return problems
        .map((p) => ({
          id:
            p.uuid ??
            `${p.problem_id}:${p.submission_time ?? ""}:${p.attempt_count ?? ""}`,
          examProblemId: p.problem_id ? String(p.problem_id) : null,
          problemUuid: null as string | null,
          attempt: p.attempt_count ?? null,
          status: p.status ?? null,
          score: p.score ?? null,
          submission_time: p.submission_time ?? null,
          code: p.code as SubmissionCodePayload,
          language: p.language ?? [],
        }))
        .filter((r) => r.id && r.examProblemId);
    }

    return (userSubmissions ?? [])
      .map((sub: any) => ({
        id: String(sub?.id ?? sub?.uuid ?? ""),
        examProblemId: sub?.exam_problem_uuid ?? sub?.exam_problem_id ?? null,
        problemUuid: sub?.problem_uuid ?? sub?.problem_id ?? null,
        attempt: sub?.attempt_count ?? null,
        status: sub?.status ?? null,
        score: sub?.score ?? null,
        submission_time: sub?.submission_time ?? null,
        code: sub?.code as SubmissionCodePayload,
        language: sub?.language ?? [],
      }))
      .filter((r) => r.id && r.examProblemId);
  }, [canUseExamScopedSubmissions, examUserData, userSubmissions]);

  const { solvedProblemIds, incorrectProblemIds } = useMemo(() => {
    const solved = new Set<string>(localSolvedIds);
    const incorrect = new Set<string>(localIncorrectIds);
    for (const sub of submissionRows) {
      const id = sub.examProblemId;
      if (!id) continue;

      const status = normalizeStatus(sub.status);
      const scoreValue = Number(sub.score);
      const isSolvedByScore =
        Number.isFinite(scoreValue) && scoreValue >= 100;
      const isSolvedByStatus = !!status && SOLVED_STATUSES.has(status);
      if (isSolvedByScore || isSolvedByStatus) {
        solved.add(String(id));
        incorrect.delete(String(id));
        continue;
      }

      const isIncorrectByScore =
        Number.isFinite(scoreValue) && scoreValue < 100;
      const isIncorrectByStatus = !!status && INCORRECT_STATUSES.has(status);
      if (isIncorrectByScore || isIncorrectByStatus) {
        if (!solved.has(String(id))) incorrect.add(String(id));
      }
    }

    for (const id of solved) incorrect.delete(id);
    return { solvedProblemIds: solved, incorrectProblemIds: incorrect };
  }, [submissionRows, localSolvedIds, localIncorrectIds]);

  const canLoadProblems = isPrivileged
    ? true
    : !examBlocked &&
      !finishedByUserLocal &&
      !(examStatus?.finished && examStatus?.finished_by_user);

  useEffect(() => {
    if (!examId || !examStatus) return;
    if (!examStatus.finished_by_user && isExamFinishedByUser(examId)) {
      clearExamFinishedByUser(examId);
      setFinishedByUserLocal(false);
    }
  }, [examStatus?.finished_by_user, examId]);

  // 문제들 로드
  const {
    data: baseProblems,
    isLoading,
    isFetching,
    error: anyError,
  } = useGetExamProblems(examId ?? undefined, ids, {
    compact: true,
    enabled: canLoadProblems,
  });

  const fallbackExamProblemIds = useMemo(
    () =>
      (examDetail?.problems ?? [])
        .map((p) => String(p?.id ?? ""))
        .filter((id) => id.length > 0),
    [examDetail?.problems]
  );

  useEffect(() => {
    if (!anyError) return;
    if (isExamFinishedError(anyError)) {
      const msg = getErrorMessage(anyError);
      const isFinishedByUser = isFinishedByUserMessage(msg);
      if (examId && isFinishedByUser) {
        markExamFinishedByUser(examId);
        setFinishedByUserLocal(true);
      }
      exitExam(msg || "시험을 종료하여 다시 접근할 수 없습니다.", {
        manual: isFinishedByUser,
      });
      return;
    }
    if (isExamUnavailableError(anyError)) {
      exitExam("접근 가능 시간이 아닙니다.");
    }
  }, [anyError, exitExam, examId]);

  useEffect(() => {
    if (!examId || !lectureId) return;
    if (examBlocked || finishedByUserLocal) return;
    if (isLoading || isFetching || anyError) return;
    if (!ids.length) return;
    if ((baseProblems?.length ?? 0) > 0) return;
    if (!fallbackExamProblemIds.length) return;

    const currentIds = ids.join(",");
    const nextIds = fallbackExamProblemIds.join(",");
    if (currentIds === nextIds) return;

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("ids", nextIds);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [
    examId,
    lectureId,
    examBlocked,
    finishedByUserLocal,
    isLoading,
    isFetching,
    anyError,
    ids,
    baseProblems?.length,
    fallbackExamProblemIds,
    searchParams,
    router,
    pathname,
  ]);

  // 현재 인덱스
  const [currentIndex, setCurrentIndex] = useState(0);
  const selectedProblemId = baseProblems?.[currentIndex]?.id;
  const { data: selectedProblem } = useGetExamProblem(examId ?? undefined, selectedProblemId, {
    enabled: canLoadProblems && !!selectedProblemId,
  });
  const problems = useMemo(
    () =>
      !selectedProblem || !baseProblems
        ? baseProblems
        : baseProblems.map((problemItem) =>
            problemItem.id === selectedProblem.id ? selectedProblem : problemItem
          ),
    [baseProblems, selectedProblem]
  );
  const isCurrentProblemHydrating = useMemo(() => {
    if (!selectedProblemId) return false;
    return selectedProblem?.id !== selectedProblemId;
  }, [selectedProblem?.id, selectedProblemId]);

  const visibleProblems = useMemo(() => {
    if (!problems) return problems;
    if (!lectureLanguageKeys || lectureLanguageKeys.length === 0) return problems;
    return problems.map((p) => applyLectureLanguageLimit(p, lectureLanguageKeys));
  }, [problems, lectureLanguageKeys]);

  const buildFinishMessage = useCallback((prefix: string) => prefix, []);

  useEffect(() => {
    if (isBeforeStart) {
      exitExam("접근 가능 시간이 아닙니다.");
    }
  }, [isBeforeStart, exitExam]);

  useEffect(() => {
    if (finishedByUserLocal) return;
    if (!canResumeFromBlockedState) return;
    if (!examBlocked) return;
    if (!examId) return;

    examBlockAlertedRef.current = false;
    setExamBlocked(false);
    setExitMessage(null);
    setExitManual(false);
    startRequestedRef.current = false;
  }, [canResumeFromBlockedState, examBlocked, examId, finishedByUserLocal]);

  useEffect(() => {
    if (!examId || startRequestedRef.current || isBeforeStart) return;
    if (examBlocked || finishedByUserLocal) return;
    if (!isPrivileged && (examStatus?.finished || examStatus?.finished_by_user)) return;
    startRequestedRef.current = true;
    startExamMutation.mutate(examId, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["examStatus", examId] });
      },
      onError: (err) => {
        if (isExamFinishedError(err)) {
          const msg = getErrorMessage(err);
          const isFinishedByUser = isFinishedByUserMessage(msg);
          if (examId && isFinishedByUser) {
            markExamFinishedByUser(examId);
            setFinishedByUserLocal(true);
          }
          exitExam(msg || "시험을 종료하여 다시 접근할 수 없습니다.", {
            manual: isFinishedByUser,
          });
          return;
        }
        if (isExamUnavailableError(err)) {
          exitExam("접근 가능 시간이 아닙니다.");
        }
      },
    });
  }, [
    examId,
    startExamMutation,
    queryClient,
    exitExam,
    isBeforeStart,
    examBlocked,
    finishedByUserLocal,
    isPrivileged,
    examStatus?.finished,
    examStatus?.finished_by_user,
  ]);

  useEffect(() => {
    if (!examStatus || isPrivileged) return;
    if (examStatus.finished) {
      const message = examStatus.finished_by_user
        ? "시험을 종료하여 다시 접근할 수 없습니다."
        : "시험이 종료되었습니다.";
      if (examStatus.finished_by_user && examId) {
        markExamFinishedByUser(examId);
        setFinishedByUserLocal(true);
      }
      exitExam(buildFinishMessage(message), {
        manual: !!examStatus.finished_by_user,
      });
    }
  }, [examStatus, isPrivileged, exitExam, buildFinishMessage, examId]);

  useEffect(() => {
    if (!isExamTimeOver || isPrivileged || !examStatus) return;
    if (examStatus.finished || examStatus.finished_by_user || examStatus.not_started) {
      return;
    }
    exitExam("시험 시간이 경과되어 자동으로 마감되었습니다.", {
      manual: false,
      keepOnPage: true,
    });
  }, [isExamTimeOver, isPrivileged, examStatus, exitExam]);

  useEffect(() => {
    if (isPrivileged) return;
    if (!examDueMs) return;
    if (!examStatus || examStatus.finished || examStatus.finished_by_user || examStatus.not_started) return;

    const hasPassed = () =>
      Date.now() + examServerOffsetMs >= examDueMs;
    if (hasPassed()) {
      exitExam("시험 시간이 경과되어 자동으로 마감되었습니다.", {
        manual: false,
        keepOnPage: true,
      });
      return;
    }

    const id = window.setInterval(() => {
      if (hasPassed()) {
        exitExam("시험 시간이 경과되어 자동으로 마감되었습니다.", {
          manual: false,
          keepOnPage: true,
        });
      }
    }, 250);

    return () => window.clearInterval(id);
  }, [
    examDueMs,
    examServerOffsetMs,
    examStatus?.finished,
    examStatus?.finished_by_user,
    examStatus?.not_started,
    isPrivileged,
    exitExam,
  ]);

  // problems 길이가 바뀌면 인덱스 클램핑
  useEffect(() => {
    if (!visibleProblems?.length) return;
    if (currentIndex < 0 || currentIndex >= visibleProblems.length) {
      setCurrentIndex(0);
    }
  }, [visibleProblems?.length, currentIndex]);

  // 문제별 초안 저장소
  const draftsRef = useRef<Map<string, PersistedProblemDraft>>(new Map());

  // 현재 문제
  const problem: ProblemUI | undefined =
    visibleProblems && visibleProblems.length > 0
      ? visibleProblems[currentIndex]
      : undefined;

  // 파일 편집 상태
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [myFiles, setMyFiles] = useState<ProblemData>({ code: [], language: "cpp" });
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState("");
  const [editorReloadKey, setEditorReloadKey] = useState(0);
  const [editorProblemId, setEditorProblemId] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<{
    status?: string | null;
    execTime?: string | null;
    memory?: string | null;
    score?: string | null;
    output?: string;
    error?: string | null;
  }>({});

  const examSubmissionsForProblem = useMemo(() => {
    if (!problem) return [];
    const currentProblemId = String(problem.id);
    const rows = submissionRows
      .filter((sub) => {
        if (!sub.examProblemId) return false;
        return String(sub.examProblemId) === currentProblemId;
      })
      .map((sub) => ({
        id: String(sub.id ?? ""),
        attempt: sub.attempt ?? null,
        status: sub.status ?? null,
        score: sub.score ?? null,
        submission_time: sub.submission_time ?? null,
        code: sub.code as SubmissionCodePayload,
        lang: pickSubmissionLang(sub.language),
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
  }, [submissionRows, problem?.id, problem?.problemUuid]);

  useEffect(() => {
    setSelectedSubmissionId("");
  }, [problem?.id]);

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
    const target = examSubmissionsForProblem.find((s) => s.id === submissionId);
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
    setEditorReloadKey((prev) => prev + 1);
    if (runTimeoutRef.current) {
      clearTimeout(runTimeoutRef.current);
      runTimeoutRef.current = null;
    }
    if (gradeTimeoutRef.current) {
      clearTimeout(gradeTimeoutRef.current);
      gradeTimeoutRef.current = null;
    }
  };

  // 🔥 시험 실행/채점 훅
  const examRunMutation = usePostExamRun();
  const examSubmitMutation = usePostExamSubmission();
  const draftStorageKey = useMemo(() => {
    if (!lectureId || !examId || !problem?.id) return "";
    return buildSolveClassExamDraftKey({
      classId: lectureId,
      examId,
      problemId: problem.id,
    });
  }, [lectureId, examId, problem?.id]);

  // 🔥 실행/채점 결과 폴링 상태
  const [runJobId, setRunJobId] = useState<string | null>(null);
  const [runToken, setRunToken] = useState<string | null>(null);
  const [runSectionProblemUuid, setRunSectionProblemUuid] = useState<string | null>(
    null
  );
  const [gradeSubmissionUuid, setGradeSubmissionUuid] = useState<string | null>(
    null
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const runTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gradeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: runResultData } = useGetExamRunResult({
    jobId: runJobId,
    runToken,
    sectionProblemUuid: runSectionProblemUuid,
  });
  const { data: gradeResultData } =
    useGetExamGradeResult(gradeSubmissionUuid);

  // 문제 전환 시 템플릿 로드/초안 복원
  useEffect(() => {
    if (!problem) return;
    if (isCurrentProblemHydrating) {
      setMyFiles((prev) => {
        if (prev.code.length === 0 && prev.language === problem.defaultLang) {
          return prev;
        }
        return { code: [], language: problem.defaultLang };
      });
      setEditorProblemId(null);
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
      return;
    }
    const draftFromMap = draftsRef.current.get(problem.id);
    const draft =
      draftFromMap ??
      (draftStorageKey ? readPersistedProblemDraft(draftStorageKey) : null);
    if (!draftFromMap && draft && draftStorageKey) {
      draftsRef.current.set(problem.id, draft);
    }
    const next = resolveProblemDraft(problem, draft);
    setMyFiles(next);
    setEditorProblemId(problem.id);
    setActiveFileIndex(clampActiveFileIndex(next.code, draft?.activeFileIndex));
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
  }, [
    problem?.id,
    problem?.defaultLang,
    draftStorageKey,
    isCurrentProblemHydrating,
  ]);

  // 파일 변경 시 초안 저장
  useEffect(() => {
    if (!problem || !draftStorageKey) return;
    if (isCurrentProblemHydrating) return;
    if (editorProblemId !== problem.id) return;
    draftsRef.current.set(problem.id, {
      ...myFiles,
      activeFileIndex,
    });
    if (myFiles.code.length > 0) {
      writePersistedProblemDraft(draftStorageKey, {
        ...myFiles,
        activeFileIndex,
      });
    }
  }, [
    myFiles,
    activeFileIndex,
    problem?.id,
    draftStorageKey,
    isCurrentProblemHydrating,
    editorProblemId,
  ]);

  // 실행 결과 처리
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

    if (runStatus && !GRADE_PENDING_STATUSES.has(runStatus)) {
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

  // 채점 결과 처리
  useEffect(() => {
    if (gradeResultData === undefined) return;

    const status = extractGradeStatus(gradeResultData);
    if (status && GRADE_PENDING_STATUSES.has(status)) {
      setTestResult("채점 결과를 가져오는 중입니다...");
      return;
    }

    const scoreText = extractScore(gradeResultData as any);
    try {
      setTestResult(formatGradeResult(gradeResultData as any));
      setResultMeta({
        status,
        execTime: extractExecutionTime(gradeResultData as any),
        memory: extractMemory(gradeResultData as any),
        score: scoreText,
        output: "",
        error: extractErrorMessage(gradeResultData as any),
      });
    } catch {
      setTestResult(String(gradeResultData));
    }

    if (status) {
      const solvedByStatus = SOLVED_STATUSES.has(status);
      const scoreValue = Number(scoreText);
      const solvedByScore = Number.isFinite(scoreValue) && scoreValue >= 100;
      const incorrectByScore =
        Number.isFinite(scoreValue) && scoreValue < 100;
      const incorrectByStatus = INCORRECT_STATUSES.has(status);
      if ((solvedByScore || solvedByStatus) && problem?.id) {
        setLocalSolvedIds((prev) => {
          if (prev.has(problem.id)) return prev;
          const next = new Set(prev);
          next.add(problem.id);
          return next;
        });
        setLocalIncorrectIds((prev) => {
          if (!prev.has(problem.id)) return prev;
          const next = new Set(prev);
          next.delete(problem.id);
          return next;
        });
      } else if ((incorrectByScore || incorrectByStatus) && problem?.id) {
        setLocalIncorrectIds((prev) => {
          if (prev.has(problem.id)) return prev;
          const next = new Set(prev);
          next.add(problem.id);
          return next;
        });
      }
      if (me?.pk) {
        queryClient.invalidateQueries({
          queryKey: ["lectureProgress", lectureId ?? undefined, me.pk, examId],
          exact: true,
          refetchType: "all",
        });
        queryClient.invalidateQueries({
          queryKey: ["instructorUserSubmissions", me.pk],
          refetchType: "all",
        });
      }
      setGradeSubmissionUuid(null);
      setIsGrading(false);
      if (gradeTimeoutRef.current) {
        clearTimeout(gradeTimeoutRef.current);
        gradeTimeoutRef.current = null;
      }
    }
  }, [gradeResultData, problem?.id, me?.pk, lectureId, examId, queryClient]);

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

  // ===== 실행 / 제출 =====

  const handleRunCode = () => {
    if (isExamTimeOver) {
      exitExam("시험 시간이 경과되어 자동으로 마감되었습니다.", {
        manual: false,
      });
      return;
    }
    if (!problem) {
      setTestResult("현재 선택된 문제가 없습니다.");
      return;
    }

    const codeMap: Record<string, string> = {};
    for (const f of myFiles.code) {
      if (f.filename) {
        codeMap[f.filename] = f.code ?? "";
      }
    }

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
    const runBody: {
      section_problem_uuid?: string;
      section_problem_id?: string;
      exam_problem_uuid?: string;
      exam_problem_id?: string;
      language: string;
      code: Record<string, string>;
      input_data?: string;
    } = {
      language: langNameForRun,
      code: codeMap,
      input_data: testInput || "",
    };

    if (isUuidLike(problem.id)) {
      runBody.exam_problem_uuid = problem.id;
    } else {
      runBody.exam_problem_id = problem.id;
    }

    setTestResult("코드 실행 요청 중...");
    setRunJobId(null);
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

    examRunMutation.mutate(runBody, {
      onSuccess: (data) => {
        // console.log("[시험 실행 성공]", data);

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
          setTestResult("실행 결과를 가져오는 중입니다...");
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
          try {
            setTestResult(
              typeof data === "string" ? data : JSON.stringify(data, null, 2)
            );
          } catch {
            setTestResult(String(data));
          }
        }
      },
      onError: (err) => {
        // console.error("[시험 실행 실패]", err);
        setTestResult(`코드 실행 실패: ${(err as Error).message}`);
        setIsRunning(false);
        if (runTimeoutRef.current) {
          clearTimeout(runTimeoutRef.current);
          runTimeoutRef.current = null;
        }
      },
    });
  };

  const handleSubmitAndScore = () => {
    if (isExamTimeOver) {
      exitExam("시험 시간이 경과되어 자동으로 마감되었습니다.", {
        manual: false,
      });
      return;
    }
    if (!problem) {
      setTestResult("현재 선택된 문제가 없습니다.");
      return;
    }
    if (!examId) {
      setTestResult("유효하지 않은 시험 ID입니다.");
      return;
    }
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

    const payload: {
      user?: number;
      exam_uuid?: string;
      exam_id?: string;
      exam_problem_uuid?: string;
      exam_problem_id?: string;
      status?: string;
      language: string;
      code: string | Record<string, string>;
      submission_count?: number;
      judge_count?: number;
      submission_time?: string;
    } = {
      language: toRunLanguageName(myFiles.language),
      code: codeMap,
      status: "PENDING",
      submission_count: 1,
      judge_count: 1,
      submission_time: new Date().toISOString(),
    };

    if (isUuidLike(examId)) {
      payload.exam_uuid = examId;
    } else {
      payload.exam_id = examId;
    }

    if (isUuidLike(problem.id)) {
      payload.exam_problem_uuid = problem.id;
    } else {
      payload.exam_problem_id = problem.id;
    }

    if (me?.pk != null) {
      payload.user = me.pk;
    }

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

    examSubmitMutation.mutate(payload, {
      onSuccess: (data) => {
        // console.log("[시험 제출/채점 성공]", data);
        if (me?.pk != null) {
          queryClient.invalidateQueries({
            queryKey: ["lectureProgress", lectureId ?? undefined, me.pk, examId],
            exact: true,
            refetchType: "all",
          });
          queryClient.invalidateQueries({
            queryKey: ["lectureProgress", lectureId ?? undefined, me.pk],
            refetchType: "all",
          });
          queryClient.invalidateQueries({
            queryKey: ["instructorUserSubmissions", me.pk],
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
        // console.error("[시험 제출/채점 실패]", err);
        setTestResult(`제출/채점 실패: ${(err as Error).message}`);
        setIsGrading(false);
        if (gradeTimeoutRef.current) {
          clearTimeout(gradeTimeoutRef.current);
          gradeTimeoutRef.current = null;
        }
      },
    });
  };

  const handleEndExam = () => {
    if (!examId || finishExamMutation.isPending) return;
    const confirmed =
      typeof window !== "undefined"
        ? window.confirm("종료하시겠습니까?\n종료하면 다시 접속할 수 없습니다.")
        : true;
    if (!confirmed) return;
    finishExamMutation.mutate(examId, {
      onSuccess: () => {
        if (examId) {
          markExamFinishedByUser(examId);
          setFinishedByUserLocal(true);
          queryClient.invalidateQueries({
            queryKey: ["examStatus", examId],
            exact: true,
            refetchType: "all",
          });
        }
        exitExam(buildFinishMessage("시험이 종료되었습니다. 수고하셨습니다."));
      },
      onError: (err) => {
        if (typeof window !== "undefined") {
          window.alert(`종료 실패: ${(err as Error).message}`);
        }
      },
    });
  };

  // ===== 상태 처리 =====
  if (!examId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">잘못된 경로입니다.</p>
          <p className="text-sm text-gray-400">
            /solve/exam/{"{exam_id}"}?ids=1,2,3 형태로 접근해주세요.
          </p>
        </div>
      </div>
    );
  }

  if (!isPrivileged && (finishedByUserLocal || examBlocked)) {
    const message =
      exitMessage ??
      (finishedByUserLocal
        ? "시험을 종료하여 다시 접근할 수 없습니다."
        : "시험이 종료되어 더 이상 접근할 수 없습니다.");
    const showConfirm = true;
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-lg font-semibold mb-4">{message}</p>
          {showConfirm && (
            <button
              type="button"
              onClick={() => router.replace(examListPath)}
              className="px-4 py-2 rounded bg-white text-gray-900 font-semibold hover:bg-gray-200"
            >
              확인
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!ids.length) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <p>ids 쿼리 파라미터가 없습니다. 예) ?ids=48,49,50</p>
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
          <p className="text-sm text-gray-400">
            {(anyError as Error).message}
          </p>
        </div>
      </div>
    );
  }

  if (!visibleProblems || visibleProblems.length === 0 || !problem) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <p>표시할 문제가 없습니다.</p>
      </div>
    );
  }

  // ===== 렌더링 =====
  return (
    <div className="flex w-full flex-1 overflow-hidden bg-gray-900 text-white relative flex-col lg:flex-row">
      {/* 상단: 문제 탭 */}
      <div className="absolute left-0 right-0 top-0 px-4 pt-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar">
            <div className="flex w-max">
              {visibleProblems.map((p, i) => (
                <button
                  key={`${p.id}-${i}`}
                  onClick={() => setCurrentIndex(i)}
                  className={`ml-2 mr-2 font-eng font-bold text-lg transition inline-flex items-center gap-1 ${i === currentIndex
                      ? "border-t border-white text-white"
                      : "text-gray-400 hover:text-white"
                    }`}
                  title={p.title}
                >
                  {`문제 ${i + 1}`}
                  {solvedProblemIds.has(p.id) ||
                  (useUnifiedSubmissions &&
                    p.problemUuid &&
                    solvedProblemIds.has(p.problemUuid)) ? (
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  ) : incorrectProblemIds.has(p.id) ||
                    (useUnifiedSubmissions &&
                      p.problemUuid &&
                      incorrectProblemIds.has(p.problemUuid)) ? (
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {canLoadExamNotice ? (
              <button
                type="button"
                onClick={() => {
                  if (showNoticePanel) {
                    closeNoticePanel();
                    return;
                  }
                  if (unreadNoticeCount > 0) {
                    markAllExamNoticesAsRead();
                  }
                  openNoticePanel();
                }}
                className="rounded border border-yellow-300/50 px-2 py-1 text-xs text-yellow-100 hover:bg-yellow-100/10"
              >
                {showNoticePanel ? "시험 공지 닫기" : "시험 공지 열기"}
                {!showNoticePanel && unreadNoticeCount > 0 ? (
                  <span className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] leading-none text-white">
                    {unreadNoticeCount}
                  </span>
                ) : null}
              </button>
            ) : null}
            {examMode && remainingSeconds != null && (
              <div className="shrink-0 text-sm font-semibold text-white/90 bg-white/10 px-2 py-0.5 rounded">
                남은 시간: {formatRemaining(remainingSeconds)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 본문 2열 레이아웃 */}
      <div
        ref={splitContainerRef}
        className="flex w-full flex-1 min-h-0 pt-12 flex-col lg:flex-row"
      >
        {/* LEFT: 문제 설명 */}
        <div
          id="exam-problem-panel"
          aria-hidden={isProblemPanelCollapsed}
          className={`${isProblemPanelCollapsed ? "hidden" : "flex"} pt-2 px-4 flex-col min-h-0 overflow-auto`}
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

        {/* RIGHT: 코드 에디터 */}
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
          {showNoticePanel ? (
            <div
              className="fixed inset-0 z-[1200] overflow-y-auto bg-black/55 p-4"
              onClick={closeNoticePanel}
            >
              <div className="relative z-10 flex min-h-full items-center justify-center">
                <div
                  className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[860px] flex-col overflow-hidden rounded-lg border border-yellow-300/50 bg-gray-900 text-yellow-50"
                  onClick={(e) => e.stopPropagation()}
                >
                <div className="flex items-center justify-between border-b border-yellow-300/30 px-4 py-3">
                  <div className="text-sm font-semibold">시험 공지</div>
                  <button
                    type="button"
                    onClick={closeNoticePanel}
                    className="rounded border border-yellow-300/40 px-2 py-1 text-xs text-yellow-100 hover:bg-yellow-100/10"
                  >
                    닫기
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 overflow-hidden">
                  <div className="w-[34%] overflow-y-auto border-r border-yellow-300/30 px-3 py-2">
                    {examNotices.length === 0 ? (
                      <p className="px-1 py-2 text-xs text-yellow-200/80">
                        등록된 시험 공지가 없습니다.
                      </p>
                    ) : (
                      examNotices.map((notice) => (
                        <button
                          key={notice.uuid}
                          type="button"
                          onClick={() => setActiveNoticeUuid(notice.uuid)}
                          className={`mb-2 w-full rounded border px-2 py-2 text-left text-xs ${
                            selectedNotice?.uuid === notice.uuid
                              ? "border-yellow-200/70 bg-yellow-400/10"
                              : "border-yellow-200/30 hover:bg-yellow-100/10"
                          }`}
                        >
                          <p className="mb-1 line-clamp-2 font-semibold text-yellow-50">
                            {notice.title ?? "시험 공지"}
                          </p>
                          {notice.isEdited ? (
                            <p className="text-[11px] text-yellow-200/90">
                              수정됨 {notice.editedCount ?? 1}
                            </p>
                          ) : null}
                          {notice.created_date ? (
                            <p className="text-[11px] text-yellow-200/80">
                              {formatNoticeDate(notice.created_date)}
                            </p>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                    {selectedNotice ? (
                      <article className="rounded border border-yellow-200/30 bg-yellow-900/20 p-3 text-xs text-yellow-100">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-yellow-50">
                            {selectedNotice.title ?? "시험 공지"}
                          </h3>
                          {selectedNotice.isEdited ? (
                            <span className="shrink-0 rounded bg-yellow-200/20 px-1.5 py-0.5 text-[11px] text-yellow-200">
                              수정됨 {selectedNotice.editedCount ?? 1}
                            </span>
                          ) : null}
                        </div>
                        {selectedNotice.isEdited && selectedNotice.updated_date ? (
                          <p className="mb-2 text-[11px] text-yellow-200/80">
                            수정일: {formatNoticeDate(selectedNotice.updated_date)}
                          </p>
                        ) : null}
                        {selectedNotice.content ? (
                          <p className="whitespace-pre-wrap">
                            {selectedNotice.content}
                          </p>
                        ) : (
                          <p className="text-yellow-200/70">내용이 비어 있습니다.</p>
                        )}
                        {selectedNotice.created_date ? (
                          <p className="mt-3 text-[11px] text-yellow-200/70">
                            {formatNoticeDate(selectedNotice.created_date)}
                          </p>
                        ) : null}
                      </article>
                    ) : (
                      <p className="text-xs text-yellow-200/80">
                        공지를 선택해 주세요.
                      </p>
                    )}
                  </div>
            </div>
              </div>
            </div>
            </div>
          ) : null}
          <SolveComponentRight
            isExam={examMode}
            files={myFiles.code}
            onFilesChange={handleFilesChange}
            currentProblemIndex={currentIndex}
            activeFileIndex={activeFileIndex}
            onChangeActiveFileIndex={setActiveFileIndex}
            editorReloadKey={editorReloadKey}
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
            remainingSeconds={remainingSeconds}
            headerLeftControl={
              <>
                <button
                  type="button"
                  onClick={() => setIsProblemPanelCollapsed((prev) => !prev)}
                  aria-expanded={!isProblemPanelCollapsed}
                  aria-controls="exam-problem-panel"
                  className="rounded border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-200 hover:bg-gray-700"
                >
                  {isProblemPanelCollapsed ? "문제 펼치기" : "문제 접기"}
                </button>
                {examSubmissionsForProblem.length > 0 ? (
                  <>
                    <select
                      value={selectedSubmissionId}
                      onChange={(e) => setSelectedSubmissionId(e.target.value)}
                      className="min-w-[220px] rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200"
                    >
                      <option value="">회차 선택</option>
                      {examSubmissionsForProblem.map((s) => (
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
              예제실행
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
              onClick={handleEndExam}
              disabled={finishExamMutation.isPending}
              className={`font-kr w-[85px] h-[32px] text-xs rounded-[8px] ${
                finishExamMutation.isPending
                  ? "bg-gray-500 cursor-not-allowed opacity-60"
                  : "bg-[rgba(78,97,246,1)] hover:bg-[rgba(55,69,175,1)]"
              }`}
            >
              종료하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
