// ──── FILE: src/components/CodeModal.tsx ────
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import MonacoEditor from "@/components/editor/MonacoEditor";
import JudgeBadge from "@/components/submission/JudgeBadge";
import { Submission } from "@/types/submission";
import { mapLanguages } from "@/types/languages";
import { useGetSubmissionCode } from "@/hooks/problems/get/all/useGetSubmissionCode";
import {
  defaultFilenameForSubmissionLanguage,
  languageForCodeFile,
  normalizeSubmissionLanguage,
  parseSubmissionCodeFiles,
} from "@/utils/submissionCodeFiles";

interface CodeModalProps {
  open: boolean;
  submission: Submission | null;
  onClose: () => void;
  userId?: number;
  embedded?: boolean;
  showClose?: boolean;
  showHeader?: boolean;
}

type MonoLang = "c" | "cpp" | "java" | "python";
const ALIAS_TO_LANG: Record<string, MonoLang> = {
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  java: "java",
  python: "python",
  py: "python",
  python3: "python",
};

/** 어떤 형태(숫자/문자열/배열)로 와도 MonoLang 하나로 정규화 */
function normalizeLang(input: unknown): MonoLang | undefined {
  if (Array.isArray(input)) return normalizeLang(input[0]);
  if (typeof input === "number") return mapLanguages([input])[0];
  if (typeof input === "string") {
    const s = input.toLowerCase();
    const asNum = Number(s);
    if (!Number.isNaN(asNum)) return mapLanguages([asNum])[0];
    return ALIAS_TO_LANG[s];
  }
  return undefined;
}

/** 화면에 보여줄 라벨 (C / C++ / Java / Python) */
function displayLang(input: unknown): string {
  const l = normalizeLang(input);
  if (!l) return "-";
  return { c: "C", cpp: "C++", java: "Java", python: "Python" }[l];
}

