// ──── FILE: src/components/SectionModal.tsx ────
"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface SectionModalProps {
    open: boolean;
    onSave: (
        title: string,
        description: string,
        isExamDefault: boolean,
        schedule?: { start_date?: string; due_date?: string }
    ) => void;
    onClose: () => void;
    /** 시험 탭에서 열렸다면 true로 전달 */
    examLocked?: boolean;
}

const toDatetimeLocalValue = (date: Date) => {
    const localMs = date.getTime() - date.getTimezoneOffset() * 60_000;
    return new Date(localMs).toISOString().slice(0, 16);
};

const getDefaultSchedule = (durationDays: number) => {
    const start = new Date();
    const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
    return {
        start_date: toDatetimeLocalValue(start),
        due_date: toDatetimeLocalValue(end),
    };
};

const SectionModal: React.FC<SectionModalProps> = ({
    open,
    onSave,
    onClose,
    examLocked = false,
}) => {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startDate, setStartDate] = useState("");
    const [dueDate, setDueDate] = useState("");
    const contentTypeLabel = examLocked ? "시험" : "과제";

    /* ESC + 스크롤 잠금 */
    useEffect(() => {
        if (!open) return;
        const handleEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", handleEsc);

        const sw = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = "hidden";
        document.body.style.paddingRight = `${sw}px`;

        return () => {
            window.removeEventListener("keydown", handleEsc);
            document.body.style.overflow = "";
            document.body.style.paddingRight = "";
        };
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;

        const defaults = getDefaultSchedule(examLocked ? 1 : 7);
        setStartDate(defaults.start_date);
        setDueDate(defaults.due_date);
    }, [examLocked, open]);

    if (!open) return null;

    const isTimeInvalid = Boolean(startDate && dueDate && startDate >= dueDate);
    const isSaveDisabled =
        !title.trim() || !startDate || !dueDate || isTimeInvalid;

    const handleSaveClick = () => {
        if (isSaveDisabled) return;
        // ✅ 클릭 불가이므로 isExamDefault는 탭(examLocked)에 의해 고정
        onSave(
            title.trim(),
            description.trim(),
            !!examLocked,
            {
                start_date: startDate,
                due_date: dueDate,
            }
        );
        setTitle("");
        setDescription("");
        setStartDate("");
        setDueDate("");
    };

    return createPortal(
        <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4"
            onMouseDown={onClose}
        >
            <div className="relative z-10 flex min-h-full items-start justify-center py-4 sm:items-center">
                <div
                    className="fluid-modal-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg bg-white px-[clamp(16px,2vw,32px)] py-[clamp(16px,2vh,32px)] shadow-xl"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                <h2 className="font-kr fluid-title-lg mb-6 font-bold">{contentTypeLabel} 추가하기</h2>

                {/* 제목 */}
                <div className="mb-4">
                    <label className="font-kr mb-1 block text-sm font-medium text-gray-700">
                        {contentTypeLabel} 제목
                    </label>
                    <input
                        className="font-kr fluid-control-h w-full rounded-[5px] border border-indigo-200 px-3 text-[clamp(12px,0.8vw,14px)] focus:border-indigo-500 focus:outline-none"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={`${contentTypeLabel} 제목을 입력해주세요`}
                    />
                </div>

                {/* 설명 */}
                <div className="mb-4">
                    <label className="font-kr mb-1 block text-sm font-medium text-gray-700">
                        {contentTypeLabel} 설명
                    </label>
                    <textarea
                        rows={3}
                        className="font-kr w-full resize-none rounded-[5px] border border-indigo-200 px-3 py-2 text-[clamp(12px,0.8vw,14px)] focus:border-indigo-500 focus:outline-none"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={`${contentTypeLabel} 설명을 입력해주세요`}
                    />
                </div>

                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    <div>
                        <label className="font-kr mb-1 block text-sm font-medium text-gray-700">
                            시작 시간
                        </label>
                        <input
                            type="datetime-local"
                            className="font-kr fluid-control-h w-full rounded-[5px] border border-indigo-200 px-3 text-[clamp(12px,0.8vw,14px)] focus:border-indigo-500 focus:outline-none"
                            value={startDate}
                            max={dueDate || undefined}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="font-kr mb-1 block text-sm font-medium text-gray-700">
                            종료 시간
                        </label>
                        <input
                            type="datetime-local"
                            className="font-kr fluid-control-h w-full rounded-[5px] border border-indigo-200 px-3 text-[clamp(12px,0.8vw,14px)] focus:border-indigo-500 focus:outline-none"
                            value={dueDate}
                            min={startDate || undefined}
                            onChange={(e) => setDueDate(e.target.value)}
                        />
                    </div>
                    {isTimeInvalid && (
                        <p className="sm:col-span-2 text-sm font-medium text-red-600">
                            종료 시간은 시작 시간 이후로 설정해주세요.
                        </p>
                    )}
                </div>

                    {/* 액션 */}
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="font-kr fluid-control-h rounded-md bg-gray-200 px-[clamp(14px,1.2vw,24px)] text-[clamp(11px,0.72vw,13px)] font-medium text-gray-600 hover:bg-gray-300 active:scale-95"
                        >
                            취소
                        </button>
                        <button
                            disabled={isSaveDisabled}
                            onClick={handleSaveClick}
                            className="font-kr fluid-control-h rounded-md bg-indigo-600 px-[clamp(14px,1.2vw,24px)] text-[clamp(11px,0.72vw,13px)] font-medium text-white hover:bg-indigo-500 active:scale-95 disabled:bg-indigo-300"
                        >
                            저장
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SectionModal;
