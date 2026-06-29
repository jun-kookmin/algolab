// ──── FILE: src/components/class/StudentSection.tsx ────
"use client";

import React from "react";
import Image from "next/image";
import type { HomeworkProblem } from "@/types/class";
import { useGetHomework } from "@/hooks/lectures/Get/useGetHomework";
import { useMe } from "@/hooks/auth/get/useMe";
import { useRouter } from "next/navigation";

/* 아이콘 */
const UpIcon = "/assets/icon/Icon_Up.svg";
const DownIcon = "/assets/icon/Icon_Down.svg";
const BoardIcon = "/assets/icon/Icon_Board.svg"; // 질문하기 아이콘
const SolveStatusIcon = "/assets/icon/Icon_Code.svg"; // 제출 이력(풀이현황) 아이콘

/* new Date() 없이 문자열만으로 포맷 */
function formatDateText(dt: string) {
    // 기대형식: YYYY-MM-DDTHH:MM(:SS 생략 가능)
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
        <Image
            src={src}
            alt={alt}
            width={size}
            height={size}
            unoptimized
            className={className}
        />
    );
}

const parseMs = (value?: string | null): number | null => {
    if (!value) return null;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
};

export interface StudentSectionProps {
    id: string;
    classId: string;
    homeworkId: string;
    displayNo: number;
    title: string;
    description?: string;
    isOpen: boolean;
    onToggle: () => void;
    canViewSolveStatus?: boolean;
    solveBlocked?: boolean;
    readOnlyMode?: boolean;
    blockReason?: string;
    serverNowMs?: number | null;
}

/**
 * 문제 클릭 시 이동:
 * /class/[classid]/[sectionid]/solve/homework/[section_problem_id]/
 */
function ReadonlyProblemRow({
    problem,
    classId,
    homeworkId,
    canViewSolveStatus,
    solveBlocked,
    readOnlyMode,
    blockReason,
    serverNowMs,
}: {
    problem: HomeworkProblem;
    classId: string;
    homeworkId: string;
    canViewSolveStatus?: boolean;
    solveBlocked?: boolean;
    readOnlyMode?: boolean;
    blockReason?: string;
    serverNowMs?: number | null;
}) {
    const router = useRouter();
    const { data: me } = useMe();
    const group = (me?.group ?? "").toLowerCase();
    const isPrivileged =
        group === "administrator" || group === "professor";
    const resolveBlockReason = () => {
        if (isPrivileged) {
            return "";
        }
        if (solveBlocked) {
            return blockReason ?? "지난 강의는 풀이할 수 없습니다.";
        }
        const startMs = parseMs(problem.startAt);
        if (startMs !== null && serverNowMs != null && serverNowMs < startMs) {
            return "접근 가능 시간이 아닙니다.";
        }
        return "";
    };
    const effectiveBlockReason = resolveBlockReason();
    const isProblemBlocked = effectiveBlockReason.length > 0;
    const solveState = problem.solveState ?? "none";
    const rowColorClass =
        solveState === "solved"
            ? "bg-[#a6dbff]"
            : solveState === "wrong"
              ? "bg-[#ffb0bc]"
              : "bg-white";
    const rowHoverClass = isProblemBlocked
        ? "cursor-not-allowed"
        : solveState === "none"
          ? "cursor-pointer hover:bg-gray-50"
          : "cursor-pointer hover:brightness-95";
    const textColorClass = isProblemBlocked
        ? "text-gray-400"
        : readOnlyMode
          ? "text-gray-700"
          : "text-gray-800";

    function handleRowClick(hwProblemID: string) {
        const nextBlockReason = resolveBlockReason();
        if (nextBlockReason) {
            window.alert(nextBlockReason);
            return;
        }
        router.push(`/class/${classId}/${homeworkId}/solve/homework/${hwProblemID}`);
    }

    const hanedleGoToCommunity = () => {
        router.push(`/community/${problem.problem_id}`);
    };

    const handleGoToSolveStatus = () => {
        router.push(`/class/${classId}/${homeworkId}/status/homework/${problem.id}`);
    };

    return (
        <div
            className={`flex items-center gap-3 border-b border-b-gray-200 px-5 py-2 last:border-b-0 transition-colors ${rowColorClass} ${rowHoverClass}`}
            onClick={() => handleRowClick(problem.id)}
        >
            <div className="flex flex-1 flex-col text-[12px]">
                <span
                    className={`flex items-center font-kr font-medium ${textColorClass}`}
                >
                    {problem.title}
                </span>
                <span className="font-kr text-gray-500">
                    {formatDateText(problem.startAt)} ~ {formatDateText(problem.endAt)}
                </span>
            </div>

            <div className="flex items-center gap-1">
                <div className="mr-2 min-w-[92px] text-right font-kr text-[11px] leading-[1.25] text-gray-500">
                    <div>
                        첫 정답{" "}
                        {typeof problem.allFirstCorrectAttemptCount === "number" &&
                        problem.allFirstCorrectAttemptCount > 0
                            ? `${problem.allFirstCorrectAttemptCount}회`
                            : "-"}
                    </div>
                    <div>총 제출 {problem.allAttemptCount ?? 0}회</div>
                </div>
                {canViewSolveStatus && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleGoToSolveStatus();
                        }}
                        className="group flex items-center justify-center rounded-full p-1.5 transition
                           hover:bg-gray-100 active:scale-95"
                    >
                        <IconImg
                            src={SolveStatusIcon}
                            alt="풀이현황"
                            size={20}
                            className="opacity-60 transition group-hover:opacity-100 group-hover:scale-110"
                        />
                    </button>
                )}

                {/* 오른쪽 끝 아이콘 버튼 (질문하기) */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        hanedleGoToCommunity();
                    }}
                    className="group flex items-center justify-center rounded-full p-1.5 transition
                           hover:bg-gray-100 active:scale-95"
                >
                    <IconImg
                        src={BoardIcon}
                        alt="질문하기"
                        size={20}
                        className="opacity-60 transition group-hover:opacity-100 group-hover:scale-110"
                    />
                </button>
            </div>
        </div>
    );
}

