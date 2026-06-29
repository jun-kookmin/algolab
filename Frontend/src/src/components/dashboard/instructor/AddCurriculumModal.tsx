"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";   // ✅ next/image 가져오기
import { Language, LANGUAGES } from "@/types/languages";

interface AddCurriculumModalProps {
    open: boolean;
    onClose: () => void;
    onCreate: (
        className: string,
        startDate: string,
        endDate: string,
        languages: Language[]
    ) => void;
}

/** 배지 버튼에 쓸 라벨·아이콘 경로 */
const LANGUAGE_OPTIONS = [
    { label: LANGUAGES.C, icon: "Icon_C.svg" },
    { label: LANGUAGES.CPP, icon: "Icon_CPP.svg" },
    { label: LANGUAGES.JAVA, icon: "Icon_Java.svg" },
    { label: LANGUAGES.PYTHON, icon: "Icon_Python.svg" },
] as const;

export default function AddCurriculumModal({
    open,
    onClose,
    onCreate,
}: AddCurriculumModalProps) {
    const [className, setClassName] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [selectedLangs, setSelectedLangs] = useState<Language[]>([]);

    /* ESC + 스크롤 잠금 */
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", handleKey);
        const sw = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = "hidden";
        document.body.style.paddingRight = `${sw}px`;
        return () => {
            window.removeEventListener("keydown", handleKey);
            document.body.style.overflow = "";
            document.body.style.paddingRight = "";
        };
    }, [open, onClose]);

    if (!open) return null;

    const handleCreateClick = () => {
        if (
            !className.trim() ||
            !startDate ||
            !endDate ||
            selectedLangs.length === 0
        )
            return;
        onCreate(className.trim(), startDate, endDate, selectedLangs);
        setClassName("");
        setStartDate("");
        setEndDate("");
        setSelectedLangs([]);
    };

    const toggleLang = (lang: Language) => {
        setSelectedLangs((prev) =>
            prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
        );
    };

    return createPortal(
        <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4"
            onMouseDown={onClose}
        >
            <div className="relative z-10 flex min-h-full items-start justify-center py-4 sm:items-center">
                <div
                    className="fluid-modal-sm max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg bg-white p-[clamp(16px,1.6vw,24px)] shadow-xl"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                <h2 className="fluid-title-md mb-4 font-bold">새 커리큘럼 추가</h2>

                {/* 수업 이름 */}
                <div className="mb-3">
                    <label className="block text-sm font-semibold mb-1">수업 이름</label>
                    <input
                        className="fluid-control-h w-full rounded border border-gray-300 px-2 text-[clamp(12px,0.8vw,14px)]"
                        placeholder="예) 자료구조"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                    />
                </div>

                {/* 시작일 */}
                <div className="mb-3">
                    <label className="block text-sm font-semibold mb-1">시작일</label>
                    <input
                        type="date"
                        className="fluid-control-h w-full rounded border border-gray-300 px-2 text-[clamp(12px,0.8vw,14px)]"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>

                {/* 종료일 */}
                <div className="mb-3">
                    <label className="block text-sm font-semibold mb-1">종료일</label>
                    <input
                        type="date"
                        className="fluid-control-h w-full rounded border border-gray-300 px-2 text-[clamp(12px,0.8vw,14px)]"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>

                {/* 사용 언어 (배지 버튼: next/image 사용) */}
                <div className="mb-5">
                    <label className="block text-sm font-semibold mb-2">사용 언어</label>

                    {/* ‼️ 변경: grid-cols-4 로 넓이 균등 분배 */}
                    <div className="grid grid-cols-4 gap-2">
                        {LANGUAGE_OPTIONS.map(({ label, icon }) => {
                            const active = selectedLangs.includes(label);
                            return (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => toggleLang(label)}
                                    /* 버튼이 셀 폭 100% 차지 + 가운데 정렬 */
                                    className={`fluid-control-h flex w-full items-center justify-center gap-1 rounded-md border text-[clamp(11px,0.72vw,13px)] transition
            ${active
                                            ? "bg-blue-50 border-blue-600 text-blue-700"
                                            : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200"
                                        }`}
                                >
                                    <Image
                                        src={`/assets/icon/${icon}`}
                                        alt={label}
                                        width={0}
                                        height={16}
                                        priority
                                        className="w-auto"
                                    />
                                </button>
                            );
                        })}
                    </div>
                </div>

                    {/* 액션 버튼 */}
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={onClose}
                            className="fluid-control-h rounded bg-gray-200 px-[clamp(10px,0.9vw,14px)] text-[clamp(12px,0.8vw,14px)] hover:bg-gray-300"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleCreateClick}
                            disabled={
                                !className.trim() ||
                                !startDate ||
                                !endDate ||
                                selectedLangs.length === 0
                            }
                            className="fluid-control-h rounded bg-blue-600 px-[clamp(10px,0.9vw,14px)] text-[clamp(12px,0.8vw,14px)] text-white hover:bg-blue-500 disabled:bg-blue-300"
                        >
                            생성
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
