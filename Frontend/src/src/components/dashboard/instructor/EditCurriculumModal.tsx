"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Language, LANGUAGES } from "@/types/languages";

interface EditCurriculumModalProps {
    open: boolean;
    onClose: () => void;
    initialClassName: string;
    initialStartDate: string;
    initialEndDate: string;
    initialLanguages: Language[];
    initialCurriculumLocked?: boolean;
    onUpdate: (
        className: string,
        startDate: string,
        endDate: string,
        languages: Language[],
        curriculumLocked: boolean,
    ) => void;
}

const LANGUAGE_OPTIONS = [
    { label: LANGUAGES.C, icon: "Icon_C.svg" },
    { label: LANGUAGES.CPP, icon: "Icon_CPP.svg" },
    { label: LANGUAGES.JAVA, icon: "Icon_Java.svg" },
    { label: LANGUAGES.PYTHON, icon: "Icon_Python.svg" },
] as const;

export default function EditCurriculumModal({
    open,
    onClose,
    initialClassName,
    initialStartDate,
    initialEndDate,
    initialLanguages,
    initialCurriculumLocked = false,
    onUpdate,
}: EditCurriculumModalProps) {
    const [className, setClassName] = useState(initialClassName);
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [selectedLangs, setSelectedLangs] =
        useState<Language[]>(initialLanguages);
    const [curriculumLocked, setCurriculumLocked] = useState(
        initialCurriculumLocked
    );

    // 모달이 열릴 때마다 초기값으로 되돌림
    useEffect(() => {
        if (open) {
            setClassName(initialClassName);
            setStartDate(initialStartDate);
            setEndDate(initialEndDate);
            setSelectedLangs(initialLanguages);
            setCurriculumLocked(initialCurriculumLocked);
        }
    }, [
        open,
        initialClassName,
        initialStartDate,
        initialEndDate,
        initialLanguages,
        initialCurriculumLocked,
    ]);

    // ESC + 스크롤 잠금 처리
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
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

    const toggleLang = (lang: Language) => {
        setSelectedLangs((prev) =>
            prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
        );
    };

    const handleUpdateClick = () => {
        if (
            !className.trim() ||
            !startDate ||
            !endDate ||
            selectedLangs.length === 0
        )
            return;
        onUpdate(
            className.trim(),
            startDate,
            endDate,
            selectedLangs,
            curriculumLocked
        );
        // 모달은 상위 onUpdate에서 닫힐 수 있으므로 여기서는 닫지 않음
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
                <h2 className="fluid-title-md mb-4 font-bold">커리큘럼 수정</h2>

                {/* 수업 이름 */}
                <div className="mb-3">
                    <label className="block text-sm font-semibold mb-1">
                        수업 이름
                    </label>
                    <input
                        className="fluid-control-h w-full rounded border border-gray-300 px-2 text-[clamp(12px,0.8vw,14px)]"
                        placeholder="예) 자료구조"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                    />
                </div>

                {/* 시작일 */}
                <div className="mb-3">
                    <label className="block text-sm font-semibold mb-1">
                        시작일
                    </label>
                    <input
                        type="date"
                        className="fluid-control-h w-full rounded border border-gray-300 px-2 text-[clamp(12px,0.8vw,14px)]"
                        value={startDate.slice(0, 10)}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>

                {/* 종료일 */}
                <div className="mb-3">
                    <label className="block text-sm font-semibold mb-1">
                        종료일
                    </label>
                    <input
                        type="date"
                        className="fluid-control-h w-full rounded border border-gray-300 px-2 text-[clamp(12px,0.8vw,14px)]"
                        value={endDate.slice(0, 10)}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>

                {/* 사용 언어 */}
                <div className="mb-5">
                    <label className="block text-sm font-semibold mb-2">
                        사용 언어
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        {LANGUAGE_OPTIONS.map(({ label, icon }) => {
                            const active = selectedLangs.includes(label);
                            return (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => toggleLang(label)}
                                    className={`fluid-control-h flex w-full items-center justify-center gap-1 rounded-md border text-[clamp(11px,0.72vw,13px)] transition ${
                                        active
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

                {/* 커리큘럼 접근 제한 */}
                <div className="mb-5">
                    <label className="block text-sm font-semibold mb-2">
                        커리큘럼 접근 차단
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={curriculumLocked}
                            onChange={(e) => setCurriculumLocked(e.target.checked)}
                            className="h-4 w-4 accent-blue-600"
                        />
                        학생 커리큘럼 접근 차단
                    </label>
                    {curriculumLocked && (
                        <p className="mt-1 text-xs text-red-500">
                            학생은 커리큘럼에 접근할 수 없습니다.
                        </p>
                    )}
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
                            onClick={handleUpdateClick}
                            disabled={
                                !className.trim() ||
                                !startDate ||
                                !endDate ||
                                selectedLangs.length === 0
                            }
                            className="fluid-control-h rounded bg-blue-600 px-[clamp(10px,0.9vw,14px)] text-[clamp(12px,0.8vw,14px)] text-white hover:bg-blue-500 disabled:bg-blue-300"
                        >
                            수정
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
