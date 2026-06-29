// ──── FILE: src/components/ProblemImportModalRight.tsx ────
"use client";

import React from "react";
import Image from "next/image";
import { Question } from "@/types/class";
import { DIFFICULTIES } from "@/types/difficulties";

interface ProblemImportModalRightProps {
    selectedOrder: Question[];
    toggleSelect: (id: string) => void;
    moveUp: (id: string) => void;
    moveDown: (id: string) => void;
    sortByDifficultyAsc: () => void;
    sortByDifficultyDesc: () => void;
}

/** 공통 아이콘 컴포넌트 (간단 버전) */
interface ImgProps {
    src: string;
    alt?: string;
    size?: number;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLImageElement>;
}
const IconImg: React.FC<ImgProps> = ({
    src,
    alt = "",
    size = 17,
    className = "",
    ...rest
}) => (
    <Image
        src={src}
        alt={alt}
        width={0}
        height={size}
        unoptimized
        className={className}
        style={{ width: "auto" }}
        {...rest}
    />
);

/* ── 아이콘 경로 상수 (public/ 경로) ───────────────── */
const TrashIcon = "/assets/icon/Icon_TrashCan(Black).svg";
const UpIcon = "/assets/icon/Icon_MoveUp.svg";
const DownIcon = "/assets/icon/Icon_MoveDown.svg";

/* ── 난이도 배지 색상 유틸 ─────────────────────────── */
const difficultyBadgeColor = (d: Question["difficulty"]) => {
    switch (d) {
        case DIFFICULTIES.EASY:
            return "bg-green-100 text-green-700";
        case DIFFICULTIES.MEDIUM:
            return "bg-yellow-100 text-yellow-700";
        case DIFFICULTIES.HARD:
            return "bg-red-100 text-red-700";
        default:
            return "";
    }
};

const ProblemImportModalRight: React.FC<ProblemImportModalRightProps> = ({
    selectedOrder,
    toggleSelect,
    moveUp,
    moveDown,
    sortByDifficultyAsc,
    sortByDifficultyDesc,
}) => {
    const problems = selectedOrder;
    return (
        <div className="flex-1 ml-5">
            <div className="h-full overflow-y-auto rounded-[4px] bg-[rgba(244,250,255,1)] p-4">
                <div className="mb-2 flex items-center">
                    <h3 className="text-base font-semibold">
                        선택된 문제 ({selectedOrder.length})
                    </h3>
                    <div className="ml-auto flex gap-2">
                        <button
                            onClick={sortByDifficultyAsc}
                            className="h-6 rounded bg-indigo-100 px-2 text-xs text-indigo-700 hover:bg-indigo-200"
                        >
                            오름차순
                        </button>
                        <button
                            onClick={sortByDifficultyDesc}
                            className="h-6 rounded bg-indigo-100 px-2 text-xs text-indigo-700 hover:bg-indigo-200"
                        >
                            내림차순
                        </button>
                    </div>
                </div>

                {selectedOrder.length === 0 ? (
                    <p className="mt-10 text-center text-sm text-gray-500">
                        선택된 문제가 없습니다
                    </p>
                ) : (
                    <div className="overflow-y-auto">
                        <table className="w-full table-fixed text-sm border-separate border-spacing-y-2 min-w-[280px]">
                            <thead>
                                <tr>
                                    <th className="w-[15%] min-w-[60px] px-2" />
                                    <th className="min-w-[120px] flex-1 px-2 text-left" />
                                    <th className="w-18 px-2" />
                                </tr>
                            </thead>
                            <tbody>
                                {problems.map((q, idx) => {
                                    const id = selectedOrder[idx];
                                    if (!q) {
                                        return (
                                            <tr key={`${id}-${idx}`} className="rounded-md bg-white shadow-sm opacity-60">
                                            <td className="px-2 py-3 text-center">…</td>
                                            <td className="truncate px-2 py-3">불러오는 중…</td>
                                            <td className="px-2 py-3 text-right" />
                                            </tr>
                                        );
                                    }
                                    return (
                                        <tr key={q.id} className="rounded-md bg-white shadow-sm">
                                            {/* 난이도 */}
                                            <td className="px-2 py-3 text-center">
                                                <span
                                                    className={`rounded px-1.5 py-[1px] text-[10px] ${difficultyBadgeColor(
                                                        q.difficulty
                                                    )}`}
                                                >
                                                    {q.difficulty.toUpperCase()}
                                                </span>
                                            </td>

                                            {/* 제목 */}
                                            <td className="truncate px-2 py-3">{q.title}</td>

                                            {/* 조작 아이콘 */}
                                            <td className="px-2 py-3 text-right">
                                                <div className="flex items-center justify-end space-x-2">
                                                    <IconImg
                                                        src={UpIcon}
                                                        alt="위로"
                                                        size={16}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            moveUp(q.id);
                                                        }}
                                                        className="cursor-pointer"
                                                    />
                                                    <IconImg
                                                        src={DownIcon}
                                                        alt="아래로"
                                                        size={16}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            moveDown(q.id);
                                                        }}
                                                        className="cursor-pointer"
                                                    />
                                                    <IconImg
                                                        src={TrashIcon}
                                                        alt="삭제"
                                                        size={16}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleSelect(q.id);
                                                        }}
                                                        className="cursor-pointer"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProblemImportModalRight;
