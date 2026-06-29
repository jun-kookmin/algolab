"use client";

import React, { useMemo, useState } from "react";
import SubmissionRenderer from "@/components/submission/SubmissionRenderer";
import CodeModal from "@/components/submission/CodeModal";
import type { Submission } from "@/types/submission";
import { useGetInstructorUserSubmissions } from "@/hooks/problems/get/all/useGetInstructorUserSubmissions";
import { useMe } from "@/hooks/auth/get/useMe";
import DonutChart from "@/components/submission/components/DonutChat";
import Pagination from "@/components/dashboard/instructor/Pagination";
import { formatDisplayName, formatNameFromParts } from "@/utils/name";

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

interface Props {
  userId: number;
  userName?: string;
  initialData?: any[];
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

export default function MySubmissionDetailContent({
  userId,
  userName,
  initialData,
}: Props) {
  const { data: meData, isLoading: isMeLoading } = useMe({
    enabled: true,
  });
  const viewerId = typeof meData?.pk === "number" ? meData.pk : null;
  const viewerGroup = (meData?.group ?? "").toLowerCase();
  const resolvedUserId = userId || Number(viewerId ?? 0);
  const isSelfTarget = viewerId != null && viewerId === resolvedUserId;
  const canViewSubmissions =
    resolvedUserId > 0 && viewerId != null;
  const canViewCode =
    viewerGroup === "administrator" ||
    viewerGroup === "professor" ||
    viewerId === resolvedUserId;
  const {
    data: submissionsData,
    isLoading,
    isError,
  } = useGetInstructorUserSubmissions(resolvedUserId, canViewSubmissions, {
    includeCode: false,
    initialData,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  const submissions: Submission[] = useMemo(() => {
    if (!submissionsData) return [];
    const sorted = [...submissionsData].sort((a, b) => {
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
      language: (p.language ?? []).filter((l): l is number => l !== null),
      execTime: p.execution_time,
      memory: p.memory,
      codeSize: p.code_length,
      submittedAt: p.submission_time
        ? new Date(p.submission_time).toLocaleString("ko-KR")
        : "-",
    }));
  }, [submissionsData]);

  const metadataRow = submissionsData?.[0];
  const resolvedStudentNumber =
    metadataRow?.student_number ||
    metadataRow?.username ||
    (isSelfTarget ? formatDisplayName(meData?.username) : "") ||
    userName ||
    "";
  const resolvedDisplayName =
    metadataRow?.display_name ||
    (isSelfTarget
      ? formatNameFromParts(meData?.first_name, meData?.last_name) ||
        formatDisplayName(meData?.username)
      : "") ||
    "";
  const showName =
    resolvedDisplayName.length > 0 &&
    resolvedDisplayName !== resolvedStudentNumber;
  const fallbackLabel =
    resolvedStudentNumber ||
    resolvedDisplayName ||
    (resolvedUserId ? `사용자 ${resolvedUserId}` : "");

  const [selected, setSelected] = useState<Submission | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 30;

  const totalPages = Math.max(1, Math.ceil(submissions.length / pageSize));

  // 현재 페이지 데이터 30개씩 slice
  const pagedSubmissions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return submissions.slice(start, start + pageSize);
  }, [submissions, page]);

  const stats = computeStats(submissions);

  if (!resolvedUserId) {
    return (
      <div className="w-full min-h-0 py-6 pb-16 sm:py-8 sm:pb-20">
        <p className="font-kr text-lg text-gray-500">
          {isMeLoading ? "제출 정보를 불러오는 중…" : "제출 정보를 불러오지 못했습니다."}
        </p>
      </div>
    );
  }

  if (isMeLoading && !initialData) {
    return (
      <div className="w-full min-h-0 py-6 pb-16 sm:py-8 sm:pb-20">
        <p className="font-kr text-lg text-gray-500">
          제출 정보를 불러오는 중…
        </p>
      </div>
    );
  }

  if (!isMeLoading && !canViewSubmissions) {
    return (
      <div className="w-full min-h-0 py-6 pb-16 sm:py-8 sm:pb-20">
        <h1 className="mb-3 font-kr text-4xl font-bold text-gray-800">
          제출 정보
        </h1>
        <p className="font-kr text-lg text-red-500">
          제출 정보를 확인할 수 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-0 py-6 pb-16 sm:py-8 sm:pb-20">
      <h1 className="mb-3 font-kr text-4xl font-bold text-gray-800">
        제출 정보
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
        {(showName || fallbackLabel) && (
          <div className="mb-3 flex flex-wrap items-center gap-3 text-gray-700">
            <span className="font-kr text-lg">
              {showName && (
                <>
                  <span className="font-semibold text-gray-900">
                    {resolvedDisplayName}
                  </span>
                  {resolvedStudentNumber && (
                    <span className="mx-2 text-gray-400">·</span>
                  )}
                </>
              )}
              <span className="text-gray-600">
                {resolvedStudentNumber || fallbackLabel}
              </span>
            </span>
          </div>
        )}
        {isLoading && (
          <p className="font-kr text-lg text-gray-500">
            제출 기록을 불러오는 중…
          </p>
        )}
        {isError && (
          <p className="font-kr text-lg text-red-500">
            제출 기록을 불러오지 못했습니다.
          </p>
        )}
        {!isLoading && !isError && !canViewCode && (
          <p className="font-kr text-sm text-gray-500">
            코드 열람은 본인, 관리자, 교수자만 가능합니다.
          </p>
        )}
      </div>

      <SubmissionRenderer
        submissions={pagedSubmissions}
        onRowClick={canViewCode ? setSelected : undefined}
      />

      <div className="mt-8">
        <Pagination page={page} total={totalPages} onChange={setPage} />
      </div>

      {canViewCode && (
        <CodeModal
          open={!!selected}
          submission={selected}
          onClose={() => setSelected(null)}
          userId={resolvedUserId}
        />
      )}
    </div>
  );
}