export default function StudentSection({
    displayNo,
    classId,
    homeworkId,
    title,
    description,
    isOpen,
    onToggle,
    canViewSolveStatus = false,
    solveBlocked = false,
    readOnlyMode = false,
    blockReason,
    serverNowMs,
}: StudentSectionProps) {
    const { data: rawQuestions } = useGetHomework(classId, homeworkId);
    const problems = rawQuestions?.problems;
    // console.log("student problems : ", problems);

    return (
        <div className="mb-2 overflow-hidden border-b border-t border-b-gray-300 border-t-gray-300 bg-white shadow-[0_2px_4px_rgba(15,23,42,0.08)]">
            {/* 섹션 헤더 */}
            <div
                className={`flex cursor-pointer items-center px-5 py-3 ${
                    isOpen
                        ? "bg-indigo-50 border-indigo-400"
                        : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
                onClick={onToggle}
            >
                <IconImg src={isOpen ? DownIcon : UpIcon} alt="토글" size={16} />
                <span className="ml-4 w-12 text-center font-kr text-sm">
                    {String(displayNo).padStart(2, "0")}
                </span>
                <span className="font-kr flex flex-1 items-center text-sm">{title}</span>
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
                        {problems && problems.length > 0 ? (
                            problems.map((p) => (
                                <ReadonlyProblemRow
                                    key={p.id}
                                    problem={p}
                                    classId={classId}
                                    homeworkId={homeworkId}
                                    canViewSolveStatus={canViewSolveStatus}
                                solveBlocked={solveBlocked}
                                readOnlyMode={readOnlyMode}
                                blockReason={blockReason}
                                serverNowMs={serverNowMs}
                            />
                        ))
                        ) : (
                            <div className="p-6 text-center text-sm text-gray-500">
                                등록된 문제가 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
