// src/components/ProblemPreviewModal.tsx
"use client";

import React from "react";
import Image from "next/image";
import { LANGUAGES } from "@/types/languages";
import { useGetProblem } from "@/hooks/problems/useGetProblem";
import { DIFFICULTIES } from "@/types/difficulties";
import VditorPreview from "@/components/markdown/VditorPreview";

interface ProblemPreviewModalProps {
    questionId: string;
    onClose: () => void;
}

/**
 * 문제 미리보기 모달
 *  • 배경 오버레이 클릭 또는 × 버튼 클릭 시 닫힘
 */
const ProblemPreviewModal: React.FC<ProblemPreviewModalProps> = ({
    questionId,
    onClose,
}) => {

    /* 언어 아이콘 매핑 – 기존과 동일하게 재사용 */
    const iconMap: Record<string, string> = {
        [LANGUAGES.C]: "/assets/icon/Icon_C.svg",
        [LANGUAGES.CPP]: "/assets/icon/Icon_CPP.svg",
        [LANGUAGES.JAVA]: "/assets/icon/Icon_Java.svg",
        [LANGUAGES.PYTHON]: "/assets/icon/Icon_Python.svg",
    };

    const { data: question, isLoading } = useGetProblem(questionId, {
        includeTestcases: false,
    });

    return (
        <div
            className="fixed inset-0 z-[1200] overflow-y-auto bg-black/40 p-4"
            onClick={onClose}
        >
            <div className="relative z-10 flex min-h-full items-center justify-center">
                <div
                    className="relative flex max-h-[calc(100dvh-2rem)] w-[min(95vw,1080px)] flex-col overflow-y-auto rounded-xl bg-white p-8 shadow-xl"
                    onClick={(e) => e.stopPropagation()} // 오버레이 클릭과 분리
                >
                    {/* 닫기 버튼 */}
                    <button
                        className="absolute right-3 top-3 text-xl text-gray-400 hover:text-gray-600"
                        onClick={onClose}
                    >
                        ×
                    </button>

                {/* 헤더 */}
                <h2 className="mb-6 text-2xl font-bold">
                    {isLoading ? "로딩 중입니다." : `${question?.title}`}
                </h2>

                {/* 메타 정보 */}
                <div className="mb-6 flex flex-wrap gap-4 text-sm">
                    {/* 태그 */}
                    {question?.tags && question.tags.length > 0 && (
                        <span className="rounded bg-gray-100 px-2 py-1 text-gray-700">
                            {question.tags.join(" / ")}
                        </span>
                    )}

                    {/* 난이도 */}
                    <span
                        className={
                            {
                                [DIFFICULTIES.EASY]: "rounded bg-green-100 px-2 py-1 text-green-700",
                                [DIFFICULTIES.MEDIUM]: "rounded bg-yellow-100 px-2 py-1 text-yellow-700",
                                [DIFFICULTIES.HARD]: "rounded bg-red-100 px-2 py-1 text-red-700",
                            }[question?.difficulty ?? DIFFICULTIES.MEDIUM]
                        }
                    >
                        {question?.difficulty}
                    </span>

                    {/* 제한시간 & 메모리 */}
                    {question && question.limit_time && (
                        <span className="text-gray-600">
                            ⏱️ {question.limit_time} ms
                        </span>
                    )}
                    {question && question.limit_memory && (
                        <span className="text-gray-600">
                            💾 {question.limit_memory} MB
                        </span>
                    )}

                    {/* 사용 가능 언어 아이콘 */}
                    <span className="flex items-center gap-1">
                        {question?.language.map((lang) =>
                            iconMap[lang] ? (
                                <Image
                                    key={lang}
                                    src={iconMap[lang]}
                                    alt={lang}
                                    width={18}
                                    height={18}
                                    unoptimized
                                    style={{ width: "auto" }}
                                />
                            ) : null
                        )}
                    </span>
                </div>

                {/* 문제 설명 */}
                <div className="mt-2">
                    <VditorPreview
                        content={question?.description ?? ""}
                        theme="light"
                        className="rounded border border-gray-200"
                    />
                </div>
                </div>
            </div>
        </div>
    );
};

export default ProblemPreviewModal;
