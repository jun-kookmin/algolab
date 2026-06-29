// ──── FILE: src/components/class/StudentSection_exam.tsx ────
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ExamProblem } from "@/types/class";
import { useGetExam } from "@/hooks/lectures/Get/useGetExam";
import { mapLanguages } from "@/types/languages";
import { useAuth } from "@/hooks/auth/AuthGuardProvider";
import { useGetExamStatus } from "@/hooks/solve/exam/GET/useGetExamStatus";
import { useGetExamUserSubmissions } from "@/hooks/problems/get/exam/user/useGetExamUserSubmissions";
import {
  clearExamFinishedByUser,
  isExamFinishedByUser,
} from "@/utils/examLock";

/* 아이콘 */
const UpIcon = "/assets/icon/Icon_Up.svg";
const DownIcon = "/assets/icon/Icon_Down.svg";

/* new Date() 없이 문자열만으로 포맷 */
function formatDateText(dt: string) {
    const [ymd = "", hms = ""] = dt.split("T");
    const [y = "0000", m = "00", d = "00"] = ymd.split("-");
    const [hh = "00", mm = "00", ss = "00"] = hms.split(":");
    return `${y}.${m}.${d}. (${hh}:${mm}:${ss || "00"})`;
}

function IconImg({
    src,
    alt = "",
    size = 16,
    className = "",
}: {
    src: string;
    alt?: string;
    size?: number;
    className?: string;
}) {
    return (
        <Image src={src} alt={alt} width={size} height={size} unoptimized className={className} />
    );
}

export interface StudentExamSectionProps {
    id: string;
    classId: string;
    examId: string;
    displayNo: number;
    title: string;
    description?: string;
    start_date: string;
    end_date: string;
    isOpen: boolean;
    onToggle: () => void;
    solveBlocked?: boolean;
    serverNowMs?: number | null;
}

