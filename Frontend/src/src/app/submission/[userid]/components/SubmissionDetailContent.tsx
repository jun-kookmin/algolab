"use client";

import React, { useMemo, useState } from "react";
import { formatDisplayName } from "@/utils/name";
import SubmissionRenderer from "@/components/submission/SubmissionRenderer";
import CodeModal from "@/components/submission/CodeModal";
import type { Submission } from "@/types/submission";
import {
  LectureProgressDetail as ExamLectureProgressDetail,
  useGetExamUserSubmissions,
} from "@/hooks/problems/get/exam/user/useGetExamUserSubmissions";
import {
  LectureProgressDetail as HomeworkLectureProgressDetail,
  useGetHomeworkUserSubmissions,
} from "@/hooks/problems/get/homework/user/useGetHomeworkUserSubmissions";
import DonutChart from "@/components/submission/components/DonutChat";
import { useAuth } from "@/hooks/auth/AuthGuardProvider";

const toJudgeText = (status?: string) => {
  const s = (status ?? "").toUpperCase();
  if (s === "CORRECT" || s === "AC" || s === "SV") return "정답";
  if (s === "WA" || s === "WRONG") return "오답";
  if (s === "TO") return "시간 초과";
  if (s === "MO") return "메모리 초과";
  if (s === "CE") return "컴파일 오류";
  if (s === "RE") return "런타임 오류";
  if (s === "SE" || s === "SERVER_ERROR") return "에러";
  if (s === "NOT_SUBMITTED" || s === "NS" || s === "") return "오답";
  return "오답";
};
type SubmitCategory = "HOMEWORK" | "EXAM";
interface Props {
  userId: number;
  lectureId: string;
  examId?: string;
  tab: SubmitCategory;
  name: string;
  initialHomeworkData?: HomeworkLectureProgressDetail;
  initialExamData?: ExamLectureProgressDetail;
}

function computeStats(submissions: Submission[]) {
  const stats = {
    correct: 0,
    wrong: 0,
    timeout: 0,
    memoryOver: 0,
    compileError: 0,
    runtimeError: 0,
    serverError: 0,
  };

  submissions.forEach((s) => {
    switch (s.judge) {
      case "정답":
        stats.correct++;
        break;
      case "오답":
        stats.wrong++;
        break;
      case "시간 초과":
        stats.timeout++;
        break;
      case "메모리 초과":
        stats.memoryOver++;
        break;
      case "컴파일 오류":
        stats.compileError++;
        break;
      case "런타임 오류":
        stats.runtimeError++;
        break;
      case "에러":
        stats.serverError++;
        break;
    }
  });

  return stats;
}

export default function SubmissionDetailContent({
  userId,
  lectureId,
  examId,
  tab,
  name,
  initialHomeworkData,
  initialExamData,
}: Props) {
  const isExam = tab === "EXAM";
  // console.log(lectureId, "강의코드");

  const {
    data: examSubmissions,
    isLoading: isExamLoading,
    isError: isExamError,
  } = useGetExamUserSubmissions(lectureId, userId, isExam, examId, {
    initialData: isExam ? initialExamData : undefined,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: homeworkSubmissions,
    isLoading: isHomeworkLoading,
    isError: isHomeworkError,
  } = useGetHomeworkUserSubmissions(
    lectureId,
    userId,
    tab === "HOMEWORK",
    {
      initialData: !isExam ? initialHomeworkData : undefined,
      staleTime: 300_000,
      refetchOnWindowFocus: false,
    }
  );

  const activeData = isExam ? examSubmissions : homeworkSubmissions;
  const isLoading = isExam ? isExamLoading : isHomeworkLoading;
  const isError = isExam ? isExamError : isHomeworkError;

  const submissions: Submission[] = useMemo(() => {
    if (!activeData) return [];
    const sorted = [...(activeData.problems ?? [])].sort((a, b) => {
      const at = a.submission_time ? new Date(a.submission_time).getTime() : 0;
      const bt = b.submission_time ? new Date(b.submission_time).getTime() : 0;
      return bt - at;
    });
    return sorted.map((p) => ({
      id: p.id,
      problem: p.title || `문제 #${p.problem_id}`,
      code: p.code,
      judge: toJudgeText(p.status),
      score: p.score,
      language: p.language,
      execTime: p.execution_time,
      memory: p.memory,
      codeSize: p.code_length,
      submittedAt: p.submission_time
        ? new Date(p.submission_time).toLocaleString("ko-KR")
        : "-",
    }));
  }, [activeData]);

  const [selected, setSelected] = useState<Submission | null>(null);
  const { me } = useAuth();
  const viewerGroup = me?.group?.toLowerCase() ?? "";
  const canViewCode =
    viewerGroup === "administrator" ||
    viewerGroup === "professor" ||
    (me?.pk != null && Number(me.pk) === Number(userId));

  const stats = computeStats(submissions);
  const resolvedName = formatDisplayName(activeData?.name || name || "");
  const resolvedStudentNumber = activeData?.student_number ?? "";
  const showName =
    resolvedName.length > 0 && resolvedName !== resolvedStudentNumber;
  // console.log(activeData, "activeDatea");


  return (
    <div className="w-full min-h-0 py-6 sm:py-8">
      <h1 className="font-kr text-4xl font-bold text-gray-800 mb-3">
        {isExam ? "시험" : "과제"} 제출 정보
      </h1>
      {/* 통계 도넛 그래프 */}
      <div className="mb-10 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-10">
        <DonutChart stats={stats} />

        <div className="font-kr text-lg leading-8 text-left">
          <div>정답: {stats.correct}</div>
          <div>오답: {stats.wrong}</div>
          <div>시간초과: {stats.timeout}</div>
          <div>메모리 초과: {stats.memoryOver}</div>
          <div>컴파일 오류: {stats.compileError}</div>
          <div>런타임 오류: {stats.runtimeError}</div>
          <div>에러: {stats.serverError}</div>
        </div>
      </div>

      <div className="mb-6">
        {isLoading && (
          <p className="font-kr text-lg text-gray-500">
            학습 현황을 불러오는 중…
          </p>
        )}
        {isError && (
          <p className="font-kr text-lg text-red-500">
            학습 현황을 불러오지 못했습니다.
          </p>
        )}
      {activeData && (
          <div className="flex flex-wrap items-center gap-3 text-gray-700">
            <span className="font-kr text-lg">
              {showName && (
                <>
                  <span className="font-semibold text-gray-900">
                    {resolvedName}
                  </span>
                  {resolvedStudentNumber && (
                    <span className="mx-2 text-gray-400">·</span>
                  )}
                </>
              )}
              <span className="text-gray-600">{resolvedStudentNumber || resolvedName}</span>
            </span>
          </div>
        )}
      </div>

      <SubmissionRenderer
        submissions={submissions}
        onRowClick={canViewCode ? setSelected : undefined}
      />

      {canViewCode && (
        <CodeModal
          open={!!selected}
          submission={selected}
          onClose={() => setSelected(null)}
          userId={userId}
        />
      )}
    </div>
  );
}
