"use client";

import React, { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import DeleteModal from "@/components/class/DeleteModal";
import dynamic from "next/dynamic";

import type { ExamProblem, ExamQuestion, Question } from "@/types/class";
import { useGetExam } from "@/hooks/lectures/Get/useGetExam";
import { mapLanguages } from "@/types/languages";

// 업데이트와 캐시 무효화를 위한 React Query 훅
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateExam } from "@/hooks/lectures/Update/useUpdateExam";
import { toast } from "react-toastify";
import { Btn } from "@/components/assets/Btn";
import { usePatchExam } from "@/hooks/lectures/Update/usePatchExam";
import { validateDateTimeRange } from "@/utils/dateTimeLocal";

const ProblemImportModal = dynamic(
    () => import("@/components/class/ProblemImportModal/ProblemImportModal"),
    {
        ssr: false,
        loading: () => (
            <div className="p-6 text-center text-sm text-gray-500">
                모달 로딩 중...
            </div>
        ),
    }
);

/* ── 아이콘 경로 ( public/… ) ───────────────────────── */
const ExternalIcon = "/assets/icon/Icon_ShortCut.svg";
const TrashIcon = "/assets/icon/Icon_TrashCan.svg";
const UpIcon = "/assets/icon/Icon_Up.svg";
const DownIcon = "/assets/icon/Icon_Down.svg";

/* ── 공통 Image 래퍼 ─────────────────────────────────── */
interface IconProps {
    src: string;
    alt?: string;
    size?: number;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLImageElement>;
}

const IconImg: React.FC<IconProps> = ({ src, alt = "", size = 16, className = "", ...rest }) => (
    <Image src={src} alt={alt} width={size} height={size} unoptimized className={className} {...rest} />
);

/* ───────────────────────────────────────────────────── */
export interface ExamSectionProps {
    id: string;
    classId: string;
    examId: string;
    displayNo: number;
    title: string;
    description?: string;
    isOpen: boolean;
    start_date?: string;
    due_date?: string;
    onToggle: () => void;
    onDelete: () => void;
}