/** 학생용: 시험 문제 행 (문항 보기/토글 제거) */
function ReadonlyExamProblemRow({ problem }: { problem: ExamProblem }) {
    return (
        <div className="flex flex-col gap-2 border-b border-b-gray-200 px-5 py-2 last:border-b-0">
            <div className="flex items-center gap-3">
                <div className="flex flex-1 flex-col text-[12px]">
                    <span className="flex items-center gap-2 font-kr font-medium text-gray-800">
                        {problem.title}
                        <span className="rounded bg-red-50 px-1.5 py-[1px] text-[10px] font-semibold text-red-600">
                            시험
                        </span>
                    </span>
                    <span className="font-kr text-gray-500">
                        {formatDateText(problem.startAt)} ~ {formatDateText(problem.endAt)}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default function StudentSectionExam({
    displayNo,
    classId,
    examId,
    title,
    description,
    start_date,
    end_date,
    isOpen,
    onToggle,
    solveBlocked = false,
    serverNowMs,
}: StudentExamSectionProps) {
    const defaultDate = "2025-01-01T00:00";

    const { data: examData } = useGetExam(classId, examId);
    const examProblem = examData?.problems ?? [];
    // console.log("ExamData : ", examData);

    const displayProblem: ExamProblem = {
        id: examId,
        title: title,
        startAt: start_date.slice(0, 16) ?? defaultDate,
        endAt: end_date.slice(0, 16) ?? defaultDate,
        isExam: true,
        checked: false,
        subQuestions: examProblem.map(({ id, problem_id, title, language, score }) => ({
            id,                 // ← exam_problem_id
            problem_id,         // 참고용 원 문제 id
            title,
            language: mapLanguages(language),
            points: score,
        })),
    };

    // exam_problem_id 배열을 ids=1,2,3 쿼리로
    const idsParam = (displayProblem.subQuestions ?? [])
        .map((q) => q.id)
        .filter(Boolean)
        .join(",");

    /**
     * ✅ 최종 라우팅:
     * /class/[classid]/solve/exam/[examID]?ids=1,2,3
     * 예) /class/1/solve/exam/2?ids=4,5,6
     */
    const examHref = idsParam
        ? `/class/${classId}/solve/exam/${examId}?ids=${idsParam}`
        : "#";

    const parseMs = (value?: string) => {
        if (!value) return null;
        const t = new Date(value).getTime();
        return Number.isFinite(t) ? t : null;
    };
    const { me } = useAuth();
    const group = (me?.group ?? "").toLowerCase();
    const isPrivileged =
        group === "administrator" || group === "professor";
    const nowMs = serverNowMs;
    const startMsFromSection = parseMs(start_date);
    const endMsFromSection = parseMs(end_date);

    const canQueryStatusPreStart =
      isPrivileged ||
      startMsFromSection === null ||
      (nowMs != null && nowMs >= startMsFromSection);
    const willBeAfterEnd =
      nowMs != null && endMsFromSection !== null && nowMs > endMsFromSection;
    const [finishedByUserLocal, setFinishedByUserLocal] =
      useState(() => isExamFinishedByUser(examId));

    useEffect(() => {
      if (!examId) return;
      setFinishedByUserLocal(isExamFinishedByUser(examId));
    }, [examId]);

    const shouldQueryStatus =
      !!examId &&
      canQueryStatusPreStart &&
      (!willBeAfterEnd || finishedByUserLocal);
    const { data: examStatus } = useGetExamStatus(examId, shouldQueryStatus);

    useEffect(() => {
      if (!examId || !examStatus) return;
      if (!examStatus.finished_by_user && finishedByUserLocal) {
        clearExamFinishedByUser(examId);
        setFinishedByUserLocal(false);
      }
    }, [examId, examStatus, finishedByUserLocal]);

    const startMs = startMsFromSection ?? parseMs(examStatus?.start_date ?? undefined);
    const endMs = endMsFromSection ?? parseMs(examStatus?.due_date ?? undefined);
    const isBeforeStart = nowMs != null && startMs !== null && nowMs < startMs;
    const isAfterEnd = nowMs != null && endMs !== null && nowMs > endMs;
    const isAccessible =
        Boolean(idsParam) &&
        (isPrivileged || (!isBeforeStart && !isAfterEnd && !solveBlocked));
    const blockReason = solveBlocked && !isPrivileged
        ? "시험 시간이 종료되었습니다."
        : isBeforeStart && !isPrivileged
            ? "접근 가능 시간이 아닙니다."
            : isAfterEnd && !isPrivileged
                ? "시험 시간이 종료되었습니다."
                : "";

    const isFinished =
        Boolean(examStatus?.finished) ||
        isAfterEnd ||
        solveBlocked ||
        finishedByUserLocal;
    const shouldShowSummary =
        isFinished || (isPrivileged && Boolean(examStatus?.started));
    const { data: examProgress } = useGetExamUserSubmissions(
        classId,
        me?.pk,
        shouldShowSummary && !!classId && !!me?.pk,
        examId
    );
    const totalFromExam = displayProblem.subQuestions?.length ?? 0;
    const progressTotal = examProgress?.total_count ?? 0;
    const solvedCount = examProgress?.solved_count ?? 0;
    const totalCount =
        totalFromExam > 0
            ? totalFromExam
            : progressTotal > 0
                ? progressTotal
                : solvedCount;
    const solvedDisplay =
        totalCount > 0 ? Math.min(solvedCount, totalCount) : solvedCount;
    const solvedSummary = shouldShowSummary
        ? {
            label: "정답",
            count: `${solvedDisplay}/${totalCount}`,
        }
        : null;

    return (
        <div className="mb-2 overflow-hidden border-b border-t border-b-gray-300 border-t-gray-300 bg-white shadow-[0_2px_4px_rgba(15,23,42,0.08)]">
            {/* 섹션 헤더 */}
            <div
                className={`flex cursor-pointer items-center px-5 py-3 ${
                    isOpen ? "bg-indigo-50 border-indigo-400" : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
                onClick={onToggle}
            >
                <IconImg src={isOpen ? DownIcon : UpIcon} alt="토글" size={16} />
                <span className="ml-4 w-12 text-center font-kr text-sm">
                    {String(displayNo).padStart(2, "0")}
                </span>
                <span className="font-kr flex flex-1 items-center text-sm">
                    {title}
                    {solvedSummary && (
                        <span className="ml-2 rounded bg-sky-50 px-2 py-0.5 text-[11px] font-kr font-semibold text-sky-700">
                            {solvedSummary.label}
                            <span className="ml-1">{solvedSummary.count}</span>
                        </span>
                    )}
                </span>
            </div>

            {/* 섹션 바디 */}
            {isOpen && (
                <div className="px-10 py-4 border-t border-gray-200 bg-white">
                    {description && (
                        <p className="mb-2 font-kr text-xs font-medium text-gray-500">
                            {description}
                        </p>
                    )}

                    <div className="border border-gray-200">
                        {displayProblem ? (
                            isAccessible ? (
                                // ✅ ids가 있고 접근 가능 시간일 때에만 시험 페이지로 라우팅
                                <Link
                                    href={examHref}
                                    prefetch={false}
                                    className="block hover:bg-gray-50"
                                >
                                    <ReadonlyExamProblemRow
                                        key={displayProblem.id}
                                        problem={displayProblem}
                                    />
                                </Link>
                            ) : (
                                <div className="block cursor-not-allowed opacity-60">
                                    <ReadonlyExamProblemRow
                                        key={displayProblem.id}
                                        problem={displayProblem}
                                    />
                                    {blockReason && (
                                        <div className="px-5 pb-3 text-xs font-kr text-red-500">
                                            {blockReason}
                                        </div>
                                    )}
                                </div>
                            )
                        ) : (
                            <div className="p-6 text-center text-sm text-gray-500">
                                등록된 시험 문제가 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
