"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import DonutChart from "@/components/submission/components/DonutChat";
import CodeModal from "@/components/submission/CodeModal";
import {
  postHomeworkSolvedCodeLike,
  postHomeworkSolvedCodeView,
  useGetHomeworkSolvedSubmissions,
  type HomeworkSolvedSubmissionResponse,
} from "@/hooks/problems/get/homework/problem/useGetHomeworkSolvedSubmissions";
import { useAuth } from "@/hooks/auth/AuthGuardProvider";
import { mapLanguages } from "@/types/languages";
import type { Judge, Submission } from "@/types/submission";

const ICON_THUMB_UP = "/assets/icon/Icon_ThumbUp.svg";

const languageLabel = (langs: number[]) => {
  const mapped = mapLanguages(langs ?? []);
  if (!mapped.length) return "-";
  return mapped
    .map((lang) => {
      if (lang === "cpp") return "C++";
      if (lang === "python") return "Python";
      if (lang === "java") return "Java";
      if (lang === "c") return "C";
      return lang;
    })
    .join(", ");
};

const defaultStats = {
  total: 0,
  correct: 0,
  wrong: 0,
  timeout: 0,
  memoryOver: 0,
  compileError: 0,
  runtimeError: 0,
  serverError: 0,
};

const toJudgeText = (status?: string): Judge => {
  const s = (status ?? "").toUpperCase();
  if (s === "CORRECT" || s === "AC" || s === "SV") return "정답";
  if (s === "WA" || s === "WRONG") return "오답";
  if (s === "TO" || s === "TIME_LIMIT_EXCEEDED") return "시간 초과";
  if (s === "MO" || s === "MEMORY_LIMIT_EXCEEDED") return "메모리 초과";
  if (s === "CE" || s === "COMPILE_ERROR") return "컴파일 오류";
  if (s === "RE" || s === "RUNTIME_ERROR") return "런타임 오류";
  if (s === "SE" || s === "SERVER_ERROR") return "에러";
  return "미제출";
};

type SortKey = "studentNumber" | "executionTime" | "memory" | "submissionTime" | "codeLength";
type SortOrder = "asc" | "desc";

function updateSubmissionMetrics(
  prev: HomeworkSolvedSubmissionResponse | undefined,
  submissionUuid: string,
  nextLikeCount: number,
  nextViewCount: number,
  likedByMe?: boolean
) {
  if (!prev) return prev;
  return {
    ...prev,
    results: prev.results.map((item) =>
      item.submissionUuid === submissionUuid
        ? {
            ...item,
            likeCount: nextLikeCount,
            viewCount: nextViewCount,
            likedByMe: likedByMe ?? item.likedByMe,
          }
        : item
    ),
  };
}

