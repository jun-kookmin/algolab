"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ProblemCopyCaseBlock } from "@/utils/problemCopyInputBlocks";

interface CopyInputPanelProps {
  copyCases: ProblemCopyCaseBlock[];
  theme?: "dark" | "light";
}

const ICON_UP = "/assets/icon/Icon_Up.svg";
const ICON_DOWN = "/assets/icon/Icon_Down.svg";

const copyWithFallback = async (text: string) => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

const CopyInputPanel: React.FC<CopyInputPanelProps> = ({
  copyCases,
  theme = "dark",
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0);

  const copyCaseKey = useMemo(
    () => copyCases.map((item) => item.id).join("|"),
    [copyCases],
  );
  useEffect(() => {
    setShowPanel(false);
    setCurrentCaseIndex(0);
  }, [copyCaseKey]);

  if (!copyCases.length) return null;

  const handleCopy = async (copyKey: string, content: string) => {
    if (!content.trim()) return;
    try {
      await copyWithFallback(content);
      setCopiedKey(copyKey);
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === copyKey ? null : prev));
      }, 1400);
    } catch {
      // console.error("[CopyInputPanel] copy failed:", err);
      setCopiedKey(null);
    }
  };

  const isDark = theme === "dark";
  const safeCaseIndex = Math.min(currentCaseIndex, copyCases.length - 1);
  const currentCase = copyCases[safeCaseIndex] ?? copyCases[0];
  const canGoPrev = safeCaseIndex > 0;
  const canGoNext = safeCaseIndex < copyCases.length - 1;
  const navButtonClass = `inline-flex h-7 w-7 items-center justify-center rounded border transition ${
    isDark
      ? "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
  } disabled:cursor-not-allowed disabled:opacity-40`;

  return (
    <section
      className={`mt-3 space-y-3 rounded border p-3 ${
        isDark
          ? "border-slate-700 bg-slate-900/70 text-slate-100"
          : "border-gray-200 bg-white text-gray-900"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h5 className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-gray-700"}`}>
          테스트케이스
        </h5>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] ${isDark ? "text-slate-400" : "text-gray-500"}`}>
            {showPanel
              ? `${safeCaseIndex + 1} / ${copyCases.length}`
              : `${copyCases.length}개`}
          </span>
          {showPanel && copyCases.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setCurrentCaseIndex((prev) =>
                    Math.max(Math.min(prev, copyCases.length - 1) - 1, 0)
                  )
                }
                disabled={!canGoPrev}
                className={navButtonClass}
                aria-label="이전 테스트케이스"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentCaseIndex((prev) =>
                    Math.min(Math.min(prev, copyCases.length - 1) + 1, copyCases.length - 1)
                  )
                }
                disabled={!canGoNext}
                className={navButtonClass}
                aria-label="다음 테스트케이스"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowPanel((prev) => !prev)}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${
              isDark
                ? "bg-slate-700 text-slate-100 hover:bg-slate-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <span>{showPanel ? "패널 접기" : "패널 펼치기"}</span>
            <Image
              src={showPanel ? ICON_DOWN : ICON_UP}
              alt={showPanel ? "Collapse panel" : "Expand panel"}
              width={14}
              height={14}
            />
          </button>
        </div>
      </div>
      {showPanel && currentCase && (
          <article
            key={currentCase.id}
            className={`rounded border p-2 ${
              isDark ? "border-slate-700 bg-slate-800/70" : "border-gray-200 bg-gray-50"
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <span className={`text-xs font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                {currentCase.title}
              </span>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              <section className="rounded border border-white/10 p-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium">테스트케이스 입력</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(`${currentCase.id}:input`, currentCase.input)}
                    disabled={!currentCase.input.trim()}
                    className={`rounded px-2 py-1 text-xs ${
                      copiedKey === `${currentCase.id}:input`
                        ? "bg-emerald-600 text-white"
                        : isDark
                          ? "bg-slate-700 text-slate-100 hover:bg-slate-600"
                          : "bg-white text-gray-700 hover:bg-gray-100"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {copiedKey === `${currentCase.id}:input` ? "복사됨" : "입력 복사"}
                  </button>
                </div>
                <pre className="min-h-20 overflow-auto whitespace-pre-wrap break-words rounded bg-black/20 p-2 text-xs leading-5">
                  {currentCase.input || "(없음)"}
                </pre>
              </section>
              <section className="rounded border border-white/10 p-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium">테스트케이스 출력</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(`${currentCase.id}:output`, currentCase.output)}
                    disabled={!currentCase.output.trim()}
                    className={`rounded px-2 py-1 text-xs ${
                      copiedKey === `${currentCase.id}:output`
                        ? "bg-emerald-600 text-white"
                        : isDark
                          ? "bg-slate-700 text-slate-100 hover:bg-slate-600"
                          : "bg-white text-gray-700 hover:bg-gray-100"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {copiedKey === `${currentCase.id}:output` ? "복사됨" : "출력 복사"}
                  </button>
                </div>
                <pre className="min-h-20 overflow-auto whitespace-pre-wrap break-words rounded bg-black/20 p-2 text-xs leading-5">
                  {currentCase.output || "(없음)"}
                </pre>
              </section>
            </div>
          </article>
      )}
    </section>
  );
};

export default CopyInputPanel;
