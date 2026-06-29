"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import MonacoEditor from "@/components/editor/MonacoEditor";
import type { FileData, LangKey } from "@/types/solve";
import { ALL_LANGS } from "@/types/solve";

const ICON_UP = "/assets/icon/Icon_Up.svg";
const ICON_DOWN = "/assets/icon/Icon_Down.svg";
const MIN_PANEL_HEIGHT = 180;

const langLabel = (k: LangKey) => {
    switch (k) {
        case "c":
            return "C";
        case "cpp":
            return "C++";
        case "python":
            return "Python";
        case "java":
            return "Java";
        default:
            return k;
    }
};

interface SolveComponentRightProps {
    isExam: boolean;
    files: FileData[];
    onFilesChange?: (newFiles: FileData[]) => void;
    currentProblemIndex: number;
    activeFileIndex: number;
    onChangeActiveFileIndex: (idx: number) => void;
    testInput: string;
    onTestInputChange: (val: string) => void;
    testResult: string;
    isLoadingResult?: boolean;
    outputText?: string;
    errorText?: string;
    diffText?: string;
    statusText?: string;
    execTimeText?: string;
    memoryText?: string;
    scoreText?: string;
    languageText?: string;
    currentLanguage: LangKey;
    onChangeLanguage: (newLang: string) => void;
    availableLanguages: LangKey[];
    headerLeftControl?: React.ReactNode;
}