const CodeModal: React.FC<CodeModalProps> = ({
  open,
  submission,
  onClose,
  userId,
  embedded = false,
  showClose = true,
  showHeader = true,
}) => {
  const modalButtonBaseClass =
    "font-kr inline-flex items-center justify-center rounded-[10px] border bg-white font-medium transition-colors active:scale-95";
  const modalTabButtonDefaultClass =
    `${modalButtonBaseClass} h-7 border-indigo-300 px-2.5 text-xs text-indigo-600 hover:bg-indigo-50`;
  const modalTabButtonActiveClass =
    `${modalButtonBaseClass} h-7 border-indigo-500 px-2.5 text-xs text-indigo-700 shadow-[0_0_0_2px_rgba(99,102,241,0.12)]`;
  const modalCloseButtonClass =
    `${modalButtonBaseClass} h-8 border-indigo-300 px-5 text-sm text-indigo-600 hover:bg-indigo-50`;

  const needsFetch =
    !!open &&
    !!submission &&
    !!userId &&
    (!submission.code || submission.code.trim() === "");
  const { data: fetchedCode, isLoading: isFetchingCode } = useGetSubmissionCode(
    userId,
    submission?.id != null ? String(submission.id) : null,
    needsFetch
  );

  const resolved = useMemo(() => {
    if (!submission) return null;
    if (!fetchedCode) return submission;
    return {
      ...submission,
      code: fetchedCode.code ?? submission.code,
      language:
        fetchedCode.language && fetchedCode.language.length > 0
          ? fetchedCode.language
          : submission.language,
      execTime:
        fetchedCode.execution_time ?? submission.execTime,
      memory: fetchedCode.memory ?? submission.memory,
      score: fetchedCode.score ?? submission.score,
      submittedAt: fetchedCode.submission_time
        ? new Date(fetchedCode.submission_time).toLocaleString("ko-KR")
        : submission.submittedAt,
      codeSize:
        typeof fetchedCode.code_length === "number"
          ? fetchedCode.code_length
          : submission.codeSize,
    };
  }, [submission, fetchedCode]);

  const fallbackLanguage = useMemo(
    () => normalizeSubmissionLanguage(resolved?.language),
    [resolved?.language]
  );
  const fallbackFilename = useMemo(
    () => defaultFilenameForSubmissionLanguage(resolved?.language),
    [resolved?.language]
  );
  const codeFiles = useMemo(() => {
    const hiddenCodeText =
      !userId && (!resolved?.code || resolved.code.trim() === "")
        ? "제출 코드는 볼 수 없습니다."
        : resolved?.code ?? "";
    const loadingText =
      isFetchingCode && (!resolved?.code || resolved.code.trim() === "")
        ? "코드를 불러오는 중입니다..."
        : hiddenCodeText;
    return parseSubmissionCodeFiles(loadingText, fallbackFilename);
  }, [isFetchingCode, resolved?.code, fallbackFilename, userId]);
  const codeFileKey = useMemo(
    () => codeFiles.map((file) => file.filename).join("|"),
    [codeFiles]
  );
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  useEffect(() => {
    setActiveFileIndex(0);
  }, [codeFileKey]);

  const safeFileIndex = Math.min(
    Math.max(activeFileIndex, 0),
    Math.max(codeFiles.length - 1, 0)
  );
  const activeFile = codeFiles[safeFileIndex] ?? {
    filename: fallbackFilename,
    content: "",
  };
  const editorLanguage = useMemo(
    () =>
      languageForCodeFile(
        activeFile?.filename ?? fallbackFilename,
        fallbackLanguage ?? normalizeLang(resolved?.language)
      ),
    [activeFile?.filename, fallbackFilename, fallbackLanguage, resolved?.language]
  );

  /* ESC 키 및 스크롤 잠금(폭 보정) */
  useEffect(() => {
    if (!open || embedded) return;
    const handleEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleEsc);

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [open, onClose, embedded]);

  /* 열려 있지 않으면 렌더링하지 않음 */
  if (!open || !resolved) return null;

  const modalClass = embedded
    ? "flex h-[56vh] w-full flex-col overflow-hidden rounded-[4px] bg-white"
    : "flex h-[clamp(360px,82dvh,860px)] min-h-[320px] max-h-[calc(100dvh-2rem)] w-[min(95vw,820px)] max-w-[95vw] flex-col overflow-hidden rounded-[4px] bg-white";

  const content = (
    <div className={modalClass}>
      {showHeader && (
        <div className="px-6 pt-5 pb-4">
          <h2 className="mb-4 font-kr text-2xl font-bold">
            문제&nbsp;{resolved.problem}
          </h2>

          <div className="flex flex-wrap items-start gap-2 text-sm text-gray-600 divide-x divide-gray-300">
            <div className="pr-4">
              <span className="block text-xs text-gray-400">제출</span>
              {resolved.submittedAt}
            </div>

            <div className="px-4">
              <span className="block text-xs text-gray-400">언어</span>
              {displayLang(resolved.language)}
            </div>

            <div className="px-4">
              <span className="block text-xs text-gray-400">점수</span>
              {resolved.score} / 100
            </div>

            <div className="px-4">
              <JudgeBadge result={resolved.judge} />
            </div>

            <div className="px-4">
              <span className="block text-xs text-gray-400">실행시간</span>
              {resolved.execTime}ms
            </div>

            <div className="px-4">
              <span className="block text-xs text-gray-400">메모리</span>
              {resolved.memory} KB
            </div>
          </div>
        </div>
      )}

      <div className="px-4 flex-1 relative border-none overflow-hidden flex min-h-0 flex-col">
        <div className="mb-2 flex items-center gap-2 overflow-x-auto border-b border-gray-200 pb-2">
          {codeFiles.map((file, idx) => {
            const active = idx === safeFileIndex;
            return (
              <button
                type="button"
                key={`${file.filename}-${idx}`}
                onClick={() => setActiveFileIndex(idx)}
                className={`shrink-0 ${
                  active ? modalTabButtonActiveClass : modalTabButtonDefaultClass
                }`}
                title={file.filename}
              >
                {file.filename}
              </button>
            );
          })}
        </div>
        <div className="min-h-0 flex-1">
          <MonacoEditor
            language={editorLanguage}
            value={activeFile.content}
            width="100%"
            height="100%"
            theme="vs"
            readonly={true}
            scrollBeyondLastLine={false}
            onCodeChange={() => {}}
          />
        </div>
      </div>

      {showClose && (
        <div className="flex justify-end px-6 py-4">
          <button
            type="button"
            className={modalCloseButtonClass}
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1200] overflow-y-auto bg-black/40 backdrop-blur-sm p-4"
      onMouseDown={onClose}
    >
      <div className="relative z-10 flex min-h-full items-center justify-center py-4">
        <div onMouseDown={(e) => e.stopPropagation()}>{content}</div>
      </div>
    </div>,
    document.body
  );
};

export default CodeModal;