export default function HomeworkSolvedStatusPage() {
  const params = useParams<{
    classid: string;
    sectionid: string;
    section_problem_id: string;
  }>();
  const router = useRouter();
  const { me } = useAuth();

  const classId = String(params?.classid ?? "");
  const sectionProblemId = String(params?.section_problem_id ?? "");

  const { data, isLoading, isError } = useGetHomeworkSolvedSubmissions(
    classId,
    sectionProblemId
  );
  const queryClient = useQueryClient();
  const queryKey = ["homeworkSolvedSubmissions", classId, sectionProblemId];

  const viewMutation = useMutation({
    mutationFn: (submissionUuid: string) =>
      postHomeworkSolvedCodeView(classId, sectionProblemId, submissionUuid),
    onSuccess: (res) => {
      queryClient.setQueryData<HomeworkSolvedSubmissionResponse | undefined>(
        queryKey,
        (prev) =>
          updateSubmissionMetrics(
            prev,
            res.submissionUuid,
            res.likeCount,
            res.viewCount,
            res.likedByMe
          )
      );
    },
  });

  const likeMutation = useMutation({
    mutationFn: (submissionUuid: string) =>
      postHomeworkSolvedCodeLike(classId, sectionProblemId, submissionUuid),
    onSuccess: (res) => {
      queryClient.setQueryData<HomeworkSolvedSubmissionResponse | undefined>(
        queryKey,
        (prev) =>
          updateSubmissionMetrics(
            prev,
            res.submissionUuid,
            res.likeCount,
            res.viewCount,
            res.likedByMe
          )
      );
    },
  });

  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [selectedSubmissionUserId, setSelectedSubmissionUserId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("submissionTime");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const rows = useMemo(() => {
    const sorted = [...(data?.results ?? [])];
    sorted.sort((a, b) => {
      let av: number | string = "";
      let bv: number | string = "";

      if (sortKey === "studentNumber") {
        const an = Number(a.studentNumber ?? "");
        const bn = Number(b.studentNumber ?? "");
        if (Number.isFinite(an) && Number.isFinite(bn)) {
          av = an;
          bv = bn;
        } else {
          av = a.studentNumber ?? "";
          bv = b.studentNumber ?? "";
        }
      } else if (sortKey === "executionTime") {
        av = a.executionTime ?? Number.MAX_SAFE_INTEGER;
        bv = b.executionTime ?? Number.MAX_SAFE_INTEGER;
      } else if (sortKey === "memory") {
        av = a.memory ?? Number.MAX_SAFE_INTEGER;
        bv = b.memory ?? Number.MAX_SAFE_INTEGER;
      } else if (sortKey === "codeLength") {
        av = a.codeLength ?? Number.MAX_SAFE_INTEGER;
        bv = b.codeLength ?? Number.MAX_SAFE_INTEGER;
      } else if (sortKey === "submissionTime") {
        av = a.submissionTime ? new Date(a.submissionTime).getTime() : 0;
        bv = b.submissionTime ? new Date(b.submissionTime).getTime() : 0;
      }

      if (typeof av === "string" && typeof bv === "string") {
        return sortOrder === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      return sortOrder === "asc"
        ? Number(av) - Number(bv)
        : Number(bv) - Number(av);
    });
    return sorted;
  }, [data?.results, sortKey, sortOrder]);
  const stats = data?.summaryStats ?? defaultStats;
  const viewerGroup = (me?.group ?? "").toLowerCase();
  const isViewerPrivileged =
    viewerGroup === "administrator" ||
    viewerGroup === "professor" ||
    viewerGroup === "instructor";

  const handleCodeOpen = async (row: (typeof rows)[number]) => {
    let resolvedCode = row.code ?? "";
    if (row.canViewCode) {
      try {
        const res = await viewMutation.mutateAsync(row.submissionUuid);
        resolvedCode = res.code || row.code || "";
      } catch {
        resolvedCode = row.code || "";
      }
    }
    const rowUserId = row.userId ?? (me?.pk != null ? Number(me.pk) : null);
    setSelectedSubmissionUserId(row.canViewCode ? rowUserId : null);
    setSelectedSubmission({
      id: row.submissionUuid,
      problem: data?.problemTitle ?? "문제",
      judge: toJudgeText(row.status),
      score:
        typeof row.score === "number"
          ? row.score
          : ["CORRECT", "AC", "SV"].includes((row.status ?? "").toUpperCase())
            ? 100
            : 0,
      code: resolvedCode,
      language: row.language ?? [],
      execTime: row.executionTime ?? 0,
      memory: row.memory ?? 0,
      codeSize: row.codeLength ?? resolvedCode.length,
      submittedAt: row.submissionTime
        ? new Date(row.submissionTime).toLocaleString("ko-KR")
        : "-",
    });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortOrder(key === "submissionTime" ? "asc" : "asc");
  };

  const sortMark = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortOrder === "asc" ? " ▲" : " ▼";
  };

  return (
    <section className="fluid-container bg-white pt-8 pb-20">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-kr text-3xl font-bold text-gray-800">풀이 현황</h1>
          <p className="mt-1 font-kr text-sm text-gray-500">
            문제: {data?.problemTitle ?? "-"} / 정답 코드 {data?.count ?? 0}개
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/class/${classId}`)}
          className="font-kr rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200"
        >
          목록으로
        </button>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-8 rounded-md border border-gray-200 bg-gray-50 p-5">
        <DonutChart stats={stats} />
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 font-kr text-sm text-gray-700">
          <div>전체 제출: {stats.total}</div>
          <div>정답: {stats.correct}</div>
          <div>오답: {stats.wrong}</div>
          <div>시간 초과: {stats.timeout}</div>
          <div>메모리 초과: {stats.memoryOver}</div>
          <div>컴파일 오류: {stats.compileError}</div>
          <div>런타임 오류: {stats.runtimeError}</div>
          <div>에러: {stats.serverError}</div>
        </div>
      </div>

      <div className="overflow-auto rounded-md border border-gray-200">
        <table className="min-w-full text-sm font-kr">
          <thead className="bg-gray-50 text-gray-700">
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 text-left">
                <button type="button" className="hover:underline" onClick={() => toggleSort("studentNumber")}>
                  학번{sortMark("studentNumber")}
                </button>
              </th>
              <th className="px-4 py-3 text-center">
                <button type="button" className="hover:underline" onClick={() => toggleSort("executionTime")}>
                  걸린시간(ms){sortMark("executionTime")}
                </button>
              </th>
              <th className="px-4 py-3 text-center">
                <button type="button" className="hover:underline" onClick={() => toggleSort("memory")}>
                  메모리(KB){sortMark("memory")}
                </button>
              </th>
              <th className="px-4 py-3 text-center">언어</th>
              <th className="px-4 py-3 text-left">
                <button type="button" className="hover:underline" onClick={() => toggleSort("submissionTime")}>
                  제출시간{sortMark("submissionTime")}
                </button>
              </th>
              <th className="px-4 py-3 text-center">
                <button type="button" className="hover:underline" onClick={() => toggleSort("codeLength")}>
                  코드 길이{sortMark("codeLength")}
                </button>
              </th>
              <th className="px-4 py-3 text-center">코드</th>
              <th className="px-4 py-3 text-center">조회수</th>
              <th className="px-4 py-3 text-center">좋아요</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={9}>
                  풀이 현황을 불러오는 중…
                </td>
              </tr>
            )}

            {!isLoading && isError && (
              <tr>
                <td className="px-4 py-6 text-center text-red-500" colSpan={9}>
                  풀이 현황을 불러오지 못했습니다.
                </td>
              </tr>
            )}

            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={9}>
                  정답 제출이 아직 없습니다.
                </td>
              </tr>
            )}

            {!isLoading &&
              !isError &&
              rows.map((row) => {
                const submissionUserId =
                  row.userId ?? (me?.pk != null ? Number(me.pk) : null);
                const isOwnSubmission =
                  row.isOwner === true ||
                  (me?.pk != null && row.userId != null && row.userId === me.pk);
                const isCodeHiddenUntilDeadline =
                  !isViewerPrivileged && !isOwnSubmission && !row.canViewCode;
                const canOpenSubmissionDetail =
                  submissionUserId != null;
                return (
                  <tr key={row.submissionUuid} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-4 py-2">
                      {canOpenSubmissionDetail ? (
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/submission/${submissionUserId}?lid=${classId}&tab=HOMEWORK&name=${encodeURIComponent(
                                row.name || row.username || row.studentNumber || ""
                              )}`
                            )
                          }
                          className="text-left text-blue-700 hover:underline"
                        >
                          {row.studentNumber || "-"}
                        </button>
                      ) : (
                        <span className="text-gray-500">{row.studentNumber || "-"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">{row.executionTime ?? "-"}</td>
                    <td className="px-4 py-2 text-center">{row.memory ?? "-"}</td>
                    <td className="px-4 py-2 text-center">{languageLabel(row.language)}</td>
                    <td className="px-4 py-2">
                      {row.submissionTime
                        ? new Date(row.submissionTime).toLocaleString("ko-KR")
                        : "-"}
                    </td>
                    <td className="px-4 py-2 text-center">{row.codeLength}</td>
                    <td className="px-4 py-2 text-center">
                      {isCodeHiddenUntilDeadline ? (
                        <span className="text-xs text-gray-500">마감 후 공개</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCodeOpen(row)}
                          className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
                        >
                          보기
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">{row.viewCount}</td>
                    <td className="px-4 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (isOwnSubmission) return;
                          likeMutation.mutate(row.submissionUuid);
                        }}
                        disabled={isOwnSubmission}
                        title={
                          isOwnSubmission
                            ? "자기 자신의 코드에는 좋아요를 할 수 없습니다."
                            : "좋아요"
                        }
                        aria-disabled={isOwnSubmission}
                        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${
                          isOwnSubmission
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : row.likedByMe
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                        }`}
                      >
                        <Image
                          src={ICON_THUMB_UP}
                          alt="좋아요"
                          width={14}
                          height={14}
                          className={row.likedByMe ? "brightness-0 invert" : ""}
                        />
                        <span>{row.likeCount}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <CodeModal
        open={!!selectedSubmission}
        submission={selectedSubmission}
        onClose={() => {
          setSelectedSubmission(null);
          setSelectedSubmissionUserId(null);
        }}
        userId={selectedSubmissionUserId ?? undefined}
      />
    </section>
  );
}