const SolveComponentRight: React.FC<SolveComponentRightProps> = ({
    files,
    onFilesChange,
    currentProblemIndex,
    activeFileIndex,
    onChangeActiveFileIndex,
    testInput,
    onTestInputChange,
    isLoadingResult,
    outputText,
    errorText,
    statusText,
    execTimeText,
    scoreText,
    currentLanguage,
    onChangeLanguage,
    availableLanguages,
    headerLeftControl,
}) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const prevProblemIndex = useRef(currentProblemIndex);
    const inputGutterRef = useRef<HTMLDivElement | null>(null);
    const outputGutterRef = useRef<HTMLDivElement | null>(null);
    const outputScrollRef = useRef<HTMLDivElement | null>(null);
    const isResizingRef = useRef(false);
    const startYRef = useRef(0);
    const startHeightRef = useRef(280);

    const [showPanel, setShowPanel] = useState(true);
    const [panelHeight, setPanelHeight] = useState(280);

    useEffect(() => {
        if (prevProblemIndex.current !== currentProblemIndex) {
            onChangeActiveFileIndex(0);
            prevProblemIndex.current = currentProblemIndex;
        }
    }, [currentProblemIndex, onChangeActiveFileIndex]);

    const patchFiles = (patch: (draft: FileData[]) => void) => {
        const next = [...files];
        patch(next);
        onFilesChange?.(next);
    };

    const handleCodeChange = (newCode: string) => {
        patchFiles((draft) => {
            draft[activeFileIndex] = {
                ...draft[activeFileIndex],
                code: newCode,
            };
        });
    };

    const currentFile = files[activeFileIndex];
    const currentCode = currentFile?.code || "";

    const editorLanguage: LangKey = useMemo(() => {
        const raw = currentFile?.language;
        if (raw && ALL_LANGS.includes(raw as LangKey)) {
            return raw as LangKey;
        }
        return currentLanguage;
    }, [currentFile?.language, currentLanguage]);

    const uniqueEditorKey = useMemo(() => {
        return `${editorLanguage}-${currentProblemIndex}-${activeFileIndex}`;
    }, [editorLanguage, currentProblemIndex, activeFileIndex]);

    const hasLangOptions = (availableLanguages?.length ?? 0) > 0;
    const options = useMemo(
        () => (availableLanguages ?? []).map((k) => ({ value: k, label: langLabel(k) })),
        [availableLanguages]
    );

    const inputLines = useMemo(() => {
        const lines = (testInput ?? "").split("\n");
        return lines.length > 0 ? lines : [""];
    }, [testInput]);

    const outputValue = useMemo(() => outputText ?? "", [outputText]);

    const outputDisplayText = useMemo(() => {
        const chunks: string[] = [];
        if (scoreText) chunks.push(`점수: ${scoreText}`);
        if (outputValue) chunks.push(outputValue);
        if (errorText) chunks.push(errorText);
        return chunks.join("\n\n");
    }, [scoreText, outputValue, errorText]);

    const outputLines = useMemo(() => {
        const value = outputDisplayText || "출력이 없습니다";
        const lines = value.split("\n");
        return lines.length > 0 ? lines : [""];
    }, [outputDisplayText]);

    const copyToClipboard = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch {
            const textarea = document.createElement("textarea");
            textarea.value = value;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            const ok = document.execCommand("copy");
            document.body.removeChild(textarea);
            return ok;
        }
    };

    const handleInputScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
        if (inputGutterRef.current) {
            inputGutterRef.current.scrollTop = e.currentTarget.scrollTop;
        }
    };

    const handleOutputScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (outputGutterRef.current) {
            outputGutterRef.current.scrollTop = e.currentTarget.scrollTop;
        }
    };

    const clampPanelHeight = (nextHeight: number) => {
        const containerHeight = containerRef.current?.clientHeight ?? window.innerHeight;
        const maxHeight = Math.max(MIN_PANEL_HEIGHT, Math.floor(containerHeight * 0.75));
        return Math.min(Math.max(nextHeight, MIN_PANEL_HEIGHT), maxHeight);
    };

    const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!showPanel) return;

        isResizingRef.current = true;
        startYRef.current = e.clientY;
        startHeightRef.current = panelHeight;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "row-resize";
    };

    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
            if (!isResizingRef.current) return;

            const delta = startYRef.current - e.clientY;
            setPanelHeight(clampPanelHeight(startHeightRef.current + delta));
        };

        const stopResize = () => {
            if (!isResizingRef.current) return;

            isResizingRef.current = false;
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopResize);
        window.addEventListener("pointercancel", stopResize);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", stopResize);
            window.removeEventListener("pointercancel", stopResize);
        };
    }, [panelHeight]);

    const normalizeStatus = (value?: string | null) => (value ?? "").trim().toUpperCase();

    const statusBadge = (status?: string | null, isGradingResult?: boolean) => {
        const code = normalizeStatus(status);
        if (!code) return null;

        switch (code) {
            case "SV":
            case "AC":
                return {
                    label: isGradingResult ? "정답" : "실행 완료",
                    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
                };
            case "WA":
                return isGradingResult
                    ? { label: "오답", className: "bg-rose-500/15 text-rose-300 border-rose-500/40" }
                    : null;
            case "CE":
                return { label: "컴파일 오류", className: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40" };
            case "RE":
                return { label: "런타임 오류", className: "bg-orange-500/15 text-orange-300 border-orange-500/40" };
            case "SE":
            case "SERVER_ERROR":
                return { label: "에러", className: "bg-slate-500/15 text-slate-300 border-slate-500/40" };
            case "TO":
            case "TLE":
                return { label: "시간초과", className: "bg-amber-500/15 text-amber-300 border-amber-500/40" };
            case "MLE":
                return { label: "메모리초과", className: "bg-orange-500/15 text-orange-300 border-orange-500/40" };
            case "PD":
            case "PENDING":
                return { label: "채점중", className: "bg-sky-500/15 text-sky-300 border-sky-500/40" };
            default:
                return { label: code, className: "bg-gray-800 text-gray-300 border-gray-600" };
        }
    };

    const statusBadgeMeta = statusBadge(statusText, !!scoreText);

    return (
        <div ref={containerRef} className="w-full h-full flex flex-col min-h-0">
            <div className="flex-none flex items-center mb-2 gap-2">
                <div className="flex">
                    {files.map((file, i) => (
                        <button
                            key={file.filename + "-" + i}
                            onClick={() => onChangeActiveFileIndex(i)}
                            className={`ml-2 mr-2 font-eng font-bold text-lg transition ${
                                i === activeFileIndex
                                    ? "border-t border-white text-white"
                                    : "text-gray-400 hover:text-white"
                            }`}
                        >
                            {file.filename}
                        </button>
                    ))}
                </div>

                <div className="ml-auto flex items-center gap-2">
                    {headerLeftControl ? (
                        <div className="flex items-center gap-2">{headerLeftControl}</div>
                    ) : null}
                    <select
                        className="bg-gray-700 text-white px-2 py-1 rounded"
                        value={currentLanguage}
                        onChange={(e) => onChangeLanguage(e.target.value)}
                        disabled={!hasLangOptions}
                        title={!hasLangOptions ? "선택 가능한 언어가 없습니다." : undefined}
                    >
                        {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden border border-gray-700 rounded mb-2">
                {currentFile && (
                    <MonacoEditor
                        key={uniqueEditorKey}
                        language={editorLanguage}
                        initialCode={currentCode}
                        onCodeChange={handleCodeChange}
                        width="100%"
                        height="100%"
                    />
                )}
            </div>

            {showPanel && (
                <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="입출력 패널 높이 조절"
                    onPointerDown={handleResizeStart}
                    className="group relative mb-2 flex h-4 cursor-row-resize touch-none items-center justify-center"
                >
                    <div className="absolute h-px w-full bg-slate-700/80 transition-colors group-hover:bg-indigo-400" />
                    <div className="relative h-2 w-10 rounded-full bg-slate-600 transition-colors group-hover:bg-indigo-400" />
                </div>
            )}

            <div
                className="flex-none mb-2 rounded border border-slate-700 bg-slate-900/70 p-3 overflow-hidden"
                style={showPanel ? { height: `${panelHeight}px` } : undefined}
            >
                <div className={`flex justify-end ${showPanel ? "mb-2" : ""}`}>
                    <button
                        type="button"
                        onClick={() => setShowPanel((prev) => !prev)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-kr bg-slate-700 text-slate-100 hover:bg-slate-600"
                    >
                        <span>{showPanel ? "패널 닫기" : "패널 열기"}</span>
                        <Image
                            src={showPanel ? ICON_DOWN : ICON_UP}
                            alt={showPanel ? "Collapse panel" : "Expand panel"}
                            width={14}
                            height={14}
                        />
                    </button>
                </div>

                {showPanel && (
                    <div className="h-[calc(100%-2rem)] flex min-h-0 gap-4 overflow-hidden">
                        <div className="flex-1 flex flex-col">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-kr text-lg text-gray-400 font-bold">테스트 입력</h3>
                                <button
                                    type="button"
                                    aria-label="Copy input"
                                    onClick={() => copyToClipboard(testInput ?? "")}
                                    className="text-xs px-2 py-1 rounded-full border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
                                >
                                    Copy
                                </button>
                            </div>

                            <div className="flex-1 border border-gray-700 rounded bg-gray-900/60 shadow-inner overflow-hidden">
                                <div className="flex h-full">
                                    <div
                                        ref={inputGutterRef}
                                        className="w-6 shrink-0 bg-gray-900/80 text-gray-500 text-[11px] leading-6 border-r border-gray-800 px-0 py-3 overflow-hidden"
                                    >
                                        {inputLines.map((_, i) => (
                                            <div key={`in-line-${i}`} className="text-right pr-1.5">
                                                {i + 1}
                                            </div>
                                        ))}
                                    </div>

                                    <textarea
                                        className="flex-1 p-3 bg-transparent text-gray-100 font-mono text-sm leading-6 outline-none resize-none focus:ring-0"
                                        value={testInput}
                                        onChange={(e) => onTestInputChange(e.target.value)}
                                        onScroll={handleInputScroll}
                                        spellCheck={false}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-kr text-lg text-gray-400 font-semibold">실행 결과</h3>

                                <div className="flex items-center gap-2">
                                    {statusBadgeMeta && (
                                        <span
                                            className={`text-xs px-2 py-1 rounded-full border ${statusBadgeMeta.className}`}
                                        >
                                            {statusBadgeMeta.label}
                                        </span>
                                    )}

                                    {execTimeText && (
                                        <span className="text-xs px-2 py-1 rounded-full border border-gray-700 bg-gray-800 text-gray-300">
                                            {execTimeText}ms
                                        </span>
                                    )}

                                    {isLoadingResult && (
                                        <span
                                            aria-label="loading"
                                            className="inline-block h-4 w-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin"
                                        />
                                    )}
                                </div>

                                <button
                                    type="button"
                                    aria-label="Copy output"
                                    onClick={() => copyToClipboard(outputDisplayText || "출력이 없습니다")}
                                    className="ml-auto text-xs px-2 py-1 rounded-full border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
                                >
                                    Copy
                                </button>
                            </div>

                            <div className="flex-1 border border-gray-700 rounded bg-gray-900/60 shadow-inner overflow-hidden">
                                <div className="flex h-full">
                                    <div
                                        ref={outputGutterRef}
                                        className="w-6 shrink-0 bg-gray-900/80 text-gray-500 text-[11px] leading-6 border-r border-gray-800 px-0 py-3 overflow-hidden"
                                    >
                                        {outputLines.map((_, i) => (
                                            <div key={`out-line-${i}`} className="text-right pr-1.5">
                                                {i + 1}
                                            </div>
                                        ))}
                                    </div>

                                    <div
                                        ref={outputScrollRef}
                                        onScroll={handleOutputScroll}
                                        className="flex-1 p-3 text-gray-100 font-mono text-sm leading-6 overflow-auto whitespace-pre-wrap break-words"
                                    >
                                        {outputDisplayText || "출력이 없습니다"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SolveComponentRight;