/* ── Exam 전용 문제 행 ───────────────────────────────── */
const ExamProblemRow: React.FC<{
    problem: ExamQuestion;
    onPointChange: (id: string, newPoints: number) => void;
    onDelete: () => void;
}> = ({ problem, onPointChange, onDelete }) => {
    const displayTitle = problem.title;

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [tempPoint, setTempPoint] = useState<number>(problem.points);

    // props 변동 시 동기화
    useEffect(() => {
        setTempPoint(problem.points);
    }, [problem.points]);

    return (
        <div className="flex flex-col gap-2 border-b border-b-gray-200 px-5 py-2 last:border-b-0">
            <div className="flex items-center gap-3">
                {/* 제목 */}
                <div className="flex flex-1 flex-col text-[12px]">
                    <span className="flex items-center gap-2 font-kr font-medium text-gray-800">
                        {displayTitle}
                        <span className="rounded bg-red-50 px-1.5 py-[1px] text-[10px] font-semibold text-red-600">
                            시험
                        </span>
                    </span>
                </div>

                <span className="mx-2 font-kr text-xs text-gray-500">배점</span>
                <input
                    type="number"
                    value={tempPoint}
                    onChange={(e) => setTempPoint(Number(e.target.value))}
                    onBlur={() => onPointChange(problem.id, tempPoint)}
                    className="h-8 w-16 rounded-md border border-indigo-200 bg-indigo-50 px-2 text-right text-xs focus:border-indigo-500"
                />

                <IconImg src={ExternalIcon} alt="바로가기" size={16} className="cursor-pointer" />
                <IconImg
                    src={TrashIcon}
                    alt="삭제"
                    size={16}
                    className="cursor-pointer hover:text-red-600"
                    onClick={() => setDeleteModalOpen(true)}
                />
            </div>

            {/* 삭제 모달 */}
            <DeleteModal
                open={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={() => {
                    onDelete();
                    setDeleteModalOpen(false);
                }}
            />
        </div>
    );
};

/* ── Exam 섹션 컴포넌트 ─────────────────────────────── */
const ExamSection: React.FC<ExamSectionProps> = ({
    classId,
    examId,
    displayNo,
    title,
    description,
    isOpen,
    start_date,
    due_date,
    onToggle,
    onDelete,
}) => {
    // 업데이트 후 캐시 무효화를 위한 QueryClient
    const qc = useQueryClient();
    // 시험 문제를 업데이트하기 위한 커스텀 훅
    const updateExam = useUpdateExam(classId, examId);
    const patchExam = usePatchExam(classId, examId);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);

    const defaultDate = "2025-01-01T00:00";

    const { data: examData, isLoading } = useGetExam(classId, examId, {
        enabled: isOpen,
    });

    const examProblem = examData?.problems ?? [];
    // 화면에 표시하기 위한 ExamProblem 객체를 구성합니다.
    const displayProblem: ExamProblem | null = useMemo(() => {
        if (!examData) return null;
        return {
            id: examId,
            title: title,
            startAt: examData.start_date ?? defaultDate,
            endAt: examData.due_date ?? defaultDate,
            isExam: true,
            checked: false,
            subQuestions: examProblem.map(({ id, problem_id, title, language, score }) => ({
                id,
                problem_id,
                title,
                language: mapLanguages(language),
                points: score
            })),
        };
    }, [examProblem, examData, examId, title]);

    // subQuestions의 배점을 수정할 때 사용할 로컬 상태
    const [editedSubQuestions, setEditedSubQuestions] = useState<ExamQuestion[]>(
        displayProblem?.subQuestions ?? []
    );

    // displayProblem이 바뀌면 로컬 상태 초기화
    useEffect(() => {
        if (displayProblem?.subQuestions) {
            setEditedSubQuestions(displayProblem.subQuestions);
        }
    }, [displayProblem]);

    const problemIds = examProblem.map((prob) => prob.problem_id);

    // 날짜 일괄 편집을 위한 로컬 상태
    const [bulkStart, setBulkStart] = useState(start_date ? start_date.slice(0, 16) : defaultDate);
    const [bulkEnd, setBulkEnd] = useState(due_date ? due_date.slice(0, 16) : defaultDate);

    /** 전체 시험 기간 일괄 적용 */
    const applyBulkDateRange = () => {
        if (!displayProblem) return;
        const validation = validateDateTimeRange(bulkStart, bulkEnd);
        if (!validation.ok) {
            toast.error(validation.message);
            return;
        }

        const toastID = toast.info("저장 중입니다...");
        patchExam.mutate(
            {
                start_date: bulkStart,
                due_date: bulkEnd,
            },
            {
                onSuccess: () => {
                    qc.invalidateQueries({ queryKey: ["exam", classId, examId], exact: true });
                    toast.success("저장되었습니다!");
                },
                onError: () => {
                    toast.error("문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
                },
                onSettled: () => toast.dismiss(toastID),
            }
        );
    };

    /** 행별 배점 변경을 로컬 상태에 반영 */
    const handlePointChange = (id: string, newPoints: number) => {
        setEditedSubQuestions((prev) =>
            prev.map((sq) => (sq.id === id ? { ...sq, points: newPoints } : sq))
        );
    };

    /** 전체 변경 사항을 서버에 한 번에 저장 */
    const handleSaveAll = () => {
        const payload = editedSubQuestions.map((sq) => ({
            problem: sq.problem_id,
            score: sq.points,
        }));

        const toastID = toast.info("저장 중입니다...");
        updateExam.mutate(payload, {
            onSuccess: () => {
                qc.invalidateQueries({ queryKey: ["exam", classId, examId], exact: true });
                toast.success("저장되었습니다!");
            },
            onError: () => {
                toast.error("문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
            },
            onSettled: () => toast.dismiss(toastID),
        });
    };

    const handleImportQuestions = (qs: Question[]) => {
        const payload = (qs ?? []).map((q) => ({ problem: q.id, score: 100 }));

        const toastID = toast.info("저장 중입니다...");
        updateExam.mutate(payload, {
            onSuccess: () => {
                qc.invalidateQueries({ queryKey: ["exam", classId, examId], exact: true });
                toast.success("저장되었습니다!");
            },
            onError: () => {
                toast.error("문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
            },
                onSettled: () => toast.dismiss(toastID),
        });
    };


    /** 문제 삭제 시 로컬 상태에서 제외하고 바로 서버에 전송 */
    const handleSubQuestionDelete = (id: string) => {
        // 1) 로컬 상태에서 먼저 제거
        const next = editedSubQuestions.filter((sq) => sq.id !== id);
        setEditedSubQuestions(next);

        // 2) 서버에 업데이트 전송
        const payload = next.map((sq) => ({
            problem: sq.problem_id,
            score: sq.points,
        }));
        const toastID = toast.info("삭제 중입니다...");
        updateExam.mutate(
        payload,
        {
            onSuccess: () => {
                qc.invalidateQueries({ queryKey: ["exam", classId, examId], exact: true });
                toast.success("삭제되었습니다!");
            },
            onError: () => {
                toast.error("문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
            },
            onSettled: () => toast.dismiss(toastID),
        }
        );
    };


    return (
        <>
            <div className="mb-2 overflow-hidden border-b border-t border-b-gray-300 border-t-gray-300 bg-white shadow-[0_2px_4px_rgba(15,23,42,0.08)]">
                {/* 섹션 헤더 */}
                <div
                    className={`flex cursor-pointer items-center px-5 py-3 ${isOpen ? "bg-indigo-50 border-indigo-400" : "bg-white border-gray-200 hover:bg-gray-50"}`}
                    onClick={onToggle}
                >
                    <IconImg src={isOpen ? DownIcon : UpIcon} alt="토글" size={16} />
                    <span className="ml-4 w-12 text-center font-kr text-sm">
                        {String(displayNo).padStart(2, "0")}
                    </span>
                    <span className="font-kr flex flex-1 items-center text-sm">{title}</span>

                    {/* 오른쪽 아이콘 */}
                    <div
                        className="flex items-center gap-3"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <IconImg src={ExternalIcon} alt="바로가기" size={16} />
                        <IconImg
                            src={TrashIcon}
                            alt="삭제"
                            size={16}
                            className="cursor-pointer hover:text-red-600"
                            onClick={() => setDeleteModalOpen(true)}
                        />
                    </div>
                </div>

                {/* 섹션 바디 */}
                {isOpen && (
                    <div className="mx-10 border border-gray-200 border-x-0 p-4">
                        {description && (
                            <p className="mb-2 font-kr text-xs font-medium text-gray-500">
                                {description}
                            </p>
                        )}

                        {/* 기간 일괄 설정 */}
                        <div className="mb-4 flex items-center gap-2">
                            <span className="font-kr text-xs text-gray-600">
                                기간 일괄 설정:
                            </span>
                            <input
                                type="datetime-local"
                                value={bulkStart}
                                onChange={(e) => setBulkStart(e.target.value)}
                                className="h-7 rounded border border-gray-200 px-2 text-[11px]"
                            />
                            <span className="text-gray-500">~</span>
                            <input
                                type="datetime-local"
                                value={bulkEnd}
                                onChange={(e) => setBulkEnd(e.target.value)}
                                className="h-7 rounded border border-gray-200 px-2 text-[11px]"
                            />
                            <button
                                onClick={applyBulkDateRange}
                                className="ml-2 rounded bg-indigo-600 px-3 py-[3px] font-kr text-[11px] font-medium text-white hover:bg-indigo-500 active:scale-95"
                            >
                                일괄 적용
                            </button>
                        </div>

                        {/* 문제 목록 (시험 전용) */}
                        <div className="border border-gray-200">
                            {isLoading ? (
                                <div className="p-6 text-center text-sm text-gray-500">
                                    로딩 중입니다...
                                </div>
                            ) : editedSubQuestions.length > 0 ? (
                                editedSubQuestions.map((sq) => (
                                    <ExamProblemRow
                                        key={sq.id}
                                        problem={sq}
                                        onPointChange={handlePointChange}
                                        onDelete={() => handleSubQuestionDelete(sq.id)}
                                    />
                                ))
                            ) : (
                                <div className="p-6 text-center text-sm text-gray-500">
                                    선택된 시험 문제가 없습니다. 우측 버튼으로 문제를 가져오세요.
                                </div>
                            )}
                        </div>

                        {/* 전체 저장 버튼 */}
                        <div className="mt-4 flex justify-end">
                            <Btn
                                text="저장하기"
                                onClick={handleSaveAll}
                                textSize="text-xs"
                                height="h-7"
                                width="w-24"
                            />
                        </div>

                        <div className="mt-4 ml-auto flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setImportModalOpen(true)}
                                className="font-kr flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 active:scale-95"
                            >
                                시험 문제 편집하기
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 섹션 삭제 모달 */}
            <DeleteModal
                open={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={() => {
                    onDelete();
                    setDeleteModalOpen(false);
                }}
            />

            {/* 문제 가져오기 모달 (시험: subQuestions 기반 초기 선택) */}
            <ProblemImportModal
                open={importModalOpen}
                initialSelected={problemIds}
                onClose={() => setImportModalOpen(false)}
                onConfirm={(sel) => {
                    // 새로운 문제 추가 후 저장 버튼으로 업데이트
                    handleImportQuestions(sel);
                    setImportModalOpen(false);
                }}
            />
        </>
    );
};

export default ExamSection;
