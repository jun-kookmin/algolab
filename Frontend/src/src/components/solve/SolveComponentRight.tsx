// ──── FILE: src/components/solve/SolveComponentRight.tsx ────
"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import Image from "next/image";
import MonacoEditor from "@/components/editor/MonacoEditor";
import type { FileData, LangKey } from "@/types/solve";
import { ALL_LANGS } from "@/types/solve";

// SVG 아이콘
const ICON_UP = "/assets/icon/Icon_Up.svg";
const ICON_DOWN = "/assets/icon/Icon_Down.svg";

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

    currentLanguage: LangKey;
    onChangeLanguage: (newLang: string) => void;
    availableLanguages: LangKey[];
}

const SolveComponentRight: React.FC<SolveComponentRightProps> = ({
    isExam,
    files,
    onFilesChange,
    currentProblemIndex,
    activeFileIndex,
    onChangeActiveFileIndex,
    testInput,
    onTestInputChange,
    testResult,
    currentLanguage,
    onChangeLanguage,
    availableLanguages,
}) => {
    // 문제 변경 시 탭 인덱스 초기화
    const prevProblemIndex = useRef(currentProblemIndex);
    useEffect(() => {
        if (prevProblemIndex.current !== currentProblemIndex) {
            onChangeActiveFileIndex(0);
            prevProblemIndex.current = currentProblemIndex;
        }
    }, [currentProblemIndex, onChangeActiveFileIndex]);

    // 부모 state(files) 수정
    const patchFiles = (patch: (draft: FileData[]) => void) => {
        const next = [...files];
        patch(next);
        onFilesChange?.(next);
    };

    // 코드 변경
    const handleCodeChange = (newCode: string) => {
        patchFiles((draft) => {
            draft[activeFileIndex] = {
                ...draft[activeFileIndex],
                code: newCode,
            };
        });
    };

    // 언어 변경
    const handleLanguageSelect = (lang: string) => {
        onChangeLanguage(lang);
    };

    // 콘솔 패널 열고 닫기
    const [showPanel, setShowPanel] = useState(true);
    const togglePanel = () => setShowPanel((prev) => !prev);
    const editorFlex = showPanel ? "flex-[6]" : "flex-1";

    const currentFile = files[activeFileIndex];
    const currentCode = currentFile?.code || "";

    // ✅ FileData.language(string) → LangKey로 안전하게 좁히기
    const editorLanguage: LangKey = useMemo(() => {
        const raw = currentFile?.language;
        if (raw && ALL_LANGS.includes(raw as LangKey)) {
            return raw as LangKey;
        }
        // 폴백: 현재 선택된 언어 사용
        return currentLanguage;
    }, [currentFile?.language, currentLanguage]);

    // Key = (언어 + 문제 인덱스 + 탭 인덱스)
    const uniqueEditorKey = useMemo(() => {
        return `${editorLanguage}-${currentProblemIndex}-${activeFileIndex}`;
    }, [editorLanguage, currentProblemIndex, activeFileIndex]);

    const hasLangOptions = (availableLanguages?.length ?? 0) > 0;
    const options = useMemo(
        () => (availableLanguages ?? []).map((k) => ({ value: k, label: langLabel(k) })),
        [availableLanguages]
    );

    return (
        <div className="w-full h-full flex flex-col min-h-0">
            {/* 상단 탭 영역 */}
            <div className="flex-none flex items-center mb-2 gap-2">
                <div className="flex">
                    {files.map((file, i) => (
                        <button
                            key={file.filename + "-" + i}
                            onClick={() => onChangeActiveFileIndex(i)}
                            className={`ml-2 mr-2 font-eng font-bold text-lg transition ${i === activeFileIndex
                                    ? "border-t border-white text-white"
                                    : "text-gray-400 hover:text-white"
                                }`}
                        >
                            {file.filename}
                        </button>
                    ))}
                </div>

                {/* 언어 선택 드롭다운 (템플릿이 있는 언어만 노출) */}
                <select
                    className="ml-auto bg-gray-700 text-white px-2 py-1 rounded"
                    value={currentLanguage}
                    onChange={(e) => handleLanguageSelect(e.target.value)}
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

            {/* 에디터 영역 */}
            <div
                className={`relative ${editorFlex} min-h-0 flex flex-col overflow-hidden border border-gray-700 rounded mb-2`}
            >
                {currentFile && (
                    <MonacoEditor
                        key={uniqueEditorKey}
                        language={editorLanguage}    // ✅ LangKey(=languages.Language)로 일치
                        initialCode={currentCode}
                        onCodeChange={handleCodeChange}
                        width="100%"
                        height="100%"
                    />
                )}
            </div>

            {/* 테스트 입력 / 실행 결과 */}
            <div className={`flex-none mb-4 rounded border border-slate-700 bg-slate-900/70 p-3 ${showPanel ? "h-1/3" : ""}`}>
                <div className={`flex justify-end ${showPanel ? "mb-2" : ""}`}>
                    <button
                        type="button"
                        onClick={togglePanel}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-kr bg-slate-700 text-slate-100 hover:bg-slate-600"
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
                {showPanel && (
                    <div className="h-[calc(100%-2rem)] flex min-h-0 gap-4 overflow-hidden">
                        <div className="flex-1 flex flex-col">
                            <h3 className="font-kr text-lg text-gray-400 font-bold mb-1">테스트 값</h3>
                            <textarea
                                className="p-5 flex-1 border border-gray-700 rounded bg-transparent outline-none resize-none"
                                value={testInput}
                                onChange={(e) => onTestInputChange(e.target.value)}
                            />
                        </div>
                        <div className="flex-1 flex flex-col">
                            <h3 className="font-kr text-lg text-gray-400 font-semibold mb-1">실행 결과</h3>
                            <textarea
                                className="p-5 flex-1 border border-gray-700 rounded bg-transparent outline-none whitespace-pre-wrap resize-none"
                                value={testResult}
                                readOnly
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SolveComponentRight;
