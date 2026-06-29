// /components/dashboard/instructor/TestManageTab.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import InProgressListRenderer from "@/components/testManage/InProgressListRenderer";
import CompletedListRenderer from "@/components/testManage/CompletedListRenderer";
import StudentListRenderer from "@/components/testManage/StudentListRenderer";
import { useGetLectures } from "@/hooks/lectures/Get/useGetLectures";
import { useGetExams } from "@/hooks/lectures/Get/useGetExams";
import { useGetExamSubmissions } from "@/hooks/problems/get/exam/useGetExamSubmissions";
import { buildProctorGroups } from "@/components/testManage/proctorUtils";
import { useAuth } from "@/hooks/auth/AuthGuardProvider";
import { usePostExamUnlock } from "@/hooks/solve/exam/POST/usePostExamUnlock";
import { useQueryClient } from "@tanstack/react-query";

/* -------------------- 컴포넌트 -------------------- */
export default function TestManageTab() {
    const { me } = useAuth();
    const group = me?.group?.toLowerCase() ?? "";
    const canUnlock = group === "administrator" || group === "professor";
    const queryClient = useQueryClient();
    const [showAbsent, setShowAbsent] = useState(false);
    const [selectedLectureId, setSelectedLectureId] = useState<string>("");
    const [selectedExamId, setSelectedExamId] = useState<string>("");
    const [nowMs, setNowMs] = useState(() => Date.now());

    useEffect(() => {
      const timer = setInterval(() => setNowMs(Date.now()), 10000);
      return () => clearInterval(timer);
    }, []);

    const { data: lecturesData } = useGetLectures({ all: true, page: 1, size: 200 });
    const lectures = useMemo(() => lecturesData?.data ?? [], [lecturesData]);

    useEffect(() => {
        if (!selectedLectureId && lectures.length > 0) {
            setSelectedLectureId(lectures[0].id);
        }
    }, [lectures, selectedLectureId]);

    const { data: exams = [] } = useGetExams(selectedLectureId);

    useEffect(() => {
        if (!selectedExamId && exams.length > 0) {
            setSelectedExamId(exams[0].id);
        }
    }, [exams, selectedExamId]);

    const selectedExam = useMemo(
        () => exams.find((exam) => exam.id === selectedExamId),
        [exams, selectedExamId]
    );

    const canLoadSubmissions = !!selectedLectureId && !!selectedExamId;
    const { data: examSubmissions } = useGetExamSubmissions(
        selectedLectureId,
        selectedExamId,
        canLoadSubmissions,
        {
          lite: true,
          refetchIntervalMs: canLoadSubmissions ? 5_000 : false,
        }
    );
    const {
        mutate: unlockExam,
        mutateAsync: unlockExamAsync,
        isPending: isUnlocking,
    } = usePostExamUnlock();
    const [isBulkUnlocking, setIsBulkUnlocking] = useState(false);

    const examProblemIds = useMemo(
        () => (examSubmissions?.problem_ids ?? []).map((p) => String(p ?? "")),
        [examSubmissions?.problem_ids]
    );

    const { notStarted, inProgress, completed } = useMemo(() => {
        const dueDateMs = Date.parse(selectedExam?.due_date ?? "");
        const isExamFinished =
          Number.isFinite(dueDateMs) && nowMs >= dueDateMs;
        return buildProctorGroups(examSubmissions?.data ?? [], examProblemIds, {
          examFinished: isExamFinished,
        });
    }, [
      examSubmissions?.data,
      examProblemIds,
      nowMs,
      selectedExam?.due_date,
    ]);
    const unlockableCompletedUsers = useMemo(
        () =>
            completed
                .filter((item) => !!item.finishedByUser)
                .map((item) => item.userId)
                .filter(
                    (userId): userId is string =>
                        typeof userId === "string" && userId.trim().length > 0
                ),
        [completed]
    );

    const total = notStarted.length + inProgress.length + completed.length;

    const handleUnlock = (userId?: string) => {
        if (!canUnlock || !selectedExamId || !userId) return;
        if (!window.confirm("해당 학생의 시험 종료 상태를 해제하시겠습니까?")) return;
        unlockExam(
            { examId: selectedExamId, userId },
            {
                onSuccess: () => {
                    queryClient.invalidateQueries({
                        queryKey: ["examSubmissions", selectedLectureId, selectedExamId],
                    });
                },
                onError: (err) => {
                    window.alert((err as Error).message || "시험 해제에 실패했습니다.");
                },
            }
        );
    };

    const handleBulkUnlock = async () => {
        if (!canUnlock || !selectedExamId) return;
        if (unlockableCompletedUsers.length === 0) {
            window.alert("해제 가능한 학생이 없습니다.");
            return;
        }
        if (
            !window.confirm(
                `시험 종료 상태를 전체 해제하시겠습니까? (총 ${unlockableCompletedUsers.length}명)`
            )
        )
            return;

        setIsBulkUnlocking(true);
        let successCount = 0;
        let failCount = 0;

        for (const userId of unlockableCompletedUsers) {
            try {
                await unlockExamAsync({ examId: selectedExamId, userId });
                successCount += 1;
            } catch {
                failCount += 1;
            }
        }

        queryClient.invalidateQueries({
            queryKey: ["examSubmissions", selectedLectureId, selectedExamId],
        });

        if (failCount === 0) {
            window.alert(`${successCount}명의 시험 종료 상태가 해제되었습니다.`);
        } else if (successCount === 0) {
            window.alert("일괄 해제에 실패했습니다.");
        } else {
            window.alert(`${successCount}명 성공, ${failCount}명 실패`);
        }
        setIsBulkUnlocking(false);
    };

    return (
        <div className="w-full h-full flex flex-col gap-4">
            {/* 상단 바 */}
            <div className="flex ml-auto items-center px-12 gap-6">
                <div className="flex items-center gap-4 text-sm font-medium">
                    <button
                        onClick={() => setShowAbsent((p) => !p)}
                        className="bg-[rgba(78,97,246,1)] text-white px-[12px] py-[8px] rounded-[12px] hover:bg-[#3745AF]"
                    >
                        미응시&nbsp;{notStarted.length}
                    </button>
                    <span>|</span>
                    <span>응시 대상자 수&nbsp;{total}</span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">강의:</span>
                    <select
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                        value={selectedLectureId}
                        onChange={(e) => {
                            setSelectedLectureId(e.target.value);
                            setSelectedExamId("");
                            setShowAbsent(false);
                        }}
                    >
                        {lectures.map((lec) => (
                            <option key={lec.id} value={lec.id}>
                                {lec.name}
                            </option>
                        ))}
                    </select>

                    <span className="text-sm font-medium">시험:</span>
                    <select
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                        value={selectedExamId}
                        onChange={(e) => {
                            setSelectedExamId(e.target.value);
                            setShowAbsent(false);
                        }}
                    >
                        {exams.map((exam) => (
                            <option key={exam.id} value={exam.id}>
                                {exam.exam_name ?? exam.title ?? "시험"}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 본문: (미응시 1/6) (진행중 2/6) (완료 3/6) */}
            <div className="flex px-12">
                {/* ── 미응시 패널 (1/6) ── */}
                {showAbsent && (
                    <div className="flex-[1] bg-white border-r border-r-gray-200">
                        <h2 className="font-kr text-lg font-bold px-8 pt-6 mb-2">
                            미응시&nbsp;({notStarted.length})
                        </h2>
                        <div className="px-8 pb-6">
                            <StudentListRenderer
                                items={notStarted}
                                lectureId={selectedLectureId}
                                examId={selectedExamId}
                            />
                        </div>
                    </div>
                )}

                {/* ── 진행 중 패널 (2/6) ── */}
                <div className={`bg-white border-r border-r-gray-200 ${showAbsent ? "flex-[2]" : "flex-[2]"}`}>
                    <h2 className="font-kr text-lg font-bold px-8 pt-6 mb-2">
                        진행 중&nbsp;({inProgress.length})
                    </h2>
                    <InProgressListRenderer
                        items={inProgress}
                        lectureId={selectedLectureId}
                        examId={selectedExamId}
                    />
                </div>

                {/* ── 완료 패널 (3/6) ── */}
                <div className={`bg-white ${showAbsent ? "flex-[3]" : "flex-[3]"}`}>
                    <div className="px-8 pt-6 mb-2 flex items-center justify-between">
                        <h2 className="font-kr text-lg font-bold">
                        완료&nbsp;({completed.length})
                        </h2>
                        {canUnlock && unlockableCompletedUsers.length > 0 ? (
                            <button
                                type="button"
                                onClick={handleBulkUnlock}
                                disabled={isUnlocking || isBulkUnlocking}
                                className="rounded mt-0.5 bg-indigo-500 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
                            >
                                {isBulkUnlocking ? "일괄 해제 중..." : "시험 종료 상태 전체 해제"}
                            </button>
                        ) : null}
                    </div>
                    <CompletedListRenderer
                        items={completed}
                        lectureId={selectedLectureId}
                        examId={selectedExamId}
                        canUnlock={canUnlock}
                        onUnlock={(item) => handleUnlock(item.userId)}
                    />
                </div>
            </div>
        </div>
    );
}
