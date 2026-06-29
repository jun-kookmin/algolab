"use client";

import React from "react";
import Image from "next/image";
import { Question } from "@/types/class";
import ProblemPreviewModal from "@/components/class/ProblemImportModal/ProblemPreviewModal"; // ⬅️ 추가
import { DIFFICULTIES } from "@/types/difficulties";
import { Language, LANGUAGES } from "@/types/languages";

interface ProblemImportModalLeftProps {
    filteredList: Question[];
    selectedOrder: string[];
    page: number;
    setPage: React.Dispatch<React.SetStateAction<number>>;
    totalPages: number;
    searchText: string;
    setSearchText: React.Dispatch<React.SetStateAction<string>>;
    itemsPerPage: number;
    toggleSelect: (id: string) => void;
    onSearch: () => void;
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
const InfoIcon = "/assets/icon/Icon_Info.svg";
const SearchIcon = "/assets/icon/Icon_Search.svg";

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

/* ── 언어 아이콘 매핑 ──────────────────────────────── */
const Icon_C = "/assets/icon/Icon_C.svg";
const Icon_CPP = "/assets/icon/Icon_CPP.svg";
const Icon_Java = "/assets/icon/Icon_Java.svg";
const Icon_Python = "/assets/icon/Icon_Python.svg";

const languageIconMap: Record<Language, string> = {
    [LANGUAGES.C] : Icon_C,
    [LANGUAGES.CPP]: Icon_CPP,
    [LANGUAGES.JAVA]: Icon_Java,
    [LANGUAGES.PYTHON]: Icon_Python,
};

const ProblemImportModalLeft: React.FC<ProblemImportModalLeftProps> = ({
    filteredList,
    selectedOrder,
    page,
    setPage,
    totalPages,
    searchText,
    setSearchText,
    itemsPerPage,
    toggleSelect,
    onSearch,
}) => {
    /* ───────── 추가: 미리보기 상태 ─────────────────── */
    const [previewQuestion, setPreviewQuestion] = React.useState<Question | null>(
        null
    );

    /* ───────── 헬퍼 ──────────────────────────────── */
    const openPreview = (q: Question) => setPreviewQuestion(q);
    const closePreview = () => setPreviewQuestion(null);

    return (
        <div className="relative flex w-[65%] flex-col border border-gray-200">
            {/* 검색/필터 */}
            <div className="flex items-center justify-start border-b border-b-gray-200 px-4 py-2">
                <div className="relative w-96">
                    <input
                        type="text"
                        placeholder="검색"
                        value={searchText}
                        onChange={(e) => {
                            setSearchText(e.target.value);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                onSearch(); // Enter 키로 검색 실행
                            }
                        }}
                        className="h-8 w-96 rounded border border-gray-200 pl-4 pr-8 text-sm"
                    />
                    <IconImg
                        src={SearchIcon}
                        alt="검색"
                        size={16}
                        onClick={() => onSearch()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500"
                    />
                </div>
            </div>

            {/* 문제 리스트 */}
            <div className="mb-10 max-h-[clamp(220px,52dvh,600px)] overflow-y-auto">
                <table className="w-full table-fixed">
                    <thead>
                        <tr className="border-b border-b-gray-200 bg-gray-50 text-sm font-medium text-gray-600">
                            <th className="w-[10%] px-4 py-2">난이도</th>
                            <th className="w-[70%] px-4 py-2 text-left">제목</th>
                            <th className="w-[30%] px-4 py-2 text-center">사용 가능 언어</th>
                            <th className="w-8 px-4 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {filteredList.map((q) => {
                            const isSelected = selectedOrder.includes(q.id);
                            return (
                                <tr
                                    key={q.id}
                                    onClick={() => toggleSelect(q.id)}
                                    className={`cursor-pointer border-b border-b-gray-200 ${
                                        isSelected
                                            ? "bg-gray-100 text-[rgba(78,97,246,1)]"
                                            : ""
                                    }`}
                                >
                                    {/* 난이도 */}
                                    <td className="px-4 py-2 text-left">
                                        <span
                                            className={`rounded px-1.5 py-[1px] text-[10px] ${difficultyBadgeColor(
                                                q.difficulty
                                            )}`}
                                        >
                                            {q.difficulty}
                                        </span>
                                    </td>

                                    {/* 제목 */}
                                    <td className="flex-1 truncate px-4 py-2 text-left">
                                        {q.title}
                                    </td>

                                    {/* 언어 아이콘 */}
                                    <td className="w-[30%] px-4 py-2">
                                        <div className="flex items-center justify-center gap-1">
                                            {q.language.map((lang) => {
                                                const src = languageIconMap[lang];
                                                return src ? (
                                                    <IconImg key={lang} src={src} alt={lang} size={17} />
                                                ) : null;
                                            })}
                                        </div>
                                    </td>

                                    {/* Info 아이콘 */}
                                    <td
                                        className="w-8 px-2 py-2 text-center"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openPreview(q);
                                        }}
                                    >
                                        <IconImg src={InfoIcon} alt="문제 정보" size={16} className="cursor-pointer" />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* 페이지 버튼 */}
            {totalPages > 1 && (
                <div className="absolute bottom-0 left-0 flex w-full justify-center gap-2 bg-white py-2">
                    {Array.from({ length: totalPages }, (_, i) => (
                        <button
                            key={i}
                            onClick={() => setPage(i + 1)}
                            className={`font-kr inline-flex h-7 min-w-[28px] items-center justify-center rounded-[10px] border px-2 text-xs font-medium transition-colors active:scale-95 ${
                                page === i + 1
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-500 shadow-sm ring-1 ring-indigo-200 font-semibold"
                                    : "bg-white text-gray-700 border-gray-300 hover:bg-indigo-50"
                            }`}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>
            )}

            {/* ───────── 미리보기 모달 ─────────────────── */}
            {previewQuestion && (
                <ProblemPreviewModal questionId={previewQuestion.id} onClose={closePreview} />
            )}
        </div>
    );
};

export default ProblemImportModalLeft;
