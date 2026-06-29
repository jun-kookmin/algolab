"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import CodeModal from "@/components/submission/CodeModal";
import { useGetExamProblemSubmission } from "@/hooks/problems/get/exam/problem/useGetExamProblemSubmission";
import { useGetHomeworkProblemSubmission } from "@/hooks/problems/get/homework/problem/useGetHomeworkProblemSubmission";
import { mapLanguages, type Language } from "@/types/languages";
import { Submission } from "@/types/submission";

type Tab = "exam" | "homework";

const toJudgeText = (status?: string) => {
  const s = (status ?? "").toUpperCase();
  if (s === "CORRECT" || s === "AC" || s === "SV") return "정답";
  if (s === "WA" || s === "WRONG") return "오답";
  if (s === "TO") return "시간 초과";
  if (s === "MO") return "메모리 초과";
  if (s === "CE") return "컴파일 오류";
  if (s === "RE") return "런타임 오류";
  if (s === "SE" || s === "SERVER_ERROR") return "에러";
  if (s === "NOT_SUBMITTED" || s === "NS" || s === "") return "미제출";
  return "오답";
};

export default function SubmissionProblemModalContent({
  lectureId,
  userId,
  problemId,
  problemLabel,
  tab,
  userName,
  studentId,
}: {
  lectureId: string;
  userId: number;
  problemId: string;
  problemLabel: number;
  tab: Tab;
  userName: string;
  studentId: string;
}) {
  const isExam = tab === "exam";
  const isHomework = tab === "homework";

  const {
    data: exam,
    isLoading: exLoading,
    isError: exError,
  } = useGetExamProblemSubmission(lectureId, userId, problemId, {
    enabled: isExam,
  });

  const {
    data: hw,
    isLoading: hwLoading,
    isError: hwError,
  } = useGetHomeworkProblemSubmission(lectureId, userId, problemId, {
    enabled: isHomework,
  });

  const raw = isExam ? exam : hw;
  const isLoading = isExam ? exLoading : hwLoading;
  const isError = isExam ? exError : hwError;

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
  }, [raw?.length]);
  const current = raw && raw[idx];
  const maxIdx = raw && Math.max(raw.length - 1, 0);
  const hasNoSubmission = !isLoading && (!raw || raw.length === 0);

  const goOlder = () => setIdx((i) => Math.min(i + 1, maxIdx ?? 0));
  const goNewer = () => setIdx((i) => Math.max(i - 1, 0));

  const leftDisabled = (raw && raw.length === 0) || idx >= (maxIdx ?? 0);
  const rightDisabled = (raw && raw.length === 0) || idx === 0;

  const langList = useMemo<Language[]>(() => {
    return mapLanguages(current?.languages as number[] | undefined);
  }, [current?.languages]);
  const langText = langList.length ? langList.join(", ") : "-";

  const statusClass = useMemo(() => {
    const base =
      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1";
    const status = toJudgeText(current?.status);
    if (status === "정답") return `${base} bg-emerald-100 text-emerald-700 ring-emerald-200`;
    if (
      status === "오답" ||
      status === "컴파일 오류" ||
      status === "런타임 오류" ||
      status === "시간 초과" ||
      status === "메모리 초과"
    ) {
      return `${base} bg-rose-100 text-rose-700 ring-rose-200`;
    }
    if (status === "에러") {
      return `${base} bg-slate-100 text-slate-700 ring-slate-200`;
    }
    return `${base} bg-gray-100 text-gray-600 ring-gray-200`;
  }, [current?.status]);

  const totalAttempts = raw?.length ?? 0;
  const getAttemptNumber = (i: number) =>
    totalAttempts > 0 ? totalAttempts - i : i + 1;

  const optionLabel = (r: { submissionTime: string; status?: string }, i: number) => {
    const t = r?.submissionTime
      ? new Date(r.submissionTime).toLocaleString("ko-KR")
      : "-";
    return `${getAttemptNumber(i)}번째  •  ${toJudgeText(r?.status)}  •  ${t}`;
  };

  const mappedSubmission = useMemo<Submission | null>(() => {
    if (!current) return null;
    return {
      id: current.id,
      problem: `문제 ${problemLabel}`,
      judge: toJudgeText(current.status),
      score: current.score,
      code: current.code ?? "",
      language: (current.languages ?? []).filter((l) => l != null),
      execTime: current.executionTime,
      memory: current.memory,
      codeSize: current.code != null ? current.code.length : 0,
      submittedAt: current.submissionTime
        ? new Date(current.submissionTime).toLocaleString("ko-KR")
        : "-",
    };
  }, [current, problemLabel]);

  return (
    <div className="space-y-6 min-h-0 font-kr">
      <div className="flex flex-col gap-3 items-start px-1 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={goOlder}
            disabled={leftDisabled}
            className={`h-9 w-9 grid place-items-center rounded-lg ring-1 ring-gray-400 text-gray-400 transition ${
              leftDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-white"
            }`}
            aria-label="이전 제출"
            title="이전 제출(오래된)"
            type="button"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <h1 className="flex items-center gap-3 font-kr text-xl md:text-2xl font-extrabold tracking-tight">
            {isExam ? "시험" : "과제"} 문제 #{problemLabel}
            <span className={statusClass}>{toJudgeText(current?.status)}</span>
          </h1>

          <button
            onClick={goNewer}
            disabled={rightDisabled}
            className={`h-9 w-9 grid place-items-center rounded-lg ring-1 ring-gray-400 text-gray-400 transition ${
              rightDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-white"
            }`}
            aria-label="다음 제출"
            title="다음 제출(새로운)"
            type="button"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">제출 선택</label>
          <select
            className="h-9 rounded-lg ring-1 ring-gray-300 px-2 text-sm bg-white"
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            disabled={raw?.length === 0}
          >
            {raw?.map((r: { id: string; submissionTime: string; status?: string }, i: number) => (
              <option key={r.id ?? i} value={i}>
                {optionLabel(r, i)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <span className="animate-spin h-6 w-6 border-2 border-gray-300 border-t-transparent rounded-full mb-3" />
          불러오는 중…
        </div>
      )}

      {hasNoSubmission && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <span className="text-5xl mb-3">📭</span>
          <p className="font-medium">제출이 없습니다.</p>
          <p className="text-sm mt-1">아직 이 문제를 제출하지 않았습니다.</p>
        </div>
      )}

      {!isLoading && isError && !hasNoSubmission && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <span className="text-5xl mb-3">⚠️</span>
          <p className="font-medium">제출 정보를 불러오지 못했습니다.</p>
          <p className="text-sm mt-1">잠시 후 다시 시도해주세요.</p>
        </div>
      )}

      {mappedSubmission && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label="점수" value={String(mappedSubmission.score ?? 0)} />
            <Stat label="실행 시간" value={`${mappedSubmission.execTime ?? 0}ms`} />
            <Stat label="메모리" value={`${mappedSubmission.memory ?? 0} MB`} />
            <Stat label="제출 횟수" value={String(getAttemptNumber(idx))} />
            <Stat label="언어" value={langText} />
          </div>

          <div className="rounded-xl ring-1 ring-gray-200 p-5">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Meta label="이름" value={userName} />
              <Meta label="학번" value={studentId} />
              <Meta label="문제 번호" value={String(problemLabel)} />
              <Meta
                label="제출 시간"
                value={
                  mappedSubmission.submittedAt
                    ? mappedSubmission.submittedAt
                    : "-"
                }
              />
            </dl>
          </div>

          <CodeModal
            open={!!mappedSubmission}
            submission={mappedSubmission}
            onClose={() => {}}
            userId={userId}
            embedded
            showClose={false}
            showHeader={false}
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-4 py-3 bg-gray-50 ring-1 ring-gray-200">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-base font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-medium">{value}</dd>
    </div>
  );
}
